import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SignalementCree, SignalementRequestInput, SignalementResume } from '@shared/frontalier.js';
import { apiFetch } from '@/lib/api';

async function send<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await apiFetch(url, init);
  } catch {
    throw new Error('Serveur injoignable. Reessayez.');
  }
  const raw = await response.text().catch(() => '');
  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const error = body && typeof body === 'object' && 'error' in body ? (body as { error?: unknown }).error : null;
    throw new Error(typeof error === 'string' ? error : `Echec de la requete (HTTP ${response.status}).`);
  }
  return body as T;
}

export function useEnvoyerSignalement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SignalementRequestInput) =>
      send<SignalementCree>('/api/frontalier/signalements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['signalements'] });
      void qc.invalidateQueries({ queryKey: ['compte'] });
    },
  });
}

export function useMesSignalements() {
  return useQuery({ queryKey: ['signalements'], queryFn: () => send<SignalementResume[]>('/api/me/signalements') });
}

export function useSupprimerSignalement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => send<null>(`/api/me/signalements/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['signalements'] });
      void qc.invalidateQueries({ queryKey: ['compte'] });
    },
  });
}
