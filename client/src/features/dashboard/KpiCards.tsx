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
  resultA: SimulationResult;
  resultB?: SimulationResult | null;
}

function KpiColumn({ label, result, color }: { label: string; result: SimulationResult; color: string }) {
  const lastYear = result.yearlyData[result.yearlyData.length - 1];
  const breakEvenYear = result.yearlyData.find((y) => parseFloat(y.totalNetCashFlow) > 0)?.year;

  return (
    <div className="space-y-3">
      <h4 className={`text-sm font-semibold ${color}`}>{label}</h4>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg border p-3">
          <p className="text-xs text-gray-500">Patrimoine net</p>
          <p className="text-lg font-bold text-gray-900">{formatEur(result.summary.totalNetWealth)}</p>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <p className="text-xs text-gray-500">Impots cumules</p>
          <p className="text-lg font-bold text-red-600">{formatEur(result.summary.totalTaxPaid)}</p>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <p className="text-xs text-gray-500">Cash flow (an {lastYear?.year})</p>
          <p className={`text-lg font-bold ${parseFloat(lastYear?.totalNetCashFlow ?? '0') >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatEur(lastYear?.totalNetCashFlow ?? '0')}
          </p>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <p className="text-xs text-gray-500">Equilibre</p>
          <p className="text-lg font-bold text-gray-900">
            {breakEvenYear ? `An ${breakEvenYear}` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

export function KpiCards({ resultA, resultB }: KpiCardsProps) {
  return (
    <div className={`grid gap-6 ${resultB ? 'grid-cols-2' : 'grid-cols-1'}`}>
      <KpiColumn label="Holding + SCI IS" result={resultA} color="text-blue-700" />
      {resultB && <KpiColumn label="SCI IR (transparence)" result={resultB} color="text-amber-700" />}
    </div>
  );
}
