import { useScenarioStore } from '@/store/scenarioStore';

export function LoanForm() {
  const { scenario, updateLoan } = useScenarioStore();
  const loan = scenario.structures[0]?.assets[0]?.loan;

  if (!loan) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Financement</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Montant emprunte (EUR)
          </label>
          <input
            type="number"
            step={5000}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={parseFloat(loan.principal)}
            onChange={(e) => {
              const num = parseFloat(e.target.value);
              if (!isNaN(num)) updateLoan(0, 0, { principal: num.toFixed(2) });
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Taux nominal (%)
          </label>
          <input
            type="number"
            step={0.1}
            min={0}
            max={15}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={((loan.interestRate ?? 0) * 100).toFixed(2)}
            onChange={(e) => {
              const pct = parseFloat(e.target.value);
              if (!isNaN(pct)) updateLoan(0, 0, { interestRate: pct / 100 });
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Taux assurance (%)
          </label>
          <input
            type="number"
            step={0.01}
            min={0}
            max={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={((loan.insuranceRate ?? 0) * 100).toFixed(2)}
            onChange={(e) => {
              const pct = parseFloat(e.target.value);
              if (!isNaN(pct)) updateLoan(0, 0, { insuranceRate: pct / 100 });
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Duree (annees)
          </label>
          <input
            type="number"
            step={1}
            min={1}
            max={30}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={Math.round((loan.durationMonths ?? 240) / 12)}
            onChange={(e) => {
              const years = parseInt(e.target.value);
              if (!isNaN(years)) updateLoan(0, 0, { durationMonths: years * 12 });
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type de pret
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={loan.type}
            onChange={(e) => updateLoan(0, 0, { type: e.target.value as 'AMORTISSABLE' | 'INFINE' })}
          >
            <option value="AMORTISSABLE">Amortissable</option>
            <option value="INFINE">In fine</option>
          </select>
        </div>
      </div>
    </div>
  );
}
