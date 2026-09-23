import Decimal from 'decimal.js';

/**
 * Every dated figure the engine relies on, in one place.
 *
 * These numbers change every year and they used to be scattered across
 * tax.ts and succession.ts, which made it impossible to tell at a glance
 * which vintage the engine was actually running.
 *
 * ⚠️ ANNEE D'IMPOSITION EN VIGUEUR CI-DESSOUS : 2024 (revenus 2023).
 *
 * The barème below is internally consistent — brackets, decote and quotient
 * ceilings all belong to the same year — but it is NOT the 2026 one the
 * project documentation claims. Updating it means changing `ANNEE_BAREME`
 * and the values in this file only; nothing else in the engine hard-codes a
 * rate. The figures to bring back from the BOFiP are marked `@aVerifier`.
 */

/** Vintage the values below belong to. Bump it with the values, never alone. */
export const ANNEE_BAREME = 2024;

// ─── IR — bareme progressif ──────────────────────────────────────────────────

/** @aVerifier Seuils de tranches, revenus 2023 / imposition 2024. */
export const IR_BRACKETS: { threshold: Decimal; rate: Decimal }[] = [
  { threshold: new Decimal('11294'), rate: new Decimal('0') },
  { threshold: new Decimal('28797'), rate: new Decimal('0.11') },
  { threshold: new Decimal('82341'), rate: new Decimal('0.30') },
  { threshold: new Decimal('177106'), rate: new Decimal('0.41') },
  { threshold: new Decimal('Infinity'), rate: new Decimal('0.45') },
];

/** @aVerifier Plafond de l'avantage procure par chaque demi-part ordinaire. */
export const PLAFOND_DEMI_PART = new Decimal('1759');

/**
 * @aVerifier Plafond de la part entiere accordee au parent isole pour son
 * premier enfant (case T). Il est nettement plus eleve que le plafond
 * ordinaire, et s'applique a la part entiere, pas a chaque demi-part.
 */
export const PLAFOND_PARENT_ISOLE = new Decimal('4149');

/** @aVerifier Seuils de la decote. */
export const DECOTE_SEUIL_CELIBATAIRE = new Decimal('1929');
export const DECOTE_SEUIL_COUPLE = new Decimal('3191');
export const DECOTE_TAUX = new Decimal('0.4525');

// ─── IS ──────────────────────────────────────────────────────────────────────

export const IS_SEUIL_TAUX_REDUIT = new Decimal('42500');
export const IS_TAUX_REDUIT = new Decimal('0.15');
export const IS_TAUX_NORMAL = new Decimal('0.25');

/** Plafond d'imputation d'un deficit reporte, avant la part variable. */
export const IS_DEFICIT_PLAFOND_FIXE = new Decimal('1000000');
export const IS_DEFICIT_PART_VARIABLE = new Decimal('0.5');

// ─── Prelevements sociaux ────────────────────────────────────────────────────

/**
 * Revenus du patrimoine : CSG + CRDS + prelevement de solidarite.
 *
 * Un affilie a un regime de securite sociale etranger (Suisse, EEE) est
 * exonere de CSG et de CRDS et ne paie que le prelevement de solidarite.
 */
export const PS_PATRIMOINE = new Decimal('0.172');
export const PS_SOLIDARITE_SEULE = new Decimal('0.075');

/**
 * Taux retenu dans le cadre du PFU.
 *
 * @aVerifier Hypothese du projet : 18,6 %, soit un PFU total de 31,4 %, en
 * anticipation d'une hausse de CSG. Le droit en vigueur applique 17,2 % aux
 * dividendes comme aux revenus fonciers. Tant que l'hypothese tient, les deux
 * taux different volontairement.
 */
export const PS_PFU = new Decimal('0.186');
export const PFU_TAUX_IR = new Decimal('0.128');

// ─── Plus-values immobilieres ────────────────────────────────────────────────

export const PV_TAUX_IR = new Decimal('0.19');
/** Forfait travaux, au-dela de cinq ans de detention. */
export const PV_FORFAIT_TRAVAUX = new Decimal('0.15');

// ─── IFI ─────────────────────────────────────────────────────────────────────

export const IFI_SEUIL_ENTREE = new Decimal('1300000');
export const IFI_BRACKETS: { threshold: Decimal; rate: Decimal }[] = [
  { threshold: new Decimal('800000'), rate: new Decimal('0') },
  { threshold: new Decimal('1300000'), rate: new Decimal('0.005') },
  { threshold: new Decimal('2570000'), rate: new Decimal('0.007') },
  { threshold: new Decimal('5000000'), rate: new Decimal('0.01') },
  { threshold: new Decimal('10000000'), rate: new Decimal('0.0125') },
  { threshold: new Decimal('Infinity'), rate: new Decimal('0.015') },
];

// ─── Droits de succession ────────────────────────────────────────────────────

export const SUCCESSION_ABATTEMENTS = {
  SPOUSE: new Decimal('Infinity'),
  CHILD: new Decimal('100000'),
  GRANDCHILD: new Decimal('31865'),
  SIBLING: new Decimal('15932'),
  NEPHEW_NIECE: new Decimal('7967'),
  OTHER: new Decimal('1594'),
} as const;

// ─── Amortissements ──────────────────────────────────────────────────────────

export const DUREE_AMORTISSEMENT_IMMEUBLE = 25;
export const DUREE_AMORTISSEMENT_TRAVAUX = 15;
/**
 * Mobilier et equipements d'un meuble : usage courant de 5 a 10 ans selon les
 * postes. Une duree unique, mediane, faute de ventilation par poste.
 */
export const DUREE_AMORTISSEMENT_MOBILIER = 7;
/** Quote-part de terrain par defaut, non amortissable. Surchargeable par bien. */
export const QUOTE_PART_TERRAIN_DEFAUT = new Decimal('0.15');

// ─── LMNP ────────────────────────────────────────────────────────────────────

/**
 * Micro-BIC (art. 50-0 CGI), dans sa version issue de la loi du 19 novembre
 * 2024 (loi Le Meur), applicable aux revenus 2025.
 *
 * Location meublee de longue duree et meuble de tourisme classe : seuil de
 * 77 700 EUR, abattement de 50 %. Meuble de tourisme non classe : seuil
 * ramene a 15 000 EUR, abattement a 30 %.
 *
 * @aVerifier Seuils et taux, a rapprocher du BOFiP a chaque millesime.
 */
export const MICRO_BIC_SEUIL_MEUBLE = new Decimal('77700');
export const MICRO_BIC_ABATTEMENT_MEUBLE = new Decimal('0.50');
export const MICRO_BIC_SEUIL_TOURISME_NON_CLASSE = new Decimal('15000');
export const MICRO_BIC_ABATTEMENT_TOURISME_NON_CLASSE = new Decimal('0.30');
/** Abattement minimal du micro-BIC, quel que soit le taux. */
export const MICRO_BIC_ABATTEMENT_MINIMUM = new Decimal('305');

/** Un deficit BIC non professionnel se reporte sur les dix annees suivantes. */
export const LMNP_DUREE_REPORT_DEFICIT = 10;

/**
 * Seuil de recettes au-dela duquel la location meublee devient
 * professionnelle, a condition qu'elles excedent aussi les autres revenus
 * d'activite du foyer (art. 155 IV CGI).
 */
export const LMP_SEUIL_RECETTES = new Decimal('23000');

/**
 * Au-dela de ce montant de recettes annuelles, la location de meubles de
 * tourisme releve des cotisations sociales des independants (SSI), meme en
 * LMNP (art. L613-1 CSS). Le statut fiscal ne change pas ; ce sont les
 * prelevements sociaux qui sont remplaces par des cotisations.
 */
export const SSI_SEUIL_MEUBLE_TOURISME = new Decimal('23000');
