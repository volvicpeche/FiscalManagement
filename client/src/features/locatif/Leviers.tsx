import { useStoreLocatif } from '@/store/storeLocatif';

const champ = 'w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm';

function Levier({
  label,
  valeur,
  pas,
  suffixe,
  onChange,
}: {
  label: string;
  valeur: number;
  pas: number;
  suffixe: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-xs text-gray-600">
        {label}
        <span className="text-gray-400">{suffixe}</span>
      </span>
      <input
        type="number"
        min={0}
        step={pas}
        className={champ}
        value={Number.isFinite(valeur) ? valeur : 0}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v) && v >= 0) onChange(v);
        }}
      />
    </label>
  );
}

/**
 * The few figures people try first — price, rent, loan — next to the
 * results. The comparison runs again on its own a moment after each change.
 */
export function Leviers() {
  const { asset, updateAsset, updateLoan } = useStoreLocatif();
  const pret = asset.loan;
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Ajuster</h3>
        <p className="text-xs text-gray-500">Le calcul se relance tout seul.</p>
      </div>
      <Levier label="Prix d’achat" suffixe="EUR" pas={5000} valeur={parseFloat(asset.purchasePrice)} onChange={(v) => updateAsset({ purchasePrice: v.toFixed(2) })} />
      <Levier label="Loyer annuel" suffixe="EUR" pas={500} valeur={parseFloat(asset.annualRent)} onChange={(v) => updateAsset({ annualRent: v.toFixed(2) })} />
      {pret && (
        <>
          <Levier label="Montant emprunte" suffixe="EUR" pas={5000} valeur={parseFloat(pret.principal)} onChange={(v) => updateLoan({ principal: v.toFixed(2) })} />
          <div className="grid grid-cols-2 gap-2">
            <Levier label="Taux" suffixe="%" pas={0.05} valeur={Math.round(pret.interestRate * 10000) / 100} onChange={(v) => updateLoan({ interestRate: v / 100 })} />
            <Levier label="Duree" suffixe="ans" pas={1} valeur={Math.round(pret.durationMonths / 12)} onChange={(v) => updateLoan({ durationMonths: Math.max(1, Math.round(v)) * 12 })} />
          </div>
        </>
      )}
    </div>
  );
}
