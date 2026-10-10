import { useState } from 'react';
import type { SimulationResult } from '@shared/schemas.js';
import { formatEur } from '@/lib/profiles';
import {
  MONTAGES_SAISONNIER,
  NOMS_MONTAGES,
  buildSaisonnierRequests,
  donneesASauver,
  sarlFamillePossible,
  useSaisonnierStore,
  type DonneesSauvees,
  type MontageSaisonnier,
} from '@/store/saisonnierStore';
import { partsAreValid } from '@/store/scenarioStore';
import { useSimulation } from '@/hooks/useSimulation';
import { useCostPresets } from '@/hooks/useCostPresets';
import { AssociesForm } from '@/features/scenario';
import { SaisonnierBienForm } from './SaisonnierBienForm';
import { SaisonnierSaisonsForm } from './SaisonnierSaisonsForm';
import { SaisonnierFiscaliteForm } from './SaisonnierFiscaliteForm';
import { SaisonnierParamsForm } from './SaisonnierParamsForm';
import { SaisonnierKpis } from './SaisonnierKpis';
import { SaisonnierRevenueChart } from './SaisonnierRevenueChart';
import { SaisonnierCashFlowChart } from './SaisonnierCashFlowChart';
import { SaisonnierProjectionTable } from './SaisonnierProjectionTable';
import { SaisonnierSuccession } from './SaisonnierSuccession';
import { SaisonnierLMNPReports } from './SaisonnierLMNPReports';
import { SaisonnierAvertissements } from './SaisonnierAvertissements';
import { SidebarLayout } from '@/components/SidebarLayout';
import { ScenarioManager } from '@/features/scenarios';

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-lg border p-4">{children}</div>;
}

/** LMNP or LMP when held directly or in a SARL de famille (decided by the engine), IS for the company. */
function statutDe(montage: MontageSaisonnier, r: SimulationResult): 'LMNP' | 'LMP' | 'IS' {
  if (montage === 'SOCIETE_IS') return 'IS';
  const an1 = r.yearlyData.find((y) => y.year === 1);
  const entite = an1 ? Object.values(an1.entities)[0] : undefined;
  return entite?.statutMeuble ?? 'LMNP';
}

const LIBELLE_STATUT = { LMNP: 'LMNP', LMP: 'LMP', IS: 'IS + dividendes' } as const;

interface Ligne {
  label: string;
  valeur: (r: SimulationResult) => number | null;
  format: (x: number) => string;
  /** Which way is better: the cell highlighted in green. */
  mieux: 'haut' | 'bas';
}

const pct = (x: number) => `${(x * 100).toFixed(2).replace('.', ',')} %`;
const LIGNES: Ligne[] = [
  { label: 'Patrimoine net a terme', valeur: (r) => parseFloat(r.summary.totalNetWealth), format: formatEur, mieux: 'haut' },
  { label: 'TRI net de revente', valeur: (r) => (r.summary.irrNetDeRevente ? parseFloat(r.summary.irrNetDeRevente) : null), format: pct, mieux: 'haut' },
  { label: 'Impots et cotisations cumules', valeur: (r) => parseFloat(r.summary.totalTaxPaid), format: formatEur, mieux: 'bas' },
  {
    label: 'Couts de structure cumules',
    valeur: (r) => parseFloat(r.summary.fraisConstitution) + parseFloat(r.summary.totalOperatingCosts),
    format: formatEur,
    mieux: 'bas',
  },
  { label: 'Impot de sortie (revente)', valeur: (r) => parseFloat(r.summary.sortie.impot), format: formatEur, mieux: 'bas' },
];

function Comparaison({ results, sarlOk }: { results: Record<MontageSaisonnier, SimulationResult | null>; sarlOk: boolean }) {
  const montages = MONTAGES_SAISONNIER.filter((m) => results[m]);
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-gray-500">
            <th className="px-4 py-3 text-left font-medium">Indicateur</th>
            {montages.map((m) => (
              <th key={m} className="px-4 py-3 text-right font-semibold text-gray-800">
                {NOMS_MONTAGES[m]}
                <span className="block text-xs font-normal text-gray-500">{LIBELLE_STATUT[statutDe(m, results[m]!)]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LIGNES.map((l) => {
            const valeurs = montages.map((m) => l.valeur(results[m]!));
            const connues = valeurs.filter((v): v is number => v !== null);
            const meilleure = connues.length > 1 ? (l.mieux === 'haut' ? Math.max(...connues) : Math.min(...connues)) : null;
            return (
              <tr key={l.label} className="border-b last:border-0">
                <td className="px-4 py-2.5 text-gray-700">{l.label}</td>
                {valeurs.map((v, i) => (
                  <td
                    key={montages[i]}
                    className={`px-4 py-2.5 text-right font-mono ${v !== null && v === meilleure ? 'bg-green-50 text-green-700' : 'text-gray-900'}`}
                  >
                    {v === null ? '—' : l.format(v)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!sarlOk && (
        <p className="border-t px-4 py-2 text-xs text-amber-800 bg-amber-50">
          SARL de famille : reservee aux parents en ligne directe, freres et soeurs et conjoints. Un associe hors de ce
          cercle la rend impossible — la colonne est donnee pour comparaison seulement.
        </p>
      )}
      <p className="border-t px-4 py-2 text-xs text-gray-400">
        En vert, le montage le plus favorable pour chaque indicateur. Une SCI n’est pas proposee : louer en meuble de
        facon habituelle la rend passible de l’IS.
      </p>
    </div>
  );
}

export function SaisonnierPage() {
  const store = useSaisonnierStore();
  const { asset, associes, results, setResult, montageActif, setMontageActif } = store;
  const { data: presets } = useCostPresets();
  const [panelOpen, setPanelOpen] = useState(true);

  // One mutation per setup, run in parallel. Hooks cannot be conditional: all three always exist.
  const simulations: Record<MontageSaisonnier, ReturnType<typeof useSimulation>> = {
    DIRECT: useSimulation(),
    SARL_FAMILLE: useSimulation(),
    SOCIETE_IS: useSimulation(),
  };
  const isPending = MONTAGES_SAISONNIER.some((m) => simulations[m].isPending);
  const error = MONTAGES_SAISONNIER.map((m) => simulations[m].error).find(Boolean);
  const partsOk = partsAreValid(associes);

  const handleRun = () => {
    if (!presets) return;
    const requetes = buildSaisonnierRequests(store, presets);
    for (const m of MONTAGES_SAISONNIER) {
      simulations[m].mutate(requetes[m], { onSuccess: (data) => setResult(m, data) });
    }
  };

  const actif = results[montageActif];
  const auMoinsUn = MONTAGES_SAISONNIER.some((m) => results[m]);

  return (
    <SidebarLayout
      open={panelOpen}
      onToggle={() => setPanelOpen(!panelOpen)}
      sidebar={
        <>
          <Panel>
            <ScenarioManager
              kind="saisonnier"
              getData={() => donneesASauver(store) as Record<string, unknown>}
              onLoad={(data) => store.hydrate(data as DonneesSauvees)}
            />
          </Panel>
          <Panel><SaisonnierBienForm /></Panel>
          <Panel><SaisonnierSaisonsForm /></Panel>
          <Panel><AssociesForm source={store} titre="Associes / proprietaires" /></Panel>
          <Panel><SaisonnierFiscaliteForm /></Panel>
          <Panel><SaisonnierParamsForm /></Panel>
        </>
      }
    >
      <div className="space-y-6">
        <p className="text-sm text-gray-600">
          Un meuble de tourisme est une activite commerciale : en direct (LMNP ou LMP), en SARL de famille, ou dans une
          societe a l’IS. Les trois montages sont compares a partir de la meme saisie.
        </p>

        {/* Kept outside the folding panel so a collapsed sidebar never strands the user without a way to re-run. */}
        <div className="space-y-1">
          <button
            onClick={handleRun}
            disabled={isPending || !partsOk || !presets}
            className="w-full px-6 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Calcul en cours...' : 'Comparer les montages'}
          </button>
          {!partsOk && <p className="text-xs text-red-600 text-center">La repartition des parts doit totaliser 100 %.</p>}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">Erreur : {error.message}</div>
        )}

        {auMoinsUn ? (
          <>
            <Comparaison results={results} sarlOk={sarlFamillePossible(associes)} />

            <div className="flex gap-1 border-b border-gray-200">
              {MONTAGES_SAISONNIER.filter((m) => results[m]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMontageActif(m)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    montageActif === m ? 'text-orange-700 border-orange-600' : 'text-gray-400 border-transparent hover:text-gray-600'
                  }`}
                >
                  {NOMS_MONTAGES[m]}
                </button>
              ))}
            </div>

            {actif && (
              <>
                <SaisonnierKpis result={actif} />
                {statutDe(montageActif, actif) === 'LMNP' && <SaisonnierLMNPReports result={actif} />}
                <SaisonnierCashFlowChart result={actif} />
                {asset.saisonnier && <SaisonnierRevenueChart saisonnier={asset.saisonnier} />}
                <SaisonnierSuccession result={actif} />
                <SaisonnierProjectionTable result={actif} statut={statutDe(montageActif, actif)} />
              </>
            )}
          </>
        ) : (
          <>
            {asset.saisonnier && <SaisonnierRevenueChart saisonnier={asset.saisonnier} />}
            <div className="bg-white rounded-lg border p-12 text-center text-gray-400">
              <p className="text-lg">Cliquez sur « Comparer les montages » pour lancer le calcul</p>
              <p className="text-sm mt-2">
                En direct · SARL de famille · Societe a l’IS, sur {store.params.horizonYears} ans
              </p>
            </div>
          </>
        )}

        <SaisonnierAvertissements />
      </div>
    </SidebarLayout>
  );
}
