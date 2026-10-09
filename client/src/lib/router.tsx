import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import { CHEMINS, type Route } from './routes';

/**
 * Just enough routing for a handful of pages: the path is the state,
 * `pushState` changes it, `popstate` follows the browser's back button.
 * nginx and Vite already fall back to index.html on any path.
 */

export { CHEMINS, type Route };

const PAR_CHEMIN = new Map(Object.entries(CHEMINS).map(([route, chemin]) => [chemin, route as Route]));

export function routeDe(pathname: string): Route {
  return PAR_CHEMIN.get(pathname.replace(/\/+$/, '') || '/') ?? 'accueil';
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

/** `remplacer`: no new history entry — a redirect, not a click. */
export function naviguer(route: Route, { remplacer = false }: { remplacer?: boolean } = {}) {
  const chemin = CHEMINS[route];
  if (window.location.pathname === chemin) return;
  window.history[remplacer ? 'replaceState' : 'pushState'](null, '', chemin);
  window.scrollTo({ top: 0 });
  prevenir();
}

/** A real link — middle-click and "copy link" work — that navigates in place on a plain click. */
export function Lien({
  vers,
  onClick,
  ...props
}: { vers: Route } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const clic = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    naviguer(vers);
  };
  return <a href={CHEMINS[vers]} onClick={clic} {...props} />;
}
