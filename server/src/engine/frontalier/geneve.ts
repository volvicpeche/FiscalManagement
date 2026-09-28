import Decimal from 'decimal.js';
import type { CalculICC, FrontalierRequest } from '@shared/frontalier.js';
import { DATE_LIMITE_TOU, FORFAIT_ENTRETIEN_AGE_SEUIL } from '../baremesFederaux.js';
import {
  ANNEE_BAREME_GE,
  CENTIMES_COMMUNAUX,
  ICC_ASSURANCE_MALADIE_ADULTE,
  ICC_ASSURANCE_MALADIE_ENFANT,
  ICC_ASSURANCE_MALADIE_JEUNE_ADULTE,
  ICC_ASSURANCE_VIE_COUPLE,
  ICC_ASSURANCE_VIE_PAR_CHARGE,
  ICC_ASSURANCE_VIE_PAR_CHARGE_UN_AFFILIE,
  ICC_ASSURANCE_VIE_SEUL,
  ICC_CENTIMES_CANTONAUX,
  ICC_CHARGE_FAMILLE,
  ICC_CHARGE_FAMILLE_AVEC_GARDE,
  ICC_DEPLACEMENT_MAX,
  ICC_DONS_PLAFOND,
  ICC_FORFAIT_ENTRETIEN_ANCIEN,
  ICC_FORFAIT_ENTRETIEN_RECENT,
  ICC_FORMATION_MAX,
  ICC_FRAIS_GARDE_MAX,
  ICC_FRAIS_MEDICAUX_FRANCHISE,
  ICC_FRAIS_PRO_MAX,
  ICC_FRAIS_PRO_MIN,
  ICC_FRAIS_PRO_TAUX,
  ICC_REDUCTION_LDIRPP,
  ICC_SPLITTING,
  ICC_TRANCHES,
} from '../baremesGeneve.js';
import { TARIF_SOURCE_GE } from '../tarifSource.js';
import type { ModuleCantonal } from './cantons.js';
import {
  REGLES_COMMUNES,
  ZERO,
  clamp,
  d,
  foyer,
  positive,
  salaireNet,
  sum,
  tauxDeterminant,
  type BienReq,
  type ReglesColonne,
} from './commun.js';
import { nbAffiliesPrevoyance } from './federal.js';

/** Geneva: ICC per the LIPP, communal tax levied by the commune of work. */

/**
 * The ICC maintenance forfait, for an owner-occupied home only (on its
 * valeur locative): a rented property deducts its effective costs.
 */
export function forfaitEntretienGe(b: BienReq): Decimal | null {
  if (b.usage === 'LOCATIF') return null;
  const recent = b.ageBatiment <= FORFAIT_ENTRETIEN_AGE_SEUIL;
  return d(b.valeurLocativeEur).mul(recent ? ICC_FORFAIT_ENTRETIEN_RECENT : ICC_FORFAIT_ENTRETIEN_ANCIEN);
}

export const REGLES_GE: ReglesColonne = {
  ...REGLES_COMMUNES,
  FRAIS_PRO: ({ f }) =>
    sum(
      f.suisses.map((m) => {
        const forfait = clamp(salaireNet(m).mul(ICC_FRAIS_PRO_TAUX), ICC_FRAIS_PRO_MIN, ICC_FRAIS_PRO_MAX);
        const effectifs = Decimal.min(d(m.fraisDeplacement), ICC_DEPLACEMENT_MAX).plus(m.autresFraisProfessionnels);
        return Decimal.max(forfait, effectifs);
      }),
    ),
  FORMATION: ({ f }) => sum(f.suisses.map((m) => Decimal.min(d(m.fraisFormation), ICC_FORMATION_MAX))),
  ASSURANCES: ({ f }) => {
    const affilies = nbAffiliesPrevoyance(f);
    const plafondMaladie = sum([
      ...f.membres.map(() => ICC_ASSURANCE_MALADIE_ADULTE),
      ...f.req.enfants.map((e) =>
        e.age < 19 ? ICC_ASSURANCE_MALADIE_ENFANT : e.age <= 25 ? ICC_ASSURANCE_MALADIE_JEUNE_ADULTE : ICC_ASSURANCE_MALADIE_ADULTE,
      ),
    ]);
    let base = f.marie ? ICC_ASSURANCE_VIE_COUPLE : ICC_ASSURANCE_VIE_SEUL;
    let parCharge = ICC_ASSURANCE_VIE_PAR_CHARGE;
    if (affilies === 0) {
      base = base.mul(2);
      parCharge = parCharge.mul(2);
    } else if (f.marie && affilies === 1) {
      base = base.mul(1.5);
      parCharge = ICC_ASSURANCE_VIE_PAR_CHARGE_UN_AFFILIE;
    }
    const plafondVie = base.plus(parCharge.mul(f.nbEnfants));
    return Decimal.min(d(f.req.deductions.primesAssuranceMaladie), plafondMaladie).plus(
      Decimal.min(d(f.req.deductions.primesAssuranceVie), plafondVie),
    );
  },
  FRAIS_GARDE: ({ f }) =>
    sum(f.req.enfants.filter((e) => e.age < 14).map((e) => Decimal.min(d(e.fraisGarde), ICC_FRAIS_GARDE_MAX))),
  // Geneva has no double-earner deduction: couples get the splitting instead.
  DOUBLE_REVENU: () => ZERO,
  FRAIS_MEDICAUX: ({ f, netAvant }) =>
    positive(d(f.req.deductions.fraisMedicaux).minus(positive(netAvant).mul(ICC_FRAIS_MEDICAUX_FRANCHISE))),
  DONS: ({ f, netAvant }) => Decimal.min(d(f.req.deductions.dons), positive(netAvant).mul(ICC_DONS_PLAFOND)),
  CHARGES_FAMILLE: ({ f }) =>
    sum(
      f.req.enfants.map((e) => (e.age < 14 && d(e.fraisGarde).gt(0) ? ICC_CHARGE_FAMILLE_AVEC_GARDE : ICC_CHARGE_FAMILLE)),
    ),
};

/** Geneva base tax, computed by tranche on the revenu determinant. */
export function impotBaseIcc(revenu: Decimal): Decimal {
  let impot = ZERO;
  let bas = ZERO;
  for (const { threshold, rate } of ICC_TRANCHES) {
    if (revenu.lte(bas)) break;
    impot = impot.plus(Decimal.min(revenu, threshold).minus(bas).mul(rate));
    bas = threshold;
  }
  return impot;
}

/** Base tax with splitting: the rate of half the income, applied to all of it. */
export function impotBaseIccSplitting(revenu: Decimal, splitting: boolean): Decimal {
  if (!splitting) return impotBaseIcc(revenu);
  return impotBaseIcc(revenu.mul(ICC_SPLITTING)).div(ICC_SPLITTING);
}

export function computeIccGe(req: FrontalierRequest, imposable: Decimal, etrangers: Decimal): CalculICC {
  const f = foyer(req);
  const splitting = f.marie || f.parentSeul;
  const { determinant, taux } = tauxDeterminant(imposable, etrangers, (r) => impotBaseIccSplitting(r, splitting));

  const impotBase = imposable.mul(taux);
  const cantonalBrut = impotBase.mul(ICC_CENTIMES_CANTONAUX.plus(1));
  const reduction = cantonalBrut.mul(ICC_REDUCTION_LDIRPP);
  const centimesCommunaux = CENTIMES_COMMUNAUX[req.communeTravail];
  const communal = impotBase.mul(centimesCommunaux);
  const total = cantonalBrut.minus(reduction).plus(communal).toDecimalPlaces(2);

  return {
    revenuImposable: imposable.toFixed(2),
    revenuDeterminantTaux: determinant.toFixed(2),
    tauxEffectif: imposable.isZero() ? 0 : total.div(imposable).toDecimalPlaces(4).toNumber(),
    impotBase: impotBase.toFixed(2),
    centimesCantonaux: impotBase.mul(ICC_CENTIMES_CANTONAUX).toFixed(2),
    reductionLdirpp: reduction.toFixed(2),
    impotCommunal: communal.toFixed(2),
    centimesCommunaux: centimesCommunaux.toNumber(),
    total: total.toFixed(2),
  };
}

export const MODULE_GE: ModuleCantonal = {
  canton: 'GE',
  disponible: true,
  nom: 'Geneve',
  annee: ANNEE_BAREME_GE,
  autorite: 'AFC-GE',
  dateLimite: DATE_LIMITE_TOU,
  regles: REGLES_GE,
  forfaitEntretien: forfaitEntretienGe,
  computeImpot: computeIccGe,
  tarifSource: TARIF_SOURCE_GE,
};
