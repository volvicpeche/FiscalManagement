import { useScenarioStore } from '@/store/scenarioStore';
import { useSimulation } from '@/hooks/useSimulation';
import { UserProfileForm, StructureForm, AssetForm, LoanForm, ParamsForm } from '@/features/scenario';
import { KpiCards, CashFlowChart, EquityChart } from '@/features/dashboard';

function App() {
  const { scenario, result, setResult } = useScenarioStore();
  const simulation = useSimulation();

  const handleRun = () => {
    simulation.mutate(scenario, {
      onSuccess: (data) => setResult(data),
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Patrimonia</h1>
            <p className="text-sm text-gray-500">Simulateur de strategie patrimoniale</p>
          </div>
          <button
            onClick={handleRun}
            disabled={simulation.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {simulation.isPending ? 'Calcul en cours...' : 'Simuler'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {simulation.isError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            Erreur: {simulation.error.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: forms */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg border p-4">
              <UserProfileForm />
            </div>
            <div className="bg-white rounded-lg border p-4">
              <StructureForm />
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
            {result ? (
              <>
                <KpiCards result={result} />
                <CashFlowChart result={result} />
                <EquityChart result={result} />
              </>
            ) : (
              <div className="bg-white rounded-lg border p-12 text-center text-gray-400">
                <p className="text-lg">Cliquez sur "Simuler" pour lancer la projection</p>
                <p className="text-sm mt-2">Les resultats s'afficheront ici</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
