import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const StructureType = z.enum(['HOLDING', 'SCI_IS', 'SCI_IR', 'INDIVIDUAL']);
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

// ─── Decimal string (validated as numeric) ───────────────────────────────────

const decimalString = z.string().regex(/^-?\d+(\.\d{1,2})?$/, 'Must be a decimal with up to 2 decimal places');

// ─── User Profile ────────────────────────────────────────────────────────────

export const UserProfileSchema = z.object({
  maritalStatus: MaritalStatus,
  childrenCount: z.number().int().min(0),
  birthDate: z.string().datetime().optional(),
  socialChargeRegime: SocialChargeRegime.default('STANDARD'),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

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

// ─── Asset ───────────────────────────────────────────────────────────────────

export const AssetSchema = z.object({
  type: AssetType.default('REAL_ESTATE'),
  label: z.string().min(1),
  purchasePrice: decimalString,
  notaryFees: decimalString,
  renovationCosts: decimalString,
  acquisitionDate: z.string().datetime(),
  annualRent: decimalString,
  chargesYearly: decimalString,
  propertyTax: decimalString,
  loan: LoanSchema.optional(),
});
export type AssetInput = z.infer<typeof AssetSchema>;

// ─── Structure ───────────────────────────────────────────────────────────────

export const StructureSchema = z.object({
  name: z.string().min(1),
  type: StructureType,
  taxRegime: TaxRegime.default('IS'),
  ownershipShare: z.number().min(0).max(1).default(1.0),
  assets: z.array(AssetSchema).default([]),
  subsidiaries: z.lazy((): z.ZodType => z.array(StructureSchema)).default([]),
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
});
export type SimulationParams = z.infer<typeof SimulationParamsSchema>;

// ─── Full Simulation Request (POST /api/simulations/run) ─────────────────────

export const SimulationRequestSchema = z.object({
  userProfile: UserProfileSchema,
  structures: z.array(StructureSchema).min(1),
  params: SimulationParamsSchema.default({}),
});
export type SimulationRequest = z.infer<typeof SimulationRequestSchema>;

// ─── Simulation Response ─────────────────────────────────────────────────────

export const YearlyDataSchema = z.object({
  year: z.number().int(),
  entities: z.record(z.string(), z.object({
    grossRevenue: z.string(),
    loanPayment: z.string(),
    depreciation: z.string(),
    taxableProfit: z.string(),
    tax: z.string(),
    netCashFlow: z.string(),
    remainingDebt: z.string(),
    assetMarketValue: z.string(),
  })),
  userNetDividend: z.string(),
  ifiTax: z.string(),
  totalNetCashFlow: z.string(),
});
export type YearlyData = z.infer<typeof YearlyDataSchema>;

export const SimulationResultSchema = z.object({
  summary: z.object({
    totalNetWealth: z.string(),
    totalTaxPaid: z.string(),
    irr: z.string(),
  }),
  yearlyData: z.array(YearlyDataSchema),
});
export type SimulationResult = z.infer<typeof SimulationResultSchema>;
