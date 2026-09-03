import os from 'node:os';
import path from 'node:path';
import { chromium, type BrowserContext } from 'patchright';

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

export async function fetchListingTextViaBrowser(url: URL): Promise<string> {
  let context: BrowserContext;
  try {
    context = await getContext();
  } catch {
    throw new Error(
      "Chrome n'a pas pu etre pilote pour lire cette annonce. Collez le texte de l'annonce a la place.",
    );
  }

  const page = await context.newPage();
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
