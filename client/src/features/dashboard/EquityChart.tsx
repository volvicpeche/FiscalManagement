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

function equityAt(result: SimulationResult, year: number): number {
  const yearData = result.yearlyData.find((y) => y.year === year);
  if (!yearData) return 0;

  let equity = 0;
  for (const entity of Object.values(yearData.entities)) {
    equity += parseFloat(entity.assetMarketValue) - parseFloat(entity.remainingDebt);
  }
  return equity;
}

function marketValueAt(result: SimulationResult, year: number): number {
  const yearData = result.yearlyData.find((y) => y.year === year);
  if (!yearData) return 0;
  return Object.values(yearData.entities).reduce(
    (acc, e) => acc + parseFloat(e.assetMarketValue),
    0,
  );
}

export function EquityChart({ results }: ResultsProps) {
  const available = PROFILE_ORDER.filter((p) => results[p]);
  const reference = results[available[0]];
  if (!reference) return null;

  const data = reference.yearlyData.map((y) => {
    const row: Record<string, number> = {
      annee: y.year,
      'Valeur du bien': marketValueAt(reference, y.year),
    };
    for (const p of available) {
      row[PROFILE_META[p].short] = equityAt(results[p]!, y.year);
    }
    return row;
  });

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-lg font-semibold text-gray-900">Courbe patrimoniale</h3>
      <p className="text-xs text-gray-500 mb-4">
        Valeur des biens moins la dette bancaire restante.
      </p>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="annee" label={{ value: 'Annee', position: 'insideBottom', offset: -5 }} />
          <YAxis tickFormatter={(v: number) => formatEur(v)} width={100} />
          <Tooltip formatter={(val: number) => formatEur(val)} />
          <Legend />
          <Line
            type="monotone"
            dataKey="Valeur du bien"
            stroke="#a5b4fc"
            strokeDasharray="5 5"
            strokeWidth={1.5}
            dot={false}
          />
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
