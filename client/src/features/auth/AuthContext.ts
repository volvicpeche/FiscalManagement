import { createContext, useContext } from 'react';
import type { User } from '@supabase/supabase-js';

export interface AuthContextValue {
  user: User;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/** The logged-in user. Only valid under AuthGate, which renders nothing else without one. */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth hors de AuthGate');
  return value;
}
