import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SimulationResult } from '@shared/schemas.js';
import { formatEur } from '@/lib/profiles';

export function SaisonnierCashFlowChart({ result }: { result: SimulationResult }) {
  const data = result.yearlyData.map((y) => ({
    annee: y.year,
    'Cash flow net': parseFloat(y.totalNetCashFlow),
  }));

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-lg font-semibold text-gray-900">Flux de tresorerie net annuel</h3>
      <p className="text-xs text-gray-500 mb-4">
        L’annee 0 porte les frais de constitution : c’est le creux de depart.
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="annee" label={{ value: 'Annee', position: 'insideBottom', offset: -5 }} />
          <YAxis tickFormatter={(v: number) => formatEur(v)} width={100} />
          <Tooltip formatter={(val: number) => formatEur(val)} />
          <Legend />
          <ReferenceLine y={0} stroke="#9ca3af" />
          <Line type="monotone" dataKey="Cash flow net" stroke="#ea580c" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
