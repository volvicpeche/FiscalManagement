import Decimal from 'decimal.js';
import type { CommuneGe } from '@shared/frontalier.js';

/**
 * Every dated figure of the Geneva frontalier module (ICC, communes). The
 * federal and harmonised figures shared with every canton are in
 * baremesFederaux.ts.
 *
 * Kept apart from baremes.ts on purpose: it is another jurisdiction on
 * another vintage (French figures there are 2024, Swiss ones here are 2026),
 * and bumping one must never silently move the other.
 *
 * Sources, periode fiscale 2026 :
 * - ICC : RCEPF (rsGE D 3 08.05) du 8 octobre 2025, art. 6 a 17 ; LIPP ;
 *   LCACant art. 2 ; LDIRPP art. 1 ; ArCA-2026 du 18 mars 2026.
 * - IS : fichier AFC tar26ge.txt (voir tarifs/tarifSourceGe2026.ts).
 *
 * Figures not read in one of those texts carry `@aVerifier`.
 */

/** Vintage the values below belong to. Bump it with the values, never alone. */
export const ANNEE_BAREME_GE = 2026;

// ─── ICC — forfait d'entretien (art. 34 let. d LIPP) ────────────────────────

/**
 * ICC : forfait d'entretien du seul logement occupe par son proprietaire, en
 * part de la valeur locative, au choix chaque annee et pour chaque bien
 * contre les frais effectifs (art. 34 let. d LIPP, art. 21 RIPP).
 */
export const ICC_FORFAIT_ENTRETIEN_RECENT = new Decimal('0.15');
export const ICC_FORFAIT_ENTRETIEN_ANCIEN = new Decimal('0.25');

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
