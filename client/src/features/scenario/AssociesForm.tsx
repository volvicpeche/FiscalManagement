import { useState } from 'react';
import type { AssocieInput } from '@shared/schemas.js';
import { useScenarioStore, partsTotal, partsAreValid } from '@/store/scenarioStore';
import { RELATION_LABELS, formatEur } from '@/lib/profiles';

const inputClass = 'w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm';
const labelClass = 'block text-xs font-medium text-gray-600 mb-1';

function toDecimalStr(value: string): string {
  const num = parseFloat(value);
  return isNaN(num) ? '0.00' : num.toFixed(2);
}

interface CardProps {
  associe: AssocieInput;
  index: number;
  expanded: boolean;
  canRemove: boolean;
  onToggle: () => void;
}

function AssocieCard({ associe, index, expanded, canRemove, onToggle }: CardProps) {
  const { updateAssocie, removeAssocie } = useScenarioStore();
  const set = (patch: Partial<AssocieInput>) => updateAssocie(index, patch);

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50/60">
      {/* Header: identity, parts, relationship */}
      <div className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <input
            type="text"
            className={`${inputClass} flex-1`}
            value={associe.nom}
            onChange={(e) => set({ nom: e.target.value })}
            aria-label="Nom de l'associe"
          />
          {canRemove && (
            <button
              type="button"
              onClick={() => removeAssocie(index)}
              className="px-2 py-1.5 text-sm text-gray-400 hover:text-red-600 transition-colors"
              title="Retirer cet associe"
            >
              ✕
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>Parts (%)</label>
            <input
              type="number"
              step={1}
              min={0}
              max={100}
              className={inputClass}
              value={Number((associe.partsPercent * 100).toFixed(2))}
              onChange={(e) => {
                const pct = parseFloat(e.target.value);
                if (!isNaN(pct)) set({ partsPercent: pct / 100 });
              }}
            />
          </div>
          <div>
            <label className={labelClass}>Lien</label>
            <select
              className={inputClass}
              value={associe.relation}
              onChange={(e) => set({ relation: e.target.value as AssocieInput['relation'] })}
            >
              {Object.entries(RELATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          {expanded ? '− Masquer' : '+ Fiscalite et apports'}
        </button>
      </div>

      {/* Detail: own tax household and contributions */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-gray-200">
          <p className="text-xs text-gray-500 pt-2">
            A l’IR, la quote-part de cet associe s’ajoute a ses propres revenus et est imposee a
            <em> son</em> bareme.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Situation</label>
              <select
                className={inputClass}
                value={associe.maritalStatus}
                onChange={(e) => set({ maritalStatus: e.target.value as AssocieInput['maritalStatus'] })}
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
                value={associe.childrenCount}
                onChange={(e) => set({ childrenCount: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Autres revenus imposables (EUR/an)</label>
              <input
                type="number"
                step={1000}
                min={0}
                className={inputClass}
                value={parseFloat(associe.autresRevenus)}
                onChange={(e) => set({ autresRevenus: toDecimalStr(e.target.value) })}
              />
              <p className="text-xs text-gray-400 mt-1">
                Determine la tranche marginale : sans cette valeur, l’IR est sous-estime.
              </p>
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Prelevements sociaux</label>
              <select
                className={inputClass}
                value={associe.socialChargeRegime}
                onChange={(e) =>
                  set({ socialChargeRegime: e.target.value as AssocieInput['socialChargeRegime'] })
                }
              >
                <option value="STANDARD">Standard (17,2 %)</option>
                <option value="SWISS_EXEMPT">Affilie suisse (7,5 %)</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Apport capital (EUR)</label>
              <input
                type="number"
                step={100}
                min={0}
                className={inputClass}
                value={parseFloat(associe.apportCapital)}
                onChange={(e) => set({ apportCapital: toDecimalStr(e.target.value) })}
              />
            </div>
            <div>
              <label className={labelClass}>Compte courant (EUR)</label>
              <input
                type="number"
                step={1000}
                min={0}
                className={inputClass}
                value={parseFloat(associe.apportCompteCourant)}
                onChange={(e) => set({ apportCompteCourant: toDecimalStr(e.target.value) })}
              />
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Taux d’interet du compte courant (%)</label>
              <input
                type="number"
                step={0.1}
                min={0}
                max={20}
                className={inputClass}
                value={Number((associe.tauxInteretCCA * 100).toFixed(2))}
                onChange={(e) => {
                  const pct = parseFloat(e.target.value);
                  if (!isNaN(pct)) set({ tauxInteretCCA: pct / 100 });
                }}
              />
              <p className="text-xs text-gray-400 mt-1">
                0 % = compte courant non remunere. Le remboursement du capital sort de la SCI sans
                aucune fiscalite.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AssociesForm() {
  const { associes, addAssocie, redistribute } = useScenarioStore();
  const [expanded, setExpanded] = useState<number | null>(0);

  const total = partsTotal(associes);
  const valid = partsAreValid(associes);

  // Only a strictly largest share counts: a tie leaves nobody in charge.
  const maxParts = Math.max(...associes.map((a) => a.partsPercent));
  const aTete = associes.filter((a) => a.partsPercent === maxParts);
  const majoritaire = aTete.length === 1 ? aTete[0] : null;

  const capital = associes.reduce((sum, a) => sum + parseFloat(a.apportCapital), 0);
  const cca = associes.reduce((sum, a) => sum + parseFloat(a.apportCompteCourant), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Associes</h3>
        <span className="text-xs text-gray-500">{associes.length} personne(s)</span>
      </div>

      <div className="space-y-2">
        {associes.map((a, i) => (
          <AssocieCard
            key={i}
            associe={a}
            index={i}
            canRemove={associes.length > 1}
            expanded={expanded === i}
            onToggle={() => setExpanded(expanded === i ? null : i)}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={addAssocie}
          className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
        >
          + Ajouter un associe
        </button>
        <button
          type="button"
          onClick={redistribute}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
          title="Repartir les parts en laissant la majorite a l'associe « Moi-meme »"
        >
          Repartir
        </button>
      </div>

      {/* Parts total — the run button stays disabled until this reaches 100 % */}
      <div className="space-y-1">
        <div
          className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
            valid
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span className="font-medium">Total des parts</span>
          <span className="font-mono font-semibold">
            {(total * 100).toFixed(2)} % {valid ? '✓' : '✗'}
          </span>
        </div>
        <p className="text-xs text-gray-400">
          {majoritaire
            ? `${majoritaire.nom} detient la majorite (${(majoritaire.partsPercent * 100).toFixed(0)} %).`
            : 'Aucun associe majoritaire : personne ne peut emporter une decision.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
        <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
          <p>Capital social</p>
          <p className="text-sm font-semibold text-gray-800">{formatEur(capital)}</p>
        </div>
        <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
          <p>Comptes courants</p>
          <p className="text-sm font-semibold text-gray-800">{formatEur(cca)}</p>
        </div>
      </div>
    </div>
  );
}
