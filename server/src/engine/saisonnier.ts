import Decimal from 'decimal.js';
import type { SaisonnierParams } from '@shared/schemas.js';

/**
 * Location saisonniere revenue and operating charges for one year.
 *
 * CA per season bucket is entered directly by the user (see
 * SaisonnierSaisonSchema) — this module only aggregates it and applies the
 * operating-mode charges. `tauxOccupation` is informational (reporting) and
 * does not feed back into `caPeriode`.
 *
 * Mutually exclusive by `gestion`:
 *   SOI_MEME     -> commissionPlateforme (% of CA) + fraisMenageLingeAnnuel (flat)
 *   CONCIERGERIE -> fraisConciergeriePercent (% of CA) only — it already covers
 *                   mise en location, menage, linge and entretien, so no
 *                   platform commission is charged on top.
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

export function computeSaisonnierRevenue(params: SaisonnierParams): SaisonnierRevenue {
  const hauteSaison = new Decimal(params.hauteSaison.caPeriode);
  const moyenneSaison = new Decimal(params.moyenneSaison.caPeriode);
  const basseSaison = new Decimal(params.basseSaison.caPeriode);
  const caAnnuelBrut = hauteSaison.plus(moyenneSaison).plus(basseSaison);

  const isConciergerie = params.gestion === 'CONCIERGERIE';

  const commissionPlateforme = isConciergerie
    ? new Decimal(0)
    : caAnnuelBrut.mul(params.commissionPlateforme);

  const fraisMenageLinge = isConciergerie ? new Decimal(0) : new Decimal(params.fraisMenageLingeAnnuel);

  const fraisConciergerie = isConciergerie
    ? caAnnuelBrut.mul(params.fraisConciergeriePercent)
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
