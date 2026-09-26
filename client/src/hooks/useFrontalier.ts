import { useMutation } from '@tanstack/react-query';
import type {
  DocumentExtractionResult,
  FrontalierRequestInput,
  FrontalierResult,
} from '@shared/frontalier.js';

/** Fallback wording when the response carries no usable body of its own. */
function statusMessage(status: number): string {
  if (status === 0) return 'Le serveur est injoignable. Est-il demarre (npm run dev:server) ?';
  if (status === 404) return "L'endpoint est introuvable. Le serveur est-il a jour ?";
  if (status === 413) return 'Fichiers trop volumineux : 10 Mo par fichier au maximum.';
  if (status === 502 || status === 503 || status === 504) {
    return "Le serveur n'a pas repondu a temps. Reessayez avec moins de documents a la fois.";
  }
  if (status >= 500) return `Erreur interne du serveur (HTTP ${status}).`;
  return `La requete a echoue (HTTP ${status}).`;
}

/** Reads a body without assuming it is JSON: a proxy error or a timeout comes back empty. */
async function parseBody(response: Response): Promise<unknown> {
  const raw = await response.text().catch(() => '');
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function send<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error(statusMessage(0));
  }

  const body = await parseBody(response);
  if (!response.ok) {
    const error = body && typeof body === 'object' && 'error' in body ? (body as { error?: unknown }).error : null;
    throw new Error(typeof error === 'string' && error.trim() ? error : statusMessage(response.status));
  }
  if (body === null) throw new Error('Le serveur a repondu sans contenu exploitable. Reessayez.');
  return body as T;
}

export function useFrontalierSimulation() {
  return useMutation({
    mutationFn: (request: FrontalierRequestInput) =>
      send<FrontalierResult>('/api/frontalier/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      }),
  });
}

export function useExtractDocuments() {
  return useMutation({
    mutationFn: (fichiers: File[]) => {
      const form = new FormData();
      for (const f of fichiers) form.append('fichiers', f, f.name);
      return send<DocumentExtractionResult[]>('/api/frontalier/documents', { method: 'POST', body: form });
    },
  });
}
