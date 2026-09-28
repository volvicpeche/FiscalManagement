import { useMutation } from '@tanstack/react-query';
import type { SimulationRequest, SimulationResult } from '@shared/schemas.js';
import { apiFetch } from '@/lib/api';

async function runSimulation(request: SimulationRequest): Promise<SimulationResult> {
  const response = await apiFetch('/api/simulations/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error ?? 'Erreur lors de la simulation');
  }

  return response.json();
}

export function useSimulation() {
  return useMutation({
    mutationFn: runSimulation,
  });
}
