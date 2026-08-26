import Decimal from 'decimal.js';
import type { AssocieInput, AssocieRelation } from '@shared/schemas.js';

// ─── Succession Abatements ───────────────────────────────────────────────────

export type BeneficiaryRelation = 'SPOUSE' | 'CHILD' | 'GRANDCHILD' | 'SIBLING' | 'NEPHEW_NIECE' | 'OTHER';

const ABATEMENTS: Record<BeneficiaryRelation, Decimal> = {
  SPOUSE: new Decimal('Infinity'), // Full exemption
  CHILD: new Decimal('100000'),
  GRANDCHILD: new Decimal('31865'),
  SIBLING: new Decimal('15932'),
  NEPHEW_NIECE: new Decimal('7967'),
  OTHER: new Decimal('1594'),
};

// ─── Direct Line Rate Table (Parent -> Child) ────────────────────────────────

const DIRECT_LINE_BRACKETS: { threshold: Decimal; rate: Decimal }[] = [
  { threshold: new Decimal('8072'), rate: new Decimal('0.05') },
  { threshold: new Decimal('12109'), rate: new Decimal('0.10') },
  { threshold: new Decimal('15932'), rate: new Decimal('0.15') },
  { threshold: new Decimal('552324'), rate: new Decimal('0.20') },
  { threshold: new Decimal('902838'), rate: new Decimal('0.30') },
  { threshold: new Decimal('1805677'), rate: new Decimal('0.40') },
  { threshold: new Decimal('Infinity'), rate: new Decimal('0.45') },
];

/**
 * Computes succession tax for a single beneficiary (direct line).
 * @param shareValue - Taxable value of the inherited share
 * @param relation - Relationship to the deceased
 * @returns { taxableBase, tax }
 */
export function computeSuccessionTax(
  shareValue: Decimal,
  relation: BeneficiaryRelation,
): { taxableBase: Decimal; tax: Decimal } {
  if (relation === 'SPOUSE') {
    return { taxableBase: new Decimal(0), tax: new Decimal(0) };
  }

  const abatement = ABATEMENTS[relation];
  const taxableBase = Decimal.max(new Decimal(0), shareValue.minus(abatement));

  if (taxableBase.lte(0)) {
    return { taxableBase: new Decimal(0), tax: new Decimal(0) };
  }

  // Apply progressive rate table (direct line only for now)
  let tax = new Decimal(0);
  let previousThreshold = new Decimal(0);

  for (const bracket of DIRECT_LINE_BRACKETS) {
    if (taxableBase.lte(previousThreshold)) break;

    const taxableInBracket = Decimal.min(taxableBase, bracket.threshold).minus(previousThreshold);
    tax = tax.plus(taxableInBracket.mul(bracket.rate));
    previousThreshold = bracket.threshold;
  }

  return { taxableBase, tax };
}

// ─── SCI Share Valuation for Succession ──────────────────────────────────────

/**
 * Computes the taxable value of SCI shares for succession purposes.
 * @param nav - SCI Net Asset Value
 * @param ownershipShare - Ownership percentage (e.g., 0.95)
 * @param illiquidityDiscount - Discount for non-traded shares (default 10%)
 */
export function computeSCIShareValue(
  nav: Decimal,
  ownershipShare: Decimal,
  illiquidityDiscount: Decimal = new Decimal('0.10'),
): Decimal {
  const grossValue = nav.mul(ownershipShare);
  return grossValue.mul(new Decimal(1).minus(illiquidityDiscount));
}

// ─── Usufruit / Nue-Propriete Split (Art. 669 CGI) ──────────────────────────

const USUFRUIT_BAREME: { maxAge: number; usufruit: Decimal }[] = [
  { maxAge: 20, usufruit: new Decimal('0.90') },
  { maxAge: 30, usufruit: new Decimal('0.80') },
  { maxAge: 40, usufruit: new Decimal('0.70') },
  { maxAge: 50, usufruit: new Decimal('0.60') },
  { maxAge: 60, usufruit: new Decimal('0.50') },
  { maxAge: 70, usufruit: new Decimal('0.40') },
  { maxAge: 80, usufruit: new Decimal('0.30') },
  { maxAge: 90, usufruit: new Decimal('0.20') },
  { maxAge: Infinity, usufruit: new Decimal('0.10') },
];

/**
 * Returns the usufruit/nue-propriete split based on the usufructuary's age.
 */
export function getUsufruitSplit(age: number): { usufruit: Decimal; nuePropriete: Decimal } {
  for (const entry of USUFRUIT_BAREME) {
    if (age <= entry.maxAge) {
      return {
        usufruit: entry.usufruit,
        nuePropriete: new Decimal(1).minus(entry.usufruit),
      };
    }
  }

  return { usufruit: new Decimal('0.10'), nuePropriete: new Decimal('0.90') };
}

// ─── Succession across the associes of a structure ───────────────────────────

export interface SuccessionHeirDetail {
  nom: string;
  relation: AssocieRelation;
  partRecue: Decimal;
  abattement: Decimal;
  baseTaxable: Decimal;
  droits: Decimal;
}

export interface SuccessionEstimate {
  navTotal: Decimal;
  valeurPartsDefunt: Decimal;
  ccaDefunt: Decimal;
  baseTransmise: Decimal;
  heritiers: SuccessionHeirDetail[];
  total: Decimal;
}

export interface SuccessionParams {
  /** Net asset value of the structures at the end of the horizon. */
  nav: Decimal;
  associes: AssocieInput[];
  /** CCA balance still owed to each associe, keyed by name. */
  ccaBalances: Map<string, Decimal>;
  illiquidityDiscount: Decimal;
  demembrement: boolean;
  /** Age of the SELF associe at the end of the horizon, if their birth date is known. */
  ageAuTerme?: number;
  /** Heirs to assume when no other associe can inherit. */
  fallbackChildren: number;
}

const EMPTY_ESTIMATE = (nav: Decimal): SuccessionEstimate => ({
  navTotal: nav,
  valeurPartsDefunt: new Decimal(0),
  ccaDefunt: new Decimal(0),
  baseTransmise: new Decimal(0),
  heritiers: [],
  total: new Decimal(0),
});

/** Relations that can receive the estate. SELF is the deceased. */
function isHeir(relation: AssocieRelation): relation is BeneficiaryRelation {
  return relation !== 'SELF';
}

/**
 * Estimates what the SELF associe's death costs their heirs at the end of the
 * horizon.
 *
 * Only the shares still held by the deceased are transmitted — parts already
 * given to the children are out of the estate, which is precisely why an SCI
 * is used to organise a transmission. Their compte courant is added at face
 * value: it is a claim against the company, so it gets no illiquidity discount.
 */
export function computeSuccessionForAssocies(params: SuccessionParams): SuccessionEstimate {
  const { nav, associes, ccaBalances, illiquidityDiscount, demembrement, ageAuTerme, fallbackChildren } =
    params;

  const defunt = associes.find((a) => a.relation === 'SELF');
  if (!defunt) return EMPTY_ESTIMATE(nav);

  // Value of the deceased's shares, discounted for illiquidity.
  let valeurParts = computeSCIShareValue(
    Decimal.max(new Decimal(0), nav),
    new Decimal(defunt.partsPercent),
    illiquidityDiscount,
  );

  // With a demembrement, only the nue-propriete leaves the estate.
  if (demembrement && ageAuTerme !== undefined) {
    valeurParts = valeurParts.mul(getUsufruitSplit(ageAuTerme).nuePropriete);
  }

  const ccaDefunt = ccaBalances.get(defunt.nom) ?? new Decimal(0);
  const baseTransmise = valeurParts.plus(ccaDefunt);

  // Heirs: the other associes, or the declared children if the deceased is alone.
  const coAssocies = associes.filter((a) => a.nom !== defunt.nom && isHeir(a.relation));
  const heritiers: { nom: string; relation: AssocieRelation }[] =
    coAssocies.length > 0
      ? coAssocies.map((a) => ({ nom: a.nom, relation: a.relation }))
      : Array.from({ length: fallbackChildren }, (_, i) => ({
          nom: `Enfant ${i + 1}`,
          relation: 'CHILD' as AssocieRelation,
        }));

  if (heritiers.length === 0) return EMPTY_ESTIMATE(nav);

  const partParHeritier = baseTransmise.div(heritiers.length);

  const details: SuccessionHeirDetail[] = heritiers.map((h) => {
    const { taxableBase, tax } = computeSuccessionTax(partParHeritier, h.relation as BeneficiaryRelation);
    return {
      nom: h.nom,
      relation: h.relation,
      partRecue: partParHeritier,
      abattement: partParHeritier.minus(taxableBase),
      baseTaxable: taxableBase,
      droits: tax,
    };
  });

  return {
    navTotal: nav,
    valeurPartsDefunt: valeurParts,
    ccaDefunt,
    baseTransmise,
    heritiers: details,
    total: details.reduce((acc, h) => acc.plus(h.droits), new Decimal(0)),
  };
}
