import type { ReactNode } from 'react';
import { LoginPage } from './LoginPage';
import { useSession } from './AuthContext';
import { Alerte } from './ui';

/**
 * An advanced simulator: its content for a logged-in user, the login form
 * otherwise. The URL stays the same, so logging in lands right here.
 */
export function RequireAuth({ titre, apport, children }: { titre: string; apport: string; children: ReactNode }) {
  const { supabase, user, chargement, erreur } = useSession();
  if (user) return <>{children}</>;
  if (chargement) return <div className="min-h-[50vh]" aria-busy="true" />;

  return (
    <div className="mx-auto max-w-md space-y-4 py-4">
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
        <p className="font-medium text-indigo-900">🔒 {titre}</p>
        <p className="mt-1 text-sm text-indigo-800">{apport}</p>
        <p className="mt-2 text-sm text-indigo-800">Connectez-vous, ou creez un compte gratuit, pour y acceder.</p>
      </div>
      {supabase ? (
        <LoginPage supabase={supabase} integre />
      ) : (
        <Alerte type="erreur">{erreur ?? 'Connexion indisponible pour le moment.'}</Alerte>
      )}
    </div>
  );
}
