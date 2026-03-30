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
  resultA: SimulationResult;
  resultB?: SimulationResult | null;
}

function getEntityValues(result: SimulationResult, year: number) {
  const yearData = result.yearlyData.find(y => y.year === year);
  if (!yearData) return { marketValue: 0, debt: 0 };

  let marketValue = 0;
  let debt = 0;
  for (const entity of Object.values(yearData.entities)) {
    marketValue += parseFloat(entity.assetMarketValue);
    debt += parseFloat(entity.remainingDebt);
  }
  return { marketValue, debt };
}

export function EquityChart({ resultA, resultB }: EquityChartProps) {
  const data = resultA.yearlyData.map((y) => {
    const a = getEntityValues(resultA, y.year);
    const row: Record<string, number> = {
      annee: y.year,
      'Valeur de marche': a.marketValue,
      'IS — Equity nette': a.marketValue - a.debt,
    };
    if (resultB) {
      const b = getEntityValues(resultB, y.year);
      row['IR — Equity nette'] = b.marketValue - b.debt;
    }
    return row;
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
          <Area type="monotone" dataKey="Valeur de marche" fill="#e0e7ff" stroke="#a5b4fc" strokeDasharray="5 5" />
          <Area type="monotone" dataKey="IS — Equity nette" fill="#bfdbfe" stroke="#3b82f6" strokeWidth={2} fillOpacity={0.4} />
          {resultB && (
            <Area type="monotone" dataKey="IR — Equity nette" fill="#fef3c7" stroke="#f59e0b" strokeWidth={2} fillOpacity={0.4} />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
