import { useRef, useState, type ReactNode } from 'react';
import { Logo } from './Logo';
import { useFermeture } from './useFermeture';
import { Lien, useRoute, type Route } from '@/lib/router';
import { OUTILS, SIMULATEURS, type EntreeNav } from '@/lib/navigation';
import { UserMenu, useSession } from '@/features/auth';

const lienPlat = (actif: boolean) =>
  `px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
    actif ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
  }`;

function Verrou({ visible }: { visible: boolean }) {
  return visible ? (
    <span aria-label="compte requis" className="ml-1 text-xs">
      🔒
    </span>
  ) : null;
}

/** A group of pages behind one button, for the desktop header. */
function MenuGroupe({ titre, entrees, verrou }: { titre: string; entrees: EntreeNav[]; verrou: boolean }) {
  const route = useRoute();
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  useFermeture(racine, ouvert, () => setOuvert(false));
  const actif = entrees.some((e) => e.route === route);

  return (
    <div ref={racine} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
        className={lienPlat(actif)}
      >
        {titre} <span aria-hidden>▾</span>
      </button>
      {ouvert && (
        <div role="menu" className="absolute left-0 z-20 mt-2 w-80 overflow-hidden rounded-lg border bg-white shadow-lg">
          {entrees.map((e) => (
            <Lien
              key={e.route}
              vers={e.route}
              role="menuitem"
              onClick={() => setOuvert(false)}
              className={`block px-4 py-3 hover:bg-gray-50 ${e.route === route ? 'bg-indigo-50' : ''}`}
            >
              <span className="text-sm font-medium text-gray-900">
                {e.titre}
                <Verrou visible={verrou} />
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">{e.resume}</span>
            </Lien>
          ))}
        </div>
      )}
    </div>
  );
}

/** Below lg: every page in one panel — the full bar does not fit next to the login buttons. */
function MenuMobile({ verrou }: { verrou: boolean }) {
  const route = useRoute();
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  useFermeture(racine, ouvert, () => setOuvert(false));

  const lien = (r: Route, titre: string, v = false) => (
    <Lien
      key={r}
      vers={r}
      onClick={() => setOuvert(false)}
      className={`block rounded-md px-3 py-2 text-sm ${r === route ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}
    >
      {titre}
      <Verrou visible={v} />
    </Lien>
  );

  return (
    <div ref={racine} className="lg:hidden">
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
        className="rounded-md border px-3 py-1.5 text-sm text-gray-700"
      >
        ☰
      </button>
      {ouvert && (
        <nav className="absolute inset-x-0 top-full z-20 border-b bg-white px-4 py-3 shadow-lg">
          {lien('accueil', 'Accueil')}
          <p className="mt-3 px-3 text-xs font-medium uppercase tracking-wide text-gray-400">Outils rapides</p>
          {OUTILS.map((e) => lien(e.route, e.titre))}
          <p className="mt-3 px-3 text-xs font-medium uppercase tracking-wide text-gray-400">Simulateurs avances</p>
          {SIMULATEURS.map((e) => lien(e.route, e.titre, verrou))}
          <div className="mt-3 border-t pt-3">
            {lien('aide', 'Aide')}
            {verrou && lien('connexion', 'Se connecter')}
          </div>
        </nav>
      )}
    </div>
  );
}

/**
 * Header and page frame. A visitor sees the advanced simulators with a lock
 * and the login buttons; a logged-in user, their account menu.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const route = useRoute();
  const { user, chargement } = useSession();
  const verrou = !user && !chargement;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-white shadow-sm">
        <div className="relative mx-auto flex max-w-[1800px] items-center justify-between gap-3 px-4 py-3">
          <Lien vers="accueil" className="flex min-w-0 items-center gap-3">
            <Logo size={36} className="shrink-0" />
            <span className="truncate text-xl font-bold text-gray-900 sm:text-2xl">Patrimonia</span>
          </Lien>

          <nav className="hidden items-center gap-1 rounded-lg bg-gray-100 p-1 lg:flex">
            <Lien vers="accueil" className={lienPlat(route === 'accueil')}>
              Accueil
            </Lien>
            <MenuGroupe titre="Outils rapides" entrees={OUTILS} verrou={false} />
            <MenuGroupe titre="Simulateurs avances" entrees={SIMULATEURS} verrou={verrou} />
            <Lien vers="aide" className={lienPlat(route === 'aide')}>
              Aide
            </Lien>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {user ? (
              <UserMenu />
            ) : (
              !chargement && (
                <>
                  <Lien vers="connexion" className="hidden whitespace-nowrap px-2 py-1.5 text-sm text-gray-600 hover:text-gray-900 sm:inline">
                    Se connecter
                  </Lien>
                  <Lien
                    vers="inscription"
                    className="whitespace-nowrap rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Creer un compte
                  </Lien>
                </>
              )
            )}
            <MenuMobile verrou={verrou} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1800px] px-4 py-6">{children}</main>
    </div>
  );
}
