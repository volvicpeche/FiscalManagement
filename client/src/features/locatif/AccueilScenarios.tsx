import { useState } from 'react';
import { isOutdated, type ScenarioKind, type ScenarioSummary } from '@shared/scenario.js';
import { loadScenario, useDeleteScenario, useScenarioList } from '@/hooks/useScenarios';
import type { SharedInputs } from '@/store/scenarioStore';
import { useStoreLocatif } from '@/store/storeLocatif';

const date = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Where a real-estate page opens: « Nouveau scenario » to start the steps, or
 * one of the saved ones, opened straight on its results.
 */
export function AccueilScenarios({ kind, titre, intro }: { kind: ScenarioKind; titre: string; intro: React.ReactNode }) {
  const store = useStoreLocatif();
  const { data: scenarios = [], isLoading, error } = useScenarioList(kind);
  const supprimer = useDeleteScenario();
  const [erreur, setErreur] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  // Inputs left on the way, not saved: offer to pick them back up.
  const enCours = store.etapesVues.length > 0;

  const ouvrir = async (s: ScenarioSummary) => {
    setErreur(null);
    try {
      const scenario = await loadScenario(s.id);
      store.ouvrir(scenario.data as Partial<SharedInputs>, { id: scenario.id, nom: scenario.nom });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Ouverture impossible');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{titre}</h2>
        <p className="mt-1 text-sm text-gray-600">{intro}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={store.nouveau}
          className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          + Nouveau scenario
        </button>
        {enCours && (
          <button
            type="button"
            onClick={() => store.setVue(store.results && Object.values(store.results).some(Boolean) ? 'resultats' : 'parcours')}
            className="rounded-lg border bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reprendre la saisie en cours{store.scenarioCourant ? ` (« ${store.scenarioCourant.nom} »)` : ''}
          </button>
        )}
      </div>

      <section className="rounded-lg border bg-white">
        <h3 className="border-b px-4 py-3 text-sm font-semibold text-gray-900">Mes scenarios</h3>
        {(erreur || error) && <p className="px-4 py-2 text-sm text-red-700">{erreur ?? error?.message}</p>}
        {isLoading ? (
          <p className="px-4 py-4 text-sm text-gray-400">Chargement…</p>
        ) : scenarios.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            Aucun scenario enregistre. Commencez par « Nouveau scenario » : vous pourrez l’enregistrer une fois le
            resultat affiche.
          </p>
        ) : (
          <ul className="divide-y">
            {scenarios.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <button type="button" onClick={() => ouvrir(s)} className="min-w-0 flex-1 text-left" title="Ouvrir ce scenario">
                  <span className="block truncate text-sm font-medium text-gray-900">{s.nom}</span>
                  <span className="block text-xs text-gray-400">
                    Modifie le {date(s.updatedAt)}
                    {isOutdated(s) && <span className="text-amber-600"> · format ancien</span>}
                  </span>
                </button>
                <button type="button" onClick={() => ouvrir(s)} className="shrink-0 text-sm font-medium text-indigo-700 hover:text-indigo-900">
                  Ouvrir
                </button>
                {aSupprimer === s.id ? (
                  <span className="flex shrink-0 items-center gap-2 text-xs">
                    <button
                      type="button"
                      disabled={supprimer.isPending}
                      onClick={() => supprimer.mutate(s.id, { onSuccess: () => setASupprimer(null), onError: (e) => setErreur(e.message) })}
                      className="font-medium text-red-700 hover:text-red-900"
                    >
                      Confirmer
                    </button>
                    <button type="button" onClick={() => setASupprimer(null)} className="text-gray-500">
                      Annuler
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setASupprimer(s.id)} className="shrink-0 px-1 text-sm text-gray-400 hover:text-red-600" title="Supprimer">
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
