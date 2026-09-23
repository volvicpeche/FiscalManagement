import type { AssocieInput } from '@shared/schemas.js';
import { useSaisonnierStore } from '@/store/saisonnierStore';

const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

function toDecimalStr(value: string): string {
  const num = parseFloat(value);
  return isNaN(num) ? '0.00' : num.toFixed(2);
}

/** Art. 155 IV CGI: above this, and above the other activity income, the letting is professional. */
const SEUIL_LMP = 23000;

export function SaisonnierProprietaireForm() {
  const {
    asset,
    proprietaire,
    updateProprietaire,
    statut,
    setStatut,
    regimeLMNP,
    setRegimeLMNP,
    meubleTourismeClasse,
    setMeubleTourismeClasse,
    tauxCotisationsSocialesLMP,
    setTauxCotisationsSocialesLMP,
  } = useSaisonnierStore();

  const s = asset.saisonnier;
  const recettes = s
    ? parseFloat(s.hauteSaison.caPeriode) + parseFloat(s.moyenneSaison.caPeriode) + parseFloat(s.basseSaison.caPeriode)
    : parseFloat(asset.annualRent);
  // "Other income" stands in for the household's activity income, which is
  // what the law compares the receipts against.
  const conditionsLMP = recettes > SEUIL_LMP && recettes > parseFloat(proprietaire.autresRevenus);
  const seuilMicro = s && !meubleTourismeClasse ? 15000 : 77700;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Foyer fiscal</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Le resultat BIC s’ajoute a vos autres revenus et est impose a votre bareme — sans ces
          informations l’IR serait sous-estime.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className={labelClass}>Statut du loueur</label>
          <select
            className={inputClass}
            value={statut}
            onChange={(e) => setStatut(e.target.value as 'LMNP' | 'LMP')}
          >
            <option value="LMNP">LMNP — loueur en meuble non professionnel</option>
            <option value="LMP">LMP — loueur en meuble professionnel</option>
          </select>
          {statut === 'LMNP' && conditionsLMP && (
            <p className="text-xs text-amber-700 mt-1">
              Recettes superieures a 23 000 EUR et a vos autres revenus : vous seriez LMP de plein
              droit.
            </p>
          )}
          {statut === 'LMP' && !conditionsLMP && (
            <p className="text-xs text-amber-700 mt-1">
              Recettes inferieures a 23 000 EUR ou a vos autres revenus : le statut LMP n’est pas
              atteint, vous releveriez du LMNP.
            </p>
          )}
        </div>

        {statut === 'LMNP' && (
          <>
            <div>
              <label className={labelClass}>Regime d’imposition</label>
              <select
                className={inputClass}
                value={regimeLMNP}
                onChange={(e) => setRegimeLMNP(e.target.value as 'REEL' | 'MICRO_BIC')}
              >
                <option value="REEL">Reel — charges et amortissements deduits</option>
                <option value="MICRO_BIC">Micro-BIC — abattement forfaitaire</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {regimeLMNP === 'MICRO_BIC'
                  ? `Abattement de ${s && !meubleTourismeClasse ? '30' : '50'} % sur les recettes brutes, jusqu’a ${seuilMicro.toLocaleString('fr-FR')} EUR. Ni charges, ni interets, ni amortissements. Au-dela du seuil, le reel s’applique l’annee suivante.`
                  : 'L’amortissement ne peut pas creer de deficit : l’excedent est differe sans limite. Un deficit ne s’impute pas sur vos autres revenus.'}
              </p>
            </div>
            {s && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={meubleTourismeClasse}
                  onChange={(e) => setMeubleTourismeClasse(e.target.checked)}
                />
                Meuble de tourisme classe (1 a 5 etoiles)
              </label>
            )}
          </>
        )}
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
          <label className={labelClass}>
            {statut === 'LMNP' ? 'Prelevements sociaux' : 'Prelevements sociaux (revenus hors LMP)'}
          </label>
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

        {statut === 'LMP' && (
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
        )}
      </div>
    </div>
  );
}
