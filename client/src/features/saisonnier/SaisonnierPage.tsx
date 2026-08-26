import { useSaisonnierStore, buildSaisonnierRequest } from '@/store/saisonnierStore';
import { useSimulation } from '@/hooks/useSimulation';
import { SaisonnierBienForm } from './SaisonnierBienForm';
import { SaisonnierSaisonsForm } from './SaisonnierSaisonsForm';
import { SaisonnierProprietaireForm } from './SaisonnierProprietaireForm';
import { SaisonnierParamsForm } from './SaisonnierParamsForm';
import { SaisonnierKpis } from './SaisonnierKpis';
import { SaisonnierRevenueChart } from './SaisonnierRevenueChart';
import { SaisonnierCashFlowChart } from './SaisonnierCashFlowChart';
import { SaisonnierProjectionTable } from './SaisonnierProjectionTable';
import { SaisonnierSuccession } from './SaisonnierSuccession';

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-lg border p-4">{children}</div>;
}

export function SaisonnierPage() {
  const store = useSaisonnierStore();
  const { asset, result, setResult } = store;
  const simulation = useSimulation();

  const handleRun = () => {
    simulation.mutate(buildSaisonnierRequest(store), {
      onSuccess: (data) => setResult(data),
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-4">
        <Panel><SaisonnierBienForm /></Panel>
        <Panel><SaisonnierSaisonsForm /></Panel>
        <Panel><SaisonnierProprietaireForm /></Panel>
        <Panel><SaisonnierParamsForm /></Panel>

        <button
          onClick={handleRun}
          disabled={simulation.isPending}
          className="w-full px-6 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {simulation.isPending ? 'Calcul en cours...' : 'Simuler la location saisonniere'}
        </button>
      </div>

      <div className="lg:col-span-2 space-y-6">
        {simulation.error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            Erreur : {simulation.error.message}
          </div>
        )}

        {result ? (
          <>
            <SaisonnierKpis result={result} />
            <SaisonnierCashFlowChart result={result} />
            {asset.saisonnier && <SaisonnierRevenueChart saisonnier={asset.saisonnier} />}
            <SaisonnierSuccession result={result} />
            <SaisonnierProjectionTable result={result} />
          </>
        ) : (
          <>
            {asset.saisonnier && <SaisonnierRevenueChart saisonnier={asset.saisonnier} />}
            <div className="bg-white rounded-lg border p-12 text-center text-gray-400">
              <p className="text-lg">
                Cliquez sur « Simuler la location saisonniere » pour lancer le calcul
              </p>
              <p className="text-sm mt-2">
                LMP (BIC reel) — CA saisonnier, conciergerie ou gestion directe, amortissement, sur{' '}
                {store.params.horizonYears} ans
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
