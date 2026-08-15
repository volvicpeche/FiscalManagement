import { useState } from 'react';
import type { ScenarioProfile, SimulationResult, YearlyData } from '@shared/schemas.js';
import { PROFILE_META, PROFILE_ORDER, formatEur } from '@/lib/profiles';
import type { ResultsProps } from './KpiCards';

/** One year of a montage, with every entity of the tree rolled up. */
interface Row {
  year: number;
  loyers: number;
  charges: number;
  coutsStructure: number;
  interets: number;
  capital: number;
  amortissement: number;
  resultatImposable: number;
  is: number;
  irAssocies: number;
  psAssocies: number;
  ifi: number;
  dividendeNet: number;
  ccaRembourse: number;
  cashFlow: number;
  detteRestante: number;
  valeurBien: number;
}

function sumEntities(y: YearlyData, field: keyof YearlyData['entities'][string]): number {
  return Object.values(y.entities).reduce((acc, e) => acc + parseFloat(e[field]), 0);
}

function sumAssocies(y: YearlyData, field: keyof YearlyData['associes'][string]): number {
  return Object.values(y.associes).reduce((acc, a) => acc + parseFloat(a[field]), 0);
}

function toRows(result: SimulationResult): Row[] {
  return result.yearlyData.map((y) => ({
    year: y.year,
    loyers: sumEntities(y, 'grossRevenue'),
    charges: sumEntities(y, 'charges'),
    coutsStructure: sumEntities(y, 'operatingCosts'),
    interets: sumEntities(y, 'loanInterest'),
    capital: sumEntities(y, 'loanPrincipal'),
    amortissement: sumEntities(y, 'depreciation'),
    resultatImposable: sumEntities(y, 'taxableProfit'),
    is: sumEntities(y, 'tax'),
    irAssocies: sumAssocies(y, 'irTax'),
    psAssocies: sumAssocies(y, 'psTax'),
    ifi: parseFloat(y.ifiTax),
    dividendeNet: parseFloat(y.userNetDividend),
    ccaRembourse: sumAssocies(y, 'ccaRepayment'),
    cashFlow: parseFloat(y.totalNetCashFlow),
    detteRestante: sumEntities(y, 'remainingDebt'),
    valeurBien: sumEntities(y, 'assetMarketValue'),
  }));
}

interface Column {
  key: keyof Row;
  label: string;
  group: string;
  /** Running totals are meaningless for balances (debt, market value). */
  cumulable: boolean;
  /** A cost line: shown in red when non-zero. */
  cost?: boolean;
  emphasise?: boolean;
}

const COLUMNS: Column[] = [
  { key: 'loyers', label: 'Loyers', group: 'Exploitation', cumulable: true },
  { key: 'charges', label: 'Charges + TF', group: 'Exploitation', cumulable: true, cost: true },
  { key: 'coutsStructure', label: 'Couts structure', group: 'Exploitation', cumulable: true, cost: true },
  { key: 'interets', label: 'Interets + assur.', group: 'Emprunt', cumulable: true, cost: true },
  { key: 'capital', label: 'Capital rembourse', group: 'Emprunt', cumulable: true, cost: true },
  { key: 'amortissement', label: 'Amortissement', group: 'Fiscalite', cumulable: true },
  { key: 'resultatImposable', label: 'Resultat imposable', group: 'Fiscalite', cumulable: true },
  { key: 'is', label: 'IS societe', group: 'Fiscalite', cumulable: true, cost: true },
  { key: 'irAssocies', label: 'IR associes', group: 'Fiscalite', cumulable: true, cost: true },
  { key: 'psAssocies', label: 'PS associes', group: 'Fiscalite', cumulable: true, cost: true },
  { key: 'ifi', label: 'IFI', group: 'Fiscalite', cumulable: true, cost: true },
  { key: 'dividendeNet', label: 'Dividende net', group: 'Tresorerie', cumulable: true },
  { key: 'ccaRembourse', label: 'CCA rembourse', group: 'Tresorerie', cumulable: true },
  { key: 'cashFlow', label: 'Cash-flow net', group: 'Tresorerie', cumulable: true, emphasise: true },
  { key: 'detteRestante', label: 'Dette restante', group: 'Bilan', cumulable: false },
  { key: 'valeurBien', label: 'Valeur du bien', group: 'Bilan', cumulable: false },
];

const GROUPS = COLUMNS.reduce<{ name: string; span: number }[]>((acc, col) => {
  const last = acc[acc.length - 1];
  if (last && last.name === col.group) last.span += 1;
  else acc.push({ name: col.group, span: 1 });
  return acc;
}, []);

/** What each associe personally paid and received across the whole horizon. */
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
        nom,
        quotePart: 0,
        irTax: 0,
        psTax: 0,
        ccaInterest: 0,
        ccaRepayment: 0,
        ccaBalance: 0,
        netCashFlow: 0,
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

function Cell({ value, col }: { value: number; col: Column }) {
  const isZero = Math.abs(value) < 0.005;
  const tone = isZero
    ? 'text-gray-300'
    : col.emphasise
      ? value < 0
        ? 'text-red-600 font-semibold'
        : 'text-green-700 font-semibold'
      : col.cost && value > 0
        ? 'text-red-600'
        : value < 0
          ? 'text-red-600'
          : 'text-gray-700';

  return (
    <td className={`px-2 py-1 text-right font-mono whitespace-nowrap tabular-nums ${tone}`}>
      {isZero ? '—' : formatEur(value)}
    </td>
  );
}

export function ProjectionTable({ results }: ResultsProps) {
  const available = PROFILE_ORDER.filter((p) => results[p]);
  const [profile, setProfile] = useState<ScenarioProfile>(available[0] ?? 'SCI_IS_SEULE');

  const result = results[profile] ?? results[available[0]];
  if (!result) return null;

  const rows = toRows(result);
  const associes = associeTotals(result);
  const totals = COLUMNS.reduce<Record<string, number>>((acc, col) => {
    acc[col.key] = col.cumulable ? rows.reduce((s, r) => s + (r[col.key] as number), 0) : NaN;
    return acc;
  }, {});

  const meta = PROFILE_META[profile];

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 pb-3 border-b">
        <h3 className="text-lg font-semibold text-gray-900">Tableau previsionnel</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Toutes les entites du montage cumulees, annee par annee. L’annee 0 porte la constitution.
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
            <tr className="bg-gray-50 border-b">
              <th className="sticky left-0 z-10 bg-gray-50 px-2 py-1 text-left font-medium text-gray-400" />
              {GROUPS.map((g) => (
                <th
                  key={g.name}
                  colSpan={g.span}
                  className="px-2 py-1 text-center font-semibold text-gray-500 uppercase tracking-wide border-l"
                >
                  {g.name}
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50 border-b">
              <th className="sticky left-0 z-10 bg-gray-50 px-2 py-1.5 text-left font-medium text-gray-600">
                Annee
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="px-2 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap"
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
                className={`border-b last:border-0 hover:bg-blue-50/40 ${
                  row.year === 0 ? 'bg-gray-50/70' : ''
                }`}
              >
                <th
                  className={`sticky left-0 z-10 px-2 py-1 text-left font-medium text-gray-700 ${
                    row.year === 0 ? 'bg-gray-50' : 'bg-white'
                  }`}
                >
                  {row.year === 0 ? 'Creation' : row.year}
                </th>
                {COLUMNS.map((col) => (
                  <Cell key={col.key} value={row[col.key] as number} col={col} />
                ))}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className={`border-t-2 ${meta.bg}`}>
              <th className={`sticky left-0 z-10 px-2 py-2 text-left font-semibold ${meta.bg} ${meta.text}`}>
                Total
              </th>
              {COLUMNS.map((col) => (
                <td
                  key={col.key}
                  className="px-2 py-2 text-right font-mono font-semibold whitespace-nowrap tabular-nums text-gray-800"
                >
                  {col.cumulable ? formatEur(totals[col.key]) : '—'}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="px-4 py-2 text-xs text-gray-400 border-t">
        Les colonnes de bilan (dette, valeur) sont des soldes a la fin de l’annee : elles ne se
        cumulent pas.
      </p>

      {associes.length > 0 && (
        <div className="border-t">
          <div className="p-4 pb-2">
            <h4 className="text-sm font-semibold text-gray-800">Par associe, sur tout l’horizon</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Ce que chacun a personnellement paye et encaisse. A l’IS la societe porte l’impot, les
              lignes IR et PS restent donc a zero.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-y">
                  <th className="px-3 py-1.5 text-left font-medium text-gray-600">Associe</th>
                  <th className="px-3 py-1.5 text-right font-medium text-gray-600">Quote-part</th>
                  <th className="px-3 py-1.5 text-right font-medium text-gray-600">IR</th>
                  <th className="px-3 py-1.5 text-right font-medium text-gray-600">PS</th>
                  <th className="px-3 py-1.5 text-right font-medium text-gray-600">Interets CCA</th>
                  <th className="px-3 py-1.5 text-right font-medium text-gray-600">CCA rembourse</th>
                  <th className="px-3 py-1.5 text-right font-medium text-gray-600">CCA restant</th>
                  <th className="px-3 py-1.5 text-right font-medium text-gray-600">Net</th>
                </tr>
              </thead>
              <tbody>
                {associes.map((a) => (
                  <tr key={a.nom} className="border-b last:border-0">
                    <td className="px-3 py-1.5 font-medium text-gray-700">{a.nom}</td>
                    {(
                      [
                        [a.quotePart, false],
                        [a.irTax, true],
                        [a.psTax, true],
                        [a.ccaInterest, false],
                        [a.ccaRepayment, false],
                        [a.ccaBalance, false],
                      ] as [number, boolean][]
                    ).map(([value, isCost], i) => (
                      <td
                        key={i}
                        className={`px-3 py-1.5 text-right font-mono tabular-nums ${
                          Math.abs(value) < 0.005
                            ? 'text-gray-300'
                            : (isCost && value > 0) || value < 0
                              ? 'text-red-600'
                              : 'text-gray-700'
                        }`}
                      >
                        {Math.abs(value) < 0.005 ? '—' : formatEur(value)}
                      </td>
                    ))}
                    <td
                      className={`px-3 py-1.5 text-right font-mono font-semibold tabular-nums ${
                        a.netCashFlow < 0 ? 'text-red-600' : 'text-green-700'
                      }`}
                    >
                      {formatEur(a.netCashFlow)}
                    </td>
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
