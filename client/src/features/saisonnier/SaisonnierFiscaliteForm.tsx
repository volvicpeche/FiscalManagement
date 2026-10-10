import type { ManagementMode, RegimeLMNP } from '@shared/schemas.js';
import { MODE_LABELS } from '@/lib/profiles';
import { useSaisonnierStore } from '@/store/saisonnierStore';

const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

const MODES: ManagementMode[] = ['SOI_MEME', 'EN_LIGNE', 'EXPERT_COMPTABLE', 'NOTAIRE_AVOCAT'];

/**
 * What the three setups share on the tax side. The LMNP / LMP status is not
 * asked: the engine decides it from the receipts and each household's other
 * income (art. 155 IV), and the result says which applied.
 */
export function SaisonnierFiscaliteForm() {
  const {
    asset,
    regimeLMNP,
    setRegimeLMNP,
    meubleTourismeClasse,
    setMeubleTourismeClasse,
    parahotellerie,
    setParahotellerie,
    tauxCotisationsSocialesLMP,
    setTauxCotisationsSocialesLMP,
    managementMode,
    setManagementMode,
  } = useSaisonnierStore();
  const seuilMicro = asset.saisonnier && !meubleTourismeClasse ? 15000 : 77700;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Fiscalite</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          LMNP ou LMP n’est pas a choisir : le calcul le deduit des recettes et des autres revenus d’activite de votre
          foyer (plus de 23 000 EUR de recettes, et plus que ces autres revenus : LMP).
        </p>
      </div>

      <div>
        <label className={labelClass}>Regime en direct</label>
        <select className={inputClass} value={regimeLMNP} onChange={(e) => setRegimeLMNP(e.target.value as RegimeLMNP)}>
          <option value="REEL">Reel — charges et amortissements deduits</option>
          <option value="MICRO_BIC">Micro-BIC — abattement forfaitaire</option>
        </select>
        <p className="text-xs text-gray-400 mt-1">
          {regimeLMNP === 'MICRO_BIC'
            ? `Abattement de ${asset.saisonnier && !meubleTourismeClasse ? '30' : '50'} % jusqu’a ${seuilMicro.toLocaleString('fr-FR')} EUR de recettes. Seulement en direct et en LMNP : une societe est toujours au reel.`
            : 'Une societe (SARL de famille, societe a l’IS) est toujours au reel.'}
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={meubleTourismeClasse} onChange={(e) => setMeubleTourismeClasse(e.target.checked)} />
        Meuble de tourisme classe (1 a 5 etoiles)
      </label>

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" className="mt-1" checked={parahotellerie} onChange={(e) => setParahotellerie(e.target.checked)} />
        <span>
          Services para-hoteliers (au moins trois parmi : petit-dejeuner, menage regulier, linge, accueil)
          <span className="block text-xs text-gray-400">
            Releve les seuils d’exoneration de la plus-value LMP. Attention : ces services rendent la location
            soumise a la TVA, non simulee ici.
          </span>
        </span>
      </label>

      <div>
        <label className={labelClass}>Cotisations sociales des independants (%)</label>
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
          Taux SSI indicatif, minimum d’environ 1 200 EUR par an : du en LMP, et en LMNP pour un meuble de tourisme
          au-dela de 23 000 EUR de recettes. Les options micro-social et regime general ne sont pas encore simulees.
        </p>
      </div>

      <div>
        <label className={labelClass}>Gestion administrative des societes</label>
        <select className={inputClass} value={managementMode} onChange={(e) => setManagementMode(e.target.value as ManagementMode)}>
          {MODES.map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m]}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">Fixe les couts de creation et de comptabilite, indicatifs.</p>
      </div>
    </div>
  );
}
