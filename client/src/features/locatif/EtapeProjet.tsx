import type { ReactNode } from 'react';
import type { AssocieInput, ObjectifPatrimonial } from '@shared/schemas.js';
import { redistributeParts } from '@shared/parts.js';
import { PRET_PAR_DEFAUT, makeAssocie } from '@/store/scenarioStore';
import { useStoreLocatif, useStoreLocatifHook } from '@/store/storeLocatif';

type Qui = 'seul' | 'couple' | 'plusieurs';

function Choix<T extends string>({
  question,
  valeur,
  options,
  onChange,
}: {
  question: string;
  valeur: T;
  options: { v: T; titre: string; detail: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-gray-900">{question}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            aria-pressed={valeur === o.v}
            onClick={() => onChange(o.v)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              valeur === o.v ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <span className="block text-sm font-medium text-gray-900">{o.titre}</span>
            <span className="mt-0.5 block text-xs text-gray-500">{o.detail}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function quiDe(associes: AssocieInput[]): Qui {
  if (associes.length === 1) return 'seul';
  if (associes.length === 2 && associes.some((a) => a.relation === 'SPOUSE')) return 'couple';
  return 'plusieurs';
}

/**
 * The first step: three questions that shape the rest — who buys, with or
 * without a loan, to earn or to pass on. Each answer only pre-fills: every
 * figure stays editable in the following steps.
 */
export function EtapeProjet({ societe }: { societe: boolean }) {
  const { associes, asset, params, updateAsset, updateParams } = useStoreLocatif();
  const api = useStoreLocatifHook();
  const qui = quiDe(associes);

  const choisirQui = (v: Qui) => {
    const moi = associes.find((a) => a.relation === 'SELF') ?? associes[0] ?? makeAssocie({ nom: 'Moi', relation: 'SELF' });
    const conjoint =
      associes.find((a) => a.relation === 'SPOUSE') ??
      makeAssocie({ nom: 'Conjoint(e)', relation: 'SPOUSE', maritalStatus: 'MARRIED', apportCapital: '0.00' });
    const suivants =
      v === 'seul'
        ? [moi]
        : v === 'couple'
          ? [moi, conjoint]
          : associes.length >= 3
            ? associes
            : [moi, conjoint, makeAssocie({ nom: societe ? 'Associe 3' : 'Coproprietaire 3', relation: 'CHILD' })];
    const self = suivants.findIndex((a) => a.relation === 'SELF');
    api.setState({ associes: redistributeParts(suivants, self === -1 ? 0 : self) });
  };

  return (
    <div className="space-y-6">
      <Choix<Qui>
        question={societe ? 'Qui seront les associes ?' : 'Qui achete ?'}
        valeur={qui}
        onChange={choisirQui}
        options={[
          { v: 'seul', titre: 'Seul(e)', detail: societe ? 'Une societe a associe unique.' : 'Le bien a votre seul nom.' },
          { v: 'couple', titre: 'En couple', detail: 'Vous et votre conjoint, a parts egales pour commencer.' },
          { v: 'plusieurs', titre: 'A plusieurs', detail: societe ? 'Famille, amis : chacun avec son foyer.' : 'En indivision, chacun avec son foyer.' },
        ]}
      />
      <Choix<'oui' | 'non'>
        question="Un pret immobilier ?"
        valeur={asset.loan ? 'oui' : 'non'}
        onChange={(v) => updateAsset({ loan: v === 'oui' ? (asset.loan ?? PRET_PAR_DEFAUT) : undefined })}
        options={[
          { v: 'oui', titre: 'Oui', detail: 'Montant, taux et duree a l’etape Financement.' },
          { v: 'non', titre: 'Non, comptant', detail: 'Tout est apporte par les proprietaires.' },
        ]}
      />
      <Choix<ObjectifPatrimonial>
        question="Votre objectif"
        valeur={params.objectif ?? 'TRANSMISSION'}
        onChange={(objectif) => updateParams({ objectif })}
        options={[
          { v: 'TRANSMISSION', titre: 'Transmettre', detail: 'Garder le bien et le transmettre : droits de succession et impot de revente calcules.' },
          { v: 'RENDEMENT', titre: 'Rendement', detail: 'Ce que le bien rapporte pendant qu’il tourne, sans revente ni succession.' },
        ]}
      />
    </div>
  );
}
