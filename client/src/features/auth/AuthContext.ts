import { createContext, useContext } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export interface AuthContextValue {
  user: User;
  signOut: () => Promise<void>;
}

/** Set only while someone is logged in (AuthProvider). */
export const AuthContext = createContext<AuthContextValue | null>(null);

/** The logged-in user. Only valid under RequireAuth, or where `useSession().user` was checked. */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth sans utilisateur connecte');
  return value;
}

export interface SessionValue {
  supabase: SupabaseClient | null;
  /** null: a visitor. */
  user: User | null;
  /** Supabase not loaded yet: neither logged in nor out. */
  chargement: boolean;
  /** /api/config failed: the public pages still work, the login cannot. */
  erreur: string | null;
}

export const SessionContext = createContext<SessionValue>({ supabase: null, user: null, chargement: true, erreur: null });

/** Who is here, if anyone. Usable on every page, public ones included. */
export function useSession(): SessionValue {
  return useContext(SessionContext);
}
