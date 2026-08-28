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
    quoi: "Le coeur du LMP au reel : l'amortissement du bien et du mobilier efface le resultat imposable pendant des annees sans qu'un euro ne sorte. Terrain non amortissable (15 %), bati sur 25 ans, travaux sur 15 ans.",
  },
};

export function SaisonnierProjectionTable({ result }: { result: SimulationResult }) {
  const rows = toRows(result);

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <FluxTable
        rows={rows}
        columns={visibleColumns(rows)}
        overrides={LMP_OVERRIDES}
        footerClass="bg-orange-50 text-orange-900"
      />
    </div>
  );
}
