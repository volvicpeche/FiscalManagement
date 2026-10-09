import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthCard, Champ, Bouton, Alerte } from './ui';
import { EmailSchema, MotDePasseSchema, messageErreur, premiereErreur } from './messages';

type Onglet = 'connexion' | 'inscription' | 'oubli';

const ONGLETS: { key: Onglet; label: string }[] = [
  { key: 'connexion', label: 'Connexion' },
  { key: 'inscription', label: 'Creer un compte' },
  { key: 'oubli', label: 'Mot de passe oublie' },
];

const TITRES: Record<Onglet, string> = {
  connexion: 'Se connecter',
  inscription: 'Creer un compte',
  oubli: 'Reinitialiser le mot de passe',
};

/**
 * Where the links of the confirmation and reset e-mails lead (see ConfirmPage).
 * `type` is ours: with the default templates, Supabase appends only a `code`.
 * Must be listed in the project's Redirect URLs (DEPLOY.md).
 */
export const URL_CONFIRMATION = (type: 'signup' | 'recovery') =>
  `${window.location.origin}/auth/confirmer?type=${type}`;

export type OngletConnexion = Onglet;

export function LoginPage({
  supabase,
  integre,
  ongletInitial = 'connexion',
}: {
  supabase: SupabaseClient;
  integre?: boolean;
  ongletInitial?: Onglet;
}) {
  const [onglet, setOnglet] = useState<Onglet>(ongletInitial);
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const changer = (o: Onglet) => {
    setOnglet(o);
    setErreur(null);
    setInfo(null);
    setMotDePasse('');
    setConfirmation('');
  };

  const valider = (): string | null => {
    const e = premiereErreur(EmailSchema.safeParse(email));
    if (e) return e;
    if (onglet === 'connexion' && !motDePasse) return 'Saisissez votre mot de passe.';
    if (onglet === 'inscription') {
      const m = premiereErreur(MotDePasseSchema.safeParse(motDePasse));
      if (m) return m;
      if (motDePasse !== confirmation) return 'Les deux mots de passe ne correspondent pas.';
    }
    return null;
  };

  const soumettre = async (ev: FormEvent) => {
    ev.preventDefault();
    setErreur(null);
    setInfo(null);
    const invalide = valider();
    if (invalide) return setErreur(invalide);

    setEnCours(true);
    try {
      const adresse = email.trim();
      if (onglet === 'connexion') {
        // Success needs no handling here: AuthGate hears the new session.
        const { error } = await supabase.auth.signInWithPassword({ email: adresse, password: motDePasse });
        if (error) throw error;
      } else if (onglet === 'inscription') {
        const { error } = await supabase.auth.signUp({
          email: adresse,
          password: motDePasse,
          options: { emailRedirectTo: URL_CONFIRMATION('signup') },
        });
        if (error) throw error;
        // Same message whether or not the address already had an account:
        // Supabase does not say, so that nobody can probe who is registered.
        setInfo(
          `Si aucun compte n'existait pour ${adresse}, un e-mail de confirmation vient d'y etre envoye. Cliquez sur son lien pour activer le compte.`,
        );
        setMotDePasse('');
        setConfirmation('');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(adresse, {
          redirectTo: URL_CONFIRMATION('recovery'),
        });
        if (error) throw error;
        setInfo(`Si un compte existe pour ${adresse}, un e-mail avec un lien de reinitialisation vient d'y etre envoye.`);
      }
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <AuthCard titre={TITRES[onglet]} integre={integre}>
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-5">
        {ONGLETS.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => changer(o.key)}
            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
              onglet === o.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {info && <Alerte type="info">{info}</Alerte>}

      <form onSubmit={soumettre} noValidate>
        <Champ label="Adresse e-mail" type="email" value={email} onChange={setEmail} autoComplete="email" />

        {onglet !== 'oubli' && (
          <Champ
            label="Mot de passe"
            type="password"
            value={motDePasse}
            onChange={setMotDePasse}
            autoComplete={onglet === 'connexion' ? 'current-password' : 'new-password'}
          />
        )}
        {onglet === 'inscription' && (
          <>
            <Champ
              label="Confirmez le mot de passe"
              type="password"
              value={confirmation}
              onChange={setConfirmation}
              autoComplete="new-password"
            />
            <p className="text-xs text-gray-500 -mt-1 mb-3">Au moins 10 caracteres.</p>
          </>
        )}

        <Bouton disabled={enCours}>
          {enCours
            ? 'Patientez...'
            : onglet === 'connexion'
              ? 'Se connecter'
              : onglet === 'inscription'
                ? 'Creer le compte'
                : 'Envoyer le lien'}
        </Bouton>
      </form>
    </AuthCard>
  );
}
