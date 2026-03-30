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

interface CashFlowChartProps {
  resultA: SimulationResult;
  resultB?: SimulationResult | null;
}

export function CashFlowChart({ resultA, resultB }: CashFlowChartProps) {
  const data = resultA.yearlyData.map((y, i) => ({
    annee: y.year,
    'IS — Cash flow net': parseFloat(y.totalNetCashFlow),
    ...(resultB ? { 'IR — Cash flow net': parseFloat(resultB.yearlyData[i]?.totalNetCashFlow ?? '0') } : {}),
  }));

  const formatEur = (val: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Flux de tresorerie net annuel</h3>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="annee" label={{ value: 'Annee', position: 'insideBottom', offset: -5 }} />
          <YAxis tickFormatter={formatEur} width={100} />
          <Tooltip formatter={(val: number) => formatEur(val)} />
          <Legend />
          <Line type="monotone" dataKey="IS — Cash flow net" stroke="#3b82f6" strokeWidth={2} dot={false} />
          {resultB && (
            <Line type="monotone" dataKey="IR — Cash flow net" stroke="#f59e0b" strokeWidth={2} dot={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
