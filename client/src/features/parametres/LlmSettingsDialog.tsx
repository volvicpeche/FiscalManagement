import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  LLM_DEFAULT_MODELS,
  LLM_PROVIDER_LABELS,
  LLM_PROVIDERS,
  type LlmProvider,
  type LlmSettingsView,
} from '@shared/llmSettings.js';
import { useDeleteLlmSettings, useLlmSettings, useSaveLlmSettings } from '@/hooks/useLlmSettings';

const OU_CREER: Record<LlmProvider, string> = {
  anthropic: 'console.anthropic.com → Settings → API Keys',
  openai: 'platform.openai.com → API keys',
  gemini: 'aistudio.google.com → Get API key',
  openai_compatible: 'la console de votre fournisseur',
};

const champ = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm';

function Libelle({ children, aide }: { children: ReactNode; aide?: ReactNode }) {
  return (
    <span className="block mb-1">
      <span className="block text-sm font-medium text-gray-700">{children}</span>
      {aide && <span className="block text-xs text-gray-500">{aide}</span>}
    </span>
  );
}

/**
 * The user's own LLM key, for listing analysis and document reading. The key
 * is write-only: once saved, only its last four characters come back.
 */
export function LlmSettingsDialog({ onFermer }: { onFermer: () => void }) {
  const { data: vue, isLoading, error: erreurChargement } = useLlmSettings();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      onClose={onFermer}
      aria-labelledby="titre-cle-llm"
      className="m-auto rounded-lg border shadow-xl p-0 w-[calc(100%-2rem)] max-w-lg backdrop:bg-black/30"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 id="titre-cle-llm" className="text-lg font-semibold text-gray-900">Cle API LLM</h2>
            <p className="text-sm text-gray-500">
              Pour l'analyse d'annonce et la lecture de justificatifs. Les appels sont factures sur votre compte
              chez le fournisseur.
            </p>
          </div>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Fermer la fenetre" className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        {isLoading && <p className="text-sm text-gray-500">Chargement...</p>}
        {erreurChargement && <p className="text-sm text-red-700">{erreurChargement.message}</p>}
        {vue && <Formulaire vue={vue} onFermer={() => dialog.current?.close()} />}
      </div>
    </dialog>
  );
}

function Formulaire({ vue, onFermer }: { vue: LlmSettingsView; onFermer: () => void }) {
  const [provider, setProvider] = useState<LlmProvider>(vue.provider ?? 'anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(vue.model ?? '');
  const [baseUrl, setBaseUrl] = useState(vue.baseUrl ?? '');
  const [message, setMessage] = useState<{ type: 'erreur' | 'info'; texte: string } | null>(null);
  const save = useSaveLlmSettings();
  const remove = useDeleteLlmSettings();

  // A stored key only stays valid for the provider it was typed for.
  const cleGardee = vue.configuree && vue.provider === provider;
  const occupe = save.isPending || remove.isPending;

  const enregistrer = (ev: FormEvent) => {
    ev.preventDefault();
    setMessage(null);
    save.mutate(
      {
        provider,
        apiKey: apiKey || undefined,
        model: model || undefined,
        baseUrl: provider === 'openai_compatible' ? baseUrl || undefined : undefined,
      },
      {
        onSuccess: () => {
          setApiKey('');
          setMessage({ type: 'info', texte: 'Cle enregistree.' });
        },
        onError: (e) => setMessage({ type: 'erreur', texte: e.message }),
      },
    );
  };

  const supprimer = () => {
    if (!window.confirm('Supprimer votre cle API de Patrimonia ?')) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        setApiKey('');
        setMessage({ type: 'info', texte: 'Cle supprimee.' });
      },
      onError: (e) => setMessage({ type: 'erreur', texte: e.message }),
    });
  };

  return (
    <form onSubmit={enregistrer} noValidate className="space-y-4">
      {!vue.stockageDisponible && (
        <p className="p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800">
          L'enregistrement des cles n'est pas active sur ce serveur (LLM_KEYS_SECRET). Contactez l'administrateur.
        </p>
      )}

      <p className="text-sm text-gray-600">
        {vue.configuree ? (
          <>
            Cle enregistree : <strong>{LLM_PROVIDER_LABELS[vue.provider!]}</strong>, se terminant par{' '}
            <code className="px-1 bg-gray-100 rounded">{vue.cleFin}</code>.
          </>
        ) : vue.cleServeurAutorisee ? (
          'Aucune cle personnelle : la cle du serveur est utilisee pour vous.'
        ) : (
          "Aucune cle enregistree : l'analyse automatique est desactivee pour votre compte."
        )}
      </p>

      <label className="block">
        <Libelle>Fournisseur</Libelle>
        <select className={champ} value={provider} onChange={(e) => setProvider(e.target.value as LlmProvider)}>
          {LLM_PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {LLM_PROVIDER_LABELS[p]}
            </option>
          ))}
        </select>
      </label>

      {provider === 'openai_compatible' && (
        <label className="block">
          <Libelle aide="Adresse de l'API, en https (ex. https://api.mistral.ai/v1).">URL de l'API</Libelle>
          <input className={champ} type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://" />
        </label>
      )}

      <label className="block">
        <Libelle aide={`A creer sur ${OU_CREER[provider]}.`}>Cle API</Libelle>
        <input
          className={champ}
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={cleGardee ? `•••• ${vue.cleFin} — laissez vide pour la garder` : 'Collez votre cle'}
        />
      </label>

      <label className="block">
        <Libelle
          aide={
            LLM_DEFAULT_MODELS[provider]
              ? `Facultatif. Par defaut : ${LLM_DEFAULT_MODELS[provider]}.`
              : 'Obligatoire pour ce fournisseur.'
          }
        >
          Modele
        </Libelle>
        <input className={champ} value={model} onChange={(e) => setModel(e.target.value)} placeholder={LLM_DEFAULT_MODELS[provider] ?? ''} />
      </label>

      {provider === 'openai_compatible' && (
        <p className="text-xs text-gray-500">
          La lecture des justificatifs (onglet Frontalier) envoie le document lui-meme au modele : choisissez un modele
          avec vision. Beaucoup d’API compatibles refusent les PDF ; une photo ou une capture passe alors.
        </p>
      )}

      {message && (
        <p
          role={message.type === 'erreur' ? 'alert' : 'status'}
          className={`text-sm ${message.type === 'erreur' ? 'text-red-700' : 'text-green-700'}`}
        >
          {message.texte}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-2">
        {vue.configuree ? (
          <button type="button" onClick={supprimer} disabled={occupe} className="text-sm text-red-700 hover:underline disabled:opacity-50">
            Supprimer ma cle
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onFermer} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Fermer
          </button>
          <button
            type="submit"
            disabled={occupe || !vue.stockageDisponible}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {save.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </form>
  );
}
