import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

/**
 * Keeps the listing fetcher from being turned against the network it runs in.
 *
 * `/api/listings/analyze` fetches whatever URL it is given — with a plain
 * request, then with a real Chrome. Checking the hostname as a string is not
 * enough: a public name can resolve to 127.0.0.1, a public page can redirect
 * to 10.0.0.1, and `[::1]` or `[::ffff:127.0.0.1]` slip past a regex written
 * for dotted IPv4. So the check is made on the ADDRESSES the name resolves to,
 * and repeated on every redirect and every request the browser makes.
 *
 * Residual risk: DNS rebinding between this lookup and the connection. It
 * needs a hostile DNS server answering differently within milliseconds; the
 * server has little worth reaching from the container, and the whole app sits
 * behind basic auth, so it is accepted rather than solved with a pinned agent.
 */

const bloquees = new BlockList();

// IPv4 — everything that is not the public Internet.
for (const [reseau, prefixe] of [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata endpoints
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, broadcast
] as const) {
  bloquees.addSubnet(reseau, prefixe, 'ipv4');
}

// IPv6 — IPv4-mapped addresses are unwrapped below and checked as IPv4.
for (const [reseau, prefixe] of [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['64:ff9b::', 96], // NAT64, reaches IPv4 through a gateway
  ['100::', 64], // discard
  ['2001:db8::', 32], // documentation
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
] as const) {
  bloquees.addSubnet(reseau, prefixe, 'ipv6');
}

/** `::ffff:10.0.0.1` is 10.0.0.1: judge it as the IPv4 it wraps. */
function ipv4Encapsulee(adresse: string): string | null {
  const m = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(adresse);
  return m ? m[1] : null;
}

/** True for any address a server-side fetch must never reach. */
export function isAdressePrivee(adresse: string): boolean {
  const v4 = ipv4Encapsulee(adresse);
  if (v4) return bloquees.check(v4, 'ipv4');

  const famille = isIP(adresse);
  if (famille === 4) return bloquees.check(adresse, 'ipv4');
  if (famille === 6) {
    // The textual ::ffff:a.b.c.d form is handled above; the hex form
    // (::ffff:7f00:1) lands here and falls inside the mapped range.
    if (/^::ffff:/i.test(adresse)) return true;
    return bloquees.check(adresse, 'ipv6');
  }
  // Not an IP at all: refuse rather than guess.
  return true;
}

/**
 * A refusal, as opposed to a network failure. Callers must let it through
 * untouched: retrying a refused URL through the browser would defeat the check.
 */
export class AdresseRefuseeError extends Error {
  constructor() {
    super('Cette URL pointe vers une adresse reseau non autorisee');
    this.name = 'AdresseRefuseeError';
  }
}

/**
 * Throws unless every address `url`'s host resolves to is public.
 *
 * @param resoudre - Injected in tests; the system resolver otherwise.
 */
export async function assertUrlPublique(
  url: URL,
  resoudre: (host: string) => Promise<string[]> = resoudreHote,
): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Seules les URL http(s) sont acceptees');
  }

  // URL keeps IPv6 literals in brackets: "[::1]".
  const hote = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();

  let adresses: string[];
  if (isIP(hote)) {
    adresses = [hote];
  } else {
    try {
      adresses = await resoudre(hote);
    } catch {
      throw new Error(`Impossible de joindre ${url.hostname}. Verifiez l'URL.`);
    }
  }

  if (adresses.length === 0 || adresses.some(isAdressePrivee)) {
    throw new AdresseRefuseeError();
  }
}

async function resoudreHote(hote: string): Promise<string[]> {
  const resultats = await lookup(hote, { all: true, verbatim: true });
  return resultats.map((r) => r.address);
}

/**
 * The same check for a stream of requests — the browser's page and every
 * resource it loads — with a small cache so a page with a hundred images on
 * the same CDN costs one lookup, not a hundred.
 */
export function creerVerificateur(
  resoudre: (host: string) => Promise<string[]> = resoudreHote,
): (url: URL) => Promise<boolean> {
  const cache = new Map<string, Promise<boolean>>();
  return (url: URL) => {
    const cle = `${url.protocol}//${url.host}`;
    let verdict = cache.get(cle);
    if (!verdict) {
      verdict = assertUrlPublique(url, resoudre).then(
        () => true,
        () => false,
      );
      cache.set(cle, verdict);
    }
    return verdict;
  };
}

/** Redirects followed by `fetchPublic` before giving up. */
export const MAX_REDIRECTIONS = 5;

/**
 * `fetch` with `redirect: 'follow'` would chase a Location header to any
 * address without asking. Follow them by hand instead, checking each hop.
 */
export async function fetchPublic(
  url: URL,
  init: Omit<RequestInit, 'redirect'>,
  resoudre?: (host: string) => Promise<string[]>,
): Promise<Response> {
  let courante = url;
  for (let saut = 0; saut <= MAX_REDIRECTIONS; saut++) {
    await assertUrlPublique(courante, resoudre);
    const response = await fetch(courante, { ...init, redirect: 'manual' });

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      // Drain the body so the connection is released before the next hop.
      await response.body?.cancel().catch(() => undefined);
      courante = new URL(location, courante);
      continue;
    }
    return response;
  }
  throw new Error("L'annonce redirige trop de fois : collez son texte a la place.");
}
