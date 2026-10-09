import type { Etape, EtapeId } from './parcours';

/**
 * Every visible step, all clickable: the wizard guides but never locks. A
 * step already seen that still has alerts shows an amber dot.
 */
export function BarreEtapes({
  etapes,
  courante,
  vues,
  avecAlertes,
  onSelect,
}: {
  etapes: Etape[];
  courante: EtapeId;
  vues: EtapeId[];
  avecAlertes: (id: EtapeId) => boolean;
  onSelect: (id: EtapeId) => void;
}) {
  const index = etapes.findIndex((e) => e.id === courante);
  return (
    <nav aria-label="Etapes" className="min-w-0 flex-1 print:hidden">
      <p className="text-xs text-gray-500 sm:hidden">
        Etape {index + 1} sur {etapes.length}
      </p>
      <ol className="mt-1 flex gap-1 overflow-x-auto pb-1 sm:mt-0 sm:flex-wrap sm:overflow-visible sm:pb-0">
        {etapes.map((e, i) => {
          const actif = e.id === courante;
          const vue = vues.includes(e.id);
          return (
            <li key={e.id} className="shrink-0">
              <button
                type="button"
                title={e.aide}
                aria-current={actif ? 'step' : undefined}
                onClick={() => onSelect(e.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                  actif
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : vue
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                <span className="font-mono">{i + 1}</span>
                {e.court}
                {vue && !actif && avecAlertes(e.id) && (
                  <span aria-label="a verifier" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
