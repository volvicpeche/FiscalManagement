import { Lien } from '@/lib/router';
import { PROFILS_SOCIETE } from '@/lib/profiles';
import { ComparateurLocatif } from './ComparateurLocatif';

/** SCI / Holding: the company setups, the LMNP held directly as a reference. */
export function SciPage() {
  return (
    <ComparateurLocatif
      profils={PROFILS_SOCIETE}
      intro={
        <>
          SCI a l’IR, SCI a l’IS et holding : une societe a creer et a faire vivre (statuts, comptable, assemblees
          generales). La colonne « LMNP au reel » est une detention en direct, en reference ; le detail de la
          detention directe est dans <Lien vers="direct" className="text-indigo-700 underline">Location en direct</Lien>.
        </>
      }
    />
  );
}
