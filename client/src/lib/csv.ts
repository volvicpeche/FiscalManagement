import type { ScenarioProfile, SimulationRequest, SimulationResult } from '@shared/schemas.js';
import { PROFILE_META } from '@/lib/profiles';
import { toRows, COLUMNS, columnValue } from '@/features/dashboard/projectionColumns';

/**
 * CSV export, built for a reader who has to CHECK the figures — a person with
 * a spreadsheet, or a model asked to audit them.
 *
 * That rules out exporting the projection alone: nobody can verify a column of
 * numbers without the hypotheses that produced it. The file therefore carries
 * the inputs, the year-by-year detail, the summary, and the caveats — a model
 * handed only the outputs would confirm arithmetic it cannot see and miss the
 * simplifications entirely.
 *
 * Semicolon-separated with a dot decimal: unambiguous for a parser, and it
 * avoids the collision French locales create by using a comma for both.
 */

const SEP = ';';

/** Quotes a field only when it would otherwise break the row. */
function escape(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvSection {
  titre: string;
  entetes: string[];
  lignes: (string | number)[][];
  /** Shown under the title, for anything the columns cannot say. */
  note?: string;
}

export function buildCsv(preambule: string[], sections: CsvSection[]): string {
  const lignes: string[] = preambule.map((l) => `# ${l}`);

  for (const section of sections) {
    lignes.push('', `# ${section.titre}`);
    if (section.note) lignes.push(`# ${section.note}`);
    lignes.push(section.entetes.map(escape).join(SEP));
    for (const ligne of section.lignes) lignes.push(ligne.map(escape).join(SEP));
  }

  return lignes.join('\r\n');
}

/** What the reader must know before trusting a single figure. */
export const AVERTISSEMENTS = [
  'Simulateur a usage personnel. Ni conseil juridique, ni conseil fiscal.',
  'Baremes fiscaux 2026 figes sur tout l horizon : aucune reforme n est anticipee.',
  'Couts de structure : montants indicatifs, a remplacer par de vrais devis.',
  'La revente n est pas simulee dans la projection. Elle est estimee a part (section SORTIE) et ne cree aucun flux dans le tableau annuel.',
  'Deficit foncier simplifie : le plafond de 10 700 EUR est applique au deficit entier, sans isoler la part d interets. Avantage legerement l IR les premieres annees.',
  'LMP : l exoneration de l article 151 septies n est PAS appliquee. L impot de sortie affiche est le haut de la fourchette.',
  'Une tresorerie negative signifie que quelqu un doit remettre au pot ; la simulation n enregistre pas qui.',
  'Les travaux ne sont pas ajoutes a la valeur de marche du bien.',
  'La situation nette n est pas de l argent disponible : l essentiel est immobilise dans le bien.',
];

function hypotheses(request: SimulationRequest): CsvSection {
  const s = request.structures[0];
  const asset = s.assets[0] ?? (s.subsidiaries as SimulationRequest['structures'])?.[0]?.assets[0];
  const loan = asset?.loan;
  const p = request.params;

  const lignes: (string | number)[][] = [
    ['Bien - designation', asset?.label ?? ''],
    ['Bien - prix d achat', asset?.purchasePrice ?? ''],
    ['Bien - frais de notaire', asset?.notaryFees ?? ''],
    ['Bien - travaux', asset?.renovationCosts ?? ''],
    ['Bien - loyer annuel', asset?.annualRent ?? ''],
    ['Bien - charges annuelles', asset?.chargesYearly ?? ''],
    ['Bien - taxe fonciere', asset?.propertyTax ?? ''],
    ['Pret - capital emprunte', loan?.principal ?? '0.00'],
    ['Pret - taux nominal', loan?.interestRate ?? 0],
    ['Pret - taux assurance', loan?.insuranceRate ?? 0],
    ['Pret - duree (mois)', loan?.durationMonths ?? 0],
    ['Pret - type', loan?.type ?? ''],
    ['Horizon (annees)', p.horizonYears],
    ['Inflation generale', p.inflationRate],
    ['Croissance immobiliere', p.propertyGrowth],
    ['Revalorisation loyer', p.rentGrowthRate],
    ['Evolution charges', p.chargesGrowthRate],
    ['Evolution taxe fonciere', p.propertyTaxGrowthRate],
    ['Distribution de dividendes', p.dividendDistributionRate],
    ['Remboursement compte courant', p.ccaRepaymentRate],
    ['Decote d illiquidite', p.illiquidityDiscount],
    ['Demembrement', p.demembrement ? 'oui' : 'non'],
    ['Objectif', p.objectif],
  ];

  if (asset?.saisonnier) {
    const sa = asset.saisonnier;
    lignes.push(
      ['Saisonnier - gestion', sa.gestion],
      ['Saisonnier - CA haute saison', sa.hauteSaison.caPeriode],
      ['Saisonnier - taux occupation haute', sa.hauteSaison.tauxOccupation],
      ['Saisonnier - CA moyenne saison', sa.moyenneSaison.caPeriode],
      ['Saisonnier - taux occupation moyenne', sa.moyenneSaison.tauxOccupation],
      ['Saisonnier - CA basse saison', sa.basseSaison.caPeriode],
      ['Saisonnier - taux occupation basse', sa.basseSaison.tauxOccupation],
      ['Saisonnier - commission plateforme', sa.commissionPlateforme],
      ['Saisonnier - menage et linge (annuel)', sa.fraisMenageLingeAnnuel],
      ['Saisonnier - frais conciergerie', sa.fraisConciergeriePercent],
    );
  }

  return {
    titre: 'HYPOTHESES',
    note: 'Les taux sont des fractions de 1 : 0.035 = 3,5 %.',
    entetes: ['Parametre', 'Valeur'],
    lignes,
  };
}

function associes(request: SimulationRequest): CsvSection {
  const toutes = [
    ...request.structures,
    ...request.structures.flatMap((s) => (s.subsidiaries as SimulationRequest['structures']) ?? []),
  ];
  const lignes = toutes.flatMap((s) =>
    s.associes.map((a) => [
      s.name,
      a.nom,
      a.partsPercent,
      a.relation,
      a.maritalStatus,
      a.childrenCount,
      a.autresRevenus,
      a.socialChargeRegime,
      a.apportCapital,
      a.apportCompteCourant,
      a.tauxInteretCCA,
    ]),
  );

  return {
    titre: 'ASSOCIES',
    note: 'A l IR chaque associe est impose sur sa quote-part a son propre bareme, sur ses autres revenus.',
    entetes: [
      'Structure', 'Nom', 'Parts', 'Relation', 'Situation', 'Enfants',
      'Autres revenus', 'Regime social', 'Apport capital', 'Compte courant', 'Taux CCA',
    ],
    lignes,
  };
}

function projection(result: SimulationResult): CsvSection {
  const rows = toRows(result);
  return {
    titre: 'PROJECTION ANNUELLE',
    note: 'Annee 0 = constitution. Les sorties sont positives : ce sont des montants, pas des mouvements signes.',
    entetes: ['Annee', ...COLUMNS.map((c) => c.label)],
    lignes: rows.map((r) => [r.year, ...COLUMNS.map((c) => columnValue(c, r).toFixed(2))]),
  };
}

/** The components behind the headline figures, so the arithmetic is checkable. */
function detail(result: SimulationResult): CsvSection {
  const lignes: (string | number)[][] = [];
  for (const y of result.yearlyData) {
    for (const [nom, e] of Object.entries(y.entities)) {
      lignes.push([
        y.year, nom,
        e.detail.loyerNu, e.detail.caHauteSaison, e.detail.caMoyenneSaison, e.detail.caBasseSaison,
        e.detail.chargesCopro, e.detail.taxeFonciere,
        e.detail.commissionPlateforme, e.detail.fraisMenageLinge, e.detail.fraisConciergerie,
        e.detail.interets, e.detail.assurance,
        e.loanPrincipal, e.depreciation, e.operatingCosts,
        e.taxableProfit, e.tax, e.netCashFlow,
        e.tresorerie, e.ccaRembourse, e.ccaSolde, e.dividendeVerse,
        e.remainingDebt, e.assetMarketValue,
      ]);
    }
  }

  return {
    titre: 'DETAIL PAR ENTITE ET PAR ANNEE',
    note: 'De quoi refaire les calculs : chaque total du tableau se reconstitue depuis ces lignes.',
    entetes: [
      'Annee', 'Entite',
      'Loyer nu', 'CA haute saison', 'CA moyenne saison', 'CA basse saison',
      'Charges copro', 'Taxe fonciere',
      'Commission plateforme', 'Menage et linge', 'Conciergerie',
      'Interets', 'Assurance emprunteur',
      'Capital rembourse', 'Amortissement', 'Couts structure',
      'Resultat imposable', 'IS societe', 'Cash-flow entite',
      'Tresorerie', 'CCA rembourse', 'CCA solde', 'Dividende verse',
      'Dette bancaire', 'Valeur du bien',
    ],
    lignes,
  };
}

function parAssocie(result: SimulationResult): CsvSection {
  const lignes: (string | number)[][] = [];
  for (const y of result.yearlyData) {
    for (const [nom, a] of Object.entries(y.associes)) {
      lignes.push([
        y.year, nom, a.quotePart, a.irTax, a.psTax,
        a.ccaInterest, a.ccaRepayment, a.ccaBalance, a.netCashFlow,
      ]);
    }
  }

  return {
    titre: 'PAR ASSOCIE ET PAR ANNEE',
    note: 'IR calcule en differentiel : impot avec la quote-part moins impot sans elle, sur le foyer de chacun.',
    entetes: [
      'Annee', 'Associe', 'Quote-part', 'IR', 'PS ou cotisations',
      'Interets CCA', 'CCA rembourse', 'CCA solde', 'Net associe',
    ],
    lignes,
  };
}

function synthese(result: SimulationResult): CsvSection {
  const s = result.summary;
  return {
    titre: 'SYNTHESE',
    entetes: ['Indicateur', 'Valeur'],
    lignes: [
      ['Patrimoine net a terme', s.totalNetWealth],
      ['Impots cumules (hors succession et revente)', s.totalTaxPaid],
      ['Frais de constitution', s.fraisConstitution],
      ['Couts de structure cumules', s.totalOperatingCosts],
      ['TRI', s.irr ?? 'n/d'],
      ['TRI net de revente', s.irrNetDeRevente ?? 'n/d'],
      ['Cout de succession', s.successionCost],
      ['Objectif', s.objectif],
      ['Cout d acquisition', s.financement.coutAcquisition],
      ['Emprunt', s.financement.emprunt],
      ['Apport requis', s.financement.apportRequis],
      ['Apport declare', s.financement.apportDeclare],
      ['Ecart de financement', s.financement.ecart],
    ],
  };
}

function sortie(result: SimulationResult): CsvSection {
  const s = result.summary.sortie;
  return {
    titre: 'SORTIE (revente estimee au terme)',
    note: 'Estimation seule : aucun flux correspondant dans la projection annuelle.',
    entetes: ['Indicateur', 'Valeur'],
    lignes: [
      ['Regime', s.regime],
      ['Prix de vente', s.prixVente],
      ['Valeur nette comptable', s.valeurNetteComptable],
      ['Prix d acquisition', s.prixAcquisition],
      ['Plus-value brute', s.plusValueBrute],
      ['dont amortissements repris', s.amortissementsRepris],
      ['Impot paye par la societe', s.impotSociete],
      ['Boni de liquidation', s.boniLiquidation],
      ['Impot paye par les associes', s.impotAssocies],
      ['Impot de sortie total', s.impot],
      ['Dette residuelle', s.detteResiduelle],
      ['Produit net', s.produitNet],
    ],
  };
}

function succession(result: SimulationResult): CsvSection {
  const s = result.succession;
  return {
    titre: 'SUCCESSION',
    entetes: ['Heritier', 'Relation', 'Part recue', 'Abattement', 'Base taxable', 'Droits'],
    lignes: [
      ...s.heritiers.map((h) => [h.nom, h.relation, h.partRecue, h.abattement, h.baseTaxable, h.droits]),
      ['TOTAL', '', s.baseTransmise, '', '', s.total],
      ['NAV des societes', '', s.navTotal, '', '', ''],
      ['Valeur des parts du defunt', '', s.valeurPartsDefunt, '', '', ''],
      ['Compte courant du defunt', '', s.ccaDefunt, '', '', ''],
    ],
  };
}

export function exportSimulationCsv(
  request: SimulationRequest,
  result: SimulationResult,
  libelleMontage: string,
): string {
  const preambule = [
    'Patrimonia — export de simulation',
    `Montage : ${libelleMontage}`,
    `Genere le : ${new Date().toISOString()}`,
    '',
    'Separateur : point-virgule. Decimale : point. Montants en euros.',
    '',
    'A LIRE AVANT DE VALIDER CES CHIFFRES',
    ...AVERTISSEMENTS.map((a) => `- ${a}`),
  ];

  return buildCsv(preambule, [
    hypotheses(request),
    associes(request),
    synthese(result),
    projection(result),
    detail(result),
    parAssocie(result),
    sortie(result),
    succession(result),
  ]);
}

export function nomFichier(profile: ScenarioProfile): string {
  const date = new Date().toISOString().slice(0, 10);
  const montage = PROFILE_META[profile].short.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `patrimonia-${montage}-${date}.csv`;
}

/** Hands the file to the browser. The BOM makes Excel read it as UTF-8. */
export function telechargerCsv(contenu: string, nom: string): void {
  const blob = new Blob([`﻿${contenu}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.click();
  URL.revokeObjectURL(url);
}
