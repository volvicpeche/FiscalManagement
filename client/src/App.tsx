import { useEffect } from 'react';
import { AppShell } from '@/components/AppShell';
import { naviguer, useRoute, type Route } from '@/lib/router';
import { SIMULATEURS, lireDernierSimulateur, memoriserDernierSimulateur } from '@/lib/navigation';
import { appliquerMeta } from '@/lib/seo';
import { ConfirmPage, LoginPage, RequireAuth, useSession } from '@/features/auth';
import { AccueilPage } from '@/features/accueil';
import { CreditPage, InteretsPage, RendementPage } from '@/features/outils';
import { SciPage } from '@/features/sci';
import { DirectPage } from '@/features/direct';
import { FrontalierPage } from '@/features/frontalier';
import { PrevoyancePage } from '@/features/prevoyance';
import { SaisonnierPage } from '@/features/saisonnier';
import { AidePage } from '@/features/aide';
import { ConfidentialitePage, MentionsLegalesPage } from '@/features/legal';
import { ComptePage } from '@/features/compte';

const COMPTE = { titre: 'Mon compte', resume: 'Vos donnees, leur export et la suppression de votre compte.' };

function Protegee({ route, children }: { route: Route; children: React.ReactNode }) {
  const s = SIMULATEURS.find((x) => x.route === route) ?? COMPTE;
  return (
    <RequireAuth titre={s.titre} apport={s.resume}>
      {children}
    </RequireAuth>
  );
}

function App() {
  const route = useRoute();
  const { supabase, user } = useSession();

  useEffect(() => appliquerMeta(route), [route]);

  // Remembered for the home page's « Mes simulateurs » button. Never used to
  // redirect on load: a refresh must stay on the page being refreshed.
  useEffect(() => {
    if (user && SIMULATEURS.some((s) => s.route === route)) memoriserDernierSimulateur(route);
  }, [route, user]);

  // The login pages have nothing to show to someone already logged in.
  useEffect(() => {
    if (user && (route === 'connexion' || route === 'inscription')) {
      naviguer(lireDernierSimulateur() ?? 'accueil', { remplacer: true });
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
      {route === 'direct' && (
        <Protegee route="direct">
          <DirectPage />
        </Protegee>
      )}
      {route === 'frontalier' && (
        <Protegee route="frontalier">
          <FrontalierPage />
        </Protegee>
      )}
      {route === 'prevoyance' && (
        <Protegee route="prevoyance">
          <PrevoyancePage />
        </Protegee>
      )}
      {route === 'compte' && (
        <Protegee route="compte">
          <ComptePage />
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
