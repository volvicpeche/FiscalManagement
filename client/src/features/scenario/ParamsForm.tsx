import { useScenarioStore } from '@/store/scenarioStore';

export function ParamsForm() {
  const { params, updateParams } = useScenarioStore();

  const pctField = (
    label: string,
    key: keyof typeof params,
    step = 0.1,
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="number"
        step={step}
        min={0}
        max={20}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        value={(((params[key] as number) ?? 0) * 100).toFixed(1)}
        onChange={(e) => {
          const pct = parseFloat(e.target.value);
          if (!isNaN(pct)) updateParams({ [key]: pct / 100 });
        }}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Parametres de simulation</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Horizon (annees)
          </label>
          <input
            type="number"
            min={1}
            max={50}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={params.horizonYears}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v)) updateParams({ horizonYears: v });
            }}
          />
        </div>

        {pctField('Revalorisation loyer (%)', 'rentGrowthRate')}
        {pctField('Evolution charges (%)', 'chargesGrowthRate')}
        {pctField('Evolution taxe fonciere (%)', 'propertyTaxGrowthRate')}
        {pctField('Croissance immobiliere (%)', 'propertyGrowth')}
        {pctField('Inflation generale (%)', 'inflationRate')}
      </div>

      {/* Dividend slider */}
      <div className="pt-2 border-t">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Distribution de dividendes : {Math.round(((params.dividendDistributionRate as number) ?? 0) * 100)}%
        </label>
        <p className="text-xs text-gray-400 mb-2">
          Montages a l’IS uniquement. A l’IR les associes sont imposes sur le resultat, qu’ils
          sortent le cash ou non.
        </p>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          className="w-full accent-blue-600"
          value={Math.round(((params.dividendDistributionRate as number) ?? 0) * 100)}
          onChange={(e) => updateParams({ dividendDistributionRate: parseInt(e.target.value) / 100 })}
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0% (capitalisation)</span>
          <span>100% (distribution totale)</span>
        </div>
      </div>
    </div>
  );
}
