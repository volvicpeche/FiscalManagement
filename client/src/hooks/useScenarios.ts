import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  SavedScenario,
  SaveScenarioRequest,
  ScenarioKind,
  ScenarioSummary,
} from '@shared/scenario.js';

/** Reads a response without assuming it is JSON, as the listing hook does. */
async function readJson(response: Response): Promise<unknown> {
  const raw = await response.text().catch(() => '');
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error('Serveur injoignable. Est-il demarre (npm run dev:server) ?');
  }

  const body = await readJson(response);

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `Echec de la requete (HTTP ${response.status}).`;
    throw new Error(message);
  }

  return body as T;
}

export function useScenarioList(kind: ScenarioKind) {
  return useQuery({
    queryKey: ['scenarios'],
    queryFn: () => request<ScenarioSummary[]>('/api/simulations'),
    select: (all) => all.filter((s) => s.kind === kind),
  });
}

export function useSaveScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveScenarioRequest) =>
      request<SavedScenario>('/api/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios'] }),
  });
}

export function useUpdateScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: SaveScenarioRequest & { id: string }) =>
      request<SavedScenario>(`/api/simulations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios'] }),
  });
}

export function useDeleteScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<null>(`/api/simulations/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios'] }),
  });
}

/** Fetched on demand rather than cached: loading is an explicit user action. */
export function loadScenario(id: string): Promise<SavedScenario> {
  return request<SavedScenario>(`/api/simulations/${id}`);
}
