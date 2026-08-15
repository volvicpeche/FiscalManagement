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
import { PROFILE_META, PROFILE_ORDER, formatEur } from '@/lib/profiles';
import type { ResultsProps } from './KpiCards';

/** Everything the year costs in tax: company IS, associe IR/PS, and IFI. */
function taxAt(result: SimulationResult, year: number): number {
  const yearData = result.yearlyData.find((y) => y.year === year);
  if (!yearData) return 0;

  let tax = Object.values(yearData.entities).reduce((acc, e) => acc + parseFloat(e.tax), 0);
  tax += Object.values(yearData.associes).reduce(
    (acc, a) => acc + parseFloat(a.irTax) + parseFloat(a.psTax),
    0,
  );
  tax += parseFloat(yearData.ifiTax);
  return tax;
}

export function TaxBreakdownChart({ results }: ResultsProps) {
  const available = PROFILE_ORDER.filter((p) => results[p]);
  const reference = results[available[0]];
  if (!reference) return null;

  const data = reference.yearlyData.map((y) => {
    const row: Record<string, number> = { annee: y.year };
    for (const p of available) {
      row[PROFILE_META[p].short] = taxAt(results[p]!, y.year);
    }
    return row;
  });

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-lg font-semibold text-gray-900">Imposition annuelle comparee</h3>
      <p className="text-xs text-gray-500 mb-4">
        IS de la societe, IR et prelevements sociaux des associes, IFI. Un montant negatif signifie
        que le deficit foncier a reduit l’impot global des associes.
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="annee" />
          <YAxis tickFormatter={(v: number) => formatEur(v)} width={100} />
          <Tooltip formatter={(val: number) => formatEur(val)} />
          <Legend />
          {available.map((p) => (
            <Bar key={p} dataKey={PROFILE_META[p].short} fill={PROFILE_META[p].stroke} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
