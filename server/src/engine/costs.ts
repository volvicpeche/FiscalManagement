import Decimal from 'decimal.js';
import type { ManagementMode, StructureType, CostLine } from '@shared/schemas.js';

/**
 * Setup and running costs of a legal structure.
 *
 * All figures below are INDICATIVE 2026 defaults meant to be edited by the
 * user — they are the starting point of the comparison, not a quote. The UI
 * surfaces every line individually so any of them can be overridden.
 *
 * NOTAIRE_AVOCAT covers the incorporation only: a notaire does not keep the
 * books, so its annual column mirrors EXPERT_COMPTABLE.
 */

export interface ResolvedCostLine {
  label: string;
  montant: Decimal;
}

export interface ResolvedCosts {
  constitution: Decimal;
  annuel: Decimal;
  lignesConstitution: ResolvedCostLine[];
  lignesAnnuel: ResolvedCostLine[];
}

type ModeTable = Record<ManagementMode, string>;

/** A cost line whose amount depends on who does the work. */
interface PresetLine {
  label: string;
  parMode: ModeTable;
}

function flat(montant: string): ModeTable {
  return {
    SOI_MEME: montant,
    EN_LIGNE: montant,
    EXPERT_COMPTABLE: montant,
    NOTAIRE_AVOCAT: montant,
  };
}

// ─── Constitution ────────────────────────────────────────────────────────────

const CONSTITUTION_SOCIETE: PresetLine[] = [
  {
    label: 'Redaction des statuts',
    parMode: {
      SOI_MEME: '0.00',
      EN_LIGNE: '250.00',
      EXPERT_COMPTABLE: '1000.00',
      NOTAIRE_AVOCAT: '2000.00',
    },
  },
  { label: 'Annonce legale', parMode: flat('185.00') },
  { label: 'Immatriculation RCS (guichet unique)', parMode: flat('70.00') },
];

/** A holding's articles are heavier to draft than an SCI's. */
const CONSTITUTION_HOLDING: PresetLine[] = [
  {
    label: 'Redaction des statuts (holding)',
    parMode: {
      SOI_MEME: '0.00',
      EN_LIGNE: '400.00',
      EXPERT_COMPTABLE: '1500.00',
      NOTAIRE_AVOCAT: '2500.00',
    },
  },
  { label: 'Annonce legale', parMode: flat('197.00') },
  { label: 'Immatriculation RCS (guichet unique)', parMode: flat('70.00') },
];

// ─── Annual running costs ────────────────────────────────────────────────────

const COMPTA_IR: PresetLine = {
  // At IR the SCI files a 2072 from a simple receipts/payments ledger —
  // no commercial bookkeeping is legally required.
  label: 'Comptabilite (declaration 2072)',
  parMode: {
    SOI_MEME: '0.00',
    EN_LIGNE: '400.00',
    EXPERT_COMPTABLE: '900.00',
    NOTAIRE_AVOCAT: '900.00',
  },
};

const COMPTA_IS: PresetLine = {
  // At IS full commercial bookkeeping is mandatory: bilan, compte de resultat
  // and liasse 2065, plus the depreciation schedule.
  label: 'Comptabilite commerciale (liasse 2065 + bilan)',
  parMode: {
    SOI_MEME: '0.00',
    EN_LIGNE: '800.00',
    EXPERT_COMPTABLE: '1500.00',
    NOTAIRE_AVOCAT: '1500.00',
  },
};

const JURIDIQUE_ANNUEL: PresetLine = {
  label: 'AG annuelle / secretariat juridique',
  parMode: {
    SOI_MEME: '0.00',
    EN_LIGNE: '150.00',
    EXPERT_COMPTABLE: '350.00',
    NOTAIRE_AVOCAT: '500.00',
  },
};

const ASSURANCE_PNO: PresetLine = { label: 'Assurance PNO / RC', parMode: flat('200.00') };
const BANQUE: PresetLine = { label: 'Frais bancaires (compte pro)', parMode: flat('150.00') };

/**
 * NOT MODELLED: the contribution sur les revenus locatifs.
 *
 * It is a levy of 2,5 % of the rents, owed by companies subject to IS on
 * buildings completed more than fifteen years before. Two things stop it from
 * being computed here: whether it still applies in 2026 needs checking, and
 * the model records an acquisition date, not a completion date, so it cannot
 * tell whether a given building qualifies. Anyone whose property does should
 * add it as an annual cost line — the presets are overridable for exactly
 * this kind of case.
 */

/** Location nue by a civil SCI is in principle outside the scope of CFE. */
const CFE_IR: PresetLine = { label: 'CFE', parMode: flat('0.00') };
const CFE_IS: PresetLine = { label: 'CFE', parMode: flat('250.00') };

const ANNUEL_SCI_IR: PresetLine[] = [COMPTA_IR, CFE_IR, ASSURANCE_PNO, BANQUE, JURIDIQUE_ANNUEL];
const ANNUEL_SCI_IS: PresetLine[] = [COMPTA_IS, CFE_IS, ASSURANCE_PNO, BANQUE, JURIDIQUE_ANNUEL];

/** LMP is a sole-trader (entreprise individuelle) activity: no statuts, no AG. */
const CONSTITUTION_LMP: PresetLine[] = [
  { label: 'Immatriculation (guichet unique)', parMode: flat('60.00') },
];

const COMPTA_BIC: PresetLine = {
  // BIC reel bookkeeping (bilan, compte de resultat, tableau d'amortissements)
  // is as demanding as a societe a l'IS.
  label: 'Comptabilite BIC reel (liasse + bilan)',
  parMode: {
    SOI_MEME: '0.00',
    EN_LIGNE: '800.00',
    EXPERT_COMPTABLE: '1500.00',
    NOTAIRE_AVOCAT: '1500.00',
  },
};

const ANNUEL_LMP: PresetLine[] = [COMPTA_BIC, CFE_IS, ASSURANCE_PNO, BANQUE];

/** A holding owns shares, not walls — no PNO, but consolidation work instead. */
const ANNUEL_HOLDING: PresetLine[] = [
  COMPTA_IS,
  CFE_IS,
  BANQUE,
  JURIDIQUE_ANNUEL,
  {
    label: 'Consolidation / remontee de dividendes',
    parMode: {
      SOI_MEME: '0.00',
      EN_LIGNE: '100.00',
      EXPERT_COMPTABLE: '250.00',
      NOTAIRE_AVOCAT: '250.00',
    },
  },
];

// ─── Preset lookup ───────────────────────────────────────────────────────────

function presetFor(structureType: StructureType): {
  constitution: PresetLine[];
  annuel: PresetLine[];
} {
  switch (structureType) {
    case 'HOLDING':
      return { constitution: CONSTITUTION_HOLDING, annuel: ANNUEL_HOLDING };
    case 'SCI_IS':
      return { constitution: CONSTITUTION_SOCIETE, annuel: ANNUEL_SCI_IS };
    case 'SCI_IR':
      return { constitution: CONSTITUTION_SOCIETE, annuel: ANNUEL_SCI_IR };
    case 'INDIVIDUAL':
      // Direct ownership: no company, therefore no structure cost at all.
      return { constitution: [], annuel: [] };
    case 'LMP':
      return { constitution: CONSTITUTION_LMP, annuel: ANNUEL_LMP };
  }
}

function materialize(lines: PresetLine[], mode: ManagementMode): ResolvedCostLine[] {
  return lines.map((l) => ({ label: l.label, montant: new Decimal(l.parMode[mode]) }));
}

function fromOverrides(lines: CostLine[]): ResolvedCostLine[] {
  return lines.map((l) => ({ label: l.label, montant: new Decimal(l.montant) }));
}

function sum(lines: ResolvedCostLine[]): Decimal {
  return lines.reduce((acc, l) => acc.plus(l.montant), new Decimal(0));
}

/** Returns the preset lines for a mode/structure pair, for the UI to display. */
export function getPresetCostLines(
  mode: ManagementMode,
  structureType: StructureType,
): { constitution: ResolvedCostLine[]; annuel: ResolvedCostLine[] } {
  const preset = presetFor(structureType);
  return {
    constitution: materialize(preset.constitution, mode),
    annuel: materialize(preset.annuel, mode),
  };
}

/**
 * Resolves the effective costs of a structure.
 *
 * A non-empty override array fully replaces the corresponding preset — the
 * client sends back the whole resolved list as soon as the user edits a line.
 */
export function resolveCosts(
  mode: ManagementMode,
  structureType: StructureType,
  overrides?: { constitution?: CostLine[]; annuel?: CostLine[] },
): ResolvedCosts {
  const preset = presetFor(structureType);

  const lignesConstitution =
    overrides?.constitution && overrides.constitution.length > 0
      ? fromOverrides(overrides.constitution)
      : materialize(preset.constitution, mode);

  const lignesAnnuel =
    overrides?.annuel && overrides.annuel.length > 0
      ? fromOverrides(overrides.annuel)
      : materialize(preset.annuel, mode);

  return {
    constitution: sum(lignesConstitution),
    annuel: sum(lignesAnnuel),
    lignesConstitution,
    lignesAnnuel,
  };
}

/**
 * Running costs for a given year, indexed on general inflation.
 * Year 1 is the reference year (no indexation applied yet).
 */
export function indexedAnnualCost(
  baseAnnual: Decimal,
  year: number,
  inflationRate: Decimal,
): Decimal {
  if (year < 1) return new Decimal(0);
  return baseAnnual.mul(inflationRate.plus(1).pow(year - 1));
}
