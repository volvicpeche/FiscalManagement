import { useScenarioStore } from '@/store/scenarioStore';
import { useSimulation } from '@/hooks/useSimulation';
import { UserProfileForm, StructureForm, AssetForm, LoanForm, ParamsForm } from '@/features/scenario';
import { KpiCards, CashFlowChart, EquityChart, TaxBreakdownChart } from '@/features/dashboard';

function App() {
  const { scenarioA, scenarioB, resultA, resultB, setResultA, setResultB, syncSharedFields } = useScenarioStore();
  const simA = useSimulation();
  const simB = useSimulation();

  const isPending = simA.isPending || simB.isPending;

  const handleRun = () => {
    syncSharedFields();
    simA.mutate(scenarioA, { onSuccess: (data) => setResultA(data) });
    simB.mutate(scenarioB, { onSuccess: (data) => setResultB(data) });
  };

  const error = simA.error || simB.error;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Patrimonia</h1>
            <p className="text-sm text-gray-500">Simulateur de strategie patrimoniale — IS vs IR</p>
          </div>
          <button
            onClick={handleRun}
            disabled={isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Calcul en cours...' : 'Comparer IS vs IR'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            Erreur: {error.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: forms */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-lg border p-4">
              <StructureForm />
            </div>
            <div className="bg-white rounded-lg border p-4">
              <UserProfileForm />
            </div>
            <div className="bg-white rounded-lg border p-4">
              <AssetForm />
            </div>
            <div className="bg-white rounded-lg border p-4">
              <LoanForm />
            </div>
            <div className="bg-white rounded-lg border p-4">
              <ParamsForm />
            </div>
          </div>

          {/* Right panel: results */}
          <div className="lg:col-span-2 space-y-6">
            {resultA ? (
              <>
                <KpiCards resultA={resultA} resultB={resultB} />
                <CashFlowChart resultA={resultA} resultB={resultB} />
                <EquityChart resultA={resultA} resultB={resultB} />
                <TaxBreakdownChart resultA={resultA} resultB={resultB} />
              </>
            ) : (
              <div className="bg-white rounded-lg border p-12 text-center text-gray-400">
                <p className="text-lg">Cliquez sur "Comparer IS vs IR" pour lancer la simulation</p>
                <p className="text-sm mt-2">Scenario A (Holding + SCI IS) vs Scenario B (SCI IR) sur 30 ans</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
