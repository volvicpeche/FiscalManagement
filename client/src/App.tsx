import { useEffect, useRef } from 'react';
import { AppShell } from '@/components/AppShell';
import { naviguer, useRoute, type Route } from '@/lib/router';
import { ROUTES_PROTEGEES, SIMULATEURS } from '@/lib/navigation';
import { ConfirmPage, LoginPage, RequireAuth, useSession } from '@/features/auth';
import { AccueilPage } from '@/features/accueil';
import { CreditPage, InteretsPage, RendementPage } from '@/features/outils';
import { SciPage } from '@/features/sci';
import { FrontalierPage } from '@/features/frontalier';
import { SaisonnierPage } from '@/features/saisonnier';
import { AidePage } from '@/features/aide';
import { ConfidentialitePage, MentionsLegalesPage } from '@/features/legal';

const CLE_DERNIERE = 'patrimonia.dernierSimulateur';

function lireDerniere(): Route | null {
  try {
    const r = localStorage.getItem(CLE_DERNIERE) as Route | null;
    return r && ROUTES_PROTEGEES.has(r) ? r : null;
  } catch {
    return null;
  }
}

function Protegee({ route, children }: { route: Route; children: React.ReactNode }) {
  const s = SIMULATEURS.find((x) => x.route === route)!;
  return (
    <RequireAuth titre={s.titre} apport={s.resume}>
      {children}
    </RequireAuth>
  );
}

function App() {
  const route = useRoute();
  const { supabase, user, chargement } = useSession();

  // Remember the last advanced simulator, to reopen it on the next visit.
  useEffect(() => {
    if (!user || !ROUTES_PROTEGEES.has(route)) return;
    try {
      localStorage.setItem(CLE_DERNIERE, route);
    } catch {
      /* private browsing: nothing to remember */
    }
  }, [route, user]);

  // Arriving on the home page logged in: back to where the user left off.
  // Once per page load — the « Accueil » link must still show the home page.
  const arrivee = useRef(true);
  useEffect(() => {
    if (chargement || !arrivee.current) return;
    arrivee.current = false;
    if (user && route === 'accueil') {
      const derniere = lireDerniere();
      if (derniere) naviguer(derniere, { remplacer: true });
    }
  }, [chargement, user, route]);

  // The login pages have nothing to show to someone already logged in.
  useEffect(() => {
    if (user && (route === 'connexion' || route === 'inscription')) {
      naviguer(lireDerniere() ?? 'accueil', { remplacer: true });
    }
  }, [user, route]);

  if (route === 'confirmation') {
    if (!supabase) return <div className="min-h-screen bg-gray-50" aria-busy="true" />;
    return <ConfirmPage supabase={supabase} onTermine={() => naviguer('accueil', { remplacer: true })} />;
  }

  return (
    <AppShell>
      {route === 'accueil' && <AccueilPage />}
      {route === 'credit' && <CreditPage />}
      {route === 'rendement' && <RendementPage />}
      {route === 'interets' && <InteretsPage />}
      {route === 'aide' && <AidePage />}
      {route === 'mentions' && <MentionsLegalesPage />}
      {route === 'confidentialite' && <ConfidentialitePage />}
      {(route === 'connexion' || route === 'inscription') &&
        (supabase ? (
          <div className="py-4">
            <LoginPage key={route} supabase={supabase} integre ongletInitial={route === 'connexion' ? 'connexion' : 'inscription'} />
          </div>
        ) : (
          <div className="min-h-[50vh]" aria-busy="true" />
        ))}
      {route === 'sci' && (
        <Protegee route="sci">
          <SciPage />
        </Protegee>
      )}
      {route === 'frontalier' && (
        <Protegee route="frontalier">
          <FrontalierPage />
        </Protegee>
      )}
      {route === 'saisonnier' && (
        <Protegee route="saisonnier">
          <SaisonnierPage />
        </Protegee>
      )}
    </AppShell>
  );
}

export default App;
