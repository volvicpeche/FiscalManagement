import type { GestionSaisonniere, SaisonnierSaisonInput } from '@shared/schemas.js';
import { caDeSaison, useSaisonnierStore } from '@/store/saisonnierStore';
import { formatEur } from '@/lib/profiles';

const inputClass = 'w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm';
const labelClass = 'block text-xs font-medium text-gray-600 mb-1';

function toDecimalStr(value: string): string {
  const num = parseFloat(value);
  return isNaN(num) ? '0.00' : num.toFixed(2);
}

const SEASONS: { key: 'hauteSaison' | 'moyenneSaison' | 'basseSaison'; label: string; accent: string }[] = [
  { key: 'hauteSaison', label: 'Haute saison', accent: 'border-l-4 border-l-orange-500' },
  { key: 'moyenneSaison', label: 'Moyenne saison', accent: 'border-l-4 border-l-orange-300' },
  { key: 'basseSaison', label: 'Basse saison', accent: 'border-l-4 border-l-orange-100' },
];

const caDe = caDeSaison;

/** A year of 365 nights: two summer months, four shoulder months, the rest. */
const NUITS_PAR_DEFAUT = { hauteSaison: 62, moyenneSaison: 122, basseSaison: 181 } as const;

function SeasonRow({
  label,
  accent,
  value,
  parNuit,
  onChange,
}: {
  label: string;
  accent: string;
  value: SaisonnierSaisonInput;
  parNuit: boolean;
  onChange: (patch: Partial<SaisonnierSaisonInput>) => void;
}) {
  return (
    <div className={`rounded-md border border-gray-200 bg-gray-50/60 p-3 ${accent}`}>
      <p className="text-sm font-medium text-gray-800 mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Taux d’occupation (%)</label>
          <input
            type="number"
            step={5}
            min={0}
            max={100}
            className={inputClass}
            value={Math.round(value.tauxOccupation * 100)}
            onChange={(e) => {
              const pct = parseFloat(e.target.value);
              if (!isNaN(pct)) onChange({ tauxOccupation: pct / 100 });
            }}
          />
        </div>
        {parNuit ? (
          <div>
            <label className={labelClass}>Prix moyen par nuit (EUR)</label>
            <input
              type="number"
              step={5}
              min={0}
              className={inputClass}
              value={parseFloat(value.prixNuit ?? '0')}
              onChange={(e) => onChange({ prixNuit: toDecimalStr(e.target.value) })}
            />
          </div>
        ) : (
          <div>
            <label className={labelClass}>CA sur la periode (EUR)</label>
            <input
              type="number"
              step={500}
              min={0}
              className={inputClass}
              value={parseFloat(value.caPeriode)}
              onChange={(e) => onChange({ caPeriode: toDecimalStr(e.target.value) })}
            />
          </div>
        )}
        {parNuit && (
          <div>
            <label className={labelClass}>Nuits dans la saison</label>
            <input
              type="number"
              step={1}
              min={0}
              max={366}
              className={inputClass}
              value={value.nuits ?? 0}
              onChange={(e) => onChange({ nuits: Math.min(366, Math.max(0, parseInt(e.target.value) || 0)) })}
            />
          </div>
        )}
        {parNuit && (
          <div className="flex items-end pb-1.5 text-xs text-gray-500">
            CA : <span className="ml-1 font-mono text-gray-800">{formatEur(caDe(value))}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function SaisonnierSaisonsForm() {
  const { asset, updateSaison, updateSaisonnierParams } = useSaisonnierStore();
  const saisonnier = asset.saisonnier;
  if (!saisonnier) return null;

  const caAnnuelBrut = caDe(saisonnier.hauteSaison) + caDe(saisonnier.moyenneSaison) + caDe(saisonnier.basseSaison);

  const isConciergerie = saisonnier.gestion === 'CONCIERGERIE';
  // Priced by the night as soon as one season carries a price.
  const parNuit = SEASONS.some(({ key }) => saisonnier[key].prixNuit !== undefined);
  const basculer = () => {
    for (const { key } of SEASONS) {
      const s = saisonnier[key];
      if (parNuit) {
        // Back to typed amounts: keep the CA the nights gave.
        updateSaison(key, { caPeriode: caDe(s).toFixed(2), nuits: undefined, prixNuit: undefined });
      } else {
        // Start from the typed CA: the year split into its seasons (summer,
        // shoulder months, winter), the price that matches.
        const nuits = s.nuits ?? NUITS_PAR_DEFAUT[key];
        const occupees = nuits * s.tauxOccupation;
        updateSaison(key, { nuits, prixNuit: (occupees > 0 ? parseFloat(s.caPeriode) / occupees : 0).toFixed(2) });
      }
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Exploitation saisonniere</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {parNuit
            ? 'Nuits × taux d’occupation × prix par nuit : baisser l’occupation baisse le CA.'
            : 'CA saisi directement par periode ; le taux d’occupation est alors indicatif.'}
        </p>
        <button type="button" onClick={basculer} className="mt-1 text-xs text-orange-700 hover:underline">
          {parNuit ? 'Saisir le CA directement' : 'Calculer le CA a partir des nuits et du prix'}
        </button>
      </div>

      <div className="space-y-2">
        {SEASONS.map(({ key, label, accent }) => (
          <SeasonRow
            key={key}
            label={label}
            accent={accent}
            value={saisonnier[key]}
            parNuit={parNuit}
            onChange={(patch) => updateSaison(key, patch)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between rounded-md bg-orange-50 border border-orange-200 px-3 py-2">
        <span className="text-sm font-medium text-orange-900">CA annuel brut</span>
        <span className="text-sm font-mono font-semibold text-orange-900">{formatEur(caAnnuelBrut)}</span>
      </div>

      {/* Gestion mode: mutually exclusive fee structures. */}
      <div className="pt-3 border-t border-gray-200 space-y-3">
        <h4 className="text-sm font-semibold text-gray-800">Mode de gestion</h4>

        <div className="grid grid-cols-2 gap-2">
          {(['CONCIERGERIE', 'SOI_MEME'] as GestionSaisonniere[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => updateSaisonnierParams({ gestion: mode })}
              className={`rounded-md border px-3 py-2 text-sm font-medium text-left transition-colors ${
                saisonnier.gestion === mode
                  ? 'bg-orange-100 border-orange-300 text-orange-900'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {mode === 'CONCIERGERIE' ? 'Conciergerie' : 'Je m’en occupe moi-meme'}
            </button>
          ))}
        </div>

        <div>
          <label className={labelClass}>Commission plateforme (% du CA, frais hote)</label>
          <input
            type="number"
            step={1}
            min={0}
            max={100}
            className={inputClass}
            value={Math.round(saisonnier.commissionPlateforme * 100)}
            onChange={(e) => {
              const pct = parseFloat(e.target.value);
              if (!isNaN(pct)) updateSaisonnierParams({ commissionPlateforme: pct / 100 });
            }}
          />
          <p className="text-xs text-gray-400 mt-1">Prelevee par Airbnb, Booking ou Abritel, avec ou sans conciergerie.</p>
        </div>

        {isConciergerie ? (
          <div>
            <label className={labelClass}>
              Commission conciergerie (% du CA net de la plateforme — mise en location, menage, linge, entretien)
            </label>
            <input
              type="number"
              step={1}
              min={0}
              max={100}
              className={inputClass}
              value={Math.round(saisonnier.fraisConciergeriePercent * 100)}
              onChange={(e) => {
                const pct = parseFloat(e.target.value);
                if (!isNaN(pct)) updateSaisonnierParams({ fraisConciergeriePercent: pct / 100 });
              }}
            />
          </div>
        ) : (
          <div>
            <div>
              <label className={labelClass}>Menage / linge (EUR/an)</label>
              <input
                type="number"
                step={100}
                min={0}
                className={inputClass}
                value={parseFloat(saisonnier.fraisMenageLingeAnnuel)}
                onChange={(e) =>
                  updateSaisonnierParams({ fraisMenageLingeAnnuel: toDecimalStr(e.target.value) })
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
