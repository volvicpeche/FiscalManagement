/**
 * What the site keeps in this browser under its own prefix: the quick tools'
 * inputs, the last simulator opened, the consents given. The Supabase session
 * has its own key and is left to supabase-js.
 *
 * Read for the export (it is part of « your data ») and emptied when the
 * account is deleted. Every access is wrapped: private browsing may refuse.
 */
const PREFIXE = 'patrimonia.';

/** Set right before the reload that follows a deletion, read once by the home page. */
export const CLE_COMPTE_SUPPRIME = `${PREFIXE}compteSupprime`;

function cles(): string[] {
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith(PREFIXE));
  } catch {
    return [];
  }
}

/** The site's entries, values parsed when they are JSON. */
export function lireStockageLocal(): Record<string, unknown> {
  const contenu: Record<string, unknown> = {};
  for (const k of cles()) {
    try {
      const v = localStorage.getItem(k);
      if (v === null) continue;
      try {
        contenu[k] = JSON.parse(v);
      } catch {
        contenu[k] = v;
      }
    } catch {
      /* unreadable: left out */
    }
  }
  return contenu;
}

export function viderStockageLocal() {
  for (const k of cles()) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* nothing more to do */
    }
  }
}
