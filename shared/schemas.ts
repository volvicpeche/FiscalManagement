import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const StructureType = z.enum(['HOLDING', 'SCI_IS', 'SCI_IR', 'INDIVIDUAL', 'LMP']);
export type StructureType = z.infer<typeof StructureType>;

export const TaxRegime = z.enum(['IS', 'IR']);
export type TaxRegime = z.infer<typeof TaxRegime>;

export const AssetType = z.enum(['REAL_ESTATE', 'FINANCIAL', 'CASH']);
export type AssetType = z.infer<typeof AssetType>;

export const LoanType = z.enum(['AMORTISSABLE', 'INFINE']);
export type LoanType = z.infer<typeof LoanType>;

export const MaritalStatus = z.enum(['SINGLE', 'MARRIED', 'PACSED']);
export type MaritalStatus = z.infer<typeof MaritalStatus>;

export const SocialChargeRegime = z.enum(['STANDARD', 'SWISS_EXEMPT']);
export type SocialChargeRegime = z.infer<typeof SocialChargeRegime>;

/** The three structural setups the UI compares side by side. */
export const ScenarioProfile = z.enum(['SCI_IS_SEULE', 'SCI_IS_HOLDING', 'SCI_IR']);
export type ScenarioProfile = z.infer<typeof ScenarioProfile>;

/** Who handles the paperwork — drives the cost presets. */
export const ManagementMode = z.enum([
  'SOI_MEME',
  'EN_LIGNE',
  'EXPERT_COMPTABLE',
  'NOTAIRE_AVOCAT',
]);
export type ManagementMode = z.infer<typeof ManagementMode>;

/**
 * Relationship of an associe to the person whose death triggers succession.
 * All values except SELF match `BeneficiaryRelation` in engine/succession.ts.
 */
export const AssocieRelation = z.enum([
  'SELF',
  'SPOUSE',
  'CHILD',
  'GRANDCHILD',
  'SIBLING',
  'NEPHEW_NIECE',
  'OTHER',
]);
export type AssocieRelation = z.infer<typeof AssocieRelation>;

/**
 * How a location saisonniere is operated.
 * CONCIERGERIE bundles mise en location + menage/linge/entretien into a
 * single percentage — no platform commission is charged on top of it.
 * SOI_MEME books directly on the platform: commission is paid to the
 * platform and menage/linge is a separate line the owner organizes.
 */
export const GestionSaisonniere = z.enum(['SOI_MEME', 'CONCIERGERIE']);
export type GestionSaisonniere = z.infer<typeof GestionSaisonniere>;

/**
 * What the operation is for, which decides how it ends.
 *
 * TRANSMISSION: the shares are kept and passed on, so succession duties apply
 *   and the exit tax is worth knowing about.
 * RENDEMENT: a pure yield play — the question is what it earns while it runs,
 *   not what leaving it costs. Succession and resale are left out entirely
 *   rather than shown as zero, which would read as "free".
 */
export const ObjectifPatrimonial = z.enum(['TRANSMISSION', 'RENDEMENT']);
export type ObjectifPatrimonial = z.infer<typeof ObjectifPatrimonial>;

// ─── Decimal string (validated as numeric) ───────────────────────────────────

const decimalString = z.string().regex(/^-?\d+(\.\d{1,2})?$/, 'Must be a decimal with up to 2 decimal places');

// ─── User Profile ────────────────────────────────────────────────────────────

export const UserProfileSchema = z.object({
  maritalStatus: MaritalStatus,
  childrenCount: z.number().int().min(0),
  birthDate: z.string().datetime().optional(),
  socialChargeRegime: SocialChargeRegime.default('STANDARD'),
  /**
   * Other taxable income of the declarant. Sets the bracket a dividend lands
   * in when the distributing entity declares no associe of its own — without
   * it the bareme option is compared at a zero income and always wins.
   */
  autresRevenus: decimalString.default('0.00'),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

// ─── Associe ─────────────────────────────────────────────────────────────────

/**
 * A partner in the SCI. Each one carries a full tax household, because an
 * SCI at IR is fiscally translucent: the result is split pro-rata by parts and
 * each associe is taxed on their own bareme, on top of their own other income.
 */
export const AssocieSchema = z.object({
  nom: z.string().min(1),
  partsPercent: z.number().min(0).max(1),
  relation: AssocieRelation.default('OTHER'),
  birthDate: z.string().datetime().optional(),

  // Own tax household
  maritalStatus: MaritalStatus.default('SINGLE'),
  childrenCount: z.number().int().min(0).default(0),
  /** Other taxable income — sets the marginal bracket the quote-part lands in. */
  autresRevenus: decimalString.default('0.00'),
  socialChargeRegime: SocialChargeRegime.default('STANDARD'),

  // Contributions
  /** Share capital subscribed (parts sociales). */
  apportCapital: decimalString.default('0.00'),
  /** Compte courant d'associe — a debt of the SCI, repayable tax-free. */
  apportCompteCourant: decimalString.default('0.00'),
  /** 0 = non-remunerated CCA (the common case). */
  tauxInteretCCA: z.number().min(0).max(0.2).default(0),
});
export type AssocieInput = z.infer<typeof AssocieSchema>;

// ─── Structure costs ─────────────────────────────────────────────────────────

export const CostLineSchema = z.object({
  label: z.string().min(1),
  montant: decimalString,
});
export type CostLine = z.infer<typeof CostLineSchema>;

/**
 * Setup and running costs of one legal entity.
 * Empty `constitution` / `annuel` arrays mean "use the preset for `mode` and
 * this structure type". A non-empty array fully replaces the preset — the UI
 * sends the whole resolved list back once the user edits any line.
 */
export const EntityCostsSchema = z.object({
  mode: ManagementMode.default('EN_LIGNE'),
  constitution: z.array(CostLineSchema).default([]),
  annuel: z.array(CostLineSchema).default([]),
});
export type EntityCostsInput = z.infer<typeof EntityCostsSchema>;

// ─── Loan ────────────────────────────────────────────────────────────────────

export const LoanSchema = z.object({
  principal: decimalString,
  interestRate: z.number().min(0).max(1),
  insuranceRate: z.number().min(0).max(1),
  durationMonths: z.number().int().positive(),
  startDate: z.string().datetime(),
  type: LoanType.default('AMORTISSABLE'),
});
export type LoanInput = z.infer<typeof LoanSchema>;

// ─── Location saisonniere ─────────────────────────────────────────────────────

/**
 * One season bucket (haute / moyenne / basse saison). `caPeriode` is entered
 * directly by the user (v1: manual, potentially LLM-suggested from the
 * listing/locality later) rather than derived from nights x rate — simpler
 * and always overridable, consistent with the rest of the engine's presets.
 */
export const SaisonnierSaisonSchema = z.object({
  tauxOccupation: z.number().min(0).max(1),
  caPeriode: decimalString,
});
export type SaisonnierSaisonInput = z.infer<typeof SaisonnierSaisonSchema>;

export const SaisonnierParamsSchema = z.object({
  hauteSaison: SaisonnierSaisonSchema,
  moyenneSaison: SaisonnierSaisonSchema,
  basseSaison: SaisonnierSaisonSchema,
  gestion: GestionSaisonniere.default('SOI_MEME'),
  /** SOI_MEME only — platform commission (Airbnb/Abritel/Booking ~15-20%). */
  commissionPlateforme: z.number().min(0).max(1).default(0.15),
  /** SOI_MEME only — menage/linge/entretien organized directly by the owner. */
  fraisMenageLingeAnnuel: decimalString.default('0.00'),
  /**
   * CONCIERGERIE only — a single percentage covering mise en location,
   * menage, linge and entretien. No platform commission applies on top.
   */
  fraisConciergeriePercent: z.number().min(0).max(1).default(0.25),
});
export type SaisonnierParams = z.infer<typeof SaisonnierParamsSchema>;

// ─── Asset ───────────────────────────────────────────────────────────────────

export const AssetSchema = z.object({
  type: AssetType.default('REAL_ESTATE'),
  label: z.string().min(1),
  purchasePrice: decimalString,
  notaryFees: decimalString,
  renovationCosts: decimalString,
  acquisitionDate: z.string().datetime(),
  /** Ignored when `saisonnier` is set — the two revenue models are exclusive. */
  annualRent: decimalString.default('0.00'),
  chargesYearly: decimalString,
  propertyTax: decimalString,
  /** When set, revenue is computed from the seasonal buckets, not `annualRent`. */
  saisonnier: SaisonnierParamsSchema.optional(),
  loan: LoanSchema.optional(),
});
export type AssetInput = z.infer<typeof AssetSchema>;

// ─── Structure ───────────────────────────────────────────────────────────────

export const StructureSchema = z.object({
  name: z.string().min(1),
  type: StructureType,
  taxRegime: TaxRegime.default('IS'),
  ownershipShare: z.number().min(0).max(1).default(1.0),
  associes: z.array(AssocieSchema).default([]),
  costs: EntityCostsSchema.default({}),
  assets: z.array(AssetSchema).default([]),
  subsidiaries: z.lazy((): z.ZodType => z.array(StructureSchema)).default([]),
  /**
   * LMP only — indicative flat rate for TNS (SSI) social contributions on the
   * BIC result, distinct from the CSG/PS rate applied to passive foncier
   * income. Ignored for every other structure type.
   */
  tauxCotisationsSocialesLMP: z.number().min(0).max(1).default(0.35),
});
export type StructureInput = z.infer<typeof StructureSchema>;

// ─── Simulation Parameters ───────────────────────────────────────────────────

export const SimulationParamsSchema = z.object({
  horizonYears: z.number().int().min(1).max(50).default(30),
  inflationRate: z.number().min(0).max(0.2).default(0.02),
  propertyGrowth: z.number().min(-0.1).max(0.2).default(0.015),
  rentGrowthRate: z.number().min(0).max(0.2).default(0.02),
  chargesGrowthRate: z.number().min(0).max(0.2).default(0.02),
  propertyTaxGrowthRate: z.number().min(0).max(0.2).default(0.02),
  dividendDistributionRate: z.number().min(0).max(1).default(0),

  /** Share of an entity's available cash used each year to repay CCA. */
  ccaRepaymentRate: z.number().min(0).max(1).default(0),
  /** Discount applied to SCI shares for succession (non-traded shares). */
  illiquidityDiscount: z.number().min(0).max(0.5).default(0.10),
  /** Transmit nue-propriete only, keeping the usufruit (Art. 669 CGI bareme). */
  demembrement: z.boolean().default(false),
  /** Drives whether succession and resale are computed at all. */
  objectif: ObjectifPatrimonial.default('TRANSMISSION'),
});
export type SimulationParams = z.infer<typeof SimulationParamsSchema>;

// ─── Full Simulation Request (POST /api/simulations/run) ─────────────────────

/** Walks the structure tree and yields every entity, depth-first. */
function walkStructures(structures: StructureInput[]): StructureInput[] {
  const out: StructureInput[] = [];
  for (const s of structures) {
    out.push(s);
    if (s.subsidiaries?.length) {
      out.push(...walkStructures(s.subsidiaries as StructureInput[]));
    }
  }
  return out;
}

export const SimulationRequestSchema = z
  .object({
    userProfile: UserProfileSchema,
    structures: z.array(StructureSchema).min(1),
    params: SimulationParamsSchema.default({}),
  })
  .superRefine((req, ctx) => {
    // Parts validation is done here rather than on StructureSchema itself:
    // a .refine() would turn StructureSchema into a ZodEffects and break the
    // z.lazy() self-reference used for subsidiaries.
    for (const s of walkStructures(req.structures)) {
      if (s.associes.length === 0) continue;

      const total = s.associes.reduce((sum, a) => sum + a.partsPercent, 0);
      if (Math.abs(total - 1) > 1e-6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['structures'],
          message: `La repartition des parts de « ${s.name} » doit totaliser 100 % (actuellement ${(total * 100).toFixed(2)} %).`,
        });
      }

      const noms = s.associes.map((a) => a.nom);
      if (new Set(noms).size !== noms.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['structures'],
          message: `Deux associes de « ${s.name} » portent le meme nom.`,
        });
      }

      if (s.associes.filter((a) => a.relation === 'SELF').length > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['structures'],
          message: `« ${s.name} » ne peut compter qu'un seul associe de type SELF.`,
        });
      }
    }
  });
export type SimulationRequest = z.infer<typeof SimulationRequestSchema>;

// ─── Simulation Response ─────────────────────────────────────────────────────

/**
 * Where an entity's yearly totals come from, line by line.
 *
 * The table renders these as per-cell tooltips ("CA brut 23 000 = haute 15 000
 * + moyenne 8 000"), so a reader can trace any figure back to its parts
 * without opening the engine.
 */
export const EntityYearDetailSchema = z.object({
  // Revenue
  loyerNu: z.string(),
  caHauteSaison: z.string(),
  caMoyenneSaison: z.string(),
  caBasseSaison: z.string(),
  // Charges
  chargesCopro: z.string(),
  taxeFonciere: z.string(),
  commissionPlateforme: z.string(),
  fraisMenageLinge: z.string(),
  fraisConciergerie: z.string(),
  // Loan
  interets: z.string(),
  assurance: z.string(),
});
export type EntityYearDetail = z.infer<typeof EntityYearDetailSchema>;

export const EntityYearSchema = z.object({
  grossRevenue: z.string(),
  /** Charges de copropriete + taxe fonciere. */
  charges: z.string(),
  loanPayment: z.string(),
  /** Interest + loan insurance — the deductible part of the payment. */
  loanInterest: z.string(),
  /** Capital repaid — a cash outflow that is not a charge. */
  loanPrincipal: z.string(),
  depreciation: z.string(),
  /** Structure running costs for the year (comptable, CFE, banque, ...). */
  operatingCosts: z.string(),
  taxableProfit: z.string(),
  tax: z.string(),
  netCashFlow: z.string(),
  remainingDebt: z.string(),
  assetMarketValue: z.string(),

  // ── Stocks: what the company holds and owes at the end of the year ────────
  // Flows alone never answered "where did the cash go" — it goes here.
  /** Cash still sitting in the company after everything has moved. */
  tresorerie: z.string(),
  /** Compte courant capital handed back to the associes this year. */
  ccaRembourse: z.string(),
  /** Compte courant still owed to the associes. */
  ccaSolde: z.string(),
  /** Gross dividend taken out of the company — to a parent, or to the associes. */
  dividendeVerse: z.string(),

  detail: EntityYearDetailSchema,
});
export type EntityYear = z.infer<typeof EntityYearSchema>;

export const AssocieYearSchema = z.object({
  /** Share of the IR foncier result attributed to this associe. */
  quotePart: z.string(),
  irTax: z.string(),
  psTax: z.string(),
  ccaInterest: z.string(),
  /** PFU owed on the CCA interest — it is RCM in the associe's hands. */
  ccaInterestTax: z.string(),
  ccaRepayment: z.string(),
  ccaBalance: z.string(),
  /** Dividend received, net of the PFU or bareme actually retained. */
  dividendeNet: z.string(),
  /** What actually lands in this associe's pocket for the year. */
  netCashFlow: z.string(),
});
export type AssocieYear = z.infer<typeof AssocieYearSchema>;

export const YearlyDataSchema = z.object({
  /** Year 0 carries only the setup costs and the initial contributions. */
  year: z.number().int(),
  entities: z.record(z.string(), EntityYearSchema),
  associes: z.record(z.string(), AssocieYearSchema).default({}),
  userNetDividend: z.string(),
  /** Tax retained on the dividends distributed this year. */
  dividendTax: z.string(),
  ifiTax: z.string(),
  operatingCosts: z.string(),
  /**
   * The COMPANY's view: what the entities generated and kept, net of the
   * associes' personal tax. Kept for the projection table, which reads the
   * operation from the company side.
   */
  totalNetCashFlow: z.string(),
  /**
   * The FAMILY's view: what actually crossed the boundary between the
   * companies and the associes' own pockets this year — the apport at year 0,
   * then dividends and compte courant movements less the tax paid personally.
   *
   * This is the series the IRR is computed on. `totalNetCashFlow` cannot be:
   * it counts cash retained inside the company, which the terminal net asset
   * value already contains, so every euro was discounted twice.
   */
  fluxFamille: z.string(),
});
export type YearlyData = z.infer<typeof YearlyDataSchema>;

export const SuccessionHeirSchema = z.object({
  nom: z.string(),
  relation: AssocieRelation,
  partRecue: z.string(),
  abattement: z.string(),
  baseTaxable: z.string(),
  droits: z.string(),
});
export type SuccessionHeir = z.infer<typeof SuccessionHeirSchema>;

export const SuccessionResultSchema = z.object({
  /** Net asset value of all structures at the end of the horizon. */
  navTotal: z.string(),
  /** Value of the deceased's shares, after illiquidity discount. */
  valeurPartsDefunt: z.string(),
  /** CCA balance owed to the deceased — an estate asset, no discount. */
  ccaDefunt: z.string(),
  baseTransmise: z.string(),
  heritiers: z.array(SuccessionHeirSchema),
  total: z.string(),
});
export type SuccessionResult = z.infer<typeof SuccessionResultSchema>;

export const SimulationResultSchema = z.object({
  summary: z.object({
    totalNetWealth: z.string(),
    totalTaxPaid: z.string(),
    /** Null when the cash flows never change sign — there is no rate to report. */
    irr: z.string().nullable(),
    fraisConstitution: z.string(),
    totalOperatingCosts: z.string(),
    successionCost: z.string(),
    /**
     * Echoed back so the UI hides the end-of-life figures based on what was
     * actually computed, not on a form the user may have edited since.
     */
    objectif: ObjectifPatrimonial,
    /**
     * Selling at the horizon. Reported rather than folded into the projection:
     * an SCI at IS pays almost nothing for twenty years precisely because
     * depreciation lowers the book value the exit gain is measured against, so
     * a comparison that stops before the sale flatters it.
     */
    sortie: z.object({
      regime: z.enum(['IS', 'IR', 'LMP']),
      prixVente: z.string(),
      valeurNetteComptable: z.string(),
      prixAcquisition: z.string(),
      plusValueBrute: z.string(),
      /** Gain that exists only because depreciation lowered the book value. */
      amortissementsRepris: z.string(),
      impot: z.string(),
      detteResiduelle: z.string(),
      produitNet: z.string(),
    }),
    /** IRR once the exit tax is paid — the rate over the whole cycle. */
    irrNetDeRevente: z.string().nullable(),
    /** What the acquisition really needs versus what the associes declared. */
    financement: z.object({
      coutAcquisition: z.string(),
      emprunt: z.string(),
      apportRequis: z.string(),
      apportDeclare: z.string(),
      ecart: z.string(),
    }),
  }),
  yearlyData: z.array(YearlyDataSchema),
  succession: SuccessionResultSchema,
});
export type SimulationResult = z.infer<typeof SimulationResultSchema>;
