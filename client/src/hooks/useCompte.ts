import { useMutation, useQuery } from '@tanstack/react-query';
import type { ExportCompte, ResumeCompte } from '@shared/compte.js';
import { apiFetch } from '@/lib/api';
import { lireStockageLocal } from '@/lib/stockageLocal';

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

export function useResumeCompte() {
  return useQuery({ queryKey: ['compte'], queryFn: () => send<ResumeCompte>('/api/me') });
}

/**
 * Downloads everything: what the server holds, plus what this browser keeps
 * for the site (which the server never sees).
 */
export function useExporterCompte() {
  return useMutation({
    mutationFn: async () => {
      const serveur = await send<ExportCompte>('/api/me/export');
      const contenu = { ...serveur, navigateur: lireStockageLocal() };
      const url = URL.createObjectURL(new Blob([JSON.stringify(contenu, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `patrimonia-export-${serveur.exporteLe.slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  });
}

export function useSupprimerCompte() {
  return useMutation({
    mutationFn: (confirmation: string) =>
      send<null>('/api/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation }),
      }),
  });
}
