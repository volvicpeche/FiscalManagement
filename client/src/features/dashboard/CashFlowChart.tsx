import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { PROFILE_META, PROFILE_ORDER, formatEur } from '@/lib/profiles';
import type { ResultsProps } from './KpiCards';

export function CashFlowChart({ results }: ResultsProps) {
  const available = PROFILE_ORDER.filter((p) => results[p]);
  const reference = results[available[0]];
  if (!reference) return null;

  const data = reference.yearlyData.map((y) => {
    const row: Record<string, number> = { annee: y.year };
    for (const p of available) {
      const match = results[p]!.yearlyData.find((r) => r.year === y.year);
      row[PROFILE_META[p].short] = parseFloat(match?.totalNetCashFlow ?? '0');
    }
    return row;
  });

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-lg font-semibold text-gray-900">Flux de tresorerie net annuel</h3>
      <p className="text-xs text-gray-500 mb-4">
        L’annee 0 porte les frais de constitution : c’est le creux de depart.
      </p>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="annee" label={{ value: 'Annee', position: 'insideBottom', offset: -5 }} />
          <YAxis tickFormatter={(v: number) => formatEur(v)} width={100} />
          <Tooltip formatter={(val: number) => formatEur(val)} />
          <Legend />
          <ReferenceLine y={0} stroke="#9ca3af" />
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
    </div>
  );
}
