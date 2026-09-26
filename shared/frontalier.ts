import { z } from 'zod';

/**
 * Frontalier Geneve — taxation ordinaire ulterieure (TOU) au statut de
 * quasi-resident, comparee a l'impot a la source effectivement retenu.
 *
 * Unlike the rest of the app, amounts here are in CHF unless the field name
 * says EUR: French income is converted with `tauxChangeEurChf` by the engine,
 * never by the client, so the conversion is visible and testable in one place.
 */

// ─── Decimal string ──────────────────────────────────────────────────────────

const montant = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Montant positif, 2 decimales maximum');
const zero = () => montant.default('0.00');

// ─── Enums ───────────────────────────────────────────────────────────────────

/**
 * Situation civile au sens suisse. Un PACS francais n'est PAS un partenariat
 * enregistre suisse : des partenaires pacses sont imposes comme deux
 * celibataires (chacun sa TOU, chacun son test des 90 %).
 */
export const EtatCivilGe = z.enum(['CELIBATAIRE', 'MARIE']);
export type EtatCivilGe = z.infer<typeof EtatCivilGe>;

/** Ou la personne exerce son activite lucrative principale. */
export const LieuActivite = z.enum(['SUISSE', 'FRANCE', 'AUCUNE']);
export type LieuActivite = z.infer<typeof LieuActivite>;

/**
 * Communes genevoises (centimes additionnels 2026, ArCA-2026). Un frontalier
 * n'a pas de commune de domicile dans le canton : c'est la commune du lieu de
 * travail qui preleve l'impot communal.
 */
export const CommuneGe = z.enum([
  'GENEVE', 'AIRE_LA_VILLE', 'ANIERES', 'AVULLY', 'AVUSY', 'BARDONNEX', 'BELLEVUE',
  'BERNEX', 'CAROUGE', 'CARTIGNY', 'CELIGNY', 'CHANCY', 'CHENE_BOUGERIES', 'CHENE_BOURG',
  'CHOULEX', 'COLLEX_BOSSY', 'COLLONGE_BELLERIVE', 'COLOGNY', 'CONFIGNON', 'CORSIER',
  'DARDAGNY', 'GENTHOD', 'GRAND_SACONNEX', 'GY', 'HERMANCE', 'JUSSY', 'LACONNEX', 'LANCY',
  'MEINIER', 'MEYRIN', 'ONEX', 'PERLY_CERTOUX', 'PLAN_LES_OUATES', 'PREGNY_CHAMBESY',
  'PRESINGE', 'PUPLINGE', 'RUSSIN', 'SATIGNY', 'SORAL', 'THONEX', 'TROINEX', 'VANDOEUVRES',
  'VERNIER', 'VERSOIX', 'VEYRIER',
]);
export type CommuneGe = z.infer<typeof CommuneGe>;

/**
 * Code du bareme de l'impot a la source : lettre + nombre d'enfants.
 * A celibataire, B marie a un revenu, C marie a deux revenus, H parent seul.
 */
export const CodeTarifIS = z.string().regex(/^(A[0-5]|B[0-5]|C[0-5]|H[1-5])$/, 'Code bareme IS invalide (ex. A0, B1, C2, H1)');
export type CodeTarifIS = z.infer<typeof CodeTarifIS>;

/** Repas pris hors du domicile, pour le forfait IFD. */
export const RepasHorsDomicile = z.enum(['AUCUN', 'CANTINE', 'COMPLET']);
export type RepasHorsDomicile = z.infer<typeof RepasHorsDomicile>;

export const UsageBienFrance = z.enum(['LOCATIF', 'RESIDENCE_PRINCIPALE', 'SECONDAIRE']);
export type UsageBienFrance = z.infer<typeof UsageBienFrance>;

// ─── Personne ────────────────────────────────────────────────────────────────

/**
 * One earner. The Swiss block mirrors the certificat de salaire (formulaire
 * 11) so a document read can fill it box by box; the French block only feeds
 * the 90 % test and the rate, since that income is not taxed in Geneva.
 */
export const PersonneFrontalierSchema = z.object({
  prenom: z.string().max(60).default(''),
  activite: LieuActivite,

  // Certificat de salaire suisse
  salaireBrut: zero(), // case 8
  cotisationsSociales: zero(), // case 9 : AVS/AI/APG/AC/AANP
  lppOrdinaire: zero(), // case 10.1
  lppRachats: zero(), // case 10.2
  /** Affiliation a une caisse de pension : fixe le plafond 3a et les plafonds d'assurance. */
  affilieLpp: z.boolean().default(true),
  pilier3a: zero(),

  // Frais professionnels : le moteur retient le plus favorable du forfait et
  // des frais reels saisis ici, separement pour l'ICC et l'IFD.
  /** Frais de deplacement domicile-travail reels (CHF/an). */
  fraisDeplacement: zero(),
  repas: RepasHorsDomicile.default('AUCUN'),
  /** Autres frais professionnels reels (CHF/an) : outillage, vetements, bureau... */
  autresFraisProfessionnels: zero(),
  fraisFormation: zero(),

  // Impot a la source
  codeTarifIS: CodeTarifIS.optional(),
  impotSourceRetenu: zero(),

  // Activite en France (conjoint le plus souvent)
  revenuFranceBrutEur: zero(),
  revenuFranceNetEur: zero(),
});
export type PersonneFrontalier = z.infer<typeof PersonneFrontalierSchema>;
export type PersonneFrontalierInput = z.input<typeof PersonneFrontalierSchema>;

export const EnfantSchema = z.object({
  age: z.number().int().min(0).max(40),
  /** Frais de garde par un tiers (CHF/an) — deductibles jusqu'a 14 ans. */
  fraisGarde: zero(),
});
export type Enfant = z.infer<typeof EnfantSchema>;

// ─── Biens en France ─────────────────────────────────────────────────────────

/**
 * A French property. Its net income is exempt in Geneva but counts for the
 * rate (exoneration avec reserve de progression), and its gross income counts
 * in the 90 % test. Amounts in EUR, as on the French documents.
 */
export const BienFranceSchema = z.object({
  label: z.string().max(80).default(''),
  usage: UsageBienFrance,
  loyersBrutsEur: zero(),
  /** Valeur locative annuelle d'un bien occupe par son proprietaire. */
  valeurLocativeEur: zero(),
  chargesCoproEur: zero(),
  taxeFonciereEur: zero(),
  travauxEur: zero(),
  assuranceEur: zero(),
  interetsEmpruntEur: zero(),
});
export type BienFrance = z.infer<typeof BienFranceSchema>;

// ─── Requete ─────────────────────────────────────────────────────────────────

export const DeductionsFoyerSchema = z.object({
  primesAssuranceMaladie: zero(),
  primesAssuranceVie: zero(),
  /** Interets de dettes privees hors biens francais (ceux-ci vont dans le bien). */
  interetsPassifs: zero(),
  /** Rendement brut de la fortune : les interets passifs sont limites a ce montant + 50 000. */
  rendementFortune: zero(),
  pensionAlimentaire: zero(),
  fraisMedicaux: zero(),
  dons: zero(),
});
export type DeductionsFoyer = z.infer<typeof DeductionsFoyerSchema>;

export const FrontalierRequestSchema = z
  .object({
    annee: z.literal(2026),
    etatCivil: EtatCivilGe,
    communeTravail: CommuneGe.default('GENEVE'),
    contribuable: PersonneFrontalierSchema,
    conjoint: PersonneFrontalierSchema.optional(),
    enfants: z.array(EnfantSchema).max(10).default([]),
    deductions: DeductionsFoyerSchema,
    biensFrance: z.array(BienFranceSchema).max(20).default([]),
    autresRevenusEtrangersEur: zero(),
    tauxChangeEurChf: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Taux de change invalide'),
  })
  .superRefine((req, ctx) => {
    if (req.etatCivil === 'MARIE' && !req.conjoint) {
      ctx.addIssue({ code: 'custom', path: ['conjoint'], message: 'Renseignez le conjoint pour un couple marie' });
    }
    if (req.contribuable.activite !== 'SUISSE') {
      ctx.addIssue({
        code: 'custom',
        path: ['contribuable', 'activite'],
        message: 'Le contribuable doit travailler en Suisse pour etre impose a la source',
      });
    }
  });
export type FrontalierRequest = z.infer<typeof FrontalierRequestSchema>;
export type FrontalierRequestInput = z.input<typeof FrontalierRequestSchema>;

// ─── Resultat ────────────────────────────────────────────────────────────────

export interface Test90Result {
  revenusSuisses: string;
  revenusMondiaux: string;
  /** Part des revenus bruts mondiaux imposable en Suisse, entre 0 et 1. */
  ratio: number;
  eligible: boolean;
}

export interface LigneDeduction {
  code: string;
  libelle: string;
  icc: string;
  ifd: string;
}

export interface CalculImpot {
  /** Revenu imposable en Suisse, apres toutes les deductions. */
  revenuImposable: string;
  /** Revenu mondial qui fixe le taux (reserve de progression). */
  revenuDeterminantTaux: string;
  /** Taux effectif applique au revenu imposable en Suisse. */
  tauxEffectif: number;
  total: string;
}

export interface CalculICC extends CalculImpot {
  impotBase: string;
  reductionLdirpp: string;
  centimesCantonaux: string;
  impotCommunal: string;
  centimesCommunaux: number;
}

export interface ImpotSourcePersonne {
  prenom: string;
  codeTarif: string;
  salaireBrut: string;
  /** Taux du bareme applique au salaire mensuel moyen. */
  tauxBareme: number;
  impotTheorique: string;
  impotRetenu: string;
}

export interface ImpactDeduction {
  code: string;
  libelle: string;
  montant: string;
  /** Impot TOU economise grace a cette deduction seule. */
  economie: string;
}

export interface FrontalierResult {
  annee: number;
  test90: Test90Result;
  deductions: LigneDeduction[];
  icc: CalculICC;
  ifd: CalculImpot;
  totalTou: string;
  impotSource: ImpotSourcePersonne[];
  totalIsRetenu: string;
  totalIsTheorique: string;
  /** IS retenu − TOU : positif quand la TOU est plus avantageuse. */
  gainTou: string;
  impacts: ImpactDeduction[];
  dateLimite: string;
  avertissements: string[];
}

// ─── Lecture de documents ────────────────────────────────────────────────────

export const DocumentType = z.enum([
  'CERTIFICAT_SALAIRE',
  'ATTESTATION_3A',
  'ATTESTATION_LPP_RACHAT',
  'ASSURANCE_MALADIE',
  'ASSURANCE_VIE',
  'INTERETS_DETTE',
  'CHARGES_COPRO',
  'TAXE_FONCIERE',
  'FACTURE_TRAVAUX',
  'ATTESTATION_QUITTANCE_IS',
  'FRAIS_GARDE',
  'AUTRE',
]);
export type DocumentType = z.infer<typeof DocumentType>;

/**
 * Where an extracted figure lands in the form. Personal fields go to the
 * contribuable or the conjoint; French property fields go to a bien.
 */
export const ChampCible = z.enum([
  'SALAIRE_BRUT',
  'COTISATIONS_SOCIALES',
  'LPP_ORDINAIRE',
  'LPP_RACHATS',
  'PILIER_3A',
  'IMPOT_SOURCE_RETENU',
  'FRAIS_FORMATION',
  'PRIMES_ASSURANCE_MALADIE',
  'PRIMES_ASSURANCE_VIE',
  'INTERETS_PASSIFS',
  'FRAIS_GARDE',
  'FRAIS_MEDICAUX',
  'DONS',
  'BIEN_INTERETS_EMPRUNT',
  'BIEN_CHARGES_COPRO',
  'BIEN_TAXE_FONCIERE',
  'BIEN_TRAVAUX',
  'BIEN_ASSURANCE',
  'BIEN_LOYERS',
]);
export type ChampCible = z.infer<typeof ChampCible>;

export const ChampExtraitSchema = z.object({
  cible: ChampCible,
  /** Montant annuel, jamais negatif. */
  valeur: z.number().nonnegative(),
  devise: z.enum(['CHF', 'EUR']),
  /** Ce que le document dit, avec la case ou la ligne d'ou vient le montant. */
  source: z.string(),
});
export type ChampExtrait = z.infer<typeof ChampExtraitSchema>;

export const DocumentExtractionSchema = z.object({
  type: DocumentType,
  personne: z.enum(['CONTRIBUABLE', 'CONJOINT', 'INCONNU']),
  /** Nom de la personne sur le document, pour aider a l'attribuer. */
  titulaire: z.string().nullable(),
  annee: z.number().int().nullable(),
  champs: z.array(ChampExtraitSchema),
  /** Code bareme IS lu sur une attestation-quittance ou une fiche de paie. */
  codeTarifIS: z.string().nullable(),
  remarques: z.string(),
});
export type DocumentExtraction = z.infer<typeof DocumentExtractionSchema>;

export interface DocumentExtractionResult {
  fileName: string;
  extraction: DocumentExtraction | null;
  erreur: string | null;
}
