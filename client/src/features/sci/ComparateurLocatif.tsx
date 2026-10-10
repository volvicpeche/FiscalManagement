import { useEffect, useState } from 'react';
import type { ScenarioProfile } from '@shared/schemas.js';
import type { ScenarioKind } from '@shared/scenario.js';
import type { SharedInputs, StoreLocatif } from '@/store/scenarioStore';
import { selectSharedInputs, buildScenario, partsAreValid, hasAnyResult } from '@/store/scenarioStore';
import { StoreLocatifContext, useStoreLocatif } from '@/store/storeLocatif';
import { naviguer, type Route } from '@/lib/router';
import { ComparaisonAutrePage } from './ComparaisonAutrePage';
import { useSimulation } from '@/hooks/useSimulation';
import { PROFILE_META, PROFILE_ORDER } from '@/lib/profiles';
import {
  UserProfileForm,
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
  BilanCard,
} from '@/features/dashboard';
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

/** The other page, for the side-by-side box: its store, setups, address and name. */
export interface AutrePage {
  store: StoreLocatif;
  profils: ScenarioProfile[];
  route: Route;
  libelle: string;
}

export interface ComparateurProps {
  /** This page's own inputs and results. */
  store: StoreLocatif;
  /** Saved scenarios of this page, apart from the other's. */
  kind: ScenarioKind;
  /** The setups this page compares, in display order. */
  profils: ScenarioProfile[];
  /** One line above the comparison: what the page is for. */
  intro: React.ReactNode;
  autre: AutrePage;
}

/**
 * Several setups compared from one set of inputs. Each page built on it keeps
 * its own store (« Investir en direct », « Investir en societe »); the forms
 * reach it through StoreLocatifContext. A folded box compares with the other
 * page, and hands the inputs over when they differ.
 */
export function ComparateurLocatif(props: ComparateurProps) {
  return (
    <StoreLocatifContext.Provider value={props.store}>
      <Contenu {...props} />
    </StoreLocatifContext.Provider>
  );
}

function Contenu({ kind, profils, intro, autre }: ComparateurProps) {
  const store = useStoreLocatif();
  const { associes, setResult } = store;
  const [tab, setTab] = useState<TabKey>('synthese');

  // One mutation per profile so they run in parallel and report independently.
  // Every profile gets its hook, whatever the page: hooks cannot be conditional.
  const simulations: Record<ScenarioProfile, ReturnType<typeof useSimulation>> = {
    SCI_IR: useSimulation(),
    SCI_IS_SEULE: useSimulation(),
    SCI_IS_HOLDING: useSimulation(),
    LMNP_REEL: useSimulation(),
    LMNP_MICRO: useSimulation(),
    NU_MICRO: useSimulation(),
    NU_REEL: useSimulation(),
  };

  // Only this page's setups reach the dashboard: it shows whatever has a result.
  const results = Object.fromEntries(
    PROFILE_ORDER.map((p) => [p, profils.includes(p) ? store.results[p] : null]),
  ) as typeof store.results;

  const isPending = profils.some((p) => simulations[p].isPending);
  const error = profils.map((p) => simulations[p].error).find(Boolean);
  const validParts = partsAreValid(associes);

  // The projection table opens with the panel folded because it needs the
  // width, but the choice stays the user's from then on.
  const [panelOpen, setPanelOpen] = useState(true);
  const showForms = panelOpen || !hasAnyResult(results, profils);

  const selectTab = (key: TabKey) => {
    setTab(key);
    setPanelOpen(key === 'synthese');
  };

  const handleRun = () => {
    const shared = selectSharedInputs(store);
    for (const profile of profils) {
      simulations[profile].mutate(buildScenario(profile, shared), {
        onSuccess: (data) => setResult(profile, data),
      });
    }
  };

  // Arriving from the other page with its inputs: run at once, as asked there.
  useEffect(() => {
    if (store.lancerALArrivee && validParts) {
      store.setLancerALArrivee(false);
      handleRun();
    }
    // Once, on arrival: the flag is cleared before running.
  }, [store.lancerALArrivee]);

  /** Copies these inputs to the other page, which runs on arrival. */
  const comparerAilleurs = () => {
    const cible = autre.store.getState();
    cible.hydrate(selectSharedInputs(store));
    cible.setLancerALArrivee(true);
    naviguer(autre.route);
  };

  return (
    <>
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
                kind={kind}
                getData={() => selectSharedInputs(store) as unknown as Record<string, unknown>}
                onLoad={(data) => store.hydrate(data as Partial<SharedInputs>)}
              />
            </Panel>
            <Panel><AssociesForm /></Panel>
            <Panel><AssetForm /></Panel>
            <Panel><LoanForm /></Panel>
            <Panel><CostsForm profils={profils} /></Panel>
            <Panel><SuccessionForm /></Panel>
            <Panel><UserProfileForm /></Panel>
            <Panel><ParamsForm /></Panel>
          </>
        }
      >
        <div className="space-y-6">
          <div className="text-sm text-gray-600">{intro}</div>
          <div className="space-y-1">
            <button
              onClick={handleRun}
              disabled={isPending || !validParts}
              className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Calcul en cours...' : 'Comparer les montages'}
            </button>
            {!validParts && (
              <p className="text-xs text-red-600 text-center">
                La repartition des parts doit totaliser 100 %.
              </p>
            )}
          </div>

          <ComparaisonAutrePage mesProfils={profils} autre={autre} onComparer={comparerAilleurs} />

          {hasAnyResult(results, profils) ? (
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
                Cliquez sur « Comparer les montages » pour lancer la simulation
              </p>
              <p className="text-sm mt-2">
                {profils.map((p) => PROFILE_META[p].label).join(' · ')}, sur {store.params.horizonYears} ans
              </p>
            </div>
          )}
        </div>
      </SidebarLayout>
    </>
  );
}
