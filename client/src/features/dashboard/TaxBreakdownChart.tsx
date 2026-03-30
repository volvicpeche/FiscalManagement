import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { SimulationResult } from '@shared/schemas.js';

interface TaxBreakdownChartProps {
  resultA: SimulationResult;
  resultB?: SimulationResult | null;
}

export function TaxBreakdownChart({ resultA, resultB }: TaxBreakdownChartProps) {
  const data = resultA.yearlyData.map((y, i) => {
    let taxA = 0;
    for (const entity of Object.values(y.entities)) {
      taxA += parseFloat(entity.tax);
    }
    taxA += parseFloat(y.ifiTax);

    const row: Record<string, number> = {
      annee: y.year,
      'IS — Impots': taxA,
    };

    if (resultB) {
      const yB = resultB.yearlyData[i];
      if (yB) {
        let taxB = 0;
        for (const entity of Object.values(yB.entities)) {
          taxB += parseFloat(entity.tax);
        }
        taxB += parseFloat(yB.ifiTax);
        row['IR — Impots'] = taxB;
      }
    }

    return row;
  });

  const formatEur = (val: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Imposition annuelle comparee</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="annee" />
          <YAxis tickFormatter={formatEur} width={100} />
          <Tooltip formatter={(val: number) => formatEur(val)} />
          <Legend />
          <Bar dataKey="IS — Impots" fill="#3b82f6" />
          {resultB && <Bar dataKey="IR — Impots" fill="#f59e0b" />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
