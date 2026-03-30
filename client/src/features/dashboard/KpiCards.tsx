import type { SimulationResult } from '@shared/schemas.js';

function formatEur(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(num);
}

interface KpiCardsProps {
  result: SimulationResult;
}

export function KpiCards({ result }: KpiCardsProps) {
  const { summary, yearlyData } = result;
  const lastYear = yearlyData[yearlyData.length - 1];

  // Find break-even year (first year where totalNetCashFlow > 0)
  const breakEvenYear = yearlyData.find(
    (y) => parseFloat(y.totalNetCashFlow) > 0,
  )?.year;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white rounded-lg border p-4">
        <p className="text-sm text-gray-500">Patrimoine net (an {lastYear?.year})</p>
        <p className="text-2xl font-bold text-gray-900">{formatEur(summary.totalNetWealth)}</p>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <p className="text-sm text-gray-500">Impots cumules</p>
        <p className="text-2xl font-bold text-red-600">{formatEur(summary.totalTaxPaid)}</p>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <p className="text-sm text-gray-500">Cash flow net (an {lastYear?.year})</p>
        <p className={`text-2xl font-bold ${parseFloat(lastYear?.totalNetCashFlow ?? '0') >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatEur(lastYear?.totalNetCashFlow ?? '0')}
        </p>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <p className="text-sm text-gray-500">Point d'equilibre</p>
        <p className="text-2xl font-bold text-gray-900">
          {breakEvenYear ? `Annee ${breakEvenYear}` : 'Non atteint'}
        </p>
      </div>
    </div>
  );
}
