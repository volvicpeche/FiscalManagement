import { useState } from 'react';
import type { ScenarioKind } from '@shared/scenario.js';
import { useSaveScenario, useUpdateScenario } from '@/hooks/useScenarios';
import { selectSharedInputs } from '@/store/scenarioStore';
import { useStoreLocatif } from '@/store/storeLocatif';

/**
 * Above the results: which scenario this is, and saving it — over itself, or
 * under a new name. « Mes scenarios » and « Nouveau » leave the results.
 */
export function BarreScenario({ kind }: { kind: ScenarioKind }) {
  const store = useStoreLocatif();
  const save = useSaveScenario();
  const update = useUpdateScenario();
  const [nom, setNom] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const occupe = save.isPending || update.isPending;
  const courant = store.scenarioCourant;

  const annoncer = (ok: boolean, texte: string) => {
    setMessage({ ok, texte });
    if (ok) window.setTimeout(() => setMessage(null), 3000);
  };

  const enregistrerSous = () => {
    const titre = (nom ?? '').trim();
    if (!titre) return;
    save.mutate(
      { nom: titre, kind, data: selectSharedInputs(store) as unknown as Record<string, unknown> },
      {
        onSuccess: (s) => {
          store.setScenarioCourant({ id: s.id, nom: s.nom });
          setNom(null);
          annoncer(true, `« ${s.nom} » enregistre`);
        },
        onError: (e) => annoncer(false, e.message),
      },
    );
  };

  const enregistrer = () => {
    if (!courant) return setNom('');
    update.mutate(
      { id: courant.id, nom: courant.nom, kind, data: selectSharedInputs(store) as unknown as Record<string, unknown> },
      { onSuccess: (s) => annoncer(true, `« ${s.nom} » mis a jour`), onError: (e) => annoncer(false, e.message) },
    );
  };

  const bouton = 'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50';

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white px-4 py-3">
      <div className="mr-auto min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900">{courant ? courant.nom : 'Nouveau scenario'}</p>
        <p className="text-xs text-gray-500">{courant ? 'Scenario enregistre' : 'Pas encore enregistre'}</p>
      </div>
      {nom !== null ? (
        <span className="flex items-center gap-2">
          <input
            autoFocus
            value={nom}
            maxLength={120}
            placeholder="Nom du scenario"
            onChange={(e) => setNom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') enregistrerSous();
              if (e.key === 'Escape') setNom(null);
            }}
            className="w-48 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <button type="button" disabled={occupe || !nom.trim()} onClick={enregistrerSous} className={`${bouton} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700`}>
            OK
          </button>
          <button type="button" onClick={() => setNom(null)} className={`${bouton} bg-white text-gray-600 hover:bg-gray-50`}>
            Annuler
          </button>
        </span>
      ) : (
        <>
          <button type="button" disabled={occupe} onClick={enregistrer} className={`${bouton} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700`}>
            Enregistrer
          </button>
          {courant && (
            <button type="button" disabled={occupe} onClick={() => setNom(`${courant.nom} (copie)`)} className={`${bouton} bg-white text-gray-700 hover:bg-gray-50`}>
              Enregistrer sous…
            </button>
          )}
          <button type="button" onClick={() => store.setVue('accueil')} className={`${bouton} bg-white text-gray-700 hover:bg-gray-50`}>
            Mes scenarios
          </button>
          <button type="button" onClick={store.nouveau} className={`${bouton} bg-white text-gray-700 hover:bg-gray-50`}>
            + Nouveau
          </button>
        </>
      )}
      {message && (
        <p className={`basis-full text-xs ${message.ok ? 'text-emerald-700' : 'text-red-700'}`}>{message.texte}</p>
      )}
    </div>
  );
}
