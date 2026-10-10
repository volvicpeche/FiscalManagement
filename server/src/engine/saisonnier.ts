import Decimal from 'decimal.js';
import type { SaisonnierParams, SaisonnierSaisonInput } from '@shared/schemas.js';

/**
 * Location saisonniere revenue and operating charges for one year.
 *
 * The CA of a season follows from its nights, occupancy and price per night
 * when both are given; otherwise the amount typed (`caPeriode`) is used and
 * the occupancy stays informational.
 *
 * The platform takes its commission on the CA whoever runs the letting. Then:
 *   SOI_MEME     -> the owner pays cleaning and linen (flat yearly amount)
 *   CONCIERGERIE -> a percentage of the CA net of the platform commission,
 *                   covering mise en location, menage, linge and entretien.
 */

export interface SaisonnierRevenue {
  caParSaison: {
    hauteSaison: Decimal;
    moyenneSaison: Decimal;
    basseSaison: Decimal;
  };
  caAnnuelBrut: Decimal;
  commissionPlateforme: Decimal;
  fraisMenageLinge: Decimal;
  fraisConciergerie: Decimal;
  totalFraisExploitation: Decimal;
  caNetExploitation: Decimal;
}

/** CA of one season: nights × occupancy × price when known, the typed amount otherwise. */
export function caSaison(s: SaisonnierSaisonInput): Decimal {
  if (s.nuits !== undefined && s.prixNuit !== undefined) {
    return new Decimal(s.nuits).mul(s.tauxOccupation).mul(s.prixNuit);
  }
  return new Decimal(s.caPeriode);
}

export function computeSaisonnierRevenue(params: SaisonnierParams): SaisonnierRevenue {
  const hauteSaison = caSaison(params.hauteSaison);
  const moyenneSaison = caSaison(params.moyenneSaison);
  const basseSaison = caSaison(params.basseSaison);
  const caAnnuelBrut = hauteSaison.plus(moyenneSaison).plus(basseSaison);

  const isConciergerie = params.gestion === 'CONCIERGERIE';

  const commissionPlateforme = caAnnuelBrut.mul(params.commissionPlateforme);
  const fraisMenageLinge = isConciergerie ? new Decimal(0) : new Decimal(params.fraisMenageLingeAnnuel);
  const fraisConciergerie = isConciergerie
    ? caAnnuelBrut.minus(commissionPlateforme).mul(params.fraisConciergeriePercent)
    : new Decimal(0);

  const totalFraisExploitation = commissionPlateforme.plus(fraisMenageLinge).plus(fraisConciergerie);

  return {
    caParSaison: { hauteSaison, moyenneSaison, basseSaison },
    caAnnuelBrut,
    commissionPlateforme,
    fraisMenageLinge,
    fraisConciergerie,
    totalFraisExploitation,
    caNetExploitation: caAnnuelBrut.minus(totalFraisExploitation),
  };
}
