import { useScenarioStore } from '@/store/scenarioStore';

export function StructureForm() {
  const { scenario, updateStructure } = useScenarioStore();
  const structure = scenario.structures[0];

  if (!structure) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Structure juridique</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nom de la structure
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={structure.name}
            onChange={(e) => updateStructure(0, { name: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={structure.type}
            onChange={(e) => {
              const type = e.target.value as 'SCI_IS' | 'SCI_IR' | 'HOLDING' | 'INDIVIDUAL';
              const taxRegime = (type === 'SCI_IR' || type === 'INDIVIDUAL') ? 'IR' : 'IS';
              updateStructure(0, { type, taxRegime });
            }}
          >
            <option value="SCI_IS">SCI a l'IS</option>
            <option value="SCI_IR">SCI a l'IR</option>
            <option value="HOLDING">Holding</option>
            <option value="INDIVIDUAL">Nom propre</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Part de detention (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={Math.round((structure.ownershipShare ?? 1) * 100)}
            onChange={(e) => updateStructure(0, { ownershipShare: (parseInt(e.target.value) || 100) / 100 })}
          />
        </div>
      </div>
    </div>
  );
}
