import type { ReactNode } from 'react';
import type { ScenarioProfile } from '@shared/schemas.js';
import { BarreEtapes } from '@/components/BarreEtapes';
import { PROFILE_META, formatEur } from '@/lib/profiles';
import { ETAPES_IMMO, alertes, etapesVisibles, type EtapeImmoId } from '@/store/parcoursImmo';
import { partsAreValid } from '@/store/partsAssocies';
import { useStoreLocatif } from '@/store/storeLocatif';
import {
  AssetForm,
  AssociesForm,
  CostsForm,
  LoanForm,
  ParamsForm,
  SuccessionForm,
  UserProfileForm,
} from '@/features/scenario';
import { EtapeProjet } from './EtapeProjet';

const n = (x: string | undefined) => parseFloat(x ?? '0') || 0;

/** The last step: the inputs at a glance, then the comparison. */
function Recapitulatif({ profils, onComparer }: { profils: ScenarioProfile[]; onComparer: () => void }) {
  const { asset, associes } = useStoreLocatif();
  const cout = n(asset.purchasePrice) + n(asset.notaryFees) + n(asset.renovationCosts) + n(asset.mobilier);
  const lignes: [string, string][] = [
    ['Cout total de l’operation', formatEur(cout)],
    ['Emprunt', asset.loan ? `${formatEur(n(asset.loan.principal))} sur ${Math.round(asset.loan.durationMonths / 12)} ans a ${(asset.loan.interestRate * 100).toFixed(2).replace('.', ',')} %` : 'Aucun'],
    ['Loyer annuel', formatEur(n(asset.annualRent))],
    ['Charges et taxe fonciere', formatEur(n(asset.chargesYearly) + n(asset.propertyTax))],
    ['Proprietaires', associes.map((a) => `${a.nom} (${Math.round(a.partsPercent * 100)} %)`).join(', ')],
  ];
  const ok = partsAreValid(associes);
  return (
    <div className="space-y-4">
      <dl className="divide-y rounded-lg border">
        {lignes.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-2 text-sm">
            <dt className="text-gray-600">{k}</dt>
            <dd className="text-right font-medium text-gray-900">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-gray-600">
        Montages compares : {profils.map((p) => PROFILE_META[p].label).join(' · ')}.
      </p>
      <button
        type="button"
        onClick={onComparer}
        disabled={!ok}
        className="w-full rounded-lg bg-indigo-600 px-6 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Comparer les montages
      </button>
      {!ok && <p className="text-center text-xs text-red-600">La repartition des parts doit totaliser 100 %.</p>}
    </div>
  );
}

/**
 * The real-estate inputs, one step at a time, like the TOU. Every step stays
 * reachable from the bar; a step only warns, never blocks.
 */
export function ParcoursImmo({
  societe,
  profils,
  onComparer,
}: {
  /** Company page: « associes », capital and compte courant. */
  societe: boolean;
  profils: ScenarioProfile[];
  onComparer: () => void;
}) {
  const store = useStoreLocatif();
  const visibles = etapesVisibles(store);
  // A step can vanish (no more loan): fall back on the nearest one before it.
  const rang = ETAPES_IMMO.findIndex((e) => e.id === store.etape);
  const courante = [...visibles].reverse().find((e) => ETAPES_IMMO.indexOf(e) <= rang) ?? visibles[0];
  const index = visibles.indexOf(courante);
  const precedente = visibles[index - 1];
  const suivante = visibles[index + 1];

  const aller = (id: EtapeImmoId) => {
    store.setEtape(id);
    window.scrollTo({ top: 0 });
  };

  const corps: Record<EtapeImmoId, ReactNode> = {
    projet: <EtapeProjet societe={societe} />,
    bien: <AssetForm partie="achat" />,
    financement: <LoanForm />,
    loyers: <AssetForm partie="exploitation" />,
    proprietaires: (
      <div className="space-y-6">
        <AssociesForm titre={societe ? 'Associes' : 'Proprietaires'} />
        <UserProfileForm />
      </div>
    ),
    hypotheses: (
      <div className="space-y-6">
        <ParamsForm />
        <SuccessionForm />
        <CostsForm profils={profils} />
      </div>
    ),
    resultat: <Recapitulatif profils={profils} onComparer={onComparer} />,
  };
  const aVerifier = alertes(courante.id, store);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <BarreEtapes
        etapes={visibles}
        courante={courante.id}
        vues={store.etapesVues}
        avecAlertes={(id) => alertes(id, store).length > 0}
        onSelect={aller}
      />

      <div className="space-y-6 rounded-lg border bg-white p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{courante.titre}</h2>
          <p className="text-xs text-gray-500">{courante.aide}</p>
        </div>
        <div key={courante.id}>{corps[courante.id]}</div>
        {aVerifier.length > 0 && (
          <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {aVerifier.map((m) => (
              <li key={m}>⚠ {m}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-between gap-2">
        {precedente ? (
          <button type="button" onClick={() => aller(precedente.id)} className="rounded-lg border bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            ◀ {precedente.court}
          </button>
        ) : (
          <span />
        )}
        {suivante && (
          <button type="button" onClick={() => aller(suivante.id)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            {suivante.court} ▶
          </button>
        )}
      </div>
    </div>
  );
}
