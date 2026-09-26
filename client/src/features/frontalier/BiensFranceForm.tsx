import type { BienFrance, UsageBienFrance } from '@shared/frontalier.js';
import { useFrontalierStore } from '@/store/frontalierStore';
import { Montant, Titre, inputClass, labelClass } from './ui';

const CHARGES: { cle: keyof BienFrance; label: string }[] = [
  { cle: 'chargesCoproEur', label: 'Charges de copro' },
  { cle: 'taxeFonciereEur', label: 'Taxe fonciere' },
  { cle: 'travauxEur', label: 'Travaux d’entretien' },
  { cle: 'assuranceEur', label: 'Assurance' },
  { cle: 'interetsEmpruntEur', label: 'Interets d’emprunt' },
];

/**
 * French properties. Their income is taxed in France, not in Geneva, but it
 * sets the Swiss rate: every charge entered here lowers that rate.
 */
export function BiensFranceForm() {
  const { biensFrance, autresRevenusEtrangersEur, sources, addBien, updateBien, removeBien, updateFoyer } =
    useFrontalierStore();

  return (
    <div className="space-y-4">
      <Titre aide="Exoneres a Geneve mais pris en compte pour le taux, et bruts dans le test des 90 %.">
        Revenus en France
      </Titre>

      {biensFrance.map((b, i) => (
        <div key={i} className="rounded-md border border-gray-200 p-3 space-y-3">
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <label className={labelClass}>Bien</label>
              <input
                className={inputClass}
                placeholder="Appartement Annecy"
                value={b.label}
                onChange={(e) => updateBien(i, { label: e.target.value })}
              />
            </div>
            <button
              type="button"
              className="px-2 py-2 text-sm text-gray-400 hover:text-red-600"
              onClick={() => removeBien(i)}
              title="Retirer ce bien"
            >
              ✕
            </button>
          </div>
          <div>
            <label className={labelClass}>Usage</label>
            <select
              className={inputClass}
              value={b.usage}
              onChange={(e) => updateBien(i, { usage: e.target.value as UsageBienFrance })}
            >
              <option value="LOCATIF">Mis en location</option>
              <option value="RESIDENCE_PRINCIPALE">Residence principale</option>
              <option value="SECONDAIRE">Residence secondaire</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {b.usage === 'LOCATIF' ? (
              <Montant
                label="Loyers bruts"
                devise="EUR"
                value={b.loyersBrutsEur}
                onChange={(v) => updateBien(i, { loyersBrutsEur: v })}
                source={sources[`biensFrance.${i}.loyersBrutsEur`]}
                className="col-span-2"
              />
            ) : (
              <Montant
                label="Valeur locative"
                devise="EUR"
                value={b.valeurLocativeEur}
                onChange={(v) => updateBien(i, { valeurLocativeEur: v })}
                aide="Loyer que le bien rapporterait, a l’estimer prudemment."
                className="col-span-2"
              />
            )}
            {CHARGES.map(({ cle, label }) => (
              <Montant
                key={cle}
                label={label}
                devise="EUR"
                value={String(b[cle])}
                onChange={(v) => updateBien(i, { [cle]: v })}
                source={sources[`biensFrance.${i}.${cle}`]}
              />
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addBien}
        className="w-full rounded-md border border-dashed border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50"
      >
        + Ajouter un bien en France
      </button>

      <Montant
        label="Autres revenus hors Suisse"
        devise="EUR"
        value={autresRevenusEtrangersEur}
        onChange={(v) => updateFoyer({ autresRevenusEtrangersEur: v })}
        aide="Dividendes, interets, revenus d’une SCI a l’IR..."
      />
    </div>
  );
}
