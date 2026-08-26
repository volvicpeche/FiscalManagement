import type { SimulationResult } from '@shared/schemas.js';
import { formatEur } from '@/lib/profiles';

function Kpi({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'cost' | 'good' }) {
  const toneClass =
    tone === 'cost' ? 'text-red-600' : tone === 'good' ? 'text-green-700' : 'text-gray-900';
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-mono font-semibold mt-1 ${toneClass}`}>{value}</p>
    </div>
  );
}

export function SaisonnierKpis({ result }: { result: SimulationResult }) {
  const year1 = result.yearlyData.find((y) => y.year === 1);
  const lmp = year1?.entities['LMP'];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Kpi label="CA annuel brut (an 1)" value={lmp ? formatEur(lmp.grossRevenue) : '—'} />
      <Kpi
        label="Resultat imposable (an 1)"
        value={lmp ? formatEur(lmp.taxableProfit) : '—'}
        tone={lmp && parseFloat(lmp.taxableProfit) < 0 ? 'cost' : 'neutral'}
      />
      <Kpi label="Patrimoine net a terme" value={formatEur(result.summary.totalNetWealth)} tone="good" />
      <Kpi
        label="Impots + cotisations cumules"
        value={formatEur(result.summary.totalTaxPaid)}
        tone="cost"
      />
    </div>
  );
}
