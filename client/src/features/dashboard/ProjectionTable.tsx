import { useState } from 'react';
import type { ScenarioProfile, SimulationResult } from '@shared/schemas.js';
import { PROFILE_META, PROFILE_ORDER, formatEur } from '@/lib/profiles';
import type { ResultsProps } from './KpiCards';
import { FluxTable, useFluxTooltip } from './FluxTable';
import { toRows, visibleColumns } from './projectionColumns';
import { exportSimulationCsv, nomFichier, telechargerCsv } from '@/lib/csv';
import {
  useScenarioStore,
  selectSharedInputs,
  buildScenario,
} from '@/store/scenarioStore';

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
  const tooltip = useFluxTooltip();
  const store = useScenarioStore();

  const result = results[profile] ?? results[available[0]];
  if (!result) return null;

  const rows = toRows(result);
  const columns = visibleColumns(rows);
  const associes = associeTotals(result);
  const meta = PROFILE_META[profile];

  // At IS the company carries the tax, so the associes decaisse nothing
  // personally and this table is legitimately blank. Saying so beats letting it
  // look broken — and it points at where the figures do appear.
  const riensDePersonnel = associes.every(
    (a) =>
      Math.abs(a.quotePart) < 0.005 &&
      Math.abs(a.irTax) < 0.005 &&
      Math.abs(a.psTax) < 0.005 &&
      Math.abs(a.ccaInterest) < 0.005 &&
      Math.abs(a.ccaRepayment) < 0.005,
  );
  const aDuCompteCourant = associes.some((a) => Math.abs(a.ccaBalance) > 0.005);

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 pb-3 border-b">
        <h3 className="text-lg font-semibold text-gray-900">Tableau previsionnel</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Toutes les entites du montage cumulees, annee par annee. Survolez n’importe quel chiffre
          pour voir d’ou il vient.
        </p>

        <div className="flex items-center gap-1 mt-3">
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

          <button
            type="button"
            onClick={() => {
              const shared = selectSharedInputs(store);
              telechargerCsv(
                exportSimulationCsv(
                  buildScenario(profile, shared),
                  result,
                  PROFILE_META[profile].label,
                ),
                nomFichier(profile),
              );
            }}
            title="Exporter les hypotheses, la projection et le detail au format CSV"
            className="ml-auto px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            Exporter en CSV
          </button>
        </div>
      </div>

      {tooltip.element}

      <FluxTable rows={rows} columns={columns} footerClass={`${meta.bg} ${meta.text}`} />

      {associes.length > 0 && (
        <div className="border-t">
          <div className="p-4 pb-2">
            <h4 className="text-sm font-semibold text-gray-800">Par associe, sur tout l’horizon</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Ce que chacun a personnellement paye et encaisse — hors de la societe.
            </p>

            {riensDePersonnel && (
              <div className="mt-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-900">
                <p className="font-medium">Vide, et c’est normal sur ce montage.</p>
                <p className="mt-1 text-blue-800">
                  A l’IS, c’est la societe qui paie l’impot : les associes ne decaissent rien
                  personnellement. Ces lignes se remplissent sur{' '}
                  <strong>le montage a l’IR</strong>, ou chacun est impose sur sa quote-part a son
                  propre bareme
                  {aDuCompteCourant && (
                    <>
                      , et des que vous activez le{' '}
                      <strong>remboursement de compte courant</strong> dans le bloc Transmission —
                      le solde ci-dessous sortira alors sans aucune imposition
                    </>
                  )}
                  .
                </p>
              </div>
            )}
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
