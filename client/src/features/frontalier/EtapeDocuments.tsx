import { useFrontalierStore } from '@/store/frontalierStore';
import { etapesVisibles, piecesEtape } from './parcours';

/** The checklist, built from the profile and grouped by the step that asks for each paper. */
export function EtapeDocuments() {
  const s = useFrontalierStore();
  const groupes = etapesVisibles(s)
    .map((e) => ({ etape: e, pieces: piecesEtape(e.id, s) }))
    .filter((g) => g.pieces.length > 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">Indispensable</span> : sans cette piece le calcul sera inexact.{' '}
          <span className="font-medium text-gray-900">Si concerne</span> : seulement si vous avez eu la depense.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 print:hidden"
        >
          Imprimer la liste
        </button>
      </div>

      {groupes.map(({ etape, pieces }) => (
        <section key={etape.id}>
          <h4 className="text-xs font-medium uppercase tracking-wide text-gray-400">{etape.titre}</h4>
          <ul className="mt-2 divide-y rounded-md border">
            {pieces.map((p) => (
              <li key={p.libelle} className="flex items-start gap-3 p-3">
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    p.indispensable ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {p.indispensable ? 'Indispensable' : 'Si concerne'}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-900">{p.libelle}</p>
                  <p className="text-xs text-gray-500">{p.ouLeTrouver}</p>
                </div>
                {p.type && (
                  <span title="Peut etre lu automatiquement" className="ml-auto shrink-0 text-xs text-gray-400">
                    📄 lisible
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="text-xs text-gray-400">
        Les pieces marquees « lisible » peuvent etre deposees a leur etape : leurs montants sont lus, puis proposes a
        votre validation. Les autres se recopient a la main.
      </p>
    </div>
  );
}
