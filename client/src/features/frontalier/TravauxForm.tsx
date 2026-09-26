import type { BienFrance } from '@shared/frontalier.js';
import { useFrontalierStore, type CategorieTravaux, type LigneTravaux } from '@/store/frontalierStore';
import { SourceBadge, Titre, inputClass } from './ui';

const CATEGORIES: Record<CategorieTravaux, { label: string; aide: string }> = {
  ENTRETIEN: {
    label: 'Entretien',
    aide: 'Remplacer l’existant par un equivalent : electricite vetuste, WC, salle de bain, cuisine, toiture, peinture. Deductible.',
  },
  ENERGIE: {
    label: 'Energie',
    aide: 'Isolation, fenetres, pompe a chaleur, solaire. Deductible ; l’excedent se reporte sur deux ans.',
  },
  PLUS_VALUE: {
    label: 'Plus-value',
    aide: 'Ce qui ajoute ou ameliore : piece ou salle d’eau nouvelle, agrandissement, nette montee en gamme.',
  },
};

const formatEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

/** ICC forfait: owner-occupied homes only, on the rental value. */
function forfaitIcc(b: BienFrance): number | null {
  if (b.usage === 'LOCATIF') return null;
  return (parseFloat(b.valeurLocativeEur) || 0) * (b.ageBatiment <= 10 ? 0.15 : 0.25);
}

/**
 * Works of the year, kept apart from the properties because most years have
 * none: the switch leaves them out of the calculation without losing them.
 */
export function TravauxForm() {
  const { travauxActifs, travaux, biensFrance, setTravauxActifs, addTravaux, updateTravaux, removeTravaux } =
    useFrontalierStore();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <Titre aide="Sur votre residence principale ou un autre bien en France.">Travaux</Titre>
        <button
          type="button"
          role="switch"
          aria-checked={travauxActifs}
          onClick={() => setTravauxActifs(!travauxActifs)}
          className={`mt-1 relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            travauxActifs ? 'bg-indigo-600' : 'bg-gray-300'
          }`}
          title={travauxActifs ? 'Ne plus compter les travaux' : 'Compter des travaux cette annee'}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
              travauxActifs ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {!travauxActifs ? (
        <p className="text-sm text-gray-500">
          Pas de travaux cette annee.
          {travaux.length > 0 && ` ${travaux.length} ligne(s) conservee(s), non comptee(s) dans le calcul.`}
        </p>
      ) : (
        <>
          {travaux.map((t) => (
            <LigneForm
              key={t.id}
              ligne={t}
              biens={biensFrance}
              onChange={(p) => updateTravaux(t.id, p)}
              onRemove={() => removeTravaux(t.id)}
            />
          ))}

          <button
            type="button"
            onClick={addTravaux}
            className="w-full rounded-md border border-dashed border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            + Ajouter des travaux
          </button>
          {biensFrance.length === 0 && (
            <p className="text-xs text-gray-400">
              Le premier ajout cree votre residence principale dans « Revenus en France » : renseignez-y sa valeur
              locative et l’age du batiment.
            </p>
          )}

          <Bilan travaux={travaux} biens={biensFrance} />
        </>
      )}
    </div>
  );
}

function LigneForm({
  ligne: t,
  biens,
  onChange,
  onRemove,
}: {
  ligne: LigneTravaux;
  biens: BienFrance[];
  onChange: (p: Partial<Omit<LigneTravaux, 'id'>>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border border-gray-200 p-3 space-y-2">
      <div className="flex gap-2 items-center">
        <input
          className={inputClass}
          placeholder="Ex. refection de l’electricite"
          value={t.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
        <button type="button" className="px-2 text-sm text-gray-400 hover:text-red-600" onClick={onRemove} title="Retirer">
          ✕
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500">
            Montant TTC (EUR) <SourceBadge fichier={t.source} />
          </label>
          <input
            type="number"
            min={0}
            step={100}
            className={`${inputClass} ${t.source ? 'border-indigo-300 bg-indigo-50/40' : ''}`}
            value={parseFloat(t.montantEur) || 0}
            onChange={(e) => onChange({ montantEur: Math.max(0, parseFloat(e.target.value) || 0).toFixed(2) })}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Nature</label>
          <select
            className={inputClass}
            value={t.categorie}
            onChange={(e) => onChange({ categorie: e.target.value as CategorieTravaux })}
          >
            {Object.entries(CATEGORIES).map(([k, c]) => (
              <option key={k} value={k}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-gray-400">{CATEGORIES[t.categorie].aide}</p>
      {biens.length > 1 && (
        <select className={inputClass} value={t.bien} onChange={(e) => onChange({ bien: parseInt(e.target.value) })}>
          {biens.map((b, i) => (
            <option key={i} value={i}>
              {b.label || `Bien ${i + 1}`}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/**
 * Per property: do this year's works beat the forfait? Below it they change
 * nothing, which is exactly what makes grouping works in one year pay off.
 */
function Bilan({ travaux, biens }: { travaux: LigneTravaux[]; biens: BienFrance[] }) {
  const lignes = biens
    .map((b, i) => {
      const siens = travaux.filter((t) => t.bien === i);
      if (siens.length === 0) return null;
      const somme = (c: CategorieTravaux) =>
        siens.filter((t) => t.categorie === c).reduce((a, t) => a + (parseFloat(t.montantEur) || 0), 0);
      const deductibles = somme('ENTRETIEN') + somme('ENERGIE');
      const autresFrais = (parseFloat(b.chargesCoproEur) || 0) + (parseFloat(b.assuranceEur) || 0);
      const forfait = forfaitIcc(b);
      return { nom: b.label || `Bien ${i + 1}`, deductibles, plusValue: somme('PLUS_VALUE'), reel: deductibles + autresFrais, forfait, b };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (lignes.length === 0) return null;

  return (
    <div className="rounded-md bg-gray-50 border border-gray-200 p-3 space-y-2 text-sm">
      {lignes.map((l) => (
        <div key={l.nom}>
          <p className="font-medium text-gray-800">{l.nom}</p>
          <p className="text-gray-600">
            Deductibles : {formatEur(l.deductibles)}
            {l.plusValue > 0 && <span className="text-gray-400"> — plus-value non deduite : {formatEur(l.plusValue)}</span>}
          </p>
          {l.forfait !== null &&
            (parseFloat(l.b.valeurLocativeEur) > 0 ? (
              <p className={l.reel > l.forfait ? 'text-green-700' : 'text-amber-700'}>
                {l.reel > l.forfait
                  ? `Frais reels (${formatEur(l.reel)}, copro et assurance comprises) au-dessus du forfait ICC de ${formatEur(l.forfait)} : les travaux comptent.`
                  : `Frais reels (${formatEur(l.reel)}) sous le forfait ICC de ${formatEur(l.forfait)} : le forfait s’applique, ces travaux ne changent rien cette annee. Mieux vaut les regrouper sur une seule annee.`}
              </p>
            ) : (
              <p className="text-amber-700">
                Renseignez la valeur locative de ce bien dans « Revenus en France » : sans elle, les travaux n’ont rien a
                reduire.
              </p>
            ))}
        </div>
      ))}
    </div>
  );
}
