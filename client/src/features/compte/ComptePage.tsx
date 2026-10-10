import { useState, type FormEvent, type ReactNode } from 'react';
import type { ScenarioKind } from '@shared/scenario.js';
import { LLM_PROVIDER_LABELS, type LlmProvider } from '@shared/llmSettings.js';
import { Lien } from '@/lib/router';
import { SIMULATEURS } from '@/lib/navigation';
import { CLE_COMPTE_SUPPRIME, viderStockageLocal } from '@/lib/stockageLocal';
import { useExporterCompte, useResumeCompte, useSupprimerCompte } from '@/hooks/useCompte';
import { useConsentementsIa, useLlmDialog } from '@/features/parametres';
import {
  Alerte,
  Champ,
  EmailSchema,
  MotDePasseSchema,
  URL_CONFIRMATION,
  messageErreur,
  premiereErreur,
  useAuth,
  useSession,
} from '@/features/auth';

/**
 * The user's rights over their data, in self-service (RGPD art. 15 to 20):
 * see what is stored, download it, correct the login details, delete it all.
 */

function Bloc({ titre, children, danger }: { titre: string; children: ReactNode; danger?: boolean }) {
  return (
    <section className={`rounded-2xl border bg-white p-6 ${danger ? 'border-red-200' : ''}`}>
      <h3 className={`text-base font-semibold ${danger ? 'text-red-700' : 'text-gray-900'}`}>{titre}</h3>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

const bouton =
  'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50';

/** The keys of useConsentementsIa, readable. */
function libelleFournisseur(cle: string): string {
  if (cle === 'serveur') return 'le fournisseur d’IA du site';
  if (cle.startsWith('openai_compatible:')) return cle.slice('openai_compatible:'.length);
  return LLM_PROVIDER_LABELS[cle as LlmProvider] ?? cle;
}

const KINDS: ScenarioKind[] = ['sci', 'saisonnier', 'frontalier'];

function MesDonnees() {
  const { data, isLoading, error } = useResumeCompte();
  const { ouvrir } = useLlmDialog();
  const { fournisseurs, retirer } = useConsentementsIa();
  if (isLoading) return <p className="text-gray-500">Chargement…</p>;
  if (error || !data) return <Alerte type="erreur">{error?.message ?? 'Lecture impossible.'}</Alerte>;

  return (
    <ul className="divide-y rounded-lg border">
      {KINDS.map((k) => {
        const s = SIMULATEURS.find((x) => x.route === k)!;
        const n = data.scenarios[k];
        return (
          <li key={k} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span>
              Scenarios « {s.titre} » : <strong>{n}</strong>
            </span>
            <Lien vers={k} className="shrink-0 text-indigo-700 hover:text-indigo-900">
              {n > 0 ? 'Voir ou supprimer' : 'Ouvrir'} →
            </Lien>
          </li>
        );
      })}
      <li className="flex items-center justify-between gap-3 px-4 py-2.5">
        <span>
          Cle API d’IA : <strong>{data.cleLlm ? 'enregistree (chiffree)' : 'aucune'}</strong>
        </span>
        <button type="button" onClick={ouvrir} className="shrink-0 text-indigo-700 hover:text-indigo-900">
          {data.cleLlm ? 'Modifier ou supprimer' : 'Renseigner'} →
        </button>
      </li>
      {fournisseurs.map((f) => (
        <li key={f} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span>
            Accord pour transmettre vos justificatifs a : <strong>{libelleFournisseur(f)}</strong>{' '}
            <span className="text-gray-500">(dans ce navigateur)</span>
          </span>
          <button type="button" onClick={() => retirer(f)} className="shrink-0 text-indigo-700 hover:text-indigo-900">
            Retirer
          </button>
        </li>
      ))}
    </ul>
  );
}

function Exporter() {
  const exporter = useExporterCompte();
  return (
    <>
      <p>
        Un fichier JSON avec tout ce que le serveur conserve pour vous (adresse, scenarios complets, reglages de la
        cle d’IA sans la cle elle-meme, nombre d’analyses par jour) et ce que ce navigateur garde pour le site.
      </p>
      {exporter.error && <Alerte type="erreur">{exporter.error.message}</Alerte>}
      <button type="button" className={bouton} disabled={exporter.isPending} onClick={() => exporter.mutate()}>
        {exporter.isPending ? 'Preparation…' : 'Telecharger mes donnees'}
      </button>
    </>
  );
}

function Identifiants() {
  const { supabase } = useSession();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [enCours, setEnCours] = useState<'email' | 'mdp' | null>(null);
  const [message, setMessage] = useState<{ type: 'erreur' | 'info'; texte: string } | null>(null);

  const changer = async (quoi: 'email' | 'mdp', e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setMessage(null);
    const invalide =
      quoi === 'email'
        ? premiereErreur(EmailSchema.safeParse(email))
        : (premiereErreur(MotDePasseSchema.safeParse(motDePasse)) ??
          (motDePasse !== confirmation ? 'Les deux mots de passe different.' : null));
    if (invalide) return setMessage({ type: 'erreur', texte: invalide });

    setEnCours(quoi);
    const { error } =
      quoi === 'email'
        ? await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: URL_CONFIRMATION('email_change') })
        : await supabase.auth.updateUser({ password: motDePasse });
    setEnCours(null);
    if (error) return setMessage({ type: 'erreur', texte: messageErreur(error) });

    if (quoi === 'email') {
      setMessage({
        type: 'info',
        texte: `Un lien de confirmation vient d’etre envoye a ${email.trim()} (et, selon les reglages, a votre adresse actuelle). Le changement prend effet une fois confirme.`,
      });
      setEmail('');
    } else {
      setMessage({ type: 'info', texte: 'Mot de passe modifie.' });
      setMotDePasse('');
      setConfirmation('');
    }
  };

  return (
    <>
      <p>
        Adresse actuelle : <strong>{user.email}</strong>
      </p>
      {message && <Alerte type={message.type}>{message.texte}</Alerte>}
      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={(e) => changer('email', e)} noValidate>
          <Champ label="Nouvelle adresse e-mail" type="email" value={email} onChange={setEmail} autoComplete="email" />
          <button type="submit" className={bouton} disabled={enCours !== null}>
            {enCours === 'email' ? 'Envoi…' : 'Changer d’adresse'}
          </button>
        </form>
        <form onSubmit={(e) => changer('mdp', e)} noValidate>
          <Champ label="Nouveau mot de passe" type="password" value={motDePasse} onChange={setMotDePasse} autoComplete="new-password" />
          <Champ label="Confirmez le mot de passe" type="password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
          <button type="submit" className={bouton} disabled={enCours !== null}>
            {enCours === 'mdp' ? 'Enregistrement…' : 'Changer de mot de passe'}
          </button>
        </form>
      </div>
    </>
  );
}

function Supprimer() {
  const { supabase } = useSession();
  const { user } = useAuth();
  const supprimer = useSupprimerCompte();
  const [saisie, setSaisie] = useState('');
  const attendu = user.email ?? 'SUPPRIMER';
  const confirme = saisie.trim().toLowerCase() === attendu.toLowerCase();

  const valider = (e: FormEvent) => {
    e.preventDefault();
    if (!confirme) return;
    supprimer.mutate(saisie, {
      onSuccess: async () => {
        // The account is gone: forget this browser's copy too, then sign out
        // locally (the session no longer exists server side). AuthProvider
        // reloads to the home page, which reads the flag once.
        viderStockageLocal();
        try {
          sessionStorage.setItem(CLE_COMPTE_SUPPRIME, '1');
        } catch {
          /* the message is a courtesy */
        }
        if (supabase) await supabase.auth.signOut({ scope: 'local' });
        else window.location.assign('/');
      },
    });
  };

  return (
    <>
      <p>
        Suppression <strong>immediate et definitive</strong> : votre compte, tous vos scenarios, votre cle d’IA et
        l’historique de vos analyses. Rien n’est conserve, aucune restauration n’est possible. Pensez a telecharger
        vos donnees avant.
      </p>
      <form onSubmit={valider} className="max-w-md space-y-3" noValidate>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Pour confirmer, saisissez {user.email ? 'votre adresse e-mail' : 'SUPPRIMER'} : <strong>{attendu}</strong>
          </span>
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            autoComplete="off"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </label>
        {supprimer.error && <Alerte type="erreur">{supprimer.error.message}</Alerte>}
        <button
          type="submit"
          disabled={!confirme || supprimer.isPending || supprimer.isSuccess}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {supprimer.isPending || supprimer.isSuccess ? 'Suppression…' : 'Supprimer definitivement mon compte'}
        </button>
      </form>
    </>
  );
}

export function ComptePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Mon compte</h2>
        <p className="mt-1 text-sm text-gray-600">
          Vos donnees, en libre-service. Le detail de ce qui est collecte et pourquoi :{' '}
          <Lien vers="confidentialite" className="text-indigo-700 underline hover:text-indigo-900">
            politique de confidentialite
          </Lien>
          .
        </p>
      </div>
      <Bloc titre="Mes donnees">
        <MesDonnees />
      </Bloc>
      <Bloc titre="Exporter mes donnees">
        <Exporter />
      </Bloc>
      <Bloc titre="Identifiants">
        <Identifiants />
      </Bloc>
      <Bloc titre="Supprimer mon compte" danger>
        <Supprimer />
      </Bloc>
    </div>
  );
}
