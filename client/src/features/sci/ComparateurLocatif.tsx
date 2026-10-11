import { useEffect, useRef, useState } from 'react';
import type { ScenarioProfile } from '@shared/schemas.js';
import type { ScenarioKind } from '@shared/scenario.js';
import type { StoreLocatif } from '@/store/scenarioStore';
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
import { BarreEtapes } from '@/components/BarreEtapes';
import { alertes, etapesVisibles } from '@/store/parcoursImmo';
import { AccueilScenarios } from '@/features/locatif/AccueilScenarios';
import { BarreScenario } from '@/features/locatif/BarreScenario';
import { Leviers } from '@/features/locatif/Leviers';
import { ParcoursImmo } from '@/features/locatif/ParcoursImmo';

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
  /** The page's name, on the scenario list. */
  titre: string;
  /** One line above the comparison: what the page is for. */
  intro: React.ReactNode;
  autre: AutrePage;
}

/**
 * Several setups compared from one set of inputs. Each page built on it keeps
 * its own store (« Investir en direct », « Investir en societe »); the forms
 * reach it through StoreLocatifContext. Three views (`store.vue`): the saved
 * scenarios, the step-by-step entry, and the results with a few levers that
 * re-run the comparison on their own. A folded box compares with the other
 * page, and hands the inputs over when they differ.
 */
export function ComparateurLocatif(props: ComparateurProps) {
  return (
    <StoreLocatifContext.Provider value={props.store}>
      <Contenu {...props} />
    </StoreLocatifContext.Provider>
  );
}

function Contenu({ kind, profils, titre, intro, autre }: ComparateurProps) {
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

  const selectTab = (key: TabKey) => {
    setTab(key);
    setPanelOpen(key === 'synthese');
  };

  // The inputs last computed: a lever re-runs only when they really changed.
  const empreinte = JSON.stringify(selectSharedInputs(store));
  const dernierCalcul = useRef(empreinte);

  const handleRun = () => {
    const shared = selectSharedInputs(store);
    dernierCalcul.current = JSON.stringify(shared);
    for (const profile of profils) {
      simulations[profile].mutate(buildScenario(profile, shared), {
        onSuccess: (data) => setResult(profile, data),
      });
    }
  };

  // A saved scenario opened, or the other page's inputs handed over: run at once.
  useEffect(() => {
    if (store.lancerALArrivee && validParts) {
      store.setLancerALArrivee(false);
      handleRun();
    }
    // Once, on arrival: the flag is cleared before running.
  }, [store.lancerALArrivee]);

  // On the results, every change re-runs the comparison a moment later.
  // Elsewhere the inputs move freely: the last step's button runs.
  useEffect(() => {
    if (store.vue !== 'resultats') {
      dernierCalcul.current = empreinte;
      return;
    }
    if (empreinte === dernierCalcul.current || !validParts) return;
    const t = setTimeout(handleRun, 600);
    return () => clearTimeout(t);
  }, [empreinte, store.vue, validParts]);

  /** Copies these inputs to the other page, which runs on arrival. */
  const comparerAilleurs = () => {
    const cible = autre.store.getState();
    cible.hydrate(selectSharedInputs(store));
    cible.setScenarioCourant(null);
    cible.setVue('resultats');
    cible.setLancerALArrivee(true);
    naviguer(autre.route);
  };

  if (store.vue === 'accueil') {
    return <AccueilScenarios kind={kind} titre={titre} intro={intro} />;
  }

  if (store.vue === 'parcours') {
    return (
      <div className="space-y-4">
        <div className="mx-auto max-w-4xl">
          <BarreScenario kind={kind} />
        </div>
        <ParcoursImmo
          societe={kind === 'sci'}
          profils={profils}
          onComparer={() => {
            handleRun();
            store.setVue('resultats');
            window.scrollTo({ top: 0 });
          }}
        />
      </div>
    );
  }

  const showForms = panelOpen || !hasAnyResult(results, profils);

  return (
    <div className="space-y-4">
      <BarreScenario kind={kind} />
      <BarreEtapes
        etapes={etapesVisibles(store)}
        courante="resultat"
        vues={etapesVisibles(store).map((e) => e.id)}
        avecAlertes={(id) => alertes(id, store).length > 0}
        onSelect={(id) => {
          store.setEtape(id);
          store.setVue('parcours');
          window.scrollTo({ top: 0 });
        }}
      />

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          Erreur: {error.message}
        </div>
      )}

      <SidebarLayout
        open={showForms}
        onToggle={() => setPanelOpen(!panelOpen)}
        sidebar={
          <>
            <Panel><Leviers /></Panel>
            <details className="bg-white rounded-lg border">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">
                Vue detaillee : toutes les saisies
              </summary>
              <div className="space-y-4 border-t p-4">
                <AssociesForm titre={kind === 'sci' ? 'Associes' : 'Proprietaires'} />
                <AssetForm />
                <LoanForm />
                <CostsForm profils={profils} />
                <SuccessionForm />
                <UserProfileForm />
                <ParamsForm />
              </div>
            </details>
          </>
        }
      >
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="text-sm text-gray-600">{intro}</div>
            <span className="shrink-0 text-xs text-gray-400" aria-live="polite">
              {isPending ? 'Calcul en cours…' : ''}
            </span>
          </div>
          {!validParts && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              La repartition des parts doit totaliser 100 % : le calcul attend.
            </p>
          )}

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
              <p className="text-lg">{isPending ? 'Calcul en cours…' : 'Pas encore de resultat'}</p>
              <p className="text-sm mt-2">
                {profils.map((p) => PROFILE_META[p].label).join(' · ')}, sur {store.params.horizonYears} ans
              </p>
            </div>
          )}
        </div>
      </SidebarLayout>
    </div>
  );
}
