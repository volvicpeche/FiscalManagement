import type { SimulationResult, YearlyData } from '@shared/schemas.js';

/**
 * The projection table, organised around the direction money moves rather than
 * around accounting categories: what comes in, what goes out, what is left, and
 * what it leaves on the balance sheet.
 */
export type Flux = 'ENTREES' | 'SORTIES' | 'FISCAL' | 'SOLDE' | 'BILAN';

export interface RowDetail {
  loyerNu: number;
  caHaute: number;
  caMoyenne: number;
  caBasse: number;
  chargesCopro: number;
  taxeFonciere: number;
  commission: number;
  menageLinge: number;
  conciergerie: number;
  interetsSeuls: number;
  assurance: number;
}

export interface Row {
  year: number;
  loyers: number;
  chargesBien: number;
  fraisExploitation: number;
  coutsStructure: number;
  interets: number;
  capital: number;
  is: number;
  irAssocies: number;
  psAssocies: number;
  ifi: number;
  amortissement: number;
  resultatImposable: number;
  cashFlow: number;
  effortReel: number;
  dividendeNet: number;
  ccaRembourse: number;
  detteRestante: number;
  valeurBien: number;
  tresorerie: number;
  ccaSolde: number;
  situationNette: number;
  /**
   * The company's own cash flow, before the comptes courants are repaid —
   * distinct from `cashFlow`, which is the FAMILY's and nets off the associes'
   * personal tax. Mixing the two makes the treasury fail to add up.
   */
  cashFlowSociete: number;
  /** Gross dividend that actually left the company, before the associe's tax. */
  dividendeVerse: number;
  /** Component figures behind the totals, for the per-cell tooltips. */
  detail: RowDetail;
}

type EntityField = keyof YearlyData['entities'][string];
type DetailField = keyof YearlyData['entities'][string]['detail'];
type AssocieField = keyof YearlyData['associes'][string];

const sumEntities = (y: YearlyData, f: EntityField): number =>
  Object.values(y.entities).reduce((acc, e) => acc + parseFloat(e[f] as string), 0);

const sumDetail = (y: YearlyData, f: DetailField): number =>
  Object.values(y.entities).reduce((acc, e) => acc + parseFloat(e.detail[f]), 0);

const sumAssocies = (y: YearlyData, f: AssocieField): number =>
  Object.values(y.associes).reduce((acc, a) => acc + parseFloat(a[f]), 0);

export function toRows(result: SimulationResult): Row[] {
  return result.yearlyData.map((y) => {
    const detail: RowDetail = {
      loyerNu: sumDetail(y, 'loyerNu'),
      caHaute: sumDetail(y, 'caHauteSaison'),
      caMoyenne: sumDetail(y, 'caMoyenneSaison'),
      caBasse: sumDetail(y, 'caBasseSaison'),
      chargesCopro: sumDetail(y, 'chargesCopro'),
      taxeFonciere: sumDetail(y, 'taxeFonciere'),
      commission: sumDetail(y, 'commissionPlateforme'),
      menageLinge: sumDetail(y, 'fraisMenageLinge'),
      conciergerie: sumDetail(y, 'fraisConciergerie'),
      interetsSeuls: sumDetail(y, 'interets'),
      assurance: sumDetail(y, 'assurance'),
    };

    const capital = sumEntities(y, 'loanPrincipal');
    const cashFlow = parseFloat(y.totalNetCashFlow);

    return {
      year: y.year,
      loyers: sumEntities(y, 'grossRevenue'),
      chargesBien: detail.chargesCopro + detail.taxeFonciere,
      fraisExploitation: detail.commission + detail.menageLinge + detail.conciergerie,
      coutsStructure: sumEntities(y, 'operatingCosts'),
      interets: sumEntities(y, 'loanInterest'),
      capital,
      is: sumEntities(y, 'tax'),
      irAssocies: sumAssocies(y, 'irTax'),
      psAssocies: sumAssocies(y, 'psTax'),
      ifi: parseFloat(y.ifiTax),
      amortissement: sumEntities(y, 'depreciation'),
      resultatImposable: sumEntities(y, 'taxableProfit'),
      cashFlow,
      // Capital repayment is forced saving, not a loss: adding it back shows
      // what the year actually costs.
      effortReel: cashFlow + capital,
      dividendeNet: parseFloat(y.userNetDividend),
      ccaRembourse: sumAssocies(y, 'ccaRepayment'),
      detteRestante: sumEntities(y, 'remainingDebt'),
      valeurBien: sumEntities(y, 'assetMarketValue'),
      tresorerie: sumEntities(y, 'tresorerie'),
      ccaSolde: sumEntities(y, 'ccaSolde'),
      // netCashFlow already has the CCA repayment taken out; adding it back
      // gives what the company had to dispose of.
      cashFlowSociete: sumEntities(y, 'netCashFlow') + sumEntities(y, 'ccaRembourse'),
      dividendeVerse: sumEntities(y, 'dividendeVerse'),
      // What the shares are worth: what is owned, less what is owed — to the
      // bank and to the associes alike.
      situationNette:
        sumEntities(y, 'assetMarketValue') +
        sumEntities(y, 'tresorerie') -
        sumEntities(y, 'remainingDebt') -
        sumEntities(y, 'ccaSolde'),
      detail,
    };
  });
}

export interface DecomposeLine {
  label: string;
  montant: number;
}

export interface Column {
  key: keyof Row;
  label: string;
  flux: Flux;
  /** Running totals are meaningless for balances. */
  cumulable: boolean;
  emphasise?: boolean;
  /** Money that merely changes pocket rather than entering or leaving. */
  transfert?: boolean;
  /** What the column is. */
  quoi: string;
  /** Component lines behind this cell, with their actual figures. */
  decompose?: (r: Row) => DecomposeLine[];
  /** Overrides `r[key]` — used by the synthetic column of a folded band. */
  value?: (r: Row) => number;
}

/** Reads a column's figure, whether it is a plain field or a computed one. */
export function columnValue(col: Column, row: Row): number {
  return col.value ? col.value(row) : (row[col.key] as number);
}

export const COLUMNS: Column[] = [
  {
    key: 'loyers',
    label: 'Revenus locatifs',
    flux: 'ENTREES',
    cumulable: true,
    quoi: "Tout ce que le bien encaisse sur l'annee, avant la moindre depense.",
    decompose: (r) =>
      r.detail.caHaute + r.detail.caMoyenne + r.detail.caBasse > 0
        ? [
            { label: 'CA haute saison', montant: r.detail.caHaute },
            { label: 'CA moyenne saison', montant: r.detail.caMoyenne },
            { label: 'CA basse saison', montant: r.detail.caBasse },
          ]
        : [{ label: 'Loyer annuel (location nue)', montant: r.detail.loyerNu }],
  },
  {
    key: 'chargesBien',
    label: 'Charges + TF',
    flux: 'SORTIES',
    cumulable: true,
    quoi: 'Ce que le bien coute a detenir, que vous le louiez ou non.',
    decompose: (r) => [
      { label: 'Charges de copropriete', montant: r.detail.chargesCopro },
      { label: 'Taxe fonciere', montant: r.detail.taxeFonciere },
    ],
  },
  {
    key: 'fraisExploitation',
    label: 'Frais exploitation',
    flux: 'SORTIES',
    cumulable: true,
    quoi: 'Ce que coute la mise en location saisonniere elle-meme.',
    decompose: (r) =>
      [
        { label: 'Commission plateforme', montant: r.detail.commission },
        { label: 'Menage et linge', montant: r.detail.menageLinge },
        { label: 'Conciergerie', montant: r.detail.conciergerie },
      ].filter((l) => l.montant !== 0),
  },
  {
    key: 'coutsStructure',
    label: 'Couts structure',
    flux: 'SORTIES',
    cumulable: true,
    quoi: "Le prix de la societe elle-meme : comptable, CFE, banque, assurance, juridique. Indexe sur l'inflation. Un montage avec holding les porte deux fois.",
  },
  {
    key: 'interets',
    label: 'Interets + assur.',
    flux: 'SORTIES',
    cumulable: true,
    quoi: "La part de la mensualite qui part definitivement. C'est la seule partie du credit qui soit deductible.",
    decompose: (r) => [
      { label: 'Interets du pret', montant: r.detail.interetsSeuls },
      { label: 'Assurance emprunteur', montant: r.detail.assurance },
    ],
  },
  {
    key: 'capital',
    label: 'Capital rembourse',
    flux: 'SORTIES',
    cumulable: true,
    quoi: "Sort de la tresorerie mais pas de votre patrimoine : de l'epargne forcee qui se transforme en murs. Non deductible. Le cumul egale exactement le montant emprunte.",
  },
  {
    key: 'is',
    label: 'IS societe',
    flux: 'SORTIES',
    cumulable: true,
    quoi: "Impot paye par la societe : 15 % jusqu'a 42 500 EUR de benefice, 25 % au-dela, deficits anterieurs imputes avant calcul. Reste a zero dans un montage a l'IR.",
  },
  {
    key: 'irAssocies',
    label: 'IR associes',
    flux: 'SORTIES',
    cumulable: true,
    quoi: "Impot paye par les associes de leur poche, calcule en differentiel sur le foyer de chacun. Negatif = un deficit a reduit leur impot global. Reste a zero a l'IS.",
  },
  {
    key: 'psAssocies',
    label: 'PS associes',
    flux: 'SORTIES',
    cumulable: true,
    quoi: 'Prelevements sociaux sur la quote-part positive : 17,2 %, ou 7,5 % pour un affilie suisse.',
  },
  {
    key: 'ifi',
    label: 'IFI',
    flux: 'SORTIES',
    cumulable: true,
    quoi: 'Impot sur la fortune immobiliere : valeur des biens moins la dette bancaire, nul en dessous de 1,3 M EUR net.',
  },
  {
    key: 'amortissement',
    label: 'Amortissement',
    flux: 'FISCAL',
    cumulable: true,
    quoi: "Charge purement comptable : elle efface le resultat imposable sans qu'un euro ne sorte. Terrain non amortissable (15 %), bati sur 25 ans, travaux sur 15 ans. A l'IS et en LMP au reel uniquement.",
  },
  {
    key: 'resultatImposable',
    label: 'Resultat imposable',
    flux: 'FISCAL',
    cumulable: true,
    quoi: "La base sur laquelle l'impot est calcule, pas de l'argent disponible. Negatif = deficit, reporte ou impute selon le regime.",
    decompose: (r) => [
      { label: 'Revenus locatifs', montant: r.loyers },
      { label: 'Charges + TF', montant: -r.chargesBien },
      { label: 'Frais exploitation', montant: -r.fraisExploitation },
      { label: 'Couts structure', montant: -r.coutsStructure },
      { label: 'Interets + assurance', montant: -r.interets },
      { label: 'Amortissement', montant: -r.amortissement },
    ].filter((l) => l.montant !== 0),
  },
  {
    key: 'cashFlow',
    label: 'Cash-flow net',
    flux: 'SOLDE',
    cumulable: true,
    emphasise: true,
    quoi: "Ce qui reste au niveau de la famille sur l'annee. Negatif = l'operation demande un effort d'epargne.",
    decompose: (r) => {
      // A foncier or BIC deficit can push the tax line positive: it then lowers
      // the associes' overall bill, so calling it "Impots" would read wrong.
      const impots = -(r.is + r.irAssocies + r.psAssocies + r.ifi);
      return [
        { label: 'Revenus locatifs', montant: r.loyers },
        { label: 'Charges + TF', montant: -r.chargesBien },
        { label: 'Frais exploitation', montant: -r.fraisExploitation },
        { label: 'Couts structure', montant: -r.coutsStructure },
        { label: 'Interets + assurance', montant: -r.interets },
        { label: 'Capital rembourse', montant: -r.capital },
        { label: impots > 0 ? "Economie d'impot" : 'Impots', montant: impots },
      ].filter((l) => l.montant !== 0);
    },
  },
  {
    key: 'effortReel',
    label: 'Effort reel',
    flux: 'SOLDE',
    cumulable: true,
    emphasise: true,
    quoi: "Le cash-flow une fois le capital rembourse remis dedans. C'est le vrai cout de l'annee : un cash-flow tres negatif dont l'essentiel part en capital ne vous appauvrit pas.",
    decompose: (r) => [
      { label: 'Cash-flow net', montant: r.cashFlow },
      { label: 'Capital rembourse (reinjecte)', montant: r.capital },
    ],
  },
  {
    key: 'dividendeNet',
    label: 'Dividende net',
    flux: 'SOLDE',
    cumulable: true,
    transfert: true,
    quoi: "Ce que l'associe touche apres impot. La societe s'appauvrit d'autant : transfert, pas creation de richesse.",
  },
  {
    key: 'ccaRembourse',
    label: 'CCA rembourse',
    flux: 'SOLDE',
    cumulable: true,
    transfert: true,
    quoi: 'Compte courant rendu aux associes, sans aucune imposition. Transfert egalement : la societe rend une dette.',
  },
  {
    key: 'tresorerie',
    label: 'Tresorerie',
    flux: 'BILAN',
    cumulable: false,
    quoi: "L'argent qui dort dans la societe. C'est la que va le cash-flow net quand il n'est ni distribue en dividende ni rendu en compte courant. NEGATIF signifie que l'operation consomme plus qu'elle ne genere : une societe ne peut pas avoir une caisse negative, quelqu'un doit remettre au pot — la simulation n'enregistre pas qui.",
    decompose: (r) => [
      { label: 'Cash-flow de la societe', montant: r.cashFlowSociete },
      { label: 'CCA rembourse', montant: -r.ccaRembourse },
      { label: 'Dividende verse', montant: -r.dividendeVerse },
    ].filter((l) => l.montant !== 0),
  },
  {
    key: 'detteRestante',
    label: 'Dette bancaire',
    flux: 'BILAN',
    cumulable: false,
    quoi: "Capital bancaire restant du a la fin de l'annee. A l'annee 0, le montant emprunte. C'est un solde : le cumuler n'aurait aucun sens.",
  },
  {
    key: 'ccaSolde',
    label: 'Dette CCA',
    flux: 'BILAN',
    cumulable: false,
    quoi: "Ce que la societe doit encore aux associes au titre de leurs comptes courants. Elle diminue a chaque remboursement. Contrairement a la dette bancaire, celle-ci est due a vous-meme — et elle entre dans votre succession a sa valeur nominale.",
  },
  {
    key: 'valeurBien',
    label: 'Valeur du bien',
    flux: 'BILAN',
    cumulable: false,
    quoi: "Prix d'achat + frais de notaire, revalorises chaque annee. Les travaux ne sont pas ajoutes a la valeur. Solde, non cumulable.",
  },
  {
    key: 'situationNette',
    label: 'Situation nette',
    flux: 'BILAN',
    cumulable: false,
    emphasise: true,
    quoi: "Ce que valent reellement les parts : tout ce que la societe possede, moins tout ce qu'elle doit. Ce n'est PAS de l'argent disponible — l'essentiel est immobilise dans le bien. Pour en faire quelque chose il faut vendre ou reemprunter. C'est la base sur laquelle la succession valorise les parts, avant decote d'illiquidite.",
    decompose: (r) => [
      { label: 'Valeur du bien', montant: r.valeurBien },
      { label: 'Tresorerie', montant: r.tresorerie },
      { label: 'Dette bancaire', montant: -r.detteRestante },
      { label: 'Dette CCA', montant: -r.ccaSolde },
    ].filter((l) => l.montant !== 0),
  },
];

export const FLUX_META: Record<Flux, { titre: string; sous: string; header: string; cell: string }> = {
  ENTREES: {
    titre: 'Entrees',
    sous: 'ce qui rentre',
    header: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    cell: 'bg-emerald-50/40',
  },
  SORTIES: {
    titre: 'Sorties',
    sous: 'ce qui sort',
    header: 'bg-rose-100 text-rose-900 border-rose-200',
    cell: 'bg-rose-50/30',
  },
  FISCAL: {
    titre: 'Base fiscale',
    sous: 'ne sort pas de la poche',
    header: 'bg-amber-100 text-amber-900 border-amber-200',
    cell: 'bg-amber-50/40',
  },
  SOLDE: {
    titre: 'Solde',
    sous: 'ce qui reste',
    header: 'bg-blue-100 text-blue-900 border-blue-200',
    cell: 'bg-blue-50/30',
  },
  BILAN: {
    titre: 'Bilan',
    sous: 'situation a la fin',
    header: 'bg-gray-200 text-gray-800 border-gray-300',
    cell: 'bg-gray-50/60',
  },
};

/**
 * What a band shows once its columns are folded away.
 *
 * Only SORTIES is genuinely additive — every one of its columns is money
 * leaving. Elsewhere a sum would be nonsense: Amortissement is a component of
 * Resultat imposable, Effort reel already contains Cash-flow net, and Situation
 * nette IS the combination of the other Bilan columns. Those bands collapse to
 * their headline figure instead of to a meaningless total.
 */
export const FLUX_AGGREGATE: Record<
  Flux,
  { key: keyof Row; label: string; quoi: string; somme: boolean; cumulable: boolean }
> = {
  ENTREES: {
    key: 'loyers',
    label: 'Total entrees',
    quoi: "Tout ce que le bien encaisse sur l'annee.",
    somme: false,
    cumulable: true,
  },
  SORTIES: {
    key: 'chargesBien',
    label: 'Total sorties',
    quoi: "Tout ce qui quitte la tresorerie sur l'annee : charges, structure, credit, impots. La seule bande dont la somme ait un sens — chaque colonne y est de l'argent qui part.",
    somme: true,
    cumulable: true,
  },
  FISCAL: {
    key: 'resultatImposable',
    label: 'Resultat imposable',
    quoi: "La base d'imposition. L'amortissement n'est pas ajoute : il en est deja deduit, l'additionner le compterait deux fois.",
    somme: false,
    cumulable: true,
  },
  SOLDE: {
    key: 'cashFlow',
    label: 'Cash-flow net',
    quoi: "Ce qui reste sur l'annee. Les autres colonnes de la bande ne s'y ajoutent pas : l'effort reel en est une relecture, le dividende et le compte courant sont des transferts.",
    somme: false,
    cumulable: true,
  },
  BILAN: {
    key: 'situationNette',
    label: 'Situation nette',
    quoi: "Ce que valent les parts. C'est deja la combinaison des autres colonnes du bilan : actif moins dettes.",
    somme: false,
    cumulable: false,
  },
};

/** The single column a folded band shows, keeping its members in the tooltip. */
export function collapsedColumn(flux: Flux, membres: Column[]): Column {
  const agg = FLUX_AGGREGATE[flux];
  return {
    key: agg.key,
    label: agg.label,
    flux,
    cumulable: agg.cumulable,
    emphasise: true,
    quoi: agg.quoi,
    value: agg.somme
      ? (r) => membres.reduce((total, c) => total + columnValue(c, r), 0)
      : undefined,
    // Folding hides the columns but not the figures: they move into the tooltip.
    decompose: (r) =>
      membres
        .map((c) => ({ label: c.label, montant: columnValue(c, r) }))
        .filter((l) => l.montant !== 0),
  };
}

/** Consecutive runs of columns sharing a flux, for the top header row. */
export function fluxGroups(columns: Column[]): { flux: Flux; span: number }[] {
  return columns.reduce<{ flux: Flux; span: number }[]>((acc, col) => {
    const last = acc[acc.length - 1];
    if (last && last.flux === col.flux) last.span += 1;
    else acc.push({ flux: col.flux, span: 1 });
    return acc;
  }, []);
}

/**
 * Drops columns that are all zero across the horizon — a long-term rental has
 * no seasonal fees, an SCI at IR has no IS, and empty columns only add noise.
 */
export function visibleColumns(rows: Row[]): Column[] {
  const alwaysShown = new Set<keyof Row>(['loyers', 'cashFlow', 'effortReel', 'detteRestante', 'valeurBien']);
  return COLUMNS.filter(
    (col) => alwaysShown.has(col.key) || rows.some((r) => Math.abs(r[col.key] as number) > 0.005),
  );
}

export interface CellExplanation {
  titre: string;
  quoi: string;
  lignes: DecomposeLine[];
  total: number;
}

/** Builds the tooltip for one cell: what it is, then how it adds up. */
export function explainCell(col: Column, row: Row): CellExplanation {
  return {
    titre: `${col.label} — ${row.year === 0 ? 'creation' : `annee ${row.year}`}`,
    quoi: col.quoi,
    lignes: col.decompose?.(row) ?? [],
    // Not row[col.key]: a folded band's column computes its own figure.
    total: columnValue(col, row),
  };
}
