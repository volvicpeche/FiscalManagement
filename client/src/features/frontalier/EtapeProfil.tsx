import type { CantonTravail, LieuActivite } from '@shared/frontalier.js';
import { useFrontalierStore } from '@/store/frontalierStore';
import { CANTONS_TRAVAIL, inputClass, labelClass } from './ui';

function Choix<T extends string | boolean>({
  question,
  aide,
  value,
  options,
  onChange,
}: {
  question: string;
  aide?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className={labelClass}>{question}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={`rounded-md border px-4 py-2 text-sm transition-colors ${
              o.value === value
                ? 'border-indigo-600 bg-indigo-50 font-medium text-indigo-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {aide && <p className="text-xs text-gray-400 mt-1">{aide}</p>}
    </fieldset>
  );
}

const OUI_NON = [
  { value: true, label: 'Oui' },
  { value: false, label: 'Non' },
];

/** The answers that decide which steps and which papers the household gets. */
export function EtapeProfil() {
  const s = useFrontalierStore();

  const activiteConjoint = (activite: LieuActivite) => {
    if (activite === s.conjoint.activite) return;
    s.updatePersonne('conjoint', { activite, affilieLpp: activite === 'SUISSE' });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className={labelClass}>Dans quel canton travaillez-vous ?</label>
        <select
          className={`${inputClass} sm:max-w-xs`}
          value={s.canton}
          onChange={(e) => s.updateFoyer({ canton: e.target.value as CantonTravail })}
        >
          {Object.entries(CANTONS_TRAVAIL).map(([k, c]) => (
            <option key={k} value={k} disabled={!c.disponible}>
              {c.nom}
              {c.disponible ? '' : ' — bientot'}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          Vaud, Bale, Berne, Neuchatel, Valais, Soleure et Jura relevent de l’accord de 1983 : le frontalier y est
          impose en France, il n’y a pas de TOU a comparer.
        </p>
      </div>

      <Choix
        question="Etes-vous marie(e) ?"
        aide={
          s.etatCivil === 'CELIBATAIRE'
            ? 'Un PACS n’est pas un partenariat enregistre suisse : chaque partenaire fait sa propre demande.'
            : undefined
        }
        value={s.etatCivil}
        options={[
          { value: 'CELIBATAIRE', label: 'Non (celibataire, PACS)' },
          { value: 'MARIE', label: 'Oui' },
        ]}
        onChange={(etatCivil) => s.updateFoyer({ etatCivil })}
      />

      {s.etatCivil === 'MARIE' && (
        <Choix
          question="Ou travaille votre conjoint ?"
          value={s.conjoint.activite}
          options={[
            { value: 'SUISSE', label: 'En Suisse' },
            { value: 'FRANCE', label: 'En France' },
            { value: 'AUCUNE', label: 'Sans activite' },
          ]}
          onChange={activiteConjoint}
        />
      )}

      <Choix
        question="Avez-vous des enfants a charge ?"
        value={s.profil.enfants}
        options={OUI_NON}
        onChange={(enfants) => s.updateProfil({ enfants })}
      />

      <Choix
        question="Possedez-vous un logement en France, ou avez-vous des revenus hors de Suisse ?"
        aide="Residence principale comprise : sa valeur locative compte pour le taux. Aussi : location, dividendes, interets, SCI."
        value={s.profil.revenusFrance}
        options={OUI_NON}
        onChange={(revenusFrance) => s.updateProfil({ revenusFrance })}
      />

      {s.profil.revenusFrance && (
        <Choix
          question="Avez-vous fait des travaux dans ce logement cette annee ?"
          value={s.travauxActifs}
          options={OUI_NON}
          onChange={(v) => s.setTravauxActifs(v)}
        />
      )}
    </div>
  );
}
