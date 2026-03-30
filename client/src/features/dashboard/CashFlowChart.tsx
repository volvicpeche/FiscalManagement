import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { SimulationResult } from '@shared/schemas.js';

interface CashFlowChartProps {
  result: SimulationResult;
}

export function CashFlowChart({ result }: CashFlowChartProps) {
  const entityName = Object.keys(result.yearlyData[0]?.entities ?? {})[0];
  if (!entityName) return null;

  const data = result.yearlyData.map((y) => {
    const entity = y.entities[entityName];
    return {
      annee: y.year,
      'Loyers bruts': parseFloat(entity?.grossRevenue ?? '0'),
      'Remboursement pret': -parseFloat(entity?.loanPayment ?? '0'),
      'Impots': -parseFloat(entity?.tax ?? '0') - parseFloat(y.ifiTax),
      'Cash flow net': parseFloat(y.totalNetCashFlow),
    };
  });

  const formatEur = (val: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Flux de tresorerie annuel</h3>
      <ResponsiveContainer width="100%" height={350}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="annee" label={{ value: 'Annee', position: 'insideBottom', offset: -5 }} />
          <YAxis tickFormatter={formatEur} width={100} />
          <Tooltip formatter={(val: number) => formatEur(val)} />
          <Legend />
          <Area type="monotone" dataKey="Loyers bruts" stackId="pos" fill="#86efac" stroke="#22c55e" />
          <Area type="monotone" dataKey="Remboursement pret" stackId="neg" fill="#fca5a5" stroke="#ef4444" />
          <Area type="monotone" dataKey="Impots" stackId="neg" fill="#fdba74" stroke="#f97316" />
          <Area type="monotone" dataKey="Cash flow net" fill="none" stroke="#3b82f6" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
