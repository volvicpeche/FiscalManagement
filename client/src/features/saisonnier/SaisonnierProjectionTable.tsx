import type { SimulationResult } from '@shared/schemas.js';
import { formatEur } from '@/lib/profiles';

export function SaisonnierProjectionTable({ result }: { result: SimulationResult }) {
  const columns = [
    'Annee',
    'CA brut',
    'Charges',
    'Interets',
    'Amortissement',
    'Resultat imposable',
    'IR',
    'Cotisations sociales',
    'Cash flow net',
    'Dette restante',
    'Valeur bien',
  ];

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              {columns.map((c) => (
                <th
                  key={c}
                  className="text-right first:text-left font-medium text-gray-500 px-3 py-2 text-xs uppercase tracking-wide whitespace-nowrap"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.yearlyData.map((y) => {
              const entity = y.entities['LMP'];
              const associe = Object.values(y.associes)[0];
              if (!entity) return null;

              return (
                <tr key={y.year} className="border-b last:border-0 hover:bg-gray-50/60">
                  <td className="px-3 py-2 text-gray-700 font-medium">{y.year}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700">{formatEur(entity.grossRevenue)}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">{formatEur(entity.charges)}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">{formatEur(entity.loanInterest)}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">{formatEur(entity.depreciation)}</td>
                  <td
                    className={`px-3 py-2 text-right font-mono font-semibold ${
                      parseFloat(entity.taxableProfit) < 0 ? 'text-red-600' : 'text-gray-900'
                    }`}
                  >
                    {formatEur(entity.taxableProfit)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">
                    {associe ? formatEur(associe.irTax) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">
                    {associe ? formatEur(associe.psTax) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">
                    {formatEur(y.totalNetCashFlow)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-500">{formatEur(entity.remainingDebt)}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-500">{formatEur(entity.assetMarketValue)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-t">
        « Cotisations sociales » = TNS (SSI) sur le resultat BIC, pas les prelevements sociaux du
        foncier.
      </p>
    </div>
  );
}
