import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChampDecompte, DecompteReel, FrontalierResult, SignalementCree } from '@shared/frontalier.js';
import { Lien } from '@/lib/router';
import { useEnvoyerSignalement } from '@/hooks/useSignalements';
import { buildFrontalierRequest, useFrontalierStore } from '@/store/frontalierStore';
import { formatChf, inputClass, labelClass } from './ui';

/**
 * « Ce chiffre me semble faux »: the household and the lines of the actual
 * assessment, kept (anonymised) for the editor to check the computation and,
 * with them, to turn it into a real test case.
 */

/** The lines most bordereaux show, then the detail of the ICC. */
const LIGNES: { champ: ChampDecompte; libelle: string; detail?: boolean }[] = [
  { champ: 'revenuImposableIcc', libelle: 'Revenu imposable ICC' },
  { champ: 'icc', libelle: 'Total ICC (cantonal et communal)' },
  { champ: 'revenuImposableIfd', libelle: 'Revenu imposable IFD' },
  { champ: 'ifd', libelle: 'Impot federal direct' },
  { champ: 'impotBaseIcc', libelle: 'Impot cantonal de base', detail: true },
  { champ: 'centimesCantonaux', libelle: 'Centimes additionnels cantonaux', detail: true },
  { champ: 'reductionLdirpp', libelle: 'Reduction LDIRPP', detail: true },
  { champ: 'impotCommunal', libelle: 'Impot communal', detail: true },
];

function Champ({ libelle, valeur, onChange }: { libelle: string; valeur: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-600 mb-1">{libelle}</span>
      <input type="number" min={0} step={1} inputMode="decimal" className={inputClass} value={valeur} placeholder="—" onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** The typed lines as amounts; empty or unreadable ones are left out. */
function versDecompte(saisie: Partial<Record<ChampDecompte, string>>): DecompteReel {
  const out: DecompteReel = {};
  for (const [champ, v] of Object.entries(saisie) as [ChampDecompte, string][]) {
    const x = parseFloat(v);
    if (Number.isFinite(x) && x >= 0) out[champ] = x.toFixed(2);
  }
  return out;
}

function Merci({ cree }: { cree: SignalementCree }) {
  return (
    <div className="space-y-3">
      <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
        Merci, c’est enregistre. Chaque ecart verifie ameliore le calcul pour tout le monde.
      </p>
      {cree.ecarts.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500">
              <th className="py-1 text-left font-medium">Ligne</th>
              <th className="py-1 text-right font-medium">Calcule</th>
              <th className="py-1 text-right font-medium">Votre decompte</th>
              <th className="py-1 text-right font-medium">Ecart</th>
            </tr>
          </thead>
          <tbody>
            {cree.ecarts.map((e) => (
              <tr key={e.champ} className="border-t">
                <td className="py-1.5 text-gray-700">{e.libelle}</td>
                <td className="py-1.5 text-right font-mono">{formatChf(e.calcule)}</td>
                <td className="py-1.5 text-right font-mono">{formatChf(e.reel)}</td>
                <td className="py-1.5 text-right font-mono">{formatChf(e.ecart)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-xs text-gray-500">
        Vous pouvez le retrouver ou le supprimer dans{' '}
        <Lien vers="compte" className="text-indigo-700 underline">Mon compte</Lien>.
      </p>
    </div>
  );
}

function Fenetre({ onFermer }: { onFermer: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const envoyer = useEnvoyerSignalement();
  const [saisie, setSaisie] = useState<Partial<Record<ChampDecompte, string>>>({});
  const [commentaire, setCommentaire] = useState('');
  const [accord, setAccord] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const valider = (e: FormEvent) => {
    e.preventDefault();
    if (!accord) return;
    envoyer.mutate({
      // The household as it is now: the server recomputes the result from it.
      requete: buildFrontalierRequest(useFrontalierStore.getState()),
      decompte: versDecompte(saisie),
      commentaire,
      consentement: true,
    });
  };

  return (
    <dialog
      ref={dialog}
      onClose={onFermer}
      aria-labelledby="titre-signaler"
      className="m-auto rounded-lg border shadow-xl p-0 w-[calc(100%-2rem)] max-w-lg backdrop:bg-black/30"
    >
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="titre-signaler" className="text-lg font-semibold text-gray-900">Un chiffre vous semble faux ?</h2>
            <p className="text-sm text-gray-500">
              Si vous avez recu votre taxation, recopiez les lignes de vos bordereaux : on comparera ligne a ligne.
            </p>
          </div>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Fermer la fenetre" className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        {envoyer.data ? (
          <Merci cree={envoyer.data} />
        ) : (
          <form onSubmit={valider} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-3">
              {LIGNES.filter((l) => !l.detail).map((l) => (
                <Champ key={l.champ} libelle={l.libelle} valeur={saisie[l.champ] ?? ''} onChange={(v) => setSaisie({ ...saisie, [l.champ]: v })} />
              ))}
            </div>
            <details>
              <summary className="cursor-pointer text-xs text-gray-500">Detail de l’ICC (facultatif)</summary>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {LIGNES.filter((l) => l.detail).map((l) => (
                  <Champ key={l.champ} libelle={l.libelle} valeur={saisie[l.champ] ?? ''} onChange={(v) => setSaisie({ ...saisie, [l.champ]: v })} />
                ))}
              </div>
            </details>
            <label className="block">
              <span className={labelClass}>Qu’est-ce qui vous semble faux ?</span>
              <textarea
                rows={3}
                maxLength={2000}
                className={inputClass}
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Ex. : mon bordereau ICC donne un revenu imposable plus bas. Sans nom ni donnee d’identification."
              />
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-1" checked={accord} onChange={(e) => setAccord(e.target.checked)} />
              <span>
                J’accepte que mes saisies, sans mon prenom ni le nom de mes biens, et ce commentaire soient conserves pour
                verifier le calcul. Les montants pourront devenir un cas de test anonyme du projet. Je peux les supprimer a
                tout moment dans Mon compte.
              </span>
            </label>
            {envoyer.error && <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{envoyer.error.message}</p>}
            <button
              type="submit"
              disabled={!accord || envoyer.isPending}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {envoyer.isPending ? 'Envoi…' : 'Envoyer le signalement'}
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}

/** The bar under a TOU result, and the window it opens. */
export function SignalerEcart({ result }: { result: FrontalierResult }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-white p-3 text-sm text-gray-600">
      <span>Votre taxation {result.annee} ne donne pas ces montants ? Signalez-le : c’est ce qui fiabilise le calcul.</span>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
      >
        Ce chiffre me semble faux
      </button>
      {ouvert && <Fenetre onFermer={() => setOuvert(false)} />}
    </div>
  );
}
