import type { ListingExtraction } from '@shared/listing.js';
import { extractListingViaLlm } from './llm/index.js';

const MAX_TEXT_CHARS = 20000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
/** Below this, there is nothing for the model to work with. */
export const MIN_TEXT_CHARS = 200;

/** Blocks the obvious SSRF targets: non-http(s) schemes and private/loopback hosts. */
export function assertPublicHttpUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL invalide");
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Seules les URL http(s) sont acceptees');
  }

  const host = url.hostname.toLowerCase();
  const blocked =
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host === '::1' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

  if (blocked) {
    throw new Error("Cette URL pointe vers une adresse reseau non autorisee");
  }

  return url;
}

/** Strips tags/scripts from raw HTML into plain, LLM-friendly text. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A hung portal must never hang the request: cap the whole fetch. */
const FETCH_TIMEOUT_MS = 15000;

/** Portals that answer 403/429 to any server-side request, whatever the headers. */
function blockedByPortalMessage(status: number, host: string): string {
  return (
    `${host} bloque la lecture automatique des annonces (HTTP ${status}). ` +
    "Copiez le texte de l'annonce et collez-le dans « Coller le texte de l'annonce »."
  );
}

function fetchFailureMessage(status: number, host: string): string {
  if (status === 403 || status === 401 || status === 429) return blockedByPortalMessage(status, host);
  if (status === 404) return "Cette annonce est introuvable (HTTP 404). Verifiez l'URL.";
  if (status >= 500) return `Le site de l'annonce est indisponible (HTTP ${status}). Reessayez plus tard.`;
  return `Impossible de recuperer l'annonce (HTTP ${status}).`;
}

async function fetchListingText(url: URL): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        // Kept honest on purpose: spoofing a browser User-Agent does not get
        // past SeLoger/LeBonCoin/PAP, which block server-side requests
        // outright. Accept-Language is plain content negotiation, not
        // impersonation.
        'User-Agent': 'Mozilla/5.0 (compatible; PatrimoniaListingBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    // Without this the request hangs forever on a tarpitting host, the proxy
    // eventually closes the connection with an empty body, and the browser
    // reports a bare "Unexpected end of JSON input".
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new Error(
        `${url.hostname} n'a pas repondu en ${FETCH_TIMEOUT_MS / 1000} secondes. ` +
          "Collez le texte de l'annonce a la place.",
      );
    }
    // undici gives up on a stalled connection after ~10 s, before our own
    // timeout fires, so this branch must be just as actionable as the one above.
    throw new Error(
      `Impossible de joindre ${url.hostname}. Verifiez l'URL, ou collez le texte de l'annonce.`,
    );
  }

  if (!response.ok) {
    throw new Error(fetchFailureMessage(response.status, url.hostname));
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new Error("La page de l'annonce est trop volumineuse");
  }

  const html = await response.text();
  const text = htmlToText(html).slice(0, MAX_TEXT_CHARS);

  if (text.length < MIN_TEXT_CHARS) {
    throw new Error(
      "La page ne contient pas assez de texte exploitable — l'annonce est probablement " +
        "chargee en JavaScript. Collez le texte de l'annonce a la place.",
    );
  }

  return text;
}

/**
 * Fetches a listing URL and extracts its features + a rough seasonal-rental
 * estimate via whichever LLM provider is configured (LLM_PROVIDER env var —
 * see server/.env.example and services/llm/index.ts).
 */
export async function analyzeListing(rawUrl: string): Promise<ListingExtraction> {
  const url = assertPublicHttpUrl(rawUrl);
  const text = await fetchListingText(url);
  return extractListingViaLlm(text);
}

/**
 * Same extraction, from text the user pasted themselves.
 *
 * This is the only route that works for SeLoger, LeBonCoin and PAP: they
 * answer 403 to any server-side request regardless of headers, so their
 * listings can never be fetched — only read by the person browsing them.
 */
export async function analyzeListingText(rawText: string): Promise<ListingExtraction> {
  const text = rawText.trim().slice(0, MAX_TEXT_CHARS);

  if (text.length < MIN_TEXT_CHARS) {
    throw new Error(
      `Le texte colle est trop court (${text.length} caracteres, minimum ${MIN_TEXT_CHARS}). ` +
        "Copiez la description complete de l'annonce.",
    );
  }

  return extractListingViaLlm(text);
}
