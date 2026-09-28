import Decimal from 'decimal.js';
import type {
  DetailBienFrance,
  FrontalierRequest,
  FrontalierResult,
  ImpactDeduction,
  ImpotSourcePersonne,
  LigneDeduction,
  MesureBien,
  Test90Result,
} from '@shared/frontalier.js';
import { INTERETS_PASSIFS_FRANCHISE } from '../baremesFederaux.js';
import { codeTarifConnu, impotSourceAnnuel } from '../tarifSource.js';
import { moduleCantonal, type ModuleCantonal } from './cantons.js';
import {
  DEDUCTIONS,
  ORDRE_DEDUCTIONS,
  d,
  foyer,
  mesurerBienAvecForfait,
  plafond3a,
  positive,
  produitsBien,
  revenusEtrangersNets,
  sum,
  computeTest90,
  type BienReq,
  type CodeDeduction,
  type Foyer,
  type MesureBienDec,
  type ReglesColonne,
} from './commun.js';
import { REGLES_IFD, computeIfd, forfaitEntretienIfd } from './federal.js';

/**
 * TOU of a quasi-resident frontalier compared with the source tax, for the
 * canton of work: the shared computation, the canton plugging in its own
 * deductions, tax and tariff (cantons.ts).
 */

/** Not a deduction from Swiss income, but it lowers the rate: the costs of the French properties. */
const CHARGES_BIENS_FRANCE = 'CHARGES_BIENS_FRANCE';
type CodeImpact = CodeDeduction | typeof CHARGES_BIENS_FRANCE;

/** The cantonal column is still called `icc` in the result: impot cantonal et communal. */
type Colonne = 'icc' | 'ifd';

function mesureur(canton: ModuleCantonal, colonne: Colonne): (b: BienReq) => MesureBienDec {
  return colonne === 'ifd'
    ? (b) => mesurerBienAvecForfait(b, forfaitEntretienIfd(b))
    : (b) => mesurerBienAvecForfait(b, canton.forfaitEntretien(b));
}

/** Net income of a French property for the cantonal tax (`icc`) or the IFD, in EUR. */
export function mesurerBien(b: BienReq, colonne: Colonne, canton: ModuleCantonal = moduleCantonal('GE')): MesureBienDec {
  return mesureur(canton, colonne)(b);
}

export function detailBiens(req: FrontalierRequest): DetailBienFrance[] {
  const canton = moduleCantonal(req.canton);
  const fx = d(req.tauxChangeEurChf);
  const chf = (x: Decimal) => x.mul(fx).toFixed(2);
  const mesure = (m: MesureBienDec): MesureBien => ({
    fraisEntretien: chf(m.fraisEntretien),
    methode: m.methode,
    forfait: m.forfait ? chf(m.forfait) : null,
    energieReportable: chf(m.energieReportable),
    net: chf(m.net),
  });
  return req.biensFrance.map((b) => ({
    label: b.label,
    usage: b.usage,
    produits: chf(produitsBien(b)),
    autresCharges: chf(d(b.taxeFonciereEur).plus(b.interetsEmpruntEur)),
    plusValueNonDeduite: chf(d(b.travauxPlusValueEur)),
    icc: mesure(mesurerBien(b, 'icc', canton)),
    ifd: mesure(mesurerBien(b, 'ifd', canton)),
  }));
}

// ─── Deductions ──────────────────────────────────────────────────────────────

interface Ligne {
  code: CodeDeduction;
  icc: Decimal;
  ifd: Decimal;
}

interface Assiettes {
  lignes: Ligne[];
  revenuBrut: Decimal;
  imposableIcc: Decimal;
  imposableIfd: Decimal;
}

/**
 * Swiss taxable income for the cantonal tax and the IFD. A quasi-resident
 * gets every deduction in full, exactly like a resident — that is the whole
 * point of the status. Deductions are taken in the order of the return, each
 * column keeping its own running net (medical costs and gifts are capped on
 * the net before them). `exclure` drops one deduction, to measure what it is
 * worth.
 */
export function computeAssiettes(req: FrontalierRequest, exclure?: CodeDeduction): Assiettes {
  const f = foyer(req);
  const canton = moduleCantonal(req.canton);
  const colonnes: Record<Colonne, ReglesColonne> = { icc: canton.regles, ifd: REGLES_IFD };

  const revenuBrut = sum(f.suisses.map((m) => d(m.salaireBrut)));
  const net = { icc: revenuBrut, ifd: revenuBrut };
  const lignes: Ligne[] = [];

  for (const code of ORDRE_DEDUCTIONS) {
    if (code === exclure) continue;
    const montant = (k: Colonne) => colonnes[k][code]({ f, revenuBrut, netAvant: net[k] });
    const ligne = { code, icc: montant('icc'), ifd: montant('ifd') };
    net.icc = net.icc.minus(ligne.icc);
    net.ifd = net.ifd.minus(ligne.ifd);
    if (!ligne.icc.isZero() || !ligne.ifd.isZero()) lignes.push(ligne);
  }

  return { lignes, revenuBrut, imposableIcc: positive(net.icc), imposableIfd: positive(net.ifd) };
}

function totalTou(req: FrontalierRequest, exclure?: CodeImpact): Decimal {
  const canton = moduleCantonal(req.canton);
  const assiettes = computeAssiettes(req, exclure === CHARGES_BIENS_FRANCE ? undefined : exclure);
  const f = foyer(req);
  const avecCharges = exclure !== CHARGES_BIENS_FRANCE;
  const icc = canton.computeImpot(req, assiettes.imposableIcc, revenusEtrangersNets(f, mesureur(canton, 'icc'), avecCharges));
  const ifd = computeIfd(req, assiettes.imposableIfd, revenusEtrangersNets(f, mesureur(canton, 'ifd'), avecCharges));
  return d(icc.total).plus(ifd.total);
}

// ─── Impot a la source ───────────────────────────────────────────────────────

/** Code a household would normally be withheld under, when the user gives none. */
export function codeTarifParDefaut(req: FrontalierRequest): string {
  const enfants = Math.min(req.enfants.length, 5);
  if (req.etatCivil === 'CELIBATAIRE') return enfants > 0 ? `H${enfants}` : 'A0';
  const conjointActif =
    req.conjoint &&
    (req.conjoint.activite === 'SUISSE' ||
      (req.conjoint.activite === 'FRANCE' && d(req.conjoint.revenuFranceBrutEur).gt(0)));
  return `${conjointActif ? 'C' : 'B'}${enfants}`;
}

export function computeImpotSource(req: FrontalierRequest): ImpotSourcePersonne[] {
  const table = moduleCantonal(req.canton).tarifSource;
  return foyer(req).suisses.map((m) => {
    const code = m.codeTarifIS && codeTarifConnu(m.codeTarifIS, table) ? m.codeTarifIS : codeTarifParDefaut(req);
    const { taux, impot } = impotSourceAnnuel(code, d(m.salaireBrut), table);
    return {
      prenom: m.prenom,
      codeTarif: code,
      salaireBrut: d(m.salaireBrut).toFixed(2),
      tauxBareme: taux.toNumber(),
      impotTheorique: impot.toFixed(2),
      impotRetenu: d(m.impotSourceRetenu).toFixed(2),
    };
  });
}

// ─── Simulation ──────────────────────────────────────────────────────────────

/** Throws CantonIndisponibleError for a canton whose figures are not in the engine yet. */
export function simulateFrontalier(req: FrontalierRequest): FrontalierResult {
  const canton = moduleCantonal(req.canton);
  const f = foyer(req);
  const test90 = computeTest90(req);
  const assiettes = computeAssiettes(req);
  const icc = canton.computeImpot(req, assiettes.imposableIcc, revenusEtrangersNets(f, mesureur(canton, 'icc')));
  const ifd = computeIfd(req, assiettes.imposableIfd, revenusEtrangersNets(f, mesureur(canton, 'ifd')));
  const tou = d(icc.total).plus(ifd.total);

  const impotSource = computeImpotSource(req);
  const isRetenu = sum(impotSource.map((p) => d(p.impotRetenu)));
  const isTheorique = sum(impotSource.map((p) => d(p.impotTheorique)));
  // Without the actual withholding, compare against the tariff instead of zero.
  const reference = isRetenu.isZero() ? isTheorique : isRetenu;

  const deductions: LigneDeduction[] = assiettes.lignes.map((l) => ({
    code: l.code,
    libelle: DEDUCTIONS[l.code],
    icc: l.icc.toFixed(2),
    ifd: l.ifd.toFixed(2),
  }));

  const impacts: ImpactDeduction[] = assiettes.lignes
    .map((l): ImpactDeduction => ({
      code: l.code,
      libelle: DEDUCTIONS[l.code],
      montant: Decimal.max(l.icc, l.ifd).toFixed(2),
      economie: totalTou(req, l.code).minus(tou).toFixed(2),
    }))
    .concat(chargesBiensImpact(req, canton, tou))
    .filter((i) => d(i.economie).gt(0))
    .sort((a, b) => d(b.economie).comparedTo(d(a.economie)));

  return {
    annee: canton.annee,
    canton: canton.canton,
    nomCanton: canton.nom,
    autorite: canton.autorite,
    test90,
    deductions,
    icc,
    ifd,
    totalTou: tou.toFixed(2),
    impotSource,
    totalIsRetenu: isRetenu.toFixed(2),
    totalIsTheorique: isTheorique.toFixed(2),
    gainTou: reference.minus(tou).toFixed(2),
    impacts,
    biensFrance: detailBiens(req),
    dateLimite: canton.dateLimite,
    avertissements: avertissements(req, canton, f, test90, impotSource),
  };
}

function chargesBiensImpact(req: FrontalierRequest, canton: ModuleCantonal, tou: Decimal): ImpactDeduction[] {
  if (req.biensFrance.length === 0) return [];
  const f = foyer(req);
  const mesurer = mesureur(canton, 'icc');
  const charges = revenusEtrangersNets(f, mesurer, false).minus(revenusEtrangersNets(f, mesurer, true));
  if (charges.lte(0)) return [];
  return [
    {
      code: CHARGES_BIENS_FRANCE,
      libelle: 'Charges et travaux des biens en France (taux)',
      montant: charges.toFixed(2),
      economie: totalTou(req, CHARGES_BIENS_FRANCE).minus(tou).toFixed(2),
    },
  ];
}

/** « 31 mars 2027 », from an ISO date. */
function dateEnClair(iso: string): string {
  const mois = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
  const [a, m, j] = iso.split('-').map(Number);
  return `${j} ${mois[m - 1]} ${a}`;
}

function avertissements(
  req: FrontalierRequest,
  canton: ModuleCantonal,
  f: Foyer,
  test90: Test90Result,
  impotSource: ImpotSourcePersonne[],
): string[] {
  const out: string[] = [];
  const pct = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} %`;

  if (!test90.eligible) {
    out.push(
      `Seuls ${pct(test90.ratio)} des revenus bruts mondiaux du foyer sont imposables en Suisse : le seuil de 90 % n'est pas atteint, la TOU de quasi-resident n'est pas ouverte. Le calcul ci-dessous est indicatif.`,
    );
  } else if (test90.ratio < 0.92) {
    out.push(
      `Le test des 90 % passe de justesse (${pct(test90.ratio)}) : une variation de change ou un revenu francais oublie peut le faire echouer.`,
    );
  }

  if (req.etatCivil === 'CELIBATAIRE' && req.conjoint) {
    out.push(
      "Le conjoint saisi est ignore : un couple non marie (PACS compris) est impose comme deux celibataires, chacun avec sa propre demande.",
    );
  }

  for (const m of f.suisses) {
    const nom = m.prenom || 'le contribuable';
    if (d(m.pilier3a).gt(plafond3a(m))) {
      out.push(`Le versement 3a de ${nom} depasse le plafond 2026 (${plafond3a(m).toFixed(0)} CHF) : l'excedent n'est pas deductible.`);
    }
  }

  const plafondInterets = d(req.deductions.rendementFortune).plus(INTERETS_PASSIFS_FRANCHISE);
  if (d(req.deductions.interetsPassifs).gt(plafondInterets)) {
    out.push(`Les interets passifs sont limites au rendement de la fortune plus 50 000 CHF (${plafondInterets.toFixed(0)} CHF).`);
  }

  for (const p of impotSource) {
    const retenu = d(p.impotRetenu);
    const theorique = d(p.impotTheorique);
    if (retenu.gt(0) && theorique.gt(0) && retenu.minus(theorique).abs().div(theorique).gt(0.05)) {
      out.push(
        `L'impot retenu pour ${p.prenom || 'le contribuable'} s'ecarte de plus de 5 % du bareme ${p.codeTarif} : verifiez le code bareme, un 13e salaire ou un bonus verse en une fois.`,
      );
    }
    if (retenu.isZero()) {
      out.push(`Aucun impot retenu saisi pour ${p.prenom || 'le contribuable'} : la comparaison utilise le bareme ${p.codeTarif}.`);
    }
  }

  for (const b of detailBiens(req)) {
    const nom = b.label || 'un bien en France';
    if (d(b.plusValueNonDeduite).gt(0)) {
      out.push(
        `La part plus-value des travaux de ${nom} (${d(b.plusValueNonDeduite).toFixed(0)} CHF) n'est pas deductible : seuls l'entretien, la remise en etat a l'identique et les economies d'energie le sont.`,
      );
    }
    if (d(b.icc.energieReportable).gt(0)) {
      out.push(
        `Les travaux d'economie d'energie de ${nom} depassent son revenu de l'annee : ${d(b.icc.energieReportable).toFixed(0)} CHF sont reportables sur les deux annees suivantes.`,
      );
    }
    if (b.icc.methode === 'FORFAIT' || b.ifd.methode === 'FORFAIT') {
      out.push(
        `Pour ${nom}, le forfait d'entretien depasse les frais reels${b.icc.methode === 'FORFAIT' ? '' : ' a l\'IFD'} : il est retenu a leur place, et les travaux de l'annee ne comptent plus.`,
      );
    }
  }

  out.push(
    `La demande de TOU doit parvenir a l'${canton.autorite} au plus tard le ${dateEnClair(canton.dateLimite)}. Une fois la taxation notifiee, elle remplace l'impot a la source de l'annee et ne peut plus etre retiree.`,
  );
  out.push("L'impot sur la fortune n'est pas calcule : un frontalier sans bien en Suisse n'y est pas soumis.");

  return out;
}
