import type { SimulationResult } from '@shared/schemas.js';
import { FluxTable, type ColumnOverrides } from '@/features/dashboard/FluxTable';
import { toRows, visibleColumns } from '@/features/dashboard/projectionColumns';

/**
 * An LMP at BIC reel is taxed on its own terms: the social levy is TNS (SSI)
 * contributions on a professional result, not the CSG/CRDS/PS that apply to
 * passive foncier income. Same column, different meaning — so it gets its own
 * wording here rather than a vague label shared by both.
 */
const LMP_OVERRIDES: ColumnOverrides = {
  psAssocies: {
    label: 'Cotisations sociales',
    quoi: "Cotisations TNS (SSI) sur le resultat BIC, et non les prelevements sociaux du foncier. Elles ouvrent des droits (retraite, maladie), contrairement aux PS.",
  },
  irAssocies: {
    label: 'IR',
    quoi: "Impot du par l'exploitant, calcule en differentiel sur son propre foyer. Un deficit BIC professionnel s'impute en totalite sur le revenu global, sans le plafond de 10 700 EUR du foncier — d'ou des montants negatifs les premieres annees.",
  },
  amortissement: {
    quoi: "Le coeur du LMP au reel : l'amortissement du bien et du mobilier efface le resultat imposable pendant des annees sans qu'un euro ne sorte. Terrain non amortissable (15 %), bati sur 25 ans, travaux sur 15 ans, mobilier sur 7 ans.",
  },
};

/**
 * An LMNP pays the ordinary prelevements sociaux, so that column keeps its
 * default wording. What differs is the depreciation, which is capped, and the
 * deficit, which never reaches the global income.
 */
const LMNP_OVERRIDES: ColumnOverrides = {
  psAssocies: {
    label: 'PS / cotisations SSI',
    quoi: "Prelevements sociaux du patrimoine sur le resultat LMNP. Pour un meuble de tourisme au-dela de 23 000 EUR de recettes, ils sont remplaces par les cotisations SSI des independants, dues au minimum meme quand l'amortissement efface le resultat.",
  },
  irAssocies: {
    label: 'IR',
    quoi: "Impot du par le loueur, calcule en differentiel sur son propre foyer. Un deficit LMNP ne s'impute jamais sur le revenu global : il se reporte dix ans sur les seuls benefices de location meublee — d'ou un IR nul, jamais negatif.",
  },
  amortissement: {
    quoi: "Au reel, l'amortissement deduit ne peut pas creer de deficit (art. 39 C) : seul ce que le resultat absorbe figure ici, le reste est differe sans limite de duree. Bati sur 25 ans, travaux sur 15, mobilier sur 7. Au micro-BIC, aucun amortissement : l'abattement forfaitaire en tient lieu. Depuis 2025, les amortissements du bien deduits sont reintegres dans la plus-value a la revente — pas ceux du mobilier.",
  },
};

export function SaisonnierProjectionTable({
  result,
  statut,
}: {
  result: SimulationResult;
  statut: 'LMNP' | 'LMP';
}) {
  const rows = toRows(result);

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <FluxTable
        rows={rows}
        columns={visibleColumns(rows)}
        overrides={statut === 'LMNP' ? LMNP_OVERRIDES : LMP_OVERRIDES}
        footerClass="bg-orange-50 text-orange-900"
      />
    </div>
  );
}
