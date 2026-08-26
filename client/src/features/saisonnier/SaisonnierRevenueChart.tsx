import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SaisonnierParams } from '@shared/schemas.js';
import { formatEur } from '@/lib/profiles';

// Sequential shades of the same hue: haute -> basse reads as an intensity
// gradient, matching the ordinal nature of the three season buckets.
const SEASON_COLORS = ['#ea580c', '#fb923c', '#fed7aa'];

export function SaisonnierRevenueChart({ saisonnier }: { saisonnier: SaisonnierParams }) {
  const data = [
    { saison: 'Haute', ca: parseFloat(saisonnier.hauteSaison.caPeriode) },
    { saison: 'Moyenne', ca: parseFloat(saisonnier.moyenneSaison.caPeriode) },
    { saison: 'Basse', ca: parseFloat(saisonnier.basseSaison.caPeriode) },
  ];

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-lg font-semibold text-gray-900">CA par saison</h3>
      <p className="text-xs text-gray-500 mb-4">Repartition du chiffre d’affaires saisi, avant frais d’exploitation.</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={(v: number) => formatEur(v)} />
          <YAxis type="category" dataKey="saison" width={70} />
          <Tooltip formatter={(val: number) => formatEur(val)} />
          <Bar dataKey="ca" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={SEASON_COLORS[i]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
