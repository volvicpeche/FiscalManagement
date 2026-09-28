import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { AuthContext } from './AuthContext';
import { LoginPage } from './LoginPage';
import { CHEMIN_CONFIRMATION, ConfirmPage } from './ConfirmPage';
import { AuthCard, Alerte } from './ui';

/**
 * Renders the app only for a logged-in user; the login screen otherwise.
 *
 * On sign-out the page reloads: the stores (Zustand) and the query cache hold
 * the previous user's figures in memory, and a reload is the one way to be
 * sure none of it shows to whoever logs in next on the same browser.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(window.location.pathname === CHEMIN_CONFIRMATION);

  useEffect(() => {
    let desabonner: (() => void) | undefined;
    getSupabase()
      .then((client) => {
        setSupabase(client);
        const { data } = client.auth.onAuthStateChange((event, s) => {
          if (event === 'SIGNED_OUT') {
            window.location.assign('/');
            return;
          }
          setSession(s);
        });
        desabonner = () => data.subscription.unsubscribe();
      })
      .catch((err: Error) => setErreur(err.message));
    return () => desabonner?.();
  }, []);

  const terminerConfirmation = useCallback(() => {
    window.history.replaceState(null, '', '/');
    setConfirmation(false);
  }, []);

  const contexte = useMemo(
    () =>
      supabase && session
        ? { user: session.user, signOut: async () => void (await supabase.auth.signOut()) }
        : null,
    [supabase, session],
  );

  if (erreur) {
    return (
      <AuthCard titre="Application indisponible">
        <Alerte type="erreur">{erreur}</Alerte>
        <button type="button" onClick={() => window.location.reload()} className="text-sm text-blue-700 hover:underline">
          Reessayer
        </button>
      </AuthCard>
    );
  }

  if (!supabase || session === undefined) {
    return <div className="min-h-screen bg-gray-50" aria-busy="true" />;
  }

  if (confirmation) return <ConfirmPage supabase={supabase} onTermine={terminerConfirmation} />;
  if (!contexte) return <LoginPage supabase={supabase} />;

  return <AuthContext.Provider value={contexte}>{children}</AuthContext.Provider>;
}
