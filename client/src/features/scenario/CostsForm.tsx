import type { CostLine, EntityCostsInput, ManagementMode, ScenarioProfile } from '@shared/schemas.js';
import { useScenarioStore } from '@/store/scenarioStore';
import { useCostPresets, type CostPresets } from '@/hooks/useCostPresets';
import { ENTITY_SPECS, MODE_LABELS, PROFILE_META, PROFILE_ORDER, formatEur } from '@/lib/profiles';

const MODES: ManagementMode[] = ['SOI_MEME', 'EN_LIGNE', 'EXPERT_COMPTABLE', 'NOTAIRE_AVOCAT'];

function sumLines(lines: CostLine[]): number {
  return lines.reduce((acc, l) => acc + parseFloat(l.montant), 0);
}

/** Effective lines for one entity: the user override if any, else the preset. */
function linesFor(
  presets: CostPresets,
  mode: ManagementMode,
  profile: ScenarioProfile,
  entity: { name: string; type: keyof CostPresets[ManagementMode] },
  overrides: Record<string, EntityCostsInput>,
): { constitution: CostLine[]; annuel: CostLine[] } {
  const preset = presets[mode][entity.type];
  const override = overrides[entity.name];
  return {
    constitution: override?.constitution.length ? override.constitution : preset.constitution,
    annuel: override?.annuel.length ? override.annuel : preset.annuel,
  };
}

function profileTotals(
  presets: CostPresets,
  mode: ManagementMode,
  profile: ScenarioProfile,
  overrides: Record<string, EntityCostsInput>,
): { constitution: number; annuel: number } {
  return ENTITY_SPECS[profile].reduce(
    (acc, entity) => {
      const lines = linesFor(presets, mode, profile, entity, overrides);
      return {
        constitution: acc.constitution + sumLines(lines.constitution),
        annuel: acc.annuel + sumLines(lines.annuel),
      };
    },
    { constitution: 0, annuel: 0 },
  );
}

export function CostsForm() {
  const {
    managementMode,
    setManagementMode,
    activeProfile,
    setActiveProfile,
    costOverrides,
    setCostOverride,
    resetCostOverride,
  } = useScenarioStore();
  const { data: presets, isLoading, error } = useCostPresets();

  if (isLoading) {
    return <p className="text-sm text-gray-400">Chargement des couts de reference…</p>;
  }
  if (error || !presets) {
    return <p className="text-sm text-red-600">Couts de reference indisponibles.</p>;
  }

  const editLine = (
    entityName: string,
    kind: 'constitution' | 'annuel',
    lineIndex: number,
    montant: string,
  ) => {
    const entity = ENTITY_SPECS[activeProfile].find((e) => e.name === entityName)!;
    const current = linesFor(presets, managementMode, activeProfile, entity, costOverrides[activeProfile]);
    const next: EntityCostsInput = {
      mode: managementMode,
      // Editing one line freezes the whole block: the engine treats a non-empty
      // array as a full replacement of the preset.
      constitution: [...current.constitution],
      annuel: [...current.annuel],
    };
    next[kind] = next[kind].map((l, i) =>
      i === lineIndex ? { ...l, montant: (parseFloat(montant) || 0).toFixed(2) } : l,
    );
    setCostOverride(activeProfile, entityName, next);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Couts de structure</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Creation et fonctionnement annuel, selon qui s’en occupe.
        </p>
      </div>

      {/* Who does the paperwork */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mode de gestion</label>
        <select
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={managementMode}
          onChange={(e) => setManagementMode(e.target.value as ManagementMode)}
        >
          {MODES.map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      {/* The comparison that answers "how much does each montage cost me" */}
      <div className="space-y-1.5">
        {PROFILE_ORDER.map((profile) => {
          const totals = profileTotals(presets, managementMode, profile, costOverrides[profile]);
          const meta = PROFILE_META[profile];
          return (
            <div
              key={profile}
              className={`flex items-center justify-between rounded-md border px-3 py-2 ${meta.bg} ${meta.border}`}
            >
              <span className={`text-xs font-semibold ${meta.text}`}>{meta.short}</span>
              <span className="text-xs text-gray-600">
                <span className="font-mono">{formatEur(totals.constitution)}</span> a la creation ·{' '}
                <span className="font-mono font-semibold">{formatEur(totals.annuel)}</span>/an
              </span>
            </div>
          );
        })}
      </div>

      {/* Per-profile breakdown */}
      <div>
        <div className="flex gap-1 border-b border-gray-200 mb-3">
          {PROFILE_ORDER.map((profile) => (
            <button
              key={profile}
              type="button"
              onClick={() => setActiveProfile(profile)}
              className={`px-2.5 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                activeProfile === profile
                  ? `${PROFILE_META[profile].text} border-current`
                  : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}
            >
              {PROFILE_META[profile].short}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {ENTITY_SPECS[activeProfile].map((entity) => {
            const lines = linesFor(
              presets,
              managementMode,
              activeProfile,
              entity,
              costOverrides[activeProfile],
            );
            const isOverridden = Boolean(costOverrides[activeProfile][entity.name]);

            return (
              <div key={entity.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800">{entity.name}</h4>
                  {isOverridden && (
                    <button
                      type="button"
                      onClick={() => resetCostOverride(activeProfile, entity.name)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Retablir les valeurs par defaut
                    </button>
                  )}
                </div>

                {(['constitution', 'annuel'] as const).map((kind) => (
                  <div key={kind}>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      {kind === 'constitution' ? 'Creation (une fois)' : 'Fonctionnement (par an)'}
                    </p>
                    <div className="space-y-1">
                      {lines[kind].map((line, i) => (
                        <div key={line.label} className="flex items-center gap-2">
                          <span className="flex-1 text-xs text-gray-600 truncate" title={line.label}>
                            {line.label}
                          </span>
                          <input
                            type="number"
                            step={10}
                            min={0}
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-xs text-right"
                            value={parseFloat(line.montant)}
                            onChange={(e) => editLine(entity.name, kind, i, e.target.value)}
                          />
                        </div>
                      ))}
                      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                        <span className="flex-1 text-xs font-medium text-gray-700">Total</span>
                        <span className="w-24 text-xs font-mono font-semibold text-right text-gray-900">
                          {formatEur(sumLines(lines[kind]))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        ⚠️ Montants indicatifs 2026, a ajuster avec vos propres devis. Les couts annuels sont indexes
        sur l’inflation generale.
      </p>
    </div>
  );
}
