import { buildFrontalierRequest, useFrontalierStore, type FrontalierInputs } from '@/store/frontalierStore';
import { useFrontalierSimulation } from '@/hooks/useFrontalier';
import type { PersonneFrontalier } from '@shared/frontalier.js';
import { FrontalierResultats } from './FrontalierResultats';
import { alertes, etapesVisibles, type EtapeId } from './parcours';
import { CANTONS_TRAVAIL, LIBELLES_COMMUNES, formatChf, formatEur } from './ui';

const num = (v: string | undefined) => parseFloat(v ?? '0') || 0;

function resumePersonne(p: PersonneFrontalier): [string, string][] {
  if (p.activite === 'FRANCE') return [['Revenu brut en France', formatEur(num(p.revenuFranceBrutEur))]];
  if (p.activite === 'AUCUNE') return [['Activite', 'Sans activite']];
  return [
    ['Salaire brut', formatChf(p.salaireBrut)],
    ['Impot a la source retenu', num(p.impotSourceRetenu) > 0 ? formatChf(p.impotSourceRetenu) : 'non saisi'],
    ['3e pilier A', formatChf(p.pilier3a)],
  ];
}

/** The few figures that let the user check a step at a glance. */
function resume(id: EtapeId, s: FrontalierInputs): [string, string][] {
  switch (id) {
    case 'foyer':
      return [
        [
          'Lieu de travail',
          s.canton === 'GE' ? `${LIBELLES_COMMUNES[s.communeTravail]} (GE)` : CANTONS_TRAVAIL[s.canton].nom,
        ],
        ['Enfants a charge', s.profil.enfants ? String(s.enfants.length) : 'aucun'],
        ['Cours EUR → CHF', s.tauxChangeEurChf],
      ];
    case 'contribuable':
      return resumePersonne(s.contribuable);
    case 'conjoint':
      return resumePersonne(s.conjoint);
    case 'deductions': {
      const total = Object.values(s.deductions).reduce((t, v) => t + num(v), 0);
      return [
        ['Primes maladie et accidents', formatChf(s.deductions.primesAssuranceMaladie)],
        ['Total saisi', formatChf(total)],
      ];
    }
    case 'france':
      return [
        ['Biens', String(s.biensFrance.length)],
        ['Loyers bruts', formatEur(s.biensFrance.reduce((t, b) => t + (b.usage === 'LOCATIF' ? num(b.loyersBrutsEur) : 0), 0))],
        ['Autres revenus', formatEur(num(s.autresRevenusEtrangersEur))],
      ];
    case 'travaux':
      return [
        ['Factures', String(s.travaux.length)],
        ['Montant', formatEur(s.travaux.reduce((t, l) => t + num(l.montantEur), 0))],
      ];
    default:
      return [];
  }
}

export function EtapeRecap() {
  const store = useFrontalierStore();
  const simulation = useFrontalierSimulation();
  const etapes = etapesVisibles(store).filter((e) => resume(e.id, store).length > 0);

  const lancer = () =>
    simulation.mutate(buildFrontalierRequest(store), { onSuccess: (data) => store.setResult(data) });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {etapes.map((e) => {
          const a = alertes(e.id, store);
          return (
            <div key={e.id} className={`rounded-md border p-3 ${a.length ? 'border-amber-200' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">{e.titre}</p>
                <button
                  type="button"
                  onClick={() => store.setEtape(e.id)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Modifier
                </button>
              </div>
              <dl className="mt-2 space-y-0.5 text-sm">
                {resume(e.id, store).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-gray-500">{k}</dt>
                    <dd className="font-mono text-gray-900 whitespace-nowrap">{v}</dd>
                  </div>
                ))}
              </dl>
              {a.map((m) => (
                <p key={m} className="mt-1 text-xs text-amber-700">
                  ⚠ {m}
                </p>
              ))}
            </div>
          );
        })}
      </div>

      <button
        onClick={lancer}
        disabled={simulation.isPending}
        className="w-full px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {simulation.isPending ? 'Calcul en cours...' : store.result ? 'Relancer la comparaison' : 'Comparer TOU et impot a la source'}
      </button>

      {simulation.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">Erreur : {simulation.error.message}</div>
      )}

      {store.result && <FrontalierResultats result={store.result} />}
    </div>
  );
}
