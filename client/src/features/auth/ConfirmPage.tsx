import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js';
import { AuthCard, Champ, Bouton, Alerte } from './ui';
import { MotDePasseSchema, messageErreur, premiereErreur } from './messages';

export const CHEMIN_CONFIRMATION = '/auth/confirmer';

const TYPES: readonly EmailOtpType[] = ['signup', 'recovery', 'email', 'email_change', 'invite', 'magiclink'];

/**
 * Landing page of the links in Supabase's e-mails.
 *
 * The e-mail templates are rewritten (DEPLOY.md) to point here with a
 * `token_hash` rather than to supabase.co/auth/v1/verify: verifying it goes
 * through our own /supabase relay, so a corporate proxy blocking supabase.co
 * does not break sign-up or password reset.
 */
export function ConfirmPage({ supabase, onTermine }: { supabase: SupabaseClient; onTermine: () => void }) {
  const [etat, setEtat] = useState<'verification' | 'nouveauMotDePasse' | 'erreur'>('verification');
  const [erreur, setErreur] = useState<string | null>(null);
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [enCours, setEnCours] = useState(false);
  // A token works once: StrictMode's double effect must not spend it twice.
  const lance = useRef(false);

  useEffect(() => {
    if (lance.current) return;
    lance.current = true;

    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type') as EmailOtpType | null;
    if (!tokenHash || !type || !TYPES.includes(type)) {
      setErreur('Lien incomplet. Copiez-le en entier depuis l’e-mail, ou demandez-en un nouveau.');
      setEtat('erreur');
      return;
    }

    supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => {
      if (error) {
        setErreur(messageErreur(error));
        setEtat('erreur');
      } else if (type === 'recovery') {
        setEtat('nouveauMotDePasse');
      } else {
        onTermine();
      }
    });
  }, [supabase, onTermine]);

  const enregistrer = async (ev: FormEvent) => {
    ev.preventDefault();
    const invalide = premiereErreur(MotDePasseSchema.safeParse(motDePasse));
    if (invalide) return setErreur(invalide);
    if (motDePasse !== confirmation) return setErreur('Les deux mots de passe ne correspondent pas.');

    setEnCours(true);
    setErreur(null);
    const { error } = await supabase.auth.updateUser({ password: motDePasse });
    setEnCours(false);
    if (error) return setErreur(messageErreur(error));
    onTermine();
  };

  if (etat === 'verification') {
    return (
      <AuthCard titre="Verification du lien">
        <p className="text-sm text-gray-600">Un instant...</p>
      </AuthCard>
    );
  }

  if (etat === 'erreur') {
    return (
      <AuthCard titre="Lien invalide">
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        <button type="button" onClick={onTermine} className="text-sm text-blue-700 hover:underline">
          Revenir a la connexion
        </button>
      </AuthCard>
    );
  }

  return (
    <AuthCard titre="Choisissez un nouveau mot de passe">
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      <form onSubmit={enregistrer} noValidate>
        <Champ label="Nouveau mot de passe" type="password" value={motDePasse} onChange={setMotDePasse} autoComplete="new-password" />
        <Champ label="Confirmez le mot de passe" type="password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
        <p className="text-xs text-gray-500 -mt-1 mb-3">Au moins 10 caracteres.</p>
        <Bouton disabled={enCours}>{enCours ? 'Enregistrement...' : 'Enregistrer'}</Bouton>
      </form>
    </AuthCard>
  );
}
