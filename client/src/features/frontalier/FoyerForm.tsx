import type { CommuneGe, EtatCivilGe } from '@shared/frontalier.js';
import { useFrontalierStore } from '@/store/frontalierStore';
import { LIBELLES_COMMUNES, SourceBadge, Titre, inputClass, labelClass } from './ui';

export function FoyerForm() {
  const { etatCivil, communeTravail, tauxChangeEurChf, enfants, sources, updateFoyer, setEnfants } =
    useFrontalierStore();

  const majEnfant = (i: number, p: Partial<(typeof enfants)[number]>) =>
    setEnfants(enfants.map((e, j) => (j === i ? { ...e, ...p } : e)));

  return (
    <div className="space-y-4">
      <Titre aide="Le test des 90 % et le bareme portent sur tout le foyer, conjoint compris.">Foyer</Titre>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Etat civil</label>
          <select
            className={inputClass}
            value={etatCivil}
            onChange={(e) => updateFoyer({ etatCivil: e.target.value as EtatCivilGe })}
          >
            <option value="CELIBATAIRE">Celibataire / PACS</option>
            <option value="MARIE">Marie(e)</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Commune de travail</label>
          <select
            className={inputClass}
            value={communeTravail}
            onChange={(e) => updateFoyer({ communeTravail: e.target.value as CommuneGe })}
          >
            {Object.entries(LIBELLES_COMMUNES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      {etatCivil === 'CELIBATAIRE' && (
        <p className="text-xs text-gray-400">
          Un PACS n’est pas un partenariat enregistre suisse : chaque partenaire fait sa propre demande.
        </p>
      )}

      <div>
        <div className="flex items-center justify-between">
          <label className={labelClass}>Enfants a charge</label>
          <button
            type="button"
            className="text-xs text-blue-600 hover:underline"
            onClick={() => setEnfants([...enfants, { age: 5, fraisGarde: '0.00' }])}
          >
            + Ajouter
          </button>
        </div>
        {enfants.length === 0 && <p className="text-xs text-gray-400">Aucun enfant.</p>}
        {enfants.map((e, i) => (
          <div key={i} className="grid grid-cols-[4rem_1fr_auto] gap-2 items-end mt-2">
            <div>
              <label className="block text-xs text-gray-500">Age</label>
              <input
                type="number"
                min={0}
                max={40}
                className={inputClass}
                value={e.age}
                onChange={(ev) => majEnfant(i, { age: parseInt(ev.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500">
                Frais de garde (CHF/an) <SourceBadge fichier={sources[`enfants.${i}.fraisGarde`]} />
              </label>
              <input
                type="number"
                min={0}
                step={500}
                disabled={e.age >= 14}
                className={`${inputClass} disabled:bg-gray-100`}
                value={parseFloat(e.fraisGarde) || 0}
                onChange={(ev) => majEnfant(i, { fraisGarde: (parseFloat(ev.target.value) || 0).toFixed(2) })}
              />
            </div>
            <button
              type="button"
              className="px-2 py-2 text-sm text-gray-400 hover:text-red-600"
              onClick={() => setEnfants(enfants.filter((_, j) => j !== i))}
              title="Retirer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div>
        <label className={labelClass}>Cours EUR → CHF</label>
        <input
          type="number"
          min={0.5}
          max={2}
          step={0.01}
          className={inputClass}
          value={parseFloat(tauxChangeEurChf) || 0}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (v > 0) updateFoyer({ tauxChangeEurChf: v.toFixed(4) });
          }}
        />
        <p className="text-xs text-gray-400 mt-1">
          Cours moyen de l’annee publie par l’AFC. Il convertit tous les revenus francais.
        </p>
      </div>
    </div>
  );
}
