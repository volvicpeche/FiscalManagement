import { useState, type MouseEvent } from 'react';
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
  /** What the column is, and how the engine arrives at it. */
  hint: string;
}

const COLUMNS: Column[] = [
  {
    key: 'loyers',
    label: 'Loyers',
    group: 'Exploitation',
    cumulable: true,
    hint: 'Loyers encaisses, hors charges. Loyer annuel saisi, revalorise chaque annee au taux « Revalorisation loyer » des parametres.',
  },
  {
    key: 'charges',
    label: 'Charges + TF',
    group: 'Exploitation',
    cumulable: true,
    cost: true,
    hint: 'Charges de copropriete non recuperables + taxe fonciere. Chacune suit son propre taux d’evolution dans les parametres, elles ne progressent pas forcement ensemble.',
  },
  {
    key: 'coutsStructure',
    label: 'Couts structure',
    group: 'Exploitation',
    cumulable: true,
    cost: true,
    hint: 'Comptabilite, CFE, assurance, banque, juridique — le total du bloc « Couts de structure », indexe sur l’inflation generale. A l’annee 0 : les frais de constitution. Le montage avec holding porte ces frais deux fois.',
  },
  {
    key: 'interets',
    label: 'Interets + assur.',
    group: 'Emprunt',
    cumulable: true,
    cost: true,
    hint: 'Part de la mensualite qui part en interets et en assurance emprunteur. C’est la seule partie du credit qui est deductible. Elle diminue a mesure que le capital se rembourse.',
  },
  {
    key: 'capital',
    label: 'Capital rembourse',
    group: 'Emprunt',
    cumulable: true,
    cost: true,
    hint: 'Mensualite moins les interets et l’assurance. Ce n’est pas une charge deductible : c’est de la tresorerie qui sort pour se transformer en patrimoine. Le cumul egale exactement le montant emprunte.',
  },
  {
    key: 'amortissement',
    label: 'Amortissement',
    group: 'Fiscalite',
    cumulable: true,
    hint: 'A l’IS uniquement. Terrain non amortissable (15 % de la base), bati amorti sur 25 ans, travaux sur 15 ans, a partir du prix d’achat + frais de notaire. Charge purement comptable : elle efface le resultat imposable sans sortir un euro.',
  },
  {
    key: 'resultatImposable',
    label: 'Resultat imposable',
    group: 'Fiscalite',
    cumulable: true,
    hint: 'Loyers − charges et TF − interets et assurance − couts de structure − interets de compte courant, et en plus − amortissement a l’IS. Le capital rembourse n’en fait jamais partie.',
  },
  {
    key: 'is',
    label: 'IS societe',
    group: 'Fiscalite',
    cumulable: true,
    cost: true,
    hint: 'Impot paye par la societe : 15 % jusqu’a 42 500 EUR de benefice, 25 % au-dela. Les deficits anterieurs sont imputes avant calcul. Reste a zero dans un montage a l’IR.',
  },
  {
    key: 'irAssocies',
    label: 'IR associes',
    group: 'Fiscalite',
    cumulable: true,
    cost: true,
    hint: 'Somme de l’IR de chaque associe, calcule en differentiel : impot avec la quote-part moins impot sans elle, sur son propre foyer. Un montant negatif signifie qu’un deficit foncier a reduit son impot global. Reste a zero a l’IS.',
  },
  {
    key: 'psAssocies',
    label: 'PS associes',
    group: 'Fiscalite',
    cumulable: true,
    cost: true,
    hint: 'Prelevements sociaux sur la quote-part positive de chaque associe : 17,2 %, ou 7,5 % pour un affilie suisse. Aucun PS sur une annee deficitaire.',
  },
  {
    key: 'ifi',
    label: 'IFI',
    group: 'Fiscalite',
    cumulable: true,
    cost: true,
    hint: 'Impot sur la fortune immobiliere, calcule sur la valeur des biens moins la dette bancaire, toutes entites confondues. Nul en dessous de 1,3 M EUR de patrimoine net.',
  },
  {
    key: 'dividendeNet',
    label: 'Dividende net',
    group: 'Tresorerie',
    cumulable: true,
    hint: 'Ce que l’associe touche reellement apres impot. Le curseur « Distribution de dividendes » fixe la part du cash distribuee, puis le moteur retient le moins cher entre PFU et bareme. Montages a l’IS uniquement.',
  },
  {
    key: 'ccaRembourse',
    label: 'CCA rembourse',
    group: 'Tresorerie',
    cumulable: true,
    hint: 'Capital de compte courant rendu aux associes, pilote par le curseur du bloc Transmission et plafonne au cash disponible. Zero impot : c’est le remboursement d’une dette, pas un revenu.',
  },
  {
    key: 'cashFlow',
    label: 'Cash-flow net',
    group: 'Tresorerie',
    cumulable: true,
    emphasise: true,
    hint: 'Ce qui reste sur l’annee, au niveau de la famille : tresorerie des societes, moins l’IFI et l’impot personnel des associes, plus les dividendes nets encaisses. Negatif = l’operation demande un effort d’epargne.',
  },
  {
    key: 'detteRestante',
    label: 'Dette restante',
    group: 'Bilan',
    cumulable: false,
    hint: 'Capital bancaire restant du a la fin de l’annee. A l’annee 0, le montant emprunte. C’est un solde : le cumuler sur 30 ans n’aurait aucun sens.',
  },
  {
    key: 'valeurBien',
    label: 'Valeur du bien',
    group: 'Bilan',
    cumulable: false,
    hint: 'Valeur de marche estimee : prix d’achat + frais de notaire, revalorises chaque annee au taux « Croissance immobiliere ». Les travaux ne sont pas ajoutes a la valeur. C’est un solde, non cumulable.',
  },
];

const ASSOCIE_HINTS: Record<string, string> = {
  'Quote-part':
    'Part du resultat de la SCI attribuee a cet associe, au prorata de ses parts. A l’IS elle reste a zero : c’est la societe qui est imposee, pas l’associe.',
  IR: 'Impot sur le revenu du a cause de la SCI, en differentiel : impot avec la quote-part moins impot sans elle. Depend de ses autres revenus, de sa situation et de ses enfants — deux associes a parts egales ne paient pas la meme chose.',
  PS: 'Prelevements sociaux sur sa quote-part positive : 17,2 %, ou 7,5 % s’il est affilie a la securite sociale suisse.',
  'Interets CCA':
    'Interets percus sur son compte courant. Deductibles pour la SCI, imposes chez lui comme revenus de capitaux mobiliers au PFU.',
  'CCA rembourse': 'Capital de compte courant recupere sur tout l’horizon, sans aucune imposition.',
  'CCA restant': 'Solde encore du par la societe a la fin de l’horizon. Il entre dans sa succession a sa valeur nominale, sans decote.',
  Net: 'Somme de ce qu’il a encaisse moins ce qu’il a paye personnellement : remboursements et interets de compte courant, moins son IR et ses PS.',
};

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

interface Tip {
  title: string;
  body: string;
  x: number;
  y: number;
}

/**
 * Header tooltip.
 *
 * Positioned `fixed` and rendered outside the scroll container on purpose: an
 * absolutely positioned bubble would be clipped by the table's overflow-x.
 */
function useTooltip() {
  const [tip, setTip] = useState<Tip | null>(null);

  const show = (event: MouseEvent<HTMLElement>, title: string, body: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const half = 150;
    setTip({
      title,
      body,
      // Keep the bubble inside the viewport for the leftmost and rightmost columns.
      x: Math.min(Math.max(rect.left + rect.width / 2, half + 8), window.innerWidth - half - 8),
      y: rect.bottom + 8,
    });
  };

  const hide = () => setTip(null);

  const element = tip ? (
    <div
      role="tooltip"
      className="fixed z-50 w-[300px] -translate-x-1/2 rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg pointer-events-none"
      style={{ left: tip.x, top: tip.y }}
    >
      <p className="font-semibold mb-1">{tip.title}</p>
      <p className="text-gray-300 leading-relaxed">{tip.body}</p>
    </div>
  ) : null;

  return { show, hide, element };
}

function Cell({ value, col }: { value: number; col: Column }) {
  // A result computed before this column existed yields NaN. Flag it rather
  // than let it read as a genuine zero.
  if (!Number.isFinite(value)) {
    return (
      <td
        className="px-2 py-1 text-right font-mono whitespace-nowrap text-amber-600"
        title="Donnee absente de ce resultat — relancez la simulation"
      >
        n/d
      </td>
    );
  }

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
  // Every hook runs before the early return below.
  const tooltip = useTooltip();

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
      {tooltip.element}

      <div className="p-4 pb-3 border-b">
        <h3 className="text-lg font-semibold text-gray-900">Tableau previsionnel</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Toutes les entites du montage cumulees, annee par annee. L’annee 0 porte la constitution.
          Survolez un en-tete de colonne pour le detail du calcul.
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
                  onMouseEnter={(e) => tooltip.show(e, col.label, col.hint)}
                  onMouseLeave={tooltip.hide}
                  tabIndex={0}
                  onFocus={(e) => tooltip.show(e as unknown as MouseEvent<HTMLElement>, col.label, col.hint)}
                  onBlur={tooltip.hide}
                  className="px-2 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap cursor-help hover:text-blue-700 focus:text-blue-700 focus:outline-none"
                >
                  <span className="underline decoration-dotted decoration-gray-300 underline-offset-4">
                    {col.label}
                  </span>
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
                  {Object.keys(ASSOCIE_HINTS).map((label) => (
                    <th
                      key={label}
                      onMouseEnter={(e) => tooltip.show(e, label, ASSOCIE_HINTS[label])}
                      onMouseLeave={tooltip.hide}
                      className="px-3 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap cursor-help hover:text-blue-700"
                    >
                      <span className="underline decoration-dotted decoration-gray-300 underline-offset-4">
                        {label}
                      </span>
                    </th>
                  ))}
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
