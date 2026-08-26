import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { SimulationResult } from '@shared/schemas.js';
import { PROFILE_META, PROFILE_ORDER, formatEur } from '@/lib/profiles';
import type { ResultsProps } from './KpiCards';

/** Running total of what the structure itself has cost, year by year. */
function cumulativeCosts(result: SimulationResult): Map<number, number> {
  const out = new Map<number, number>();
  let running = 0;
  for (const y of result.yearlyData) {
    running += parseFloat(y.operatingCosts);
    out.set(y.year, running);
  }
  return out;
}

export function CostsChart({ results }: ResultsProps) {
  const available = PROFILE_ORDER.filter((p) => results[p]);
  const reference = results[available[0]];
  if (!reference) return null;

  const series = new Map(available.map((p) => [p, cumulativeCosts(results[p]!)]));

  const data = reference.yearlyData.map((y) => {
    const row: Record<string, number> = { annee: y.year };
    for (const p of available) {
      row[PROFILE_META[p].short] = series.get(p)!.get(y.year) ?? 0;
    }
    return row;
  });

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-lg font-semibold text-gray-900">Cout de la structure, cumule</h3>
      <p className="text-xs text-gray-500 mb-4">
        Constitution puis comptabilite, CFE, banque, assurance et juridique — indexes sur
        l’inflation. Le montage avec holding porte ces frais en double.
      </p>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="annee" label={{ value: 'Annee', position: 'insideBottom', offset: -5 }} />
          <YAxis tickFormatter={(v: number) => formatEur(v)} width={100} />
          <Tooltip formatter={(val: number) => formatEur(val)} />
          <Legend />
          {available.map((p) => (
            <Line
              key={p}
              type="monotone"
              dataKey={PROFILE_META[p].short}
              stroke={PROFILE_META[p].stroke}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {available.map((p) => {
          const r = results[p]!;
          const meta = PROFILE_META[p];
          return (
            <div key={p} className={`rounded-md border px-3 py-2 ${meta.bg} ${meta.border}`}>
              <p className={`text-xs font-semibold ${meta.text}`}>{meta.short}</p>
              <p className="text-xs text-gray-600 mt-1">
                Creation :{' '}
                <span className="font-mono">{formatEur(r.summary.fraisConstitution)}</span>
              </p>
              <p className="text-xs text-gray-600">
                Sur la duree :{' '}
                <span className="font-mono font-semibold">
                  {formatEur(r.summary.totalOperatingCosts)}
                </span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
