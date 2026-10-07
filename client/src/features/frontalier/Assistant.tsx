import type { ReactNode } from 'react';
import { selectInputs, useFrontalierStore } from '@/store/frontalierStore';
import { ScenarioManager } from '@/features/scenarios';
import { BarreEtapes } from './BarreEtapes';
import { BiensFranceForm } from './BiensFranceForm';
import { DeductionsForm } from './DeductionsForm';
import { DocumentDropzone } from './DocumentDropzone';
import { EtapeDocuments } from './EtapeDocuments';
import { EtapeProfil } from './EtapeProfil';
import { EtapeRecap } from './EtapeRecap';
import { FoyerForm } from './FoyerForm';
import { PersonneForm } from './PersonneForm';
import { TravauxForm } from './TravauxForm';
import { ETAPES, alertes, etapesVisibles, typesAttendus, type EtapeId } from './parcours';
import { Titre } from './ui';

const CORPS: Record<EtapeId, ReactNode> = {
  profil: <EtapeProfil />,
  documents: <EtapeDocuments />,
  foyer: <FoyerForm />,
  contribuable: <PersonneForm qui="contribuable" />,
  conjoint: <PersonneForm qui="conjoint" />,
  deductions: <DeductionsForm />,
  france: <BiensFranceForm />,
  travaux: <TravauxForm />,
  resultat: <EtapeRecap />,
};

/** Steps whose body has no heading of its own. */
const SANS_TITRE: EtapeId[] = ['profil', 'documents', 'resultat'];

/**
 * The TOU, one step at a time: profile, checklist, then each block of the
 * return with its own drop zone, and the result last.
 */
export function Assistant() {
  const store = useFrontalierStore();
  const visibles = etapesVisibles(store);

  // A step can vanish under the user's feet (works switched off from inside
  // the works step): fall back on the nearest visible step before it.
  const rang = ETAPES.findIndex((e) => e.id === store.etape);
  const courante = [...visibles].reverse().find((e) => ETAPES.indexOf(e) <= rang) ?? visibles[0];
  const index = visibles.indexOf(courante);
  const precedente = visibles[index - 1];
  const suivante = visibles[index + 1];

  const aller = (id: EtapeId) => {
    store.setEtape(id);
    window.scrollTo({ top: 0 });
  };

  const attendus = typesAttendus(courante.id, store);
  const aVerifier = courante.id === 'resultat' ? [] : alertes(courante.id, store);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <BarreEtapes
          etapes={visibles}
          courante={courante.id}
          vues={store.etapesVues}
          avecAlertes={(id) => alertes(id, store).length > 0}
          onSelect={aller}
        />
        <details className="shrink-0 print:hidden sm:w-72">
          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">Mes scenarios</summary>
          <div className="mt-2 rounded-lg border bg-white p-4">
            <ScenarioManager
              kind="frontalier"
              getData={() => ({ ...selectInputs(store) })}
              onLoad={(data) => {
                store.hydrate(data as Parameters<typeof store.hydrate>[0]);
                // A saved scenario is complete: go straight to the recap.
                store.toutVoir();
                aller('resultat');
              }}
            />
          </div>
        </details>
      </div>

      <div className="rounded-lg border bg-white p-4 sm:p-6 space-y-6">
        {SANS_TITRE.includes(courante.id) && <Titre aide={courante.aide}>{courante.titre}</Titre>}

        {/* Keyed so that a step's pending reads do not follow the user into the next one. */}
        <div key={courante.id}>{CORPS[courante.id]}</div>

        {aVerifier.length > 0 && (
          <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {aVerifier.map((m) => (
              <li key={m}>⚠ {m}</li>
            ))}
          </ul>
        )}

        {attendus.length > 0 && (
          <div className="border-t pt-4">
            <DocumentDropzone
              key={courante.id}
              attendus={attendus}
              personne={courante.id === 'contribuable' || courante.id === 'conjoint' ? courante.id : undefined}
            />
          </div>
        )}
      </div>

      <div className="flex justify-between gap-2 print:hidden">
        {precedente ? (
          <button
            type="button"
            onClick={() => aller(precedente.id)}
            className="rounded-lg border bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            ◀ {precedente.court}
          </button>
        ) : (
          <span />
        )}
        {suivante && (
          <button
            type="button"
            onClick={() => aller(suivante.id)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {suivante.court} ▶
          </button>
        )}
      </div>
    </div>
  );
}
