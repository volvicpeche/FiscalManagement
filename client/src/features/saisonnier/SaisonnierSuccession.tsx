import type { SimulationResult } from '@shared/schemas.js';
import { RELATION_LABELS, formatEur } from '@/lib/profiles';

export function SaisonnierSuccession({ result }: { result: SimulationResult }) {
  const succ = result.succession;
  if (succ.heritiers.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="px-4 pt-4">
        <h3 className="text-lg font-semibold text-gray-900">Transmission au terme</h3>
        <p className="text-xs text-gray-500 mb-3">
          Droits dus par les heritiers si le deces survient a la fin de l’horizon.
        </p>
      </div>

      <div className="flex items-center justify-between px-4 py-2 bg-orange-50 border-y border-orange-100">
        <span className="text-sm font-semibold text-orange-900">Total des droits</span>
        <span className="text-sm font-mono font-bold text-red-600">{formatEur(succ.total)}</span>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 border-b">
            <th className="text-left font-medium px-4 py-1.5">Heritier</th>
            <th className="text-right font-medium px-4 py-1.5">Recu</th>
            <th className="text-right font-medium px-4 py-1.5">Abattement</th>
            <th className="text-right font-medium px-4 py-1.5">Droits</th>
          </tr>
        </thead>
        <tbody>
          {succ.heritiers.map((h) => (
            <tr key={h.nom} className="border-b last:border-0">
              <td className="px-4 py-1.5 text-gray-700">
                {h.nom}
                <span className="text-gray-400"> · {RELATION_LABELS[h.relation]}</span>
              </td>
              <td className="px-4 py-1.5 text-right font-mono text-gray-600">{formatEur(h.partRecue)}</td>
              <td className="px-4 py-1.5 text-right font-mono text-green-700">−{formatEur(h.abattement)}</td>
              <td className="px-4 py-1.5 text-right font-mono font-semibold text-red-600">
                {formatEur(h.droits)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
