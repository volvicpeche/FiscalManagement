import os from 'node:os';
import path from 'node:path';
import { chromium, type BrowserContext } from 'patchright';
import { creerVerificateur } from './netGuard.js';

/**
 * Reads a listing page through a real Chrome, for portals that refuse plain
 * HTTP requests.
 *
 * SeLoger, LeBonCoin and PAP sit behind DataDome, which answers 403 to any
 * request that is not a genuine browser. Measured against a SeLoger listing:
 *
 *   fetch()                                  403
 *   playwright-core + Chrome, headless       403 (DataDome CAPTCHA)
 *   patchright, headless                     403
 *   patchright, headed, persistent profile   page served
 *
 * Hence the two non-negotiable settings below: `headless: false`, because
 * headless is exactly the signal DataDome keys on, and a persistent profile,
 * so the trust cookie survives between listings instead of being re-earned
 * every time.
 */

const PROFILE_DIR = path.join(os.tmpdir(), 'patrimonia-listing-profile');
const NAV_TIMEOUT_MS = 45000;
/** Let client-side rendering and any challenge settle before reading the DOM. */
const SETTLE_MS = 4000;
const MAX_TEXT_CHARS = 20000;

/** Chrome must be visible, but it does not have to be in the way. */
const OFFSCREEN_ARGS = ['--window-position=-2400,-2400', '--disable-blink-features=AutomationControlled'];

// Chrome refuses its own sandbox as root, which is how it runs in the
// container image (see server/Dockerfile) — CHROME_NO_SANDBOX is set there
// only, so local dev keeps the sandbox.
if (process.env.CHROME_NO_SANDBOX === 'true') {
  OFFSCREEN_ARGS.push('--no-sandbox');
}

let contextPromise: Promise<BrowserContext> | null = null;

/**
 * One Chrome for the whole process: launching costs seconds, and the shared
 * profile is what accumulates the trust cookie across listings.
 */
async function getContext(): Promise<BrowserContext> {
  if (!contextPromise) {
    contextPromise = chromium
      .launchPersistentContext(PROFILE_DIR, {
        channel: 'chrome',
        headless: false,
        locale: 'fr-FR',
        timezoneId: 'Europe/Paris',
        viewport: { width: 1440, height: 900 },
        args: OFFSCREEN_ARGS,
        // A service worker's requests escape page.route(): the address check
        // below would not see them.
        serviceWorkers: 'block',
      })
      .catch((err) => {
        contextPromise = null;
        throw err;
      });
  }
  return contextPromise;
}

export async function closeBrowser(): Promise<void> {
  if (!contextPromise) return;
  const ctx = await contextPromise.catch(() => null);
  contextPromise = null;
  await ctx?.close().catch(() => undefined);
}

/** True when a real Chrome is installed and drivable. */
export function browserFallbackEnabled(): boolean {
  return process.env.LISTING_BROWSER_FALLBACK !== 'false';
}

/**
 * Names the actual reason Chrome would not start.
 *
 * The three failures below are indistinguishable from the UI otherwise, and
 * only one of them ("le portail a refuse") is about the portal at all — the
 * other two are a missing local install, which no amount of retrying fixes.
 */
function describeLaunchFailure(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);

  if (/is not found at|Executable doesn'?t exist|playwright install/i.test(msg)) {
    return (
      "Google Chrome n'est pas installe sur le serveur, la lecture automatique " +
      "est donc indisponible. Collez le texte de l'annonce a la place."
    );
  }
  if (/Missing X server|\$DISPLAY|cannot open display/i.test(msg)) {
    return (
      "Chrome n'a aucun affichage disponible (DISPLAY) et ne peut pas etre " +
      "lance. Collez le texte de l'annonce a la place."
    );
  }
  return "Chrome n'a pas pu etre pilote pour lire cette annonce. Collez le texte de l'annonce a la place.";
}

/**
 * One page at a time, and a short queue behind it.
 *
 * Each page costs a few hundred MB of RAM on a small VPS. Without a limit, a
 * handful of concurrent calls to /api/listings/analyze was enough to exhaust
 * the machine; with it, the excess is refused straight away instead.
 */
const MAX_EN_ATTENTE = 2;
let file: Promise<unknown> = Promise.resolve();
let enAttente = 0;

export async function fetchListingTextViaBrowser(url: URL): Promise<string> {
  if (enAttente >= MAX_EN_ATTENTE) {
    throw new Error(
      "Trop d'annonces en cours d'analyse. Reessayez dans une minute, ou collez le texte de l'annonce.",
    );
  }
  enAttente++;
  const tour = file.then(() => lireAvecChrome(url));
  file = tour.catch(() => undefined);
  try {
    return await tour;
  } finally {
    enAttente--;
  }
}

async function lireAvecChrome(url: URL): Promise<string> {
  let context: BrowserContext;
  try {
    context = await getContext();
  } catch (err) {
    // The cause used to be swallowed here, which left every launch failure
    // looking identical both in the UI and in the server log.
    console.error('[listing] Chrome launch failed:', err);
    throw new Error(describeLaunchFailure(err));
  }

  const page = await context.newPage();
  // Every request the page makes — the document, its redirects, each image and
  // script — is checked against private ranges before it leaves. The page is
  // attacker-chosen: without this it could make Chrome reach inside the network.
  const estPublique = creerVerificateur();
  await page.route('**/*', async (route) => {
    let autorisee = false;
    try {
      autorisee = await estPublique(new URL(route.request().url()));
    } catch {
      autorisee = false;
    }
    await (autorisee ? route.continue() : route.abort('blockedbyclient'));
  });
  try {
    const response = await page.goto(url.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT_MS,
    });
    await page.waitForTimeout(SETTLE_MS);

    const status = response?.status() ?? 0;
    const text = (await page.innerText('body')).replace(/\s+/g, ' ').trim();

    // DataDome's challenge renders an all-but-empty document.
    if (status === 403 || text.length < 200) {
      throw new Error(
        `${url.hostname} a refuse la lecture automatique de cette annonce. ` +
          "Collez le texte de l'annonce a la place.",
      );
    }

    return text.slice(0, MAX_TEXT_CHARS);
  } finally {
    await page.close().catch(() => undefined);
  }
}
