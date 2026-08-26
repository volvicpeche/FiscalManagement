import type { AssocieInput } from '@shared/schemas.js';
import { useSaisonnierStore } from '@/store/saisonnierStore';

const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

function toDecimalStr(value: string): string {
  const num = parseFloat(value);
  return isNaN(num) ? '0.00' : num.toFixed(2);
}

export function SaisonnierProprietaireForm() {
  const { proprietaire, updateProprietaire, tauxCotisationsSocialesLMP, setTauxCotisationsSocialesLMP } =
    useSaisonnierStore();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Foyer fiscal</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Le resultat BIC de la LMP s’ajoute a vos autres revenus et est impose a votre bareme —
          sans ces informations l’IR serait sous-estime.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Situation</label>
          <select
            className={inputClass}
            value={proprietaire.maritalStatus}
            onChange={(e) => updateProprietaire({ maritalStatus: e.target.value as AssocieInput['maritalStatus'] })}
          >
            <option value="SINGLE">Celibataire</option>
            <option value="MARRIED">Marie(e)</option>
            <option value="PACSED">Pacse(e)</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Enfants</label>
          <input
            type="number"
            min={0}
            max={10}
            className={inputClass}
            value={proprietaire.childrenCount}
            onChange={(e) => updateProprietaire({ childrenCount: parseInt(e.target.value) || 0 })}
          />
        </div>

        <div className="col-span-2">
          <label className={labelClass}>Autres revenus imposables (EUR/an)</label>
          <input
            type="number"
            step={1000}
            min={0}
            className={inputClass}
            value={parseFloat(proprietaire.autresRevenus)}
            onChange={(e) => updateProprietaire({ autresRevenus: toDecimalStr(e.target.value) })}
          />
        </div>

        <div className="col-span-2">
          <label className={labelClass}>Prelevements sociaux (revenus hors LMP)</label>
          <select
            className={inputClass}
            value={proprietaire.socialChargeRegime}
            onChange={(e) =>
              updateProprietaire({ socialChargeRegime: e.target.value as AssocieInput['socialChargeRegime'] })
            }
          >
            <option value="STANDARD">Standard (17,2 %)</option>
            <option value="SWISS_EXEMPT">Affilie suisse (7,5 %)</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className={labelClass}>Cotisations sociales TNS sur le resultat BIC (%)</label>
          <input
            type="number"
            step={1}
            min={0}
            max={100}
            className={inputClass}
            value={Math.round(tauxCotisationsSocialesLMP * 100)}
            onChange={(e) => {
              const pct = parseFloat(e.target.value);
              if (!isNaN(pct)) setTauxCotisationsSocialesLMP(pct / 100);
            }}
          />
          <p className="text-xs text-gray-400 mt-1">
            Taux SSI indicatif pour un loueur meuble professionnel — distinct des prelevements
            sociaux ci-dessus, qui ne portent que sur vos revenus hors LMP.
          </p>
        </div>
      </div>
    </div>
  );
}
