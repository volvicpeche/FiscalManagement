import { PROFILS_DIRECT, PROFILS_SOCIETE } from '@/lib/profiles';
import { useDirectStore, useScenarioStore } from '@/store/scenarioStore';
import { ComparateurLocatif } from '@/features/sci/ComparateurLocatif';

/**
 * « Investir en direct »: the property held in one's own name, alone or in
 * indivision — unfurnished (micro-foncier, reel) and long-term furnished
 * (micro-BIC, reel). Its own inputs, apart from the company page.
 */
export function DirectPage() {
  return (
    <ComparateurLocatif
      store={useDirectStore}
      kind="direct"
      profils={PROFILS_DIRECT}
      intro="Le bien en votre nom, seul ou en indivision : pas de societe. Location vide ou meublee longue duree, au forfait ou au reel. Les associes sont ici les coproprietaires ; un apport en compte courant compte comme un apport personnel."
      autre={{ store: useScenarioStore, profils: PROFILS_SOCIETE, route: 'sci', libelle: 'SCI / Holding' }}
    />
  );
}
