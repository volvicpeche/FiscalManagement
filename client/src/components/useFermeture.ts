import { useEffect, type RefObject } from 'react';

/** Closes a menu on a click outside `racine` or on Escape, while it is open. */
export function useFermeture(racine: RefObject<HTMLElement | null>, ouvert: boolean, fermer: () => void) {
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      if (!racine.current?.contains(e.target as Node)) fermer();
    };
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && fermer();
    document.addEventListener('mousedown', dehors);
    document.addEventListener('keydown', echap);
    return () => {
      document.removeEventListener('mousedown', dehors);
      document.removeEventListener('keydown', echap);
    };
  }, [racine, ouvert, fermer]);
}
