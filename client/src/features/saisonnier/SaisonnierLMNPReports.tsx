import type { SimulationResult } from '@shared/schemas.js';
import { formatEur } from '@/lib/profiles';

/**
 * Why an LMNP's taxable result sits at zero for years, and what it costs at
 * the sale. The projection table shows the depreciation actually deducted;
 * the stock still waiting behind it only shows here.
 */
export function SaisonnierLMNPReports({ result }: { result: SimulationResult }) {
  const lignes = result.yearlyData
    .filter((y) => y.year > 0)
    .map((y) => {
      const e = Object.values(y.entities)[0];
      return { year: y.year, e, lmnp: e?.lmnp };
    })
    .filter((l) => l.lmnp);

  if (lignes.length === 0) return null;

  const sortie = result.summary.sortie;
  const afficherSortie = result.summary.objectif === 'TRANSMISSION' && sortie.regime === 'LMNP';
  const ssi = lignes.some((l) => l.lmnp!.affiliationSSI);
  const microPuisReel =
    lignes.some((l) => l.lmnp!.regime === 'MICRO_BIC') && lignes.some((l) => l.lmnp!.regime === 'REEL');

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="px-4 pt-4">
        <h3 className="text-lg font-semibold text-gray-900">LMNP : reports et abattement</h3>
        <p className="text-xs text-gray-500 mb-3">
          Au reel, l’amortissement ne peut pas creer de deficit : l’excedent est differe sans
          limite de duree. Un deficit de charges ne s’impute que sur les benefices LMNP des dix
          annees suivantes, jamais sur vos autres revenus.
        </p>
        {ssi && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 mb-3">
            Meuble de tourisme au-dela de 23 000 EUR de recettes : les annees marquees « SSI »
            paient des cotisations sociales d’independant (minimum inclus, meme a resultat nul) a la
            place des prelevements sociaux.
          </p>
        )}
        {microPuisReel && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 mb-3">
            Les recettes depassent le seuil du micro-BIC certaines annees : le reel s’applique
            l’annee suivante.
          </p>
        )}
      </div>

      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white">
            <tr className="text-gray-400 border-b">
              <th className="text-left font-medium px-4 py-1.5">Annee</th>
              <th className="text-left font-medium px-4 py-1.5">Regime</th>
              <th className="text-right font-medium px-4 py-1.5">Abattement micro</th>
              <th className="text-right font-medium px-4 py-1.5">Amortissement deduit</th>
              <th className="text-right font-medium px-4 py-1.5">Amortissements differes</th>
              <th className="text-right font-medium px-4 py-1.5">Deficit reportable</th>
              <th className="text-right font-medium px-4 py-1.5">Resultat imposable</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(({ year, e, lmnp }) => (
              <tr key={year} className="border-b last:border-0">
                <td className="px-4 py-1.5 text-gray-700">{year}</td>
                <td className="px-4 py-1.5 text-gray-600">
                  {lmnp!.regime === 'MICRO_BIC' ? 'Micro-BIC' : 'Reel'}
                  {lmnp!.affiliationSSI && <span className="ml-1 text-amber-700 font-medium">· SSI</span>}
                </td>
                <td className="px-4 py-1.5 text-right font-mono text-gray-600">
                  {formatEur(lmnp!.abattementMicro)}
                </td>
                <td className="px-4 py-1.5 text-right font-mono text-gray-600">{formatEur(e.depreciation)}</td>
                <td className="px-4 py-1.5 text-right font-mono text-gray-600">
                  {formatEur(lmnp!.amortissementsDifferes)}
                </td>
                <td className="px-4 py-1.5 text-right font-mono text-gray-600">
                  {formatEur(lmnp!.deficitReportable)}
                </td>
                <td className="px-4 py-1.5 text-right font-mono font-semibold text-gray-900">
                  {formatEur(e.taxableProfit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {afficherSortie && (
        <div className="px-4 py-3 border-t bg-orange-50 text-xs text-orange-900 space-y-1">
          <div className="flex justify-between">
            <span>Amortissements deduits reintegres dans la plus-value (LF 2025)</span>
            <span className="font-mono">{formatEur(sortie.amortissementsRepris)}</span>
          </div>
          <div className="flex justify-between">
            <span>Plus-value imposable (regime des particuliers)</span>
            <span className="font-mono">{formatEur(sortie.plusValueBrute)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Impot de sortie si revente au terme</span>
            <span className="font-mono text-red-600">{formatEur(sortie.impot)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
