import type { ScenarioProfile, SimulationResult } from '@shared/schemas.js';
import { PROFILE_META, PROFILE_ORDER, formatEur } from '@/lib/profiles';

export interface ResultsProps {
  results: Record<ScenarioProfile, SimulationResult | null>;
}

interface Metric {
  label: string;
  value: (r: SimulationResult) => number;
  /** Which direction is better — drives the winner highlight. */
  better: 'higher' | 'lower';
  tone?: 'neutral' | 'cost';
  /** Percentages rather than euros. */
  format?: 'eur' | 'pct';
  aide?: string;
}

const METRICS: Metric[] = [
  {
    label: 'Patrimoine net a terme',
    value: (r) => parseFloat(r.summary.totalNetWealth),
    better: 'higher',
    aide: "Ce que la famille possede au terme : les societes, plus ce que les associes detiennent personnellement, net de l'apport de depart et des impots payes de leur poche.",
  },
  {
    label: 'Rendement annuel (TRI)',
    value: (r) => (r.summary.irr === null ? NaN : parseFloat(r.summary.irr) * 100),
    better: 'higher',
    format: 'pct',
    aide: "Le taux que rapporte l'operation chaque annee, tout compris. C'est le chiffre qui la rend comparable a un placement financier. La valeur du patrimoine au terme tient lieu de revente : l'impot sur la plus-value de sortie n'est pas deduit.",
  },
  {
    label: 'Impots cumules',
    value: (r) => parseFloat(r.summary.totalTaxPaid),
    better: 'lower',
    tone: 'cost',
  },
  {
    label: 'Cout de structure cumule',
    value: (r) =>
      parseFloat(r.summary.fraisConstitution) + parseFloat(r.summary.totalOperatingCosts),
    better: 'lower',
    tone: 'cost',
  },
  {
    label: 'Impot de sortie (revente)',
    value: (r) => parseFloat(r.summary.sortie.impot),
    better: 'lower',
    tone: 'cost',
    aide: "Ce que coute la vente au terme. A l'IS la plus-value se calcule sur la valeur comptable amortie, pas sur le prix d'achat : les vingt ans d'impot economise par l'amortissement reviennent ici. A l'IR, la plus-value est exoneree apres 22 ans (impot) et 30 ans (prelevements sociaux).",
  },
  {
    label: 'TRI net de revente',
    value: (r) => (r.summary.irrNetDeRevente === null ? NaN : parseFloat(r.summary.irrNetDeRevente) * 100),
    better: 'higher',
    format: 'pct',
    aide: "Le rendement sur le cycle complet, impot de sortie deduit. C'est l'indicateur a comparer entre montages : le TRI brut au-dessus flatte l'IS, qui n'a pas encore paye sa plus-value.",
  },
  {
    label: 'Droits de succession',
    value: (r) => parseFloat(r.summary.successionCost),
    better: 'lower',
    tone: 'cost',
  },
];

export function KpiCards({ results }: ResultsProps) {
  const available = PROFILE_ORDER.filter((p) => results[p]);

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left font-medium text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">
                Indicateur
              </th>
              {available.map((p) => (
                <th
                  key={p}
                  className={`text-right font-semibold px-4 py-2.5 whitespace-nowrap ${PROFILE_META[p].text}`}
                >
                  {PROFILE_META[p].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric) => {
              const values = available.map((p) => metric.value(results[p]!));
              // A montage with no meaningful rate must not decide the winner.
              const comparables = values.filter((v) => Number.isFinite(v));
              const best = comparables.length
                ? metric.better === 'higher'
                  ? Math.max(...comparables)
                  : Math.min(...comparables)
                : NaN;
              const tolerance = metric.format === 'pct' ? 0.005 : 0.5;
              const allEqual = comparables.every((v) => Math.abs(v - comparables[0]) < tolerance);

              const render = (v: number) => {
                if (!Number.isFinite(v)) return 'n/d';
                if (metric.format === 'pct') {
                  return `${v.toFixed(2).replace('.', ',')} %`;
                }
                return formatEur(v);
              };

              return (
                <tr key={metric.label} className="border-b last:border-0">
                  <td
                    className={`px-4 py-3 text-gray-600 ${metric.aide ? 'cursor-help' : ''}`}
                    title={metric.aide}
                  >
                    <span
                      className={
                        metric.aide
                          ? 'underline decoration-dotted decoration-gray-300 underline-offset-4'
                          : undefined
                      }
                    >
                      {metric.label}
                    </span>
                  </td>
                  {available.map((p, i) => {
                    const v = values[i];
                    const isBest =
                      !allEqual && Number.isFinite(v) && Math.abs(v - best) < tolerance;
                    return (
                      <td
                        key={p}
                        className={`px-4 py-3 text-right font-mono font-semibold whitespace-nowrap ${
                          !Number.isFinite(v)
                            ? 'text-gray-300'
                            : isBest
                              ? 'text-green-700 bg-green-50'
                              : metric.tone === 'cost'
                                ? 'text-red-600'
                                : metric.format === 'pct' && v < 0
                                  ? 'text-red-600'
                                  : 'text-gray-900'
                        }`}
                      >
                        {render(v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-xs text-gray-400 bg-gray-50 border-t">
        En vert, le montage le plus favorable pour chaque indicateur.
      </p>
    </div>
  );
}
