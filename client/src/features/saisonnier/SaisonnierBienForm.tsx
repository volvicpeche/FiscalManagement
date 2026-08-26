import { useSaisonnierStore } from '@/store/saisonnierStore';

function toDecimalStr(value: string): string {
  const num = parseFloat(value);
  return isNaN(num) ? '0.00' : num.toFixed(2);
}

const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

export function SaisonnierBienForm() {
  const { asset, updateAsset, updateLoan } = useSaisonnierStore();
  const loan = asset.loan;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Le bien</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Renseignez le bien et son financement — l’analyse automatique d’une annonce arrivera dans
          une prochaine version.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={labelClass}>Designation</label>
          <input
            type="text"
            className={inputClass}
            value={asset.label}
            onChange={(e) => updateAsset({ label: e.target.value })}
          />
        </div>

        <div>
          <label className={labelClass}>Prix d'achat (EUR)</label>
          <input
            type="number"
            step={1000}
            className={inputClass}
            value={parseFloat(asset.purchasePrice)}
            onChange={(e) => updateAsset({ purchasePrice: toDecimalStr(e.target.value) })}
          />
        </div>

        <div>
          <label className={labelClass}>Frais de notaire (EUR)</label>
          <input
            type="number"
            step={500}
            className={inputClass}
            value={parseFloat(asset.notaryFees)}
            onChange={(e) => updateAsset({ notaryFees: toDecimalStr(e.target.value) })}
          />
        </div>

        <div>
          <label className={labelClass}>Travaux de renovation (EUR)</label>
          <input
            type="number"
            step={1000}
            className={inputClass}
            value={parseFloat(asset.renovationCosts)}
            onChange={(e) => updateAsset({ renovationCosts: toDecimalStr(e.target.value) })}
          />
        </div>

        <div>
          <label className={labelClass}>Charges de copropriete (EUR/an)</label>
          <input
            type="number"
            step={100}
            className={inputClass}
            value={parseFloat(asset.chargesYearly)}
            onChange={(e) => updateAsset({ chargesYearly: toDecimalStr(e.target.value) })}
          />
        </div>

        <div>
          <label className={labelClass}>Taxe fonciere (EUR/an)</label>
          <input
            type="number"
            step={100}
            className={inputClass}
            value={parseFloat(asset.propertyTax)}
            onChange={(e) => updateAsset({ propertyTax: toDecimalStr(e.target.value) })}
          />
        </div>
      </div>

      {loan && (
        <div className="pt-3 border-t border-gray-200 space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">Financement</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Montant emprunte (EUR)</label>
              <input
                type="number"
                step={5000}
                className={inputClass}
                value={parseFloat(loan.principal)}
                onChange={(e) => {
                  const num = parseFloat(e.target.value);
                  if (!isNaN(num)) updateLoan({ principal: num.toFixed(2) });
                }}
              />
            </div>
            <div>
              <label className={labelClass}>Taux nominal (%)</label>
              <input
                type="number"
                step={0.1}
                min={0}
                max={15}
                className={inputClass}
                value={((loan.interestRate ?? 0) * 100).toFixed(2)}
                onChange={(e) => {
                  const pct = parseFloat(e.target.value);
                  if (!isNaN(pct)) updateLoan({ interestRate: pct / 100 });
                }}
              />
            </div>
            <div>
              <label className={labelClass}>Duree (annees)</label>
              <input
                type="number"
                step={1}
                min={1}
                max={30}
                className={inputClass}
                value={Math.round((loan.durationMonths ?? 240) / 12)}
                onChange={(e) => {
                  const years = parseInt(e.target.value);
                  if (!isNaN(years)) updateLoan({ durationMonths: years * 12 });
                }}
              />
            </div>
            <div>
              <label className={labelClass}>Type de pret</label>
              <select
                className={inputClass}
                value={loan.type}
                onChange={(e) => updateLoan({ type: e.target.value as 'AMORTISSABLE' | 'INFINE' })}
              >
                <option value="AMORTISSABLE">Amortissable</option>
                <option value="INFINE">In fine</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
