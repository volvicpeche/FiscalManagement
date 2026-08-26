import type { ListingExtraction } from '@shared/listing.js';
import { extractListingViaLlm } from './llm/index.js';

const MAX_TEXT_CHARS = 20000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

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

async function fetchListingText(url: URL): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PatrimoniaListingBot/1.0)' },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Impossible de recuperer l'annonce (HTTP ${response.status})`);
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new Error("La page de l'annonce est trop volumineuse");
  }

  const html = await response.text();
  const text = htmlToText(html).slice(0, MAX_TEXT_CHARS);

  if (text.length < 200) {
    throw new Error("Le contenu de l'annonce est trop court pour etre analyse");
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
