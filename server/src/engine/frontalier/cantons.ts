import type Decimal from 'decimal.js';
import type { CalculICC, CantonTravail, FrontalierRequest } from '@shared/frontalier.js';
import type { TableTarifSource } from '../tarifSource.js';
import type { BienReq, ReglesColonne } from './commun.js';
import { MODULE_GE } from './geneve.js';
import { MODULE_ZH } from './zurich.js';

/**
 * What a canton brings to the TOU computation. Everything else — the
 * household, the 90 % test, the IFD, the French properties, the comparison
 * with the source tax — is shared (commun.ts, federal.ts).
 */
export interface ModuleCantonal {
  canton: CantonTravail;
  disponible: true;
  /** « Geneve », for the labels. */
  nom: string;
  /** Fiscal year of the cantonal figures. */
  annee: number;
  /** Administration receiving the TOU request (« AFC-GE »). */
  autorite: string;
  /** Deadline of the TOU request for the year, ISO date. */
  dateLimite: string;
  /** Cantonal deductions, the ICC column of the result. */
  regles: ReglesColonne;
  /** Maintenance forfait the canton grants for this property, in EUR; null when none. */
  forfaitEntretien(b: BienReq): Decimal | null;
  /** Cantonal and communal tax on the Swiss taxable income, rate set with the foreign income. */
  computeImpot(req: FrontalierRequest, imposable: Decimal, etrangers: Decimal): CalculICC;
  /** The canton's source-tax tariff (AFC file tar26xx.txt). */
  tarifSource: TableTarifSource;
}

/** A canton on the list whose official figures are not in the engine yet. */
export interface CantonIndisponible {
  canton: CantonTravail;
  disponible: false;
  nom: string;
  /** What is missing, in French, for the user and for whoever plugs it in. */
  donneesManquantes: string[];
}

export const CANTONS: Record<CantonTravail, ModuleCantonal | CantonIndisponible> = {
  GE: MODULE_GE,
  ZH: MODULE_ZH,
};

export class CantonIndisponibleError extends Error {
  constructor(readonly module: CantonIndisponible) {
    super(
      `Le calcul pour le canton de ${module.nom} n'est pas encore disponible : il manque ${module.donneesManquantes.join(' ; ')}.`,
    );
    this.name = 'CantonIndisponibleError';
  }
}

export function moduleCantonal(canton: CantonTravail): ModuleCantonal {
  const m = CANTONS[canton];
  if (!m.disponible) throw new CantonIndisponibleError(m);
  return m;
}
