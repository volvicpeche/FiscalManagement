import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LlmSettingsRequest, LlmSettingsView } from '@shared/llmSettings.js';
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

export function useLlmSettings() {
  return useQuery({
    queryKey: ['llm-settings'],
    queryFn: () => send<LlmSettingsView>('/api/me/llm'),
  });
}

export function useSaveLlmSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LlmSettingsRequest) =>
      send<LlmSettingsView>('/api/me/llm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: (vue) => qc.setQueryData(['llm-settings'], vue),
  });
}

export function useDeleteLlmSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => send<null>('/api/me/llm', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['llm-settings'] }),
  });
}
