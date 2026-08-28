import { useState } from 'react';
import type { ScenarioProfile } from '@shared/schemas.js';
import type { SharedInputs } from '@/store/scenarioStore';
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
  FinancementCard,
} from '@/features/dashboard';
import { SaisonnierPage } from '@/features/saisonnier';
import { AidePage } from '@/features/aide';
import { SidebarLayout } from '@/components/SidebarLayout';
import { ScenarioManager } from '@/features/scenarios';

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-lg border p-4">{children}</div>;
}

const TABS = [
  { key: 'synthese', label: 'Synthese' },
  { key: 'tableau', label: 'Tableau previsionnel' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const MODES = [
  { key: 'sci', label: 'SCI / Holding' },
  { key: 'saisonnier', label: 'Location saisonniere' },
  { key: 'aide', label: 'Aide' },
] as const;

type ModeKey = (typeof MODES)[number]['key'];

function App() {
  const [mode, setMode] = useState<ModeKey>('sci');
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

  // The projection table opens with the panel folded because it needs the
  // width, but the choice stays the user's from then on.
  const [panelOpen, setPanelOpen] = useState(true);
  const showForms = panelOpen || !hasAnyResult(results);

  const selectTab = (key: TabKey) => {
    setTab(key);
    setPanelOpen(key === 'synthese');
  };

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
              Simulateur patrimonial — structures locatives, fiscalite et transmission
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    mode === m.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {mode === 'sci' && (
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
            )}
          </div>
        </div>
      </header>

      {mode === 'aide' ? (
        <main className="mx-auto px-4 py-6 max-w-[1800px]">
          <AidePage />
        </main>
      ) : mode === 'saisonnier' ? (
        <main className="mx-auto px-4 py-6 max-w-[1800px]">
          <SaisonnierPage />
        </main>
      ) : (
        <main
          className={`mx-auto px-4 py-6 transition-[max-width] ${
            showForms ? 'max-w-7xl' : 'max-w-[1800px]'
          }`}
        >
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              Erreur: {error.message}
            </div>
          )}

          <SidebarLayout
            open={showForms}
            onToggle={() => setPanelOpen(!panelOpen)}
            sidebar={
              <>
                <Panel>
                  <ScenarioManager
                    kind="sci"
                    getData={() => selectSharedInputs(store) as unknown as Record<string, unknown>}
                    onLoad={(data) => store.hydrate(data as Partial<SharedInputs>)}
                  />
                </Panel>
                <Panel><StructureForm /></Panel>
                <Panel><AssociesForm /></Panel>
                <Panel><AssetForm /></Panel>
                <Panel><LoanForm /></Panel>
                <Panel><CostsForm /></Panel>
                <Panel><SuccessionForm /></Panel>
                <Panel><UserProfileForm /></Panel>
                <Panel><ParamsForm /></Panel>
              </>
            }
          >
            <div className="space-y-6">
              {hasAnyResult(results) ? (
                <>
                  <div className="flex gap-1 border-b border-gray-200">
                    {TABS.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => selectTab(t.key)}
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
          </SidebarLayout>
        </main>
      )}
    </div>
  );
}

export default App;
