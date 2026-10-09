import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { AuthContext, SessionContext, type AuthContextValue } from './AuthContext';

/**
 * Loads Supabase and follows the session, without blocking anything: the
 * quick tools are public, only RequireAuth asks for a login.
 *
 * On sign-out the page reloads to the home page: the stores (Zustand) and
 * the query cache hold the previous user's figures in memory, and a reload is
 * the one way to be sure none of it shows to whoever logs in next on the
 * same browser.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [erreur, setErreur] = useState<string | null>(null);

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
      .catch((err: Error) => {
        setErreur(err.message);
        setSession(null);
      });
    return () => desabonner?.();
  }, []);

  const user = session?.user ?? null;
  const valeur = useMemo(
    () => ({ supabase, user, chargement: session === undefined, erreur }),
    [supabase, user, session, erreur],
  );
  const auth = useMemo<AuthContextValue | null>(
    () => (supabase && user ? { user, signOut: async () => void (await supabase.auth.signOut()) } : null),
    [supabase, user],
  );

  return (
    <SessionContext.Provider value={valeur}>
      <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    </SessionContext.Provider>
  );
}
