import Decimal from 'decimal.js';
import type { CommuneGe } from '@shared/frontalier.js';

/**
 * Every dated figure of the Geneva frontalier module, in one place.
 *
 * Kept apart from baremes.ts on purpose: it is another jurisdiction on
 * another vintage (French figures there are 2024, Swiss ones here are 2026),
 * and bumping one must never silently move the other.
 *
 * Sources, periode fiscale 2026 :
 * - ICC : RCEPF (rsGE D 3 08.05) du 8 octobre 2025, art. 6 a 17 ; LIPP ;
 *   LCACant art. 2 ; LDIRPP art. 1 ; ArCA-2026 du 18 mars 2026.
 * - IFD : lettre circulaire AFC 2-215-D-2025 du 11 septembre 2025 et son
 *   bareme 2026 (art. 36 LIFD).
 * - IS : fichier AFC tar26ge.txt (voir tarifs/tarifSourceGe2026.ts).
 *
 * Figures not read in one of those texts carry `@aVerifier`.
 */

/** Vintage the values below belong to. Bump it with the values, never alone. */
export const ANNEE_BAREME_GE = 2026;

// ─── ICC — bareme de l'impot de base (art. 41 LIPP, art. 17 RCEPF) ───────────

/** Tranches : `threshold` est la borne superieure de la tranche. */
export const ICC_TRANCHES: { threshold: Decimal; rate: Decimal }[] = [
  { threshold: new Decimal('18700'), rate: new Decimal('0') },
  { threshold: new Decimal('22530'), rate: new Decimal('0.073') },
  { threshold: new Decimal('24784'), rate: new Decimal('0.082') },
  { threshold: new Decimal('27036'), rate: new Decimal('0.091') },
  { threshold: new Decimal('29290'), rate: new Decimal('0.100') },
  { threshold: new Decimal('34922'), rate: new Decimal('0.109') },
  { threshold: new Decimal('39428'), rate: new Decimal('0.113') },
  { threshold: new Decimal('43935'), rate: new Decimal('0.123') },
  { threshold: new Decimal('48441'), rate: new Decimal('0.128') },
  { threshold: new Decimal('77730'), rate: new Decimal('0.132') },
  { threshold: new Decimal('127297'), rate: new Decimal('0.142') },
  { threshold: new Decimal('171231'), rate: new Decimal('0.150') },
  { threshold: new Decimal('193762'), rate: new Decimal('0.156') },
  { threshold: new Decimal('277125'), rate: new Decimal('0.158') },
  { threshold: new Decimal('295150'), rate: new Decimal('0.160') },
  { threshold: new Decimal('415688'), rate: new Decimal('0.168') },
  { threshold: new Decimal('651131'), rate: new Decimal('0.176') },
  { threshold: new Decimal('Infinity'), rate: new Decimal('0.180') },
];

/** Splitting : le taux des couples et des parents seuls est celui de 50 % du revenu (art. 41 al. 2 et 3). */
export const ICC_SPLITTING = new Decimal('0.5');

/** Centimes additionnels cantonaux (LCACant art. 2) : 47,5 + 1 pour l'aide a domicile. */
export const ICC_CENTIMES_CANTONAUX = new Decimal('0.485');

/**
 * Reduction de 12 % de l'impot cantonal, centimes cantonaux compris, mais pas
 * des centimes communaux (LDIRPP art. 1).
 * @aVerifier ordre exact d'application face a la calculette AFC-GE.
 */
export const ICC_REDUCTION_LDIRPP = new Decimal('0.12');

/**
 * Centimes additionnels communaux 2026 (ArCA-2026), en fraction de l'impot de base.
 * @aVerifier un non-resident est impose au taux de la commune du lieu de travail.
 */
export const CENTIMES_COMMUNAUX: Record<CommuneGe, Decimal> = {
  GENEVE: new Decimal('0.4549'),
  AIRE_LA_VILLE: new Decimal('0.50'),
  ANIERES: new Decimal('0.31'),
  AVULLY: new Decimal('0.51'),
  AVUSY: new Decimal('0.49'),
  BARDONNEX: new Decimal('0.43'),
  BELLEVUE: new Decimal('0.39'),
  BERNEX: new Decimal('0.48'),
  CAROUGE: new Decimal('0.40'),
  CARTIGNY: new Decimal('0.42'),
  CELIGNY: new Decimal('0.33'),
  CHANCY: new Decimal('0.51'),
  CHENE_BOUGERIES: new Decimal('0.32'),
  CHENE_BOURG: new Decimal('0.46'),
  CHOULEX: new Decimal('0.40'),
  COLLEX_BOSSY: new Decimal('0.46'),
  COLLONGE_BELLERIVE: new Decimal('0.28'),
  COLOGNY: new Decimal('0.25'),
  CONFIGNON: new Decimal('0.46'),
  CORSIER: new Decimal('0.31'),
  DARDAGNY: new Decimal('0.48'),
  GENTHOD: new Decimal('0.25'),
  GRAND_SACONNEX: new Decimal('0.44'),
  GY: new Decimal('0.46'),
  HERMANCE: new Decimal('0.42'),
  JUSSY: new Decimal('0.41'),
  LACONNEX: new Decimal('0.44'),
  LANCY: new Decimal('0.47'),
  MEINIER: new Decimal('0.42'),
  MEYRIN: new Decimal('0.42'),
  ONEX: new Decimal('0.505'),
  PERLY_CERTOUX: new Decimal('0.43'),
  PLAN_LES_OUATES: new Decimal('0.37'),
  PREGNY_CHAMBESY: new Decimal('0.32'),
  PRESINGE: new Decimal('0.40'),
  PUPLINGE: new Decimal('0.49'),
  RUSSIN: new Decimal('0.39'),
  SATIGNY: new Decimal('0.39'),
  SORAL: new Decimal('0.44'),
  THONEX: new Decimal('0.44'),
  TROINEX: new Decimal('0.40'),
  VANDOEUVRES: new Decimal('0.27'),
  VERNIER: new Decimal('0.50'),
  VERSOIX: new Decimal('0.455'),
  VEYRIER: new Decimal('0.37'),
};

// ─── ICC — deductions (RCEPF 2026) ───────────────────────────────────────────

/** Forfait frais professionnels : 3 % du salaire net de cotisations, min 641, max 1 817 (art. 6 al. 2). */
export const ICC_FRAIS_PRO_TAUX = new Decimal('0.03');
export const ICC_FRAIS_PRO_MIN = new Decimal('641');
export const ICC_FRAIS_PRO_MAX = new Decimal('1817');
/** Frais de deplacement reels, plafond (art. 6 al. 1). */
export const ICC_DEPLACEMENT_MAX = new Decimal('536');

/** Primes d'assurance-vie et interets d'epargne (art. 8). */
export const ICC_ASSURANCE_VIE_COUPLE = new Decimal('3528');
export const ICC_ASSURANCE_VIE_SEUL = new Decimal('2352');
export const ICC_ASSURANCE_VIE_PAR_CHARGE = new Decimal('962');
export const ICC_ASSURANCE_VIE_PAR_CHARGE_UN_AFFILIE = new Decimal('1443');

/**
 * Primes d'assurance-maladie et accidents : double de la prime moyenne
 * cantonale par classe d'age (art. 32 let. a LIPP).
 * @aVerifier montants 2026 publies par l'AFC-GE.
 */
export const ICC_ASSURANCE_MALADIE_ADULTE = new Decimal('17122');
export const ICC_ASSURANCE_MALADIE_JEUNE_ADULTE = new Decimal('12842');
export const ICC_ASSURANCE_MALADIE_ENFANT = new Decimal('3965');

/** Frais medicaux deductibles au-dela de 0,5 % du revenu net (art. 32 let. b LIPP). */
export const ICC_FRAIS_MEDICAUX_FRANCHISE = new Decimal('0.005');
/** Frais de garde par enfant de moins de 14 ans (art. 9). */
export const ICC_FRAIS_GARDE_MAX = new Decimal('26392');
/** Formation continue (art. 12). */
export const ICC_FORMATION_MAX = new Decimal('12791');
/** Dons : 20 % du revenu net (art. 37 LIPP). */
export const ICC_DONS_PLAFOND = new Decimal('0.20');

/** Charges de famille (art. 13 al. 1) : entiere, et reduite si des frais de garde sont deduits. */
export const ICC_CHARGE_FAMILLE = new Decimal('13698');
export const ICC_CHARGE_FAMILLE_AVEC_GARDE = new Decimal('10536');

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

// ─── Commun ICC / IFD ────────────────────────────────────────────────────────

/** Pilier 3a 2026 (OPP 3) : avec caisse de pension, et sans (20 % du revenu, plafonne). */
export const PILIER_3A_AVEC_LPP = new Decimal('7258');
export const PILIER_3A_SANS_LPP = new Decimal('36288');
export const PILIER_3A_SANS_LPP_TAUX = new Decimal('0.20');

/** Interets passifs : limites au rendement de la fortune plus 50 000 (art. 33 al. 1 let. a LIFD). */
export const INTERETS_PASSIFS_FRANCHISE = new Decimal('50000');

// ─── Biens immobiliers (art. 34 let. d et e LIPP, art. 32 LIFD) ─────────────

/**
 * ICC : forfait d'entretien du seul logement occupe par son proprietaire, en
 * part de la valeur locative, au choix chaque annee et pour chaque bien
 * contre les frais effectifs (art. 34 let. d LIPP, art. 21 RIPP).
 */
export const ICC_FORFAIT_ENTRETIEN_RECENT = new Decimal('0.15');
export const ICC_FORFAIT_ENTRETIEN_ANCIEN = new Decimal('0.25');
/**
 * A l'IFD, le forfait vaut pour tout immeuble prive, loue ou non, en part du
 * rendement brut (loyers ou valeur locative) : ordonnance du DFF sur les
 * frais relatifs aux immeubles prives, art. 5.
 */
export const IFD_FORFAIT_ENTRETIEN_RECENT = new Decimal('0.10');
export const IFD_FORFAIT_ENTRETIEN_ANCIEN = new Decimal('0.20');
/** Un batiment de 10 ans au plus au debut de la periode est « recent », pour les deux impots. */
export const FORFAIT_ENTRETIEN_AGE_SEUIL = 10;

// ─── Quasi-resident ──────────────────────────────────────────────────────────

/** Part minimale des revenus bruts mondiaux du foyer imposable en Suisse (art. 14 al. 1 OIS). */
export const SEUIL_QUASI_RESIDENT = new Decimal('0.9');

/** Delai de la demande de TOU : 31 mars de l'annee suivante (art. 137 LIFD). */
export const DATE_LIMITE_TOU = '2027-03-31';

/** @aVerifier Cours moyen EUR/CHF 2026, a remplacer par le cours AFC de fin d'annee. */
export const TAUX_CHANGE_EUR_CHF_DEFAUT = '0.9300';
