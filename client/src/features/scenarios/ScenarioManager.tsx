import { useState } from 'react';
import { isOutdated, type ScenarioKind, type ScenarioSummary } from '@shared/scenario.js';
import {
  loadScenario,
  useDeleteScenario,
  useSaveScenario,
  useScenarioList,
  useUpdateScenario,
} from '@/hooks/useScenarios';

/**
 * Save, reload and delete scenarios.
 *
 * The payload is whatever the calling store holds, so this component stays
 * agnostic: `getData` hands it over on save, `onLoad` receives it back. That
 * keeps one component serving both the SCI comparison and the seasonal tab
 * without either shape leaking in here.
 */
export function ScenarioManager({
  kind,
  getData,
  onLoad,
}: {
  kind: ScenarioKind;
  getData: () => Record<string, unknown>;
  onLoad: (data: Record<string, unknown>) => void;
}) {
  const [nom, setNom] = useState('');
  const [courant, setCourant] = useState<ScenarioSummary | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const { data: scenarios = [], isLoading, error: listError } = useScenarioList(kind);
  const save = useSaveScenario();
  const update = useUpdateScenario();
  const remove = useDeleteScenario();

  const busy = save.isPending || update.isPending || remove.isPending;

  const annoncer = (message: string) => {
    setConfirmation(message);
    setErreur(null);
    window.setTimeout(() => setConfirmation(null), 3000);
  };

  const handleSave = () => {
    const titre = nom.trim();
    if (!titre) return;
    save.mutate(
      { nom: titre, kind, data: getData() },
      {
        onSuccess: (s) => {
          setCourant(s);
          setNom('');
          annoncer(`« ${s.nom} » enregistre`);
        },
        onError: (e) => setErreur(e.message),
      },
    );
  };

  const handleUpdate = () => {
    if (!courant) return;
    update.mutate(
      { id: courant.id, nom: courant.nom, kind, data: getData() },
      {
        onSuccess: (s) => {
          setCourant(s);
          annoncer(`« ${s.nom} » mis a jour`);
        },
        onError: (e) => setErreur(e.message),
      },
    );
  };

  const handleLoad = async (summary: ScenarioSummary) => {
    setErreur(null);
    try {
      const scenario = await loadScenario(summary.id);
      if (isOutdated(scenario)) {
        setErreur(
          `« ${scenario.nom} » a ete enregistre dans un format plus ancien. Les champs ajoutes depuis reprendront leur valeur par defaut.`,
        );
      }
      onLoad(scenario.data);
      setCourant(scenario);
      annoncer(`« ${scenario.nom} » charge`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible');
    }
  };

  const handleDelete = (summary: ScenarioSummary) => {
    remove.mutate(summary.id, {
      onSuccess: () => {
        if (courant?.id === summary.id) setCourant(null);
        annoncer(`« ${summary.nom} » supprime`);
      },
      onError: (e) => setErreur(e.message),
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Mes scenarios</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Enregistres sur le serveur : ils survivent au rechargement de la page.
        </p>
      </div>

      {/* Save */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Nom du scenario"
          className="flex-1 min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={nom}
          maxLength={120}
          onChange={(e) => setNom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || !nom.trim()}
          className="shrink-0 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Enregistrer
        </button>
      </div>

      {courant && (
        <button
          type="button"
          onClick={handleUpdate}
          disabled={busy}
          className="w-full px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50 transition-colors"
        >
          Ecraser « {courant.nom} » avec les valeurs actuelles
        </button>
      )}

      {confirmation && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          {confirmation}
        </p>
      )}
      {(erreur || listError) && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {erreur ?? listError?.message}
        </p>
      )}

      {/* List */}
      {isLoading ? (
        <p className="text-xs text-gray-400">Chargement…</p>
      ) : scenarios.length === 0 ? (
        <p className="text-xs text-gray-400">
          Aucun scenario enregistre. Donnez un nom ci-dessus pour conserver la saisie en cours.
        </p>
      ) : (
        <ul className="space-y-1">
          {scenarios.map((s) => (
            <li
              key={s.id}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-2 ${
                courant?.id === s.id ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
              }`}
            >
              <button
                type="button"
                onClick={() => handleLoad(s)}
                disabled={busy}
                className="flex-1 min-w-0 text-left disabled:opacity-50"
                title="Charger ce scenario"
              >
                <span className="block text-sm font-medium text-gray-800 truncate">{s.nom}</span>
                <span className="block text-xs text-gray-400">
                  {new Date(s.updatedAt).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {isOutdated(s) && <span className="text-amber-600"> · format ancien</span>}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(s)}
                disabled={busy}
                className="shrink-0 px-2 py-1 text-sm text-gray-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                title="Supprimer"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
