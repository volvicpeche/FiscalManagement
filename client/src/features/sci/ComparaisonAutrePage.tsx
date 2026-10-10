import type { ScenarioProfile, SimulationResult } from '@shared/schemas.js';
import { PROFILE_META, formatEur } from '@/lib/profiles';
import { hasAnyResult, selectSharedInputs, type SharedInputs } from '@/store/scenarioStore';
import { useStoreLocatif } from '@/store/storeLocatif';
import type { AutrePage } from './ComparateurLocatif';

/** What makes two pages comparable: the same property, loan, owners, household and horizon. */
function empreinte(s: SharedInputs): string {
  return JSON.stringify({ asset: s.asset, associes: s.associes, userProfile: s.userProfile, params: s.params });
}

const pct = (x: string | null) => (x === null ? '—' : `${(parseFloat(x) * 100).toFixed(2).replace('.', ',')} %`);

function Ligne({ profil, r, page }: { profil: ScenarioProfile; r: SimulationResult; page: string }) {
  const meta = PROFILE_META[profil];
  return (
    <tr className="border-t">
      <td className="py-1.5 pr-3">
        <span className={`font-medium ${meta.text}`}>{meta.label}</span>
        <span className="block text-xs text-gray-400">{page}</span>
      </td>
      <td className="py-1.5 pr-3 text-right font-mono">{formatEur(r.summary.totalNetWealth)}</td>
      <td className="py-1.5 pr-3 text-right font-mono">{pct(r.summary.irrNetDeRevente)}</td>
      <td className="py-1.5 text-right font-mono">{formatEur(r.summary.totalTaxPaid)}</td>
    </tr>
  );
}

/**
 * « Compare with the other way to hold it », folded so the page stays light.
 * The other page's figures are shown only when they were computed from the
 * same inputs; otherwise one click copies these inputs over and runs there.
 */
export function ComparaisonAutrePage({
  mesProfils,
  autre,
  onComparer,
}: {
  mesProfils: ScenarioProfile[];
  autre: AutrePage;
  onComparer: () => void;
}) {
  const moi = useStoreLocatif();
  const lui = autre.store();
  const memeSaisie = empreinte(selectSharedInputs(moi)) === empreinte(selectSharedInputs(lui));
  const prets = hasAnyResult(moi.results, mesProfils) && hasAnyResult(lui.results, autre.profils);

  return (
    <details className="rounded-lg border bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-gray-800">
        Comparer avec « {autre.libelle} »
      </summary>
      {memeSaisie && prets ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500">
                <th className="py-1 text-left font-medium">Montage</th>
                <th className="py-1 pr-3 text-right font-medium">Patrimoine net a terme</th>
                <th className="py-1 pr-3 text-right font-medium">TRI net de revente</th>
                <th className="py-1 text-right font-medium">Impots cumules</th>
              </tr>
            </thead>
            <tbody>
              {mesProfils.filter((p) => moi.results[p]).map((p) => (
                <Ligne key={p} profil={p} r={moi.results[p]!} page="Cette page" />
              ))}
              {autre.profils.filter((p) => lui.results[p]).map((p) => (
                <Ligne key={p} profil={p} r={lui.results[p]!} page={autre.libelle} />
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-gray-400">Meme bien, meme pret, memes proprietaires, meme horizon.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2 text-sm text-gray-600">
          <p>
            {memeSaisie
              ? `Lancez le calcul ici et sur « ${autre.libelle} » pour les voir cote a cote.`
              : `« ${autre.libelle} » a sa propre saisie, differente de celle-ci.`}{' '}
            Copier cette saisie la-bas remplace la sienne, puis lance le calcul.
          </p>
          <button
            type="button"
            onClick={onComparer}
            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            Copier ma saisie dans « {autre.libelle} » et comparer
          </button>
        </div>
      )}
    </details>
  );
}
