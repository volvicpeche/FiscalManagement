import Decimal from 'decimal.js';
import type { PointRachat, PrevoyanceRequest, PrevoyanceResult } from '@shared/frontalier.js';
import { d, plafond3a, positive } from './commun.js';
import { simulateFrontalier } from './simulation.js';

/**
 * 3e pilier and LPP buy-back for a frontalier: what each saves, and whether
 * they tip the TOU. Only through the TOU: the source tax ignores both, so a
 * frontalier who stays at source deducts nothing (since 2021, the TOU is the
 * only way for a non-resident to claim them).
 *
 * Everything goes through simulateFrontalier: the same household, the
 * payments switched on one after the other.
 */

/** Steps of the buy-back curve (about as many points, 0 included). */
const PAS_COURBE = 10;
/** Curve range when the user gives neither a buy-back nor a potential. */
const COURBE_DEFAUT = new Decimal(50000);

type Requete = PrevoyanceRequest['requete'];

function avecVersements(req: Requete, personne: PrevoyanceRequest['personne'], pilier3a: Decimal, rachat: Decimal): Requete {
  const p = req[personne];
  if (!p) return req;
  return { ...req, [personne]: { ...p, pilier3a: pilier3a.toFixed(2), lppRachats: rachat.toFixed(2) } };
}

const tou = (req: Requete) => d(simulateFrontalier(req).totalTou);

/** Saving per franc, 0 when nothing was paid. */
const taux = (economie: Decimal, montant: Decimal) => (montant.gt(0) ? economie.div(montant).toNumber() : 0);

/** Round a curve step to a readable amount: 100, 500, 1 000, 5 000... */
function pasLisible(brut: Decimal): Decimal {
  for (const p of [100, 500, 1000, 2000, 5000, 10000, 20000, 50000]) {
    if (brut.lte(p)) return new Decimal(p);
  }
  return brut.div(10000).ceil().mul(10000);
}

export function simulerPrevoyance(r: PrevoyanceRequest): PrevoyanceResult {
  const personne = r.requete[r.personne];
  if (!personne) throw new Error('Personne absente du foyer');
  if (personne.activite !== 'SUISSE') throw new Error('Le 3e pilier et le rachat LPP se deduisent d’un salaire suisse');

  const plafond = plafond3a(personne);
  const pilier3a = Decimal.min(d(r.pilier3a), plafond);
  const potentiel = r.potentielRachat !== undefined ? d(r.potentielRachat) : null;
  const rachat = potentiel ? Decimal.min(d(r.rachatLpp), potentiel) : d(r.rachatLpp);

  const base = avecVersements(r.requete, r.personne, new Decimal(0), new Decimal(0));
  const sansResultat = simulateFrontalier(base);
  const touSans = d(sansResultat.totalTou);
  const touAvec3a = tou(avecVersements(r.requete, r.personne, pilier3a, new Decimal(0)));
  const touAvecTout = tou(avecVersements(r.requete, r.personne, pilier3a, rachat));

  const isRetenu = d(sansResultat.totalIsRetenu);
  const impotSource = isRetenu.isZero() ? d(sansResultat.totalIsTheorique) : isRetenu;

  const economie3a = positive(touSans.minus(touAvec3a));
  const economieRachat = positive(touAvec3a.minus(touAvecTout));

  // The curve: the buy-back in even steps, on top of the 3a payment.
  const fin = potentiel && potentiel.gt(0) ? potentiel : rachat.gt(0) ? rachat.mul(2) : COURBE_DEFAUT;
  const pas = pasLisible(fin.div(PAS_COURBE));
  const montants: Decimal[] = [];
  for (let m = new Decimal(0); m.lt(fin); m = m.plus(pas)) montants.push(m);
  montants.push(fin);

  const courbe: PointRachat[] = [];
  let precedent = { rachat: new Decimal(0), tou: touAvec3a };
  for (const m of montants) {
    const t = m.isZero() ? touAvec3a : tou(avecVersements(r.requete, r.personne, pilier3a, m));
    const tranche = m.minus(precedent.rachat);
    courbe.push({
      rachat: m.toFixed(2),
      economie: positive(touAvec3a.minus(t)).toFixed(2),
      tauxMarginal: tranche.gt(0) ? positive(precedent.tou.minus(t)).div(tranche).toNumber() : 0,
    });
    precedent = { rachat: m, tou: t };
  }

  return {
    annee: sansResultat.annee,
    eligibleTou: sansResultat.test90.eligible,
    plafond3a: plafond.toFixed(2),
    pilier3aDeductible: pilier3a.toFixed(2),
    rachatDeductible: rachat.toFixed(2),
    touSans: touSans.toFixed(2),
    touAvec3a: touAvec3a.toFixed(2),
    touAvecTout: touAvecTout.toFixed(2),
    economie3a: economie3a.toFixed(2),
    economieRachat: economieRachat.toFixed(2),
    economieTotale: economie3a.plus(economieRachat).toFixed(2),
    taux3a: taux(economie3a, pilier3a),
    tauxRachat: taux(economieRachat, rachat),
    impotSource: impotSource.toFixed(2),
    gainTouSans: impotSource.minus(touSans).toFixed(2),
    gainTouAvec: impotSource.minus(touAvecTout).toFixed(2),
    courbe,
    avertissements: avertissements(r, sansResultat.test90.eligible, plafond, potentiel, impotSource, touSans, touAvecTout),
  };
}

function avertissements(
  r: PrevoyanceRequest,
  eligible: boolean,
  plafond: Decimal,
  potentiel: Decimal | null,
  impotSource: Decimal,
  touSans: Decimal,
  touAvec: Decimal,
): string[] {
  const out: string[] = [];
  const chf = (x: Decimal) => `${x.toFixed(0)} CHF`;

  if (!eligible) {
    out.push(
      'Le foyer n’atteint pas 90 % de revenus imposables en Suisse : la TOU est fermee. A l’impot a la source, ni le 3e pilier ni le rachat LPP ne reduisent l’impot.',
    );
  }
  if (d(r.pilier3a).gt(plafond)) {
    out.push(`Le versement 3a depasse le plafond 2026 (${chf(plafond)}) : l’excedent n’est pas deductible.`);
  }
  if (potentiel && d(r.rachatLpp).gt(potentiel)) {
    out.push(`Le rachat depasse le potentiel de rachat (${chf(potentiel)}) : seule cette part est deductible.`);
  }
  if (d(r.rachatLpp).gt(0)) {
    out.push(
      'Apres un rachat, les prestations qui en resultent ne peuvent pas etre retirees en capital pendant 3 ans (art. 79b al. 3 LPP), retrait pour le logement compris : sinon la deduction est reprise.',
    );
  }
  if (eligible && impotSource.minus(touSans).lte(0) && impotSource.minus(touAvec).gt(0)) {
    out.push('Sans ces versements, l’impot a la source est plus avantageux ; avec eux, la TOU le devient : c’est elle qu’il faut demander.');
  } else if (eligible && impotSource.minus(touAvec).lte(0)) {
    out.push('Meme avec ces versements, la TOU coute plus que l’impot a la source : rester a la source, ou verser davantage.');
  }
  out.push('Economies calculees sur la TOU de l’annee (ICC + IFD), le reste du foyer inchange. L’impot au retrait du capital (taux reduit, a part) n’est pas compte.');
  return out;
}
