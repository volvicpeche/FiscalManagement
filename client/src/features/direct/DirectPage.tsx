import { Lien } from '@/lib/router';
import { PROFILS_DIRECT } from '@/lib/profiles';
import { ComparateurLocatif } from '@/features/sci/ComparateurLocatif';

/**
 * Location en direct: the property held in one's own name, alone or in
 * indivision — unfurnished (micro-foncier, reel) and long-term furnished
 * (micro-BIC, reel). Same inputs as the SCI page.
 */
export function DirectPage() {
  return (
    <ComparateurLocatif
      profils={PROFILS_DIRECT}
      intro={
        <>
          Le bien en votre nom, seul ou en indivision : pas de societe. Location vide ou meublee longue duree, au
          forfait ou au reel. Les associes sont ici les coproprietaires, et un apport en compte courant compte comme un
          apport personnel. Meme saisie que la page{' '}
          <Lien vers="sci" className="text-indigo-700 underline">SCI / Holding</Lien> : comparez les deux.
        </>
      }
    />
  );
}
