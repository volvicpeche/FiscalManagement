import { useQuery } from '@tanstack/react-query';
import type { CostLine, ManagementMode, StructureType } from '@shared/schemas.js';

export type CostPresets = Record<
  ManagementMode,
  Record<StructureType, { constitution: CostLine[]; annuel: CostLine[] }>
>;

async function fetchCostPresets(): Promise<CostPresets> {
  const response = await fetch('/api/costs/presets');
  if (!response.ok) throw new Error('Impossible de charger les couts de reference');
  return response.json();
}

/**
 * Cost presets come from the engine rather than being duplicated client-side,
 * so the form and the simulation can never drift apart.
 */
export function useCostPresets() {
  return useQuery({
    queryKey: ['cost-presets'],
    queryFn: fetchCostPresets,
    staleTime: Infinity,
  });
}
