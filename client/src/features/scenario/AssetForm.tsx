import { computeAssetYields } from '@shared/yield.js';
import { useScenarioStore } from '@/store/scenarioStore';
import { formatEur } from '@/lib/profiles';

function toDecimalStr(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
}

const formatPct = (value: { toNumber(): number }) =>
  `${(value.toNumber() * 100).toFixed(2).replace('.', ',')} %`;

function YieldRow({
  label,
  hint,
  value,
  strong = false,
}: {
  label: string;
  hint: string;
  value: { toNumber(): number };
  strong?: boolean;
}) {
  const negative = value.toNumber() < 0;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <p className={`text-xs ${strong ? 'font-medium text-gray-800' : 'text-gray-600'}`}>{label}</p>
        <p className="text-xs text-gray-400 truncate">{hint}</p>
      </div>
      <span
        className={`font-mono text-sm whitespace-nowrap ${
          negative ? 'text-red-600 font-semibold' : strong ? 'font-bold text-gray-900' : 'text-gray-700'
        }`}
      >
        {formatPct(value)}
      </span>
    </div>
  );
}

export function AssetForm() {
  const { asset, updateAsset } = useScenarioStore();

  if (!asset) return null;

  const handleChange = (field: string, value: string) => {
    updateAsset({ [field]: toDecimalStr(value) });
  };

  const yields = computeAssetYields(asset);

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
            onChange={(e) => updateAsset({ label: e.target.value })}
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

      {/* Yields — before financing and before tax: they measure the walls. */}
      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2.5">
        <div className="flex items-baseline justify-between">
          <h4 className="text-sm font-semibold text-gray-800">Rentabilite</h4>
          <span className="text-xs text-gray-400">
            Cout total {formatEur(yields.coutTotal.toNumber())}
          </span>
        </div>

        <YieldRow
          label="Brute"
          hint="Loyer / prix d'achat"
          value={yields.brute}
        />
        <YieldRow
          label="Brute sur cout total"
          hint="Notaire et travaux inclus"
          value={yields.bruteCoutTotal}
        />
        <div className="pt-2 border-t border-gray-200">
          <YieldRow
            label="Nette de charges"
            hint={`Loyer net ${formatEur(yields.loyerNet.toNumber())} / an`}
            value={yields.nette}
            strong
          />
        </div>

        <p className="text-xs text-gray-400 pt-1 border-t border-gray-200">
          Avant financement et avant impot. Ce qu’il reste apres l’IS ou l’IR depend du montage :
          voir la comparaison des trois scenarios.
        </p>
      </div>
    </div>
  );
}
