import Decimal from 'decimal.js';

/**
 * Every dated figure of the frontalier module that does not depend on the
 * canton of work: the federal direct tax (IFD), the deductions harmonised by
 * the LHID, the quasi-resident threshold and the TOU deadline. The cantonal
 * figures live in one file per canton (baremesGeneve.ts, …).
 *
 * Sources, periode fiscale 2026 :
 * - IFD : lettre circulaire AFC 2-215-D-2025 du 11 septembre 2025 et son
 *   bareme 2026 (art. 36 LIFD).
 * - Pilier 3a : OPP 3. Quasi-resident : art. 14 OIS. Delai : art. 137 LIFD.
 *
 * Figures not read in one of those texts carry `@aVerifier`.
 */

/** Vintage the values below belong to. Bump it with the values, never alone. */
export const ANNEE_BAREME_FEDERAL = 2026;

// ─── IFD — bareme 2026 (art. 36 LIFD) ────────────────────────────────────────

/**
 * Bareme par paliers, tel que publie : a partir de `des`, l'impot vaut `base`
 * plus `par100` francs par tranche entiere de 100 francs au-dela.
 */
export interface PalierIFD {
  des: Decimal;
  base: Decimal;
  par100: Decimal;
}

const p = (des: string, base: string, par100: string): PalierIFD => ({
  des: new Decimal(des),
  base: new Decimal(base),
  par100: new Decimal(par100),
});

export const IFD_BAREME_SEUL: PalierIFD[] = [
  p('0', '0', '0'),
  p('15200', '0', '0.77'),
  p('33200', '138.60', '0.88'),
  p('43500', '229.20', '2.64'),
  p('58000', '612.00', '2.97'),
  p('76200', '1152.50', '5.94'),
  p('82100', '1502.95', '6.60'),
  p('108900', '3271.75', '8.80'),
  p('141500', '6140.55', '11.00'),
  p('185100', '10936.55', '13.20'),
  p('794000', '91310.00', '11.50'),
];

export const IFD_BAREME_MARIES: PalierIFD[] = [
  p('0', '0', '0'),
  p('29700', '0', '1.00'),
  p('53400', '237.00', '2.00'),
  p('61300', '395.00', '3.00'),
  p('79100', '929.00', '4.00'),
  p('94900', '1561.00', '5.00'),
  p('108700', '2251.00', '6.00'),
  p('120600', '2965.00', '7.00'),
  p('130500', '3658.00', '8.00'),
  p('138400', '4290.00', '9.00'),
  p('144300', '4821.00', '10.00'),
  p('148300', '5221.00', '11.00'),
  p('150400', '5452.00', '12.00'),
  p('152400', '5692.00', '13.00'),
  p('941400', '108261.00', '11.50'),
];

/** Reduction du montant de l'impot par enfant (bareme parental, art. 36 al. 2bis). */
export const IFD_REDUCTION_PAR_ENFANT = new Decimal('263');
/** Un impot inferieur a 25 francs n'est pas percu (art. 36 al. 3). */
export const IFD_MINIMUM_PERCU = new Decimal('25');

// ─── IFD — deductions 2026 ───────────────────────────────────────────────────

export const IFD_FRAIS_PRO_TAUX = new Decimal('0.03');
export const IFD_FRAIS_PRO_MIN = new Decimal('2000');
export const IFD_FRAIS_PRO_MAX = new Decimal('4000');
export const IFD_DEPLACEMENT_MAX = new Decimal('3300');
export const IFD_REPAS_COMPLET = new Decimal('3200');
export const IFD_REPAS_CANTINE = new Decimal('1600');

/** Primes d'assurances et interets d'epargne, tout confondu (art. 33 al. 1 let. g). */
export const IFD_ASSURANCES_MARIES = new Decimal('3700');
export const IFD_ASSURANCES_MARIES_SANS_PREVOYANCE = new Decimal('5550');
export const IFD_ASSURANCES_SEUL = new Decimal('1800');
export const IFD_ASSURANCES_SEUL_SANS_PREVOYANCE = new Decimal('2700');
export const IFD_ASSURANCES_PAR_ENFANT = new Decimal('700');

/** Frais medicaux deductibles au-dela de 5 % du revenu net (art. 33 al. 1 let. h). */
export const IFD_FRAIS_MEDICAUX_FRANCHISE = new Decimal('0.05');
export const IFD_FORMATION_MAX = new Decimal('13000');
export const IFD_FRAIS_GARDE_MAX = new Decimal('25800');
/** Dons : 20 % du revenu net, et au moins 100 francs dans l'annee (art. 33a). */
export const IFD_DONS_PLAFOND = new Decimal('0.20');
export const IFD_DONS_MINIMUM = new Decimal('100');

/** Deduction double revenu : 50 % du revenu le plus bas, entre 8 600 et 14 100 (art. 33 al. 2). */
export const IFD_DOUBLE_REVENU_TAUX = new Decimal('0.5');
export const IFD_DOUBLE_REVENU_MIN = new Decimal('8600');
export const IFD_DOUBLE_REVENU_MAX = new Decimal('14100');

export const IFD_DEDUCTION_ENFANT = new Decimal('6800');
export const IFD_DEDUCTION_MARIES = new Decimal('2800');

// ─── Communs a tous les cantons (harmonises par la LHID) ─────────────────────

/** Pilier 3a 2026 (OPP 3) : avec caisse de pension, et sans (20 % du revenu, plafonne). */
export const PILIER_3A_AVEC_LPP = new Decimal('7258');
export const PILIER_3A_SANS_LPP = new Decimal('36288');
export const PILIER_3A_SANS_LPP_TAUX = new Decimal('0.20');

/** Interets passifs : limites au rendement de la fortune plus 50 000 (art. 33 al. 1 let. a LIFD). */
export const INTERETS_PASSIFS_FRANCHISE = new Decimal('50000');

// ─── Biens immobiliers (art. 32 LIFD) ────────────────────────────────────────

/**
 * A l'IFD, le forfait vaut pour tout immeuble prive, loue ou non, en part du
 * rendement brut (loyers ou valeur locative) : ordonnance du DFF sur les
 * frais relatifs aux immeubles prives, art. 5.
 */
export const IFD_FORFAIT_ENTRETIEN_RECENT = new Decimal('0.10');
export const IFD_FORFAIT_ENTRETIEN_ANCIEN = new Decimal('0.20');
/** Un batiment de 10 ans au plus au debut de la periode est « recent » (IFD ; Geneve applique le meme seuil). */
export const FORFAIT_ENTRETIEN_AGE_SEUIL = 10;

// ─── Quasi-resident ──────────────────────────────────────────────────────────

/** Part minimale des revenus bruts mondiaux du foyer imposable en Suisse (art. 14 al. 1 OIS). */
export const SEUIL_QUASI_RESIDENT = new Decimal('0.9');

/** Delai de la demande de TOU : 31 mars de l'annee suivante (art. 137 LIFD). */
export const DATE_LIMITE_TOU = '2027-03-31';

/** @aVerifier Cours moyen EUR/CHF 2026, a remplacer par le cours AFC de fin d'annee. */
export const TAUX_CHANGE_EUR_CHF_DEFAUT = '0.9300';
