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

interface EquityChartProps {
  result: SimulationResult;
}

export function EquityChart({ result }: EquityChartProps) {
  const entityName = Object.keys(result.yearlyData[0]?.entities ?? {})[0];
  if (!entityName) return null;

  const data = result.yearlyData.map((y) => {
    const entity = y.entities[entityName];
    const marketValue = parseFloat(entity?.assetMarketValue ?? '0');
    const debt = parseFloat(entity?.remainingDebt ?? '0');
    return {
      annee: y.year,
      'Valeur de marche': marketValue,
      'Capital restant du': debt,
      'Equity nette': marketValue - debt,
    };
  });

  const formatEur = (val: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Courbe patrimoniale</h3>
      <ResponsiveContainer width="100%" height={350}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="annee" label={{ value: 'Annee', position: 'insideBottom', offset: -5 }} />
          <YAxis tickFormatter={formatEur} width={100} />
          <Tooltip formatter={(val: number) => formatEur(val)} />
          <Legend />
          <Area type="monotone" dataKey="Valeur de marche" fill="#bfdbfe" stroke="#3b82f6" />
          <Area type="monotone" dataKey="Capital restant du" fill="#fecaca" stroke="#ef4444" />
          <Area type="monotone" dataKey="Equity nette" fill="#bbf7d0" stroke="#22c55e" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
