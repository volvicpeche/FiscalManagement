import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// The SDK's structured-output helper is typed against the zod/v4 API, while
// the rest of this codebase uses classic zod (v3 API, exported by the same
// "zod" package). Building a local v4-flavoured mirror for this one call —
// then re-validating the result through the shared classic schema below —
// keeps that version split contained to this file.
import * as zv4 from 'zod/v4';
import { ListingExtractionSchema, type ListingExtraction } from '@shared/listing.js';

const ListingExtractionSchemaV4 = zv4.object({
  label: zv4.string().nullable(),
  ville: zv4.string().nullable(),
  codePostal: zv4.string().nullable(),
  surfaceM2: zv4.number().nullable(),
  nbPieces: zv4.number().nullable(),
  nbChambres: zv4.number().nullable(),
  capaciteCouchage: zv4.number().nullable(),
  prixVente: zv4.number().nullable(),
  atouts: zv4.object({
    piscine: zv4.boolean(),
    vue: zv4.boolean(),
    spa: zv4.boolean(),
    terrainPetanque: zv4.boolean(),
    climatisation: zv4.boolean(),
    parking: zv4.boolean(),
    autres: zv4.array(zv4.string()),
  }),
  estimationSaisonniere: zv4.object({
    hauteSaison: zv4.object({ tauxOccupation: zv4.number(), caPeriode: zv4.number() }),
    moyenneSaison: zv4.object({ tauxOccupation: zv4.number(), caPeriode: zv4.number() }),
    basseSaison: zv4.object({ tauxOccupation: zv4.number(), caPeriode: zv4.number() }),
    rationale: zv4.string(),
  }),
});

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

const SYSTEM_PROMPT = `Tu extrais les caracteristiques d'un bien immobilier a partir du texte brut d'une annonce de vente en France, en vue d'une exploitation en location saisonniere.

Renseigne null pour toute information absente du texte plutot que de deviner une valeur precise (surface, prix, nombre de pieces, localite...).

Propose ensuite une estimation INDICATIVE et PRUDENTE du potentiel de location saisonniere (taux d'occupation et chiffre d'affaires par saison), fondee sur la localite, le standing du bien et ses atouts (piscine, vue, spa, etc.). Explique brievement les hypotheses retenues dans le champ rationale — cette estimation n'est pas une donnee de marche verifiee, l'utilisateur doit pouvoir juger de sa fiabilite.`;

/** Fetches a listing URL and extracts its features + a rough seasonal-rental estimate via Claude. */
export async function analyzeListing(rawUrl: string): Promise<ListingExtraction> {
  const url = assertPublicHttpUrl(rawUrl);
  const text = await fetchListingText(url);

  const client = new Anthropic();

  const response = await client.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Annonce (texte extrait de la page) :\n\n${text}` }],
    output_config: { format: zodOutputFormat(ListingExtractionSchemaV4) },
  });

  if (!response.parsed_output) {
    throw new Error("L'analyse de l'annonce a echoue");
  }

  return ListingExtractionSchema.parse(response.parsed_output);
}
