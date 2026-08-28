import { useState, type MouseEvent, type ReactNode } from 'react';
import { formatEur } from '@/lib/profiles';
import {
  FLUX_META,
  explainCell,
  fluxGroups,
  type CellExplanation,
  type Column,
  type Row,
} from './projectionColumns';

/**
 * The projection table shared by the SCI comparison and the seasonal tab.
 *
 * Columns are grouped by the direction money moves, and every cell explains
 * itself on hover with the figures it is made of.
 */

interface Tip extends CellExplanation {
  x: number;
  y: number;
}

/**
 * Positioned `fixed` and rendered outside the scroll container on purpose: an
 * absolutely positioned bubble would be clipped by the table's overflow-x.
 *
 * Exported so sibling tables — the associe recap — explain their headers too.
 */
export function useFluxTooltip() {
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
              <span
                className={`font-mono tabular-nums ${l.montant < 0 ? 'text-rose-300' : 'text-gray-200'}`}
              >
                {formatEur(l.montant)}
              </span>
            </div>
          ))}
          {Number.isFinite(tip.total) && (
            <div className="flex justify-between gap-4 pt-1 border-t border-gray-700">
              <span className="font-medium">Total</span>
              <span className="font-mono tabular-nums font-semibold">{formatEur(tip.total)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  ) : null;

  return { show, hide: () => setTip(null), element };
}

function cellTone(value: number, col: Column): string {
  if (Math.abs(value) < 0.005) return 'text-gray-300';
  if (col.emphasise) return value < 0 ? 'text-rose-700 font-semibold' : 'text-emerald-700 font-semibold';
  if (col.transfert) return 'text-blue-700';
  if (col.flux === 'ENTREES') return 'text-emerald-700';
  if (col.flux === 'SORTIES') return value < 0 ? 'text-emerald-700' : 'text-rose-700';
  if (col.flux === 'FISCAL') return value < 0 ? 'text-rose-700' : 'text-gray-700';
  return value < 0 ? 'text-rose-700' : 'text-gray-700';
}

/**
 * Sorties are stored as positive amounts because that is how they are read —
 * so they carry an explicit minus in the table.
 */
function displayValue(value: number, col: Column): string {
  if (!Number.isFinite(value)) return 'n/d';
  if (Math.abs(value) < 0.005) return '—';
  if (col.flux === 'SORTIES' && value > 0) return `−${formatEur(value)}`;
  return formatEur(value);
}

/** Per-context wording, e.g. PS become TNS contributions for an LMP. */
export type ColumnOverrides = Partial<Record<keyof Row, { label?: string; quoi?: string }>>;

function applyOverrides(columns: Column[], overrides?: ColumnOverrides): Column[] {
  if (!overrides) return columns;
  return columns.map((col) => {
    const o = overrides[col.key];
    return o ? { ...col, label: o.label ?? col.label, quoi: o.quoi ?? col.quoi } : col;
  });
}

export function FluxTable({
  rows,
  columns,
  overrides,
  footerClass = 'bg-gray-100 text-gray-800',
  note,
}: {
  rows: Row[];
  columns: Column[];
  overrides?: ColumnOverrides;
  footerClass?: string;
  note?: ReactNode;
}) {
  const tooltip = useFluxTooltip();
  const cols = applyOverrides(columns, overrides);
  const groups = fluxGroups(cols);

  const totals = cols.reduce<Record<string, number>>((acc, col) => {
    acc[col.key] = col.cumulable ? rows.reduce((s, r) => s + (r[col.key] as number), 0) : NaN;
    return acc;
  }, {});

  return (
    <>
      {tooltip.element}

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
              {cols.map((col) => (
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
                {cols.map((col) => {
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
            <tr className={`border-t-2 border-gray-300 ${footerClass}`}>
              <th className={`sticky left-0 z-10 px-2 py-2 text-left font-semibold ${footerClass}`}>
                Total
              </th>
              {cols.map((col) => (
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
        Les sorties portent leur signe negatif. Les colonnes de bilan sont des soldes de fin
        d’annee : elles ne se cumulent pas. Survolez un chiffre pour voir d’ou il vient.
        {note ? <> {note}</> : null}
      </p>
    </>
  );
}
