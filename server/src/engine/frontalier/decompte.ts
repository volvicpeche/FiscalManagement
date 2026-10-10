import Decimal from 'decimal.js';
import type { ChampDecompte, DecompteReel, EcartDecompte, FrontalierResult } from '@shared/frontalier.js';

/**
 * Holds a computation against an actual assessment: the real cases of the
 * test suite (__tests__/cas-reels) and the « ce chiffre me semble faux »
 * reports compare the same lines the same way.
 */

/** Where each line of an assessment sits in the result, and what it is called on the bordereau. */
export const CHAMPS_DECOMPTE: Record<ChampDecompte, { libelle: string; lire: (r: FrontalierResult) => string }> = {
  revenuImposableIcc: { libelle: 'Revenu imposable ICC', lire: (r) => r.icc.revenuImposable },
  impotBaseIcc: { libelle: 'Impot cantonal de base', lire: (r) => r.icc.impotBase },
  centimesCantonaux: { libelle: 'Centimes additionnels cantonaux', lire: (r) => r.icc.centimesCantonaux },
  reductionLdirpp: { libelle: 'Reduction LDIRPP', lire: (r) => r.icc.reductionLdirpp },
  impotCommunal: { libelle: 'Impot communal', lire: (r) => r.icc.impotCommunal },
  icc: { libelle: 'Total ICC', lire: (r) => r.icc.total },
  revenuImposableIfd: { libelle: 'Revenu imposable IFD', lire: (r) => r.ifd.revenuImposable },
  ifd: { libelle: 'Total IFD', lire: (r) => r.ifd.total },
  totalTou: { libelle: 'Total TOU (ICC + IFD)', lire: (r) => r.totalTou },
};

/** Every line the assessment gives, in the order of the table above. */
export function comparerAuDecompte(result: FrontalierResult, decompte: DecompteReel): EcartDecompte[] {
  return (Object.keys(CHAMPS_DECOMPTE) as ChampDecompte[])
    .filter((champ) => decompte[champ] !== undefined)
    .map((champ) => {
      const calcule = new Decimal(CHAMPS_DECOMPTE[champ].lire(result));
      const reel = new Decimal(decompte[champ]!);
      return {
        champ,
        libelle: CHAMPS_DECOMPTE[champ].libelle,
        calcule: calcule.toFixed(2),
        reel: reel.toFixed(2),
        ecart: calcule.minus(reel).toFixed(2),
      };
    });
}
