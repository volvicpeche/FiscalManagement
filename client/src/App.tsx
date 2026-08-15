import { useState } from 'react';
import type { ScenarioProfile } from '@shared/schemas.js';
import {
  useScenarioStore,
  selectSharedInputs,
  buildScenario,
  partsAreValid,
  hasAnyResult,
} from '@/store/scenarioStore';
import { useSimulation } from '@/hooks/useSimulation';
import { PROFILE_ORDER } from '@/lib/profiles';
import {
  UserProfileForm,
  StructureForm,
  AssociesForm,
  AssetForm,
  LoanForm,
  CostsForm,
  SuccessionForm,
  ParamsForm,
} from '@/features/scenario';
import {
  KpiCards,
  CashFlowChart,
  EquityChart,
  TaxBreakdownChart,
  CostsChart,
  SuccessionCard,
  ProjectionTable,
} from '@/features/dashboard';

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-lg border p-4">{children}</div>;
}

const TABS = [
  { key: 'synthese', label: 'Synthese' },
  { key: 'tableau', label: 'Tableau previsionnel' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function App() {
  const store = useScenarioStore();
  const { associes, results, setResult } = store;
  const [tab, setTab] = useState<TabKey>('synthese');

  // One mutation per profile so they run in parallel and report independently.
  const simulations: Record<ScenarioProfile, ReturnType<typeof useSimulation>> = {
    SCI_IR: useSimulation(),
    SCI_IS_SEULE: useSimulation(),
    SCI_IS_HOLDING: useSimulation(),
  };

  const isPending = PROFILE_ORDER.some((p) => simulations[p].isPending);
  const error = PROFILE_ORDER.map((p) => simulations[p].error).find(Boolean);
  const validParts = partsAreValid(associes);

  const handleRun = () => {
    const shared = selectSharedInputs(store);
    for (const profile of PROFILE_ORDER) {
      simulations[profile].mutate(buildScenario(profile, shared), {
        onSuccess: (data) => setResult(profile, data),
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Patrimonia</h1>
            <p className="text-sm text-gray-500">
              Simulateur de SCI — creation, cout de fonctionnement, fiscalite et transmission
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleRun}
              disabled={isPending || !validParts}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Calcul en cours...' : 'Comparer les 3 montages'}
            </button>
            {!validParts && (
              <span className="text-xs text-red-600">
                La repartition des parts doit totaliser 100 %.
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            Erreur: {error.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: inputs */}
          <div className="lg:col-span-1 space-y-4">
            <Panel><StructureForm /></Panel>
            <Panel><AssociesForm /></Panel>
            <Panel><AssetForm /></Panel>
            <Panel><LoanForm /></Panel>
            <Panel><CostsForm /></Panel>
            <Panel><SuccessionForm /></Panel>
            <Panel><UserProfileForm /></Panel>
            <Panel><ParamsForm /></Panel>
          </div>

          {/* Right panel: results */}
          <div className="lg:col-span-2 space-y-6">
            {hasAnyResult(results) ? (
              <>
                <div className="flex gap-1 border-b border-gray-200">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTab(t.key)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        tab === t.key
                          ? 'text-blue-700 border-blue-600'
                          : 'text-gray-400 border-transparent hover:text-gray-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {tab === 'synthese' ? (
                  <>
                    <KpiCards results={results} />
                    <CashFlowChart results={results} />
                    <CostsChart results={results} />
                    <SuccessionCard results={results} />
                    <EquityChart results={results} />
                    <TaxBreakdownChart results={results} />
                  </>
                ) : (
                  <ProjectionTable results={results} />
                )}
              </>
            ) : (
              <div className="bg-white rounded-lg border p-12 text-center text-gray-400">
                <p className="text-lg">
                  Cliquez sur « Comparer les 3 montages » pour lancer la simulation
                </p>
                <p className="text-sm mt-2">
                  SCI a l’IR · SCI a l’IS · Holding + SCI a l’IS, sur {store.params.horizonYears} ans
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
