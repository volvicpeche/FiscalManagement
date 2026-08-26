import type { ScenarioProfile, SimulationResult } from '@shared/schemas.js';
import { PROFILE_META, PROFILE_ORDER, formatEur } from '@/lib/profiles';

export interface ResultsProps {
  results: Record<ScenarioProfile, SimulationResult | null>;
}

interface Metric {
  label: string;
  value: (r: SimulationResult) => number;
  /** Which direction is better — drives the winner highlight. */
  better: 'higher' | 'lower';
  tone?: 'neutral' | 'cost';
}

const METRICS: Metric[] = [
  {
    label: 'Patrimoine net a terme',
    value: (r) => parseFloat(r.summary.totalNetWealth),
    better: 'higher',
  },
  {
    label: 'Impots cumules',
    value: (r) => parseFloat(r.summary.totalTaxPaid),
    better: 'lower',
    tone: 'cost',
  },
  {
    label: 'Cout de structure cumule',
    value: (r) =>
      parseFloat(r.summary.fraisConstitution) + parseFloat(r.summary.totalOperatingCosts),
    better: 'lower',
    tone: 'cost',
  },
  {
    label: 'Droits de succession',
    value: (r) => parseFloat(r.summary.successionCost),
    better: 'lower',
    tone: 'cost',
  },
];

export function KpiCards({ results }: ResultsProps) {
  const available = PROFILE_ORDER.filter((p) => results[p]);

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left font-medium text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">
                Indicateur
              </th>
              {available.map((p) => (
                <th
                  key={p}
                  className={`text-right font-semibold px-4 py-2.5 whitespace-nowrap ${PROFILE_META[p].text}`}
                >
                  {PROFILE_META[p].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric) => {
              const values = available.map((p) => metric.value(results[p]!));
              const best =
                metric.better === 'higher' ? Math.max(...values) : Math.min(...values);
              const allEqual = values.every((v) => Math.abs(v - values[0]) < 0.5);

              return (
                <tr key={metric.label} className="border-b last:border-0">
                  <td className="px-4 py-3 text-gray-600">{metric.label}</td>
                  {available.map((p, i) => {
                    const isBest = !allEqual && Math.abs(values[i] - best) < 0.5;
                    return (
                      <td
                        key={p}
                        className={`px-4 py-3 text-right font-mono font-semibold whitespace-nowrap ${
                          isBest
                            ? 'text-green-700 bg-green-50'
                            : metric.tone === 'cost'
                              ? 'text-red-600'
                              : 'text-gray-900'
                        }`}
                      >
                        {formatEur(values[i])}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-xs text-gray-400 bg-gray-50 border-t">
        En vert, le montage le plus favorable pour chaque indicateur.
      </p>
    </div>
  );
}
