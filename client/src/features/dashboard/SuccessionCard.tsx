import { PROFILE_META, PROFILE_ORDER, RELATION_LABELS, formatEur } from '@/lib/profiles';
import type { ResultsProps } from './KpiCards';

export function SuccessionCard({ results }: ResultsProps) {
  const available = PROFILE_ORDER.filter((p) => results[p]);
  if (available.length === 0) return null;

  const anyHeirs = available.some((p) => results[p]!.succession.heritiers.length > 0);

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-lg font-semibold text-gray-900">Transmission au terme</h3>
      <p className="text-xs text-gray-500 mb-4">
        Droits dus par les heritiers si le deces survient a la fin de l’horizon. Les parts deja
        detenues par les autres associes ne sont pas transmises — elles sont hors succession.
      </p>

      {!anyHeirs && (
        <p className="text-sm text-gray-400">
          Aucun associe « Moi-meme » declare : la succession n’est pas estimee.
        </p>
      )}

      {anyHeirs && (
        <div className="space-y-4">
          {available.map((p) => {
            const succ = results[p]!.succession;
            const meta = PROFILE_META[p];

            return (
              <div key={p} className={`rounded-md border ${meta.border} overflow-hidden`}>
                <div className={`flex items-center justify-between px-3 py-2 ${meta.bg}`}>
                  <span className={`text-sm font-semibold ${meta.text}`}>{meta.label}</span>
                  <span className="text-sm font-mono font-bold text-red-600">
                    {formatEur(succ.total)}
                  </span>
                </div>

                <div className="px-3 py-2 text-xs text-gray-500 border-b bg-gray-50/50 grid grid-cols-3 gap-2">
                  <span>
                    Valeur des parts :{' '}
                    <span className="font-mono text-gray-700">
                      {formatEur(succ.valeurPartsDefunt)}
                    </span>
                  </span>
                  <span>
                    Compte courant :{' '}
                    <span className="font-mono text-gray-700">{formatEur(succ.ccaDefunt)}</span>
                  </span>
                  <span>
                    Base transmise :{' '}
                    <span className="font-mono text-gray-700">{formatEur(succ.baseTransmise)}</span>
                  </span>
                </div>

                {succ.heritiers.length > 0 && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b">
                        <th className="text-left font-medium px-3 py-1.5">Heritier</th>
                        <th className="text-right font-medium px-3 py-1.5">Recu</th>
                        <th className="text-right font-medium px-3 py-1.5">Abattement</th>
                        <th className="text-right font-medium px-3 py-1.5">Droits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {succ.heritiers.map((h) => (
                        <tr key={h.nom} className="border-b last:border-0">
                          <td className="px-3 py-1.5 text-gray-700">
                            {h.nom}
                            <span className="text-gray-400"> · {RELATION_LABELS[h.relation]}</span>
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-gray-600">
                            {formatEur(h.partRecue)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-green-700">
                            −{formatEur(h.abattement)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono font-semibold text-red-600">
                            {formatEur(h.droits)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
