import Decimal from 'decimal.js';
import type { CalculImpot, FrontalierRequest } from '@shared/frontalier.js';
import {
  FORFAIT_ENTRETIEN_AGE_SEUIL,
  IFD_ASSURANCES_MARIES,
  IFD_ASSURANCES_MARIES_SANS_PREVOYANCE,
  IFD_ASSURANCES_PAR_ENFANT,
  IFD_ASSURANCES_SEUL,
  IFD_ASSURANCES_SEUL_SANS_PREVOYANCE,
  IFD_BAREME_MARIES,
  IFD_BAREME_SEUL,
  IFD_DEDUCTION_ENFANT,
  IFD_DEDUCTION_MARIES,
  IFD_DEPLACEMENT_MAX,
  IFD_DONS_MINIMUM,
  IFD_DONS_PLAFOND,
  IFD_DOUBLE_REVENU_MAX,
  IFD_DOUBLE_REVENU_MIN,
  IFD_DOUBLE_REVENU_TAUX,
  IFD_FORFAIT_ENTRETIEN_ANCIEN,
  IFD_FORFAIT_ENTRETIEN_RECENT,
  IFD_FORMATION_MAX,
  IFD_FRAIS_GARDE_MAX,
  IFD_FRAIS_MEDICAUX_FRANCHISE,
  IFD_FRAIS_PRO_MAX,
  IFD_FRAIS_PRO_MIN,
  IFD_FRAIS_PRO_TAUX,
  IFD_MINIMUM_PERCU,
  IFD_REDUCTION_PAR_ENFANT,
  IFD_REPAS_CANTINE,
  IFD_REPAS_COMPLET,
  type PalierIFD,
} from '../baremesFederaux.js';
import {
  REGLES_COMMUNES,
  ZERO,
  clamp,
  d,
  foyer,
  positive,
  produitsBien,
  salaireNet,
  sum,
  tauxDeterminant,
  type BienReq,
  type Foyer,
  type ReglesColonne,
} from './commun.js';

/** Impot federal direct: the same in every canton. */

/** The IFD maintenance forfait, on the produits of any private building. */
export function forfaitEntretienIfd(b: BienReq): Decimal {
  const recent = b.ageBatiment <= FORFAIT_ENTRETIEN_AGE_SEUIL;
  return produitsBien(b).mul(recent ? IFD_FORFAIT_ENTRETIEN_RECENT : IFD_FORFAIT_ENTRETIEN_ANCIEN);
}

/**
 * Affiliated to a pension scheme (LPP or 3a): the IFD insurance ceiling, and
 * several cantonal ones, are lower for them.
 */
export function nbAffiliesPrevoyance(f: Foyer): number {
  return f.membres.filter((m) => m.affilieLpp || d(m.pilier3a).gt(0)).length;
}

/**
 * Double revenu: the law looks at each spouse's earned income wherever it is
 * earned — a spouse working in France opens the right too. The lower of the
 * two, or zero for a single earner.
 */
export function revenuActiviteLePlusBas(f: Foyer): Decimal {
  if (!f.marie || f.membres.length !== 2) return ZERO;
  const revenus = f.membres.map((m) =>
    m.activite === 'SUISSE' ? salaireNet(m) : m.activite === 'FRANCE' ? d(m.revenuFranceNetEur).mul(f.fx) : ZERO,
  );
  return Decimal.min(revenus[0], revenus[1]);
}

export const REGLES_IFD: ReglesColonne = {
  ...REGLES_COMMUNES,
  FRAIS_PRO: ({ f }) =>
    sum(
      f.suisses.map((m) => {
        const forfait = clamp(salaireNet(m).mul(IFD_FRAIS_PRO_TAUX), IFD_FRAIS_PRO_MIN, IFD_FRAIS_PRO_MAX);
        const repas = m.repas === 'COMPLET' ? IFD_REPAS_COMPLET : m.repas === 'CANTINE' ? IFD_REPAS_CANTINE : ZERO;
        return Decimal.min(d(m.fraisDeplacement), IFD_DEPLACEMENT_MAX)
          .plus(repas)
          .plus(Decimal.max(forfait, d(m.autresFraisProfessionnels)));
      }),
    ),
  FORMATION: ({ f }) => sum(f.suisses.map((m) => Decimal.min(d(m.fraisFormation), IFD_FORMATION_MAX))),
  ASSURANCES: ({ f }) => {
    const affilies = nbAffiliesPrevoyance(f);
    const plafond = (f.marie
      ? affilies > 0 ? IFD_ASSURANCES_MARIES : IFD_ASSURANCES_MARIES_SANS_PREVOYANCE
      : affilies > 0 ? IFD_ASSURANCES_SEUL : IFD_ASSURANCES_SEUL_SANS_PREVOYANCE
    ).plus(IFD_ASSURANCES_PAR_ENFANT.mul(f.nbEnfants));
    const primes = d(f.req.deductions.primesAssuranceMaladie).plus(f.req.deductions.primesAssuranceVie);
    return Decimal.min(primes, plafond);
  },
  FRAIS_GARDE: ({ f }) =>
    sum(f.req.enfants.filter((e) => e.age < 14).map((e) => Decimal.min(d(e.fraisGarde), IFD_FRAIS_GARDE_MAX))),
  DOUBLE_REVENU: ({ f }) => {
    const bas = revenuActiviteLePlusBas(f);
    if (bas.lte(0)) return ZERO;
    return bas.lt(IFD_DOUBLE_REVENU_MIN)
      ? bas
      : clamp(bas.mul(IFD_DOUBLE_REVENU_TAUX), IFD_DOUBLE_REVENU_MIN, IFD_DOUBLE_REVENU_MAX);
  },
  FRAIS_MEDICAUX: ({ f, netAvant }) =>
    positive(d(f.req.deductions.fraisMedicaux).minus(positive(netAvant).mul(IFD_FRAIS_MEDICAUX_FRANCHISE))),
  DONS: ({ f, netAvant }) => {
    const dons = d(f.req.deductions.dons);
    return dons.gte(IFD_DONS_MINIMUM) ? Decimal.min(dons, positive(netAvant).mul(IFD_DONS_PLAFOND)) : ZERO;
  },
  CHARGES_FAMILLE: ({ f }) => IFD_DEDUCTION_ENFANT.mul(f.nbEnfants).plus(f.marie ? IFD_DEDUCTION_MARIES : ZERO),
};

/**
 * Federal tax per the published table, fractions under CHF 100 dropped. The
 * floor to 5 ct applies to the tax finally due, not here: the AFC table
 * itself lists unrounded amounts (137.06 at CHF 33 000).
 */
export function impotIfdBareme(revenu: Decimal, bareme: PalierIFD[]): Decimal {
  const r = revenu.div(100).floor().mul(100);
  let palier = bareme[0];
  for (const p of bareme) if (r.gte(p.des)) palier = p;
  return palier.base.plus(r.minus(palier.des).div(100).floor().mul(palier.par100));
}

export function computeIfd(req: FrontalierRequest, imposable: Decimal, etrangers: Decimal): CalculImpot {
  const f = foyer(req);
  const bareme = f.marie || f.parentSeul ? IFD_BAREME_MARIES : IFD_BAREME_SEUL;
  const reductionEnfants = IFD_REDUCTION_PAR_ENFANT.mul(f.nbEnfants);
  const impotSur = (r: Decimal) => positive(impotIfdBareme(r, bareme).minus(reductionEnfants));
  const { determinant, taux } = tauxDeterminant(imposable, etrangers, impotSur);

  let total = imposable.mul(taux).mul(20).floor().div(20);
  if (total.lt(IFD_MINIMUM_PERCU)) total = ZERO;

  return {
    revenuImposable: imposable.toFixed(2),
    revenuDeterminantTaux: determinant.toFixed(2),
    tauxEffectif: imposable.isZero() ? 0 : total.div(imposable).toDecimalPlaces(4).toNumber(),
    total: total.toFixed(2),
  };
}
