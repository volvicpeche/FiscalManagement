import { useScenarioStore, getFirstAsset } from '@/store/scenarioStore';

function toDecimalStr(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
}

export function AssetForm() {
  const { scenarioA, updateAssetA } = useScenarioStore();
  const asset = getFirstAsset(scenarioA);

  if (!asset) return null;

  const handleChange = (field: string, value: string) => {
    updateAssetA(0, 0, { [field]: toDecimalStr(value) });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Bien immobilier</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Designation
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={asset.label}
            onChange={(e) => updateAssetA(0, 0, { label: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Prix d'achat (EUR)
          </label>
          <input
            type="number"
            step={1000}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={parseFloat(asset.purchasePrice)}
            onChange={(e) => handleChange('purchasePrice', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Frais de notaire (EUR)
          </label>
          <input
            type="number"
            step={500}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={parseFloat(asset.notaryFees)}
            onChange={(e) => handleChange('notaryFees', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Travaux de renovation (EUR)
          </label>
          <input
            type="number"
            step={1000}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={parseFloat(asset.renovationCosts)}
            onChange={(e) => handleChange('renovationCosts', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Loyer annuel (EUR)
          </label>
          <input
            type="number"
            step={500}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={parseFloat(asset.annualRent)}
            onChange={(e) => handleChange('annualRent', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Charges annuelles (EUR)
          </label>
          <input
            type="number"
            step={100}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={parseFloat(asset.chargesYearly)}
            onChange={(e) => handleChange('chargesYearly', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Taxe fonciere (EUR)
          </label>
          <input
            type="number"
            step={100}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={parseFloat(asset.propertyTax)}
            onChange={(e) => handleChange('propertyTax', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
