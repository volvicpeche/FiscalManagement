import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js';
import { AuthCard, Champ, Bouton, Alerte } from './ui';
import { MotDePasseSchema, messageErreur, premiereErreur } from './messages';

export const CHEMIN_CONFIRMATION = '/auth/confirmer';

const TYPES: readonly EmailOtpType[] = ['signup', 'recovery', 'email', 'email_change', 'invite', 'magiclink'];

type Etat = 'verification' | 'nouveauMotDePasse' | 'confirmee' | 'erreur';

/**
 * Landing page of the links in Supabase's e-mails. Three shapes arrive here:
 *
 * - `?type=…&code=…` — the default templates (the project is shared with other
 *   applications, so they stay untouched): the link goes through
 *   supabase.co/auth/v1/verify, which confirms the address, then redirects
 *   here with a PKCE code. The code is exchanged through our /supabase relay,
 *   with the verifier signUp/resetPasswordForEmail left in this browser.
 *   `type` is ours, put on the redirect URL by LoginPage.
 * - `?token_hash=…&type=…` — templates rewritten to skip supabase.co.
 * - `?error_code=…` (or in the fragment) — the link was refused upstream,
 *   typically expired or already used.
 */
export function ConfirmPage({ supabase, onTermine }: { supabase: SupabaseClient; onTermine: () => void }) {
  const [etat, setEtat] = useState<Etat>('verification');
  const [erreur, setErreur] = useState<string | null>(null);
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [enCours, setEnCours] = useState(false);
  // A code works once: StrictMode's double effect must not spend it twice.
  const lance = useRef(false);

  useEffect(() => {
    if (lance.current) return;
    lance.current = true;

    const params = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const type = params.get('type');
    const echouer = (message: string) => {
      setErreur(message);
      setEtat('erreur');
    };

    const codeErreur = params.get('error_code') ?? fragment.get('error_code');
    if (codeErreur) return echouer(messageErreur({ code: codeErreur }));

    const code = params.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) {
          if (type === 'recovery') setEtat('nouveauMotDePasse');
          else onTermine();
          return;
        }
        // Opened in another browser than the one that signed up (a phone,
        // say): no verifier here, but Supabase confirmed the address before
        // redirecting. Only the automatic login is lost.
        if (error.code === 'pkce_code_verifier_not_found' && type !== 'recovery') {
          setEtat('confirmee');
          return;
        }
        echouer(
          error.code === 'pkce_code_verifier_not_found'
            ? 'Ouvrez ce lien dans le navigateur où vous avez demandé la réinitialisation, ou refaites la demande depuis celui-ci.'
            : messageErreur(error),
        );
      });
      return;
    }

    const tokenHash = params.get('token_hash');
    if (tokenHash && type && TYPES.includes(type as EmailOtpType)) {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType }).then(({ error }) => {
        if (error) echouer(messageErreur(error));
        else if (type === 'recovery') setEtat('nouveauMotDePasse');
        else onTermine();
      });
      return;
    }

    echouer('Lien incomplet. Copiez-le en entier depuis l’e-mail, ou demandez-en un nouveau.');
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

  if (etat === 'confirmee') {
    return (
      <AuthCard titre="Adresse confirmée">
        <Alerte type="info">Votre adresse e-mail est confirmée. Connectez-vous pour commencer.</Alerte>
        <button type="button" onClick={onTermine} className="text-sm text-blue-700 hover:underline">
          Aller à la connexion
        </button>
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
