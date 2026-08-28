import { useState, type MouseEvent } from 'react';
import type { ScenarioProfile, SimulationResult } from '@shared/schemas.js';
import { PROFILE_META, PROFILE_ORDER, formatEur } from '@/lib/profiles';
import type { ResultsProps } from './KpiCards';
import {
  COLUMNS,
  FLUX_META,
  explainCell,
  fluxGroups,
  toRows,
  visibleColumns,
  type CellExplanation,
  type Column,
  type Row,
} from './projectionColumns';

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface Tip extends CellExplanation {
  x: number;
  y: number;
}

/**
 * Positioned `fixed` and rendered outside the scroll container on purpose: an
 * absolutely positioned bubble would be clipped by the table's overflow-x.
 */
function useTooltip() {
  const [tip, setTip] = useState<Tip | null>(null);

  const show = (event: MouseEvent<HTMLElement>, content: CellExplanation) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const half = 170;
    setTip({
      ...content,
      x: Math.min(Math.max(rect.left + rect.width / 2, half + 8), window.innerWidth - half - 8),
      y: rect.bottom + 8,
    });
  };

  const hide = () => setTip(null);

  const element = tip ? (
    <div
      role="tooltip"
      className="fixed z-50 w-[340px] -translate-x-1/2 rounded-lg bg-gray-900 px-3.5 py-3 text-xs text-white shadow-xl pointer-events-none"
      style={{ left: tip.x, top: tip.y }}
    >
      <p className="font-semibold mb-1">{tip.titre}</p>
      <p className="text-gray-300 leading-relaxed">{tip.quoi}</p>

      {tip.lignes.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-gray-700 space-y-1">
          {tip.lignes.map((l) => (
            <div key={l.label} className="flex justify-between gap-4">
              <span className="text-gray-400">{l.label}</span>
              <span className={`font-mono tabular-nums ${l.montant < 0 ? 'text-rose-300' : 'text-gray-200'}`}>
                {formatEur(l.montant)}
              </span>
            </div>
          ))}
          <div className="flex justify-between gap-4 pt-1 border-t border-gray-700">
            <span className="font-medium">Total</span>
            <span className="font-mono tabular-nums font-semibold">{formatEur(tip.total)}</span>
          </div>
        </div>
      )}
    </div>
  ) : null;

  return { show, hide, element };
}

// ─── Cells ───────────────────────────────────────────────────────────────────

function cellTone(value: number, col: Column): string {
  if (Math.abs(value) < 0.005) return 'text-gray-300';
  if (col.emphasise) return value < 0 ? 'text-rose-700 font-semibold' : 'text-emerald-700 font-semibold';
  if (col.transfert) return 'text-blue-700';
  if (col.flux === 'ENTREES') return 'text-emerald-700';
  if (col.flux === 'SORTIES') return value < 0 ? 'text-emerald-700' : 'text-rose-700';
  return value < 0 ? 'text-rose-700' : 'text-gray-700';
}

/**
 * Sorties are stored as positive numbers because they are read as amounts, not
 * as signed movements — so they carry an explicit minus in the table.
 */
function displayValue(value: number, col: Column): string {
  if (!Number.isFinite(value)) return 'n/d';
  if (Math.abs(value) < 0.005) return '—';
  if (col.flux === 'SORTIES' && value > 0) return `−${formatEur(value)}`;
  return formatEur(value);
}

// ─── Associe recap ───────────────────────────────────────────────────────────

interface AssocieTotals {
  nom: string;
  quotePart: number;
  irTax: number;
  psTax: number;
  ccaInterest: number;
  ccaRepayment: number;
  ccaBalance: number;
  netCashFlow: number;
}

function associeTotals(result: SimulationResult): AssocieTotals[] {
  const byNom = new Map<string, AssocieTotals>();

  for (const y of result.yearlyData) {
    for (const [nom, a] of Object.entries(y.associes)) {
      const current = byNom.get(nom) ?? {
        nom, quotePart: 0, irTax: 0, psTax: 0,
        ccaInterest: 0, ccaRepayment: 0, ccaBalance: 0, netCashFlow: 0,
      };
      current.quotePart += parseFloat(a.quotePart);
      current.irTax += parseFloat(a.irTax);
      current.psTax += parseFloat(a.psTax);
      current.ccaInterest += parseFloat(a.ccaInterest);
      current.ccaRepayment += parseFloat(a.ccaRepayment);
      current.netCashFlow += parseFloat(a.netCashFlow);
      // A balance is a snapshot, not a sum: the last year wins.
      current.ccaBalance = parseFloat(a.ccaBalance);
      byNom.set(nom, current);
    }
  }

  return [...byNom.values()];
}

const ASSOCIE_COLS: { label: string; get: (a: AssocieTotals) => number; cost?: boolean; quoi: string }[] = [
  { label: 'Quote-part', get: (a) => a.quotePart, quoi: "Part du resultat attribuee a cet associe, au prorata de ses parts. Reste a zero a l'IS : c'est la societe qui est imposee." },
  { label: 'IR', get: (a) => a.irTax, cost: true, quoi: "Impot du a cause de la societe, en differentiel sur son propre foyer. Deux associes a parts egales ne paient pas la meme chose." },
  { label: 'PS', get: (a) => a.psTax, cost: true, quoi: 'Prelevements sociaux sur sa quote-part positive : 17,2 %, ou 7,5 % pour un affilie suisse.' },
  { label: 'Interets CCA', get: (a) => a.ccaInterest, quoi: 'Interets percus sur son compte courant. Deductibles pour la societe, imposes chez lui au PFU.' },
  { label: 'CCA rembourse', get: (a) => a.ccaRepayment, quoi: "Capital de compte courant recupere sur l'horizon, sans aucune imposition." },
  { label: 'CCA restant', get: (a) => a.ccaBalance, quoi: "Solde encore du a la fin. Il entre dans sa succession a sa valeur nominale, sans decote." },
  { label: 'Net', get: (a) => a.netCashFlow, quoi: "Ce qu'il a encaisse moins ce qu'il a paye personnellement." },
];

// ─── Table ───────────────────────────────────────────────────────────────────

export function ProjectionTable({ results }: ResultsProps) {
  const available = PROFILE_ORDER.filter((p) => results[p]);
  const [profile, setProfile] = useState<ScenarioProfile>(available[0] ?? 'SCI_IS_SEULE');
  // Every hook runs before the early return below.
  const tooltip = useTooltip();

  const result = results[profile] ?? results[available[0]];
  if (!result) return null;

  const rows = toRows(result);
  const columns = visibleColumns(rows);
  const groups = fluxGroups(columns);
  const associes = associeTotals(result);

  const totals = columns.reduce<Record<string, number>>((acc, col) => {
    acc[col.key] = col.cumulable ? rows.reduce((s, r) => s + (r[col.key] as number), 0) : NaN;
    return acc;
  }, {});

  const meta = PROFILE_META[profile];

  return (
    <div className="bg-white rounded-lg border">
      {tooltip.element}

      <div className="p-4 pb-3 border-b">
        <h3 className="text-lg font-semibold text-gray-900">Tableau previsionnel</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Toutes les entites du montage cumulees, annee par annee. Survolez n’importe quel chiffre
          pour voir d’ou il vient.
        </p>

        <div className="flex gap-1 mt-3">
          {available.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProfile(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                profile === p
                  ? `${PROFILE_META[p].bg} ${PROFILE_META[p].border} ${PROFILE_META[p].text}`
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {PROFILE_META[p].label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            {/* Super-headers: the direction money moves */}
            <tr>
              <th className="sticky left-0 z-20 bg-white px-2 py-2" />
              {groups.map((g, i) => {
                const fm = FLUX_META[g.flux];
                return (
                  <th
                    key={`${g.flux}-${i}`}
                    colSpan={g.span}
                    className={`px-2 py-2 text-center border-x-2 border-white ${fm.header}`}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wider">{fm.titre}</span>
                    <span className="block text-[10px] font-normal opacity-70 normal-case">
                      {fm.sous}
                    </span>
                  </th>
                );
              })}
            </tr>

            <tr className="border-b-2 border-gray-300">
              <th className="sticky left-0 z-20 bg-gray-50 px-2 py-1.5 text-left font-medium text-gray-600">
                Annee
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-2 py-1.5 text-right font-medium text-gray-700 whitespace-nowrap ${FLUX_META[col.flux].cell}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.year}
                className={`border-b last:border-0 ${row.year === 0 ? 'bg-gray-50/70' : ''}`}
              >
                <th
                  className={`sticky left-0 z-10 px-2 py-1 text-left font-medium text-gray-700 ${
                    row.year === 0 ? 'bg-gray-100' : 'bg-white'
                  }`}
                >
                  {row.year === 0 ? 'Creation' : row.year}
                </th>
                {columns.map((col) => {
                  const value = row[col.key] as number;
                  return (
                    <td
                      key={col.key}
                      onMouseEnter={(e) => tooltip.show(e, explainCell(col, row))}
                      onMouseLeave={tooltip.hide}
                      className={`px-2 py-1 text-right font-mono whitespace-nowrap tabular-nums cursor-help hover:bg-blue-100/60 ${FLUX_META[col.flux].cell} ${cellTone(value, col)}`}
                    >
                      {displayValue(value, col)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className={`border-t-2 border-gray-300 ${meta.bg}`}>
              <th className={`sticky left-0 z-10 px-2 py-2 text-left font-semibold ${meta.bg} ${meta.text}`}>
                Total
              </th>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className="px-2 py-2 text-right font-mono font-semibold whitespace-nowrap tabular-nums text-gray-800"
                >
                  {col.cumulable ? displayValue(totals[col.key], col) : '—'}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="px-4 py-2 text-xs text-gray-400 border-t">
        Les sorties sont affichees avec leur signe negatif. Les colonnes de bilan sont des soldes de
        fin d’annee : elles ne se cumulent pas.
      </p>

      {associes.length > 0 && (
        <div className="border-t">
          <div className="p-4 pb-2">
            <h4 className="text-sm font-semibold text-gray-800">Par associe, sur tout l’horizon</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Ce que chacun a personnellement paye et encaisse.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-y">
                  <th className="px-3 py-1.5 text-left font-medium text-gray-600">Associe</th>
                  {ASSOCIE_COLS.map((c) => (
                    <th
                      key={c.label}
                      onMouseEnter={(e) =>
                        tooltip.show(e, { titre: c.label, quoi: c.quoi, lignes: [], total: NaN })
                      }
                      onMouseLeave={tooltip.hide}
                      className="px-3 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap cursor-help hover:text-blue-700"
                    >
                      <span className="underline decoration-dotted decoration-gray-300 underline-offset-4">
                        {c.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {associes.map((a) => (
                  <tr key={a.nom} className="border-b last:border-0">
                    <td className="px-3 py-1.5 font-medium text-gray-700">{a.nom}</td>
                    {ASSOCIE_COLS.map((c) => {
                      const v = c.get(a);
                      const zero = Math.abs(v) < 0.005;
                      return (
                        <td
                          key={c.label}
                          className={`px-3 py-1.5 text-right font-mono tabular-nums ${
                            zero
                              ? 'text-gray-300'
                              : c.label === 'Net'
                                ? v < 0
                                  ? 'text-rose-700 font-semibold'
                                  : 'text-emerald-700 font-semibold'
                                : (c.cost && v > 0) || v < 0
                                  ? 'text-rose-700'
                                  : 'text-gray-700'
                          }`}
                        >
                          {zero ? '—' : formatEur(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
