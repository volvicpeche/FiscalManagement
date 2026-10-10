import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import { ANCIENS_CHEMINS, CHEMINS, type Route } from './routes';

/**
 * Just enough routing for a handful of pages: the path is the state,
 * `pushState` changes it, `popstate` follows the browser's back button.
 * nginx and Vite already fall back to index.html on any path.
 */

export { CHEMINS, type Route };

const PAR_CHEMIN = new Map(Object.entries(CHEMINS).map(([route, chemin]) => [chemin, route as Route]));

export function routeDe(pathname: string): Route {
  const chemin = pathname.replace(/\/+$/, '') || '/';
  return PAR_CHEMIN.get(chemin) ?? ANCIENS_CHEMINS[chemin] ?? 'accueil';
}

// An old path shows its page under the current one, keeping the anchor.
if (typeof window !== 'undefined') {
  const ancienne = ANCIENS_CHEMINS[window.location.pathname.replace(/\/+$/, '')];
  if (ancienne) window.history.replaceState(null, '', CHEMINS[ancienne] + window.location.search + window.location.hash);
}

const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());

function abonner(f: () => void) {
  abonnes.add(f);
  window.addEventListener('popstate', f);
  return () => {
    abonnes.delete(f);
    window.removeEventListener('popstate', f);
  };
}

export function useRoute(): Route {
  return useSyncExternalStore(abonner, () => routeDe(window.location.pathname));
}

/** Path of a page, with an optional `#anchor`. */
export const href = (route: Route, ancre?: string) => CHEMINS[route] + (ancre ? `#${ancre}` : '');

/**
 * `remplacer`: no new history entry — a redirect, not a click.
 * `ancre`: a section of the page, which reads `location.hash` on mount.
 */
export function naviguer(route: Route, { remplacer = false, ancre }: { remplacer?: boolean; ancre?: string } = {}) {
  const cible = href(route, ancre);
  if (window.location.pathname + window.location.hash === cible) return;
  window.history[remplacer ? 'replaceState' : 'pushState'](null, '', cible);
  window.scrollTo({ top: 0 });
  prevenir();
}

/** A real link — middle-click and "copy link" work — that navigates in place on a plain click. */
export function Lien({
  vers,
  ancre,
  onClick,
  ...props
}: { vers: Route; ancre?: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const clic = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    naviguer(vers, { ancre });
  };
  return <a href={href(vers, ancre)} onClick={clic} {...props} />;
}
