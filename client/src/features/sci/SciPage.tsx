import { PROFILS_DIRECT, PROFILS_SOCIETE } from '@/lib/profiles';
import { useDirectStore, useScenarioStore } from '@/store/scenarioStore';
import { ComparateurLocatif } from './ComparateurLocatif';

/** « Investir en societe »: SCI at IR, SCI at IS, holding. */
export function SciPage() {
  return (
    <ComparateurLocatif
      store={useScenarioStore}
      kind="sci"
      profils={PROFILS_SOCIETE}
      intro="SCI a l’IR, SCI a l’IS et holding : une societe a creer et a faire vivre (statuts, comptable, assemblees generales, comptes annuels)."
      autre={{ store: useDirectStore, profils: PROFILS_DIRECT, route: 'direct', libelle: 'Location en direct' }}
    />
  );
}
