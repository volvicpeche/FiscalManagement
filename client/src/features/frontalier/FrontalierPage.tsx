import { useState } from 'react';
import { buildFrontalierRequest, selectInputs, useFrontalierStore } from '@/store/frontalierStore';
import { useFrontalierSimulation } from '@/hooks/useFrontalier';
import { SidebarLayout } from '@/components/SidebarLayout';
import { ScenarioManager } from '@/features/scenarios';
import { FoyerForm } from './FoyerForm';
import { PersonneForm } from './PersonneForm';
import { DeductionsForm } from './DeductionsForm';
import { BiensFranceForm } from './BiensFranceForm';
import { TravauxForm } from './TravauxForm';
import { DocumentDropzone } from './DocumentDropzone';
import { FrontalierResultats } from './FrontalierResultats';

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-lg border p-4">{children}</div>;
}

export function FrontalierPage() {
  const store = useFrontalierStore();
  const simulation = useFrontalierSimulation();
  const [panelOpen, setPanelOpen] = useState(true);

  const handleRun = () => {
    simulation.mutate(buildFrontalierRequest(store), {
      onSuccess: (data) => store.setResult(data),
    });
  };

  return (
    <SidebarLayout
      open={panelOpen}
      onToggle={() => setPanelOpen(!panelOpen)}
      sidebar={
        <>
          <Panel>
            <ScenarioManager
              kind="frontalier"
              getData={() => ({ ...selectInputs(store) })}
              onLoad={(data) => store.hydrate(data as Parameters<typeof store.hydrate>[0])}
            />
          </Panel>
          <Panel><DocumentDropzone /></Panel>
          <Panel><FoyerForm /></Panel>
          <Panel><PersonneForm qui="contribuable" /></Panel>
          {store.etatCivil === 'MARIE' && <Panel><PersonneForm qui="conjoint" /></Panel>}
          <Panel><DeductionsForm /></Panel>
          <Panel><TravauxForm /></Panel>
          <Panel><BiensFranceForm /></Panel>
        </>
      }
    >
      <div className="space-y-6">
        <button
          onClick={handleRun}
          disabled={simulation.isPending}
          className="w-full px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {simulation.isPending ? 'Calcul en cours...' : 'Comparer TOU et impot a la source'}
        </button>

        {simulation.error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            Erreur : {simulation.error.message}
          </div>
        )}

        {store.result ? (
          <FrontalierResultats result={store.result} />
        ) : (
          <div className="bg-white rounded-lg border p-12 text-center text-gray-400">
            <p className="text-lg">Cliquez sur « Comparer TOU et impot a la source » pour lancer le calcul</p>
            <p className="text-sm mt-2">
              Quasi-resident genevois, annee 2026 — ICC + IFD compares a l’impot retenu, test des 90 %, gain de chaque
              deduction
            </p>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
