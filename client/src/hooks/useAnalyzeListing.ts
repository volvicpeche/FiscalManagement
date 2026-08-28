import { useMutation } from '@tanstack/react-query';
import type { ListingExtraction } from '@shared/listing.js';

/** A URL to fetch server-side, or text the user pasted from the listing. */
export type AnalyzeInput = { url: string } | { text: string };

/** Fallback wording when the response carries no usable body of its own. */
function statusMessage(status: number): string {
  if (status === 0) return "Le serveur d'analyse est injoignable. Est-il demarre (npm run dev:server) ?";
  if (status === 404) return "L'endpoint d'analyse est introuvable. Le serveur est-il a jour ?";
  if (status === 502 || status === 503 || status === 504) {
    return "Le serveur d'analyse n'a pas repondu a temps. Reessayez, ou collez le texte de l'annonce.";
  }
  if (status >= 500) return `Erreur interne du serveur d'analyse (HTTP ${status}).`;
  return `L'analyse a echoue (HTTP ${status}).`;
}

/**
 * Reads a response body without ever assuming it is JSON.
 *
 * Calling response.json() directly is what turned every server-side failure
 * into a bare "Unexpected end of JSON input": a proxy error, a timeout or a
 * crash all close the connection with an empty body, and the DOM exception
 * replaced the real cause.
 */
async function parseBody(response: Response): Promise<unknown> {
  const raw = await response.text().catch(() => '');
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function errorMessageFrom(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const { error } = body as { error?: unknown };
    if (typeof error === 'string' && error.trim()) return error;
  }
  return statusMessage(status);
}

async function analyzeListing(input: AnalyzeInput): Promise<ListingExtraction> {
  let response: Response;
  try {
    response = await fetch('/api/listings/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    // Network-level failure: the request never reached a server.
    throw new Error(statusMessage(0));
  }

  const body = await parseBody(response);

  if (!response.ok) {
    throw new Error(errorMessageFrom(body, response.status));
  }

  if (body === null) {
    throw new Error("Le serveur a repondu sans contenu exploitable. Reessayez.");
  }

  return body as ListingExtraction;
}

export function useAnalyzeListing() {
  return useMutation({ mutationFn: analyzeListing });
}
