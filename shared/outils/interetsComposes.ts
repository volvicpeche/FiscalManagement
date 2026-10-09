import Decimal from 'decimal.js';

/**
 * Compound interest on a lump sum plus monthly deposits, made at the end of
 * each month.
 *
 * MENSUELLE: the balance earns rate/12 every month (nominal rate).
 * ANNUELLE: interest is credited once a year — on the opening balance for the
 * whole year, and on each deposit pro rata of the months it stayed in, the
 * way a French savings account (by quinzaine) roughly works.
 */

export type Capitalisation = 'MENSUELLE' | 'ANNUELLE';

export interface EntreeEpargne {
  capitalInitial: Decimal.Value;
  versementMensuel?: Decimal.Value;
  tauxAnnuel: Decimal.Value;
  annees: number;
  capitalisation: Capitalisation;
  /** Annual inflation, to express the final amount in today's euros. */
  inflation?: Decimal.Value;
}

export interface LigneEpargne {
  annee: number;
  /** Initial capital + deposits so far. */
  verse: Decimal;
  interets: Decimal;
  capital: Decimal;
  /** Capital in today's euros. */
  capitalReel: Decimal;
}

export interface ResultatEpargne {
  lignes: LigneEpargne[];
  capitalFinal: Decimal;
  totalVerse: Decimal;
  interets: Decimal;
  capitalFinalReel: Decimal;
  /** Years for a sum to double at this rate, or null at a zero rate. */
  anneesDoublement: Decimal | null;
}

const d = (v: Decimal.Value | undefined) => new Decimal(v ?? 0);

export function projeterEpargne(e: EntreeEpargne): ResultatEpargne {
  const taux = d(e.tauxAnnuel);
  const versement = d(e.versementMensuel);
  const inflation = d(e.inflation);
  const annees = Math.max(0, Math.min(100, Math.round(e.annees)));

  let capital = d(e.capitalInitial);
  let verse = capital;
  const lignes: LigneEpargne[] = [];

  for (let annee = 1; annee <= annees; annee++) {
    if (e.capitalisation === 'MENSUELLE') {
      const r = taux.div(12);
      for (let m = 0; m < 12; m++) capital = capital.mul(r.plus(1)).plus(versement);
    } else {
      // Deposit of month m (1..12) stays 12 − m months before the year closes.
      let interets = capital.mul(taux);
      for (let m = 1; m <= 12; m++) interets = interets.plus(versement.mul(taux).mul(12 - m).div(12));
      capital = capital.plus(versement.mul(12)).plus(interets);
    }
    verse = verse.plus(versement.mul(12));
    lignes.push({
      annee,
      verse,
      interets: capital.minus(verse),
      capital,
      capitalReel: capital.div(inflation.plus(1).pow(annee)),
    });
  }

  const tauxEffectif = e.capitalisation === 'MENSUELLE' ? taux.div(12).plus(1).pow(12).minus(1) : taux;
  return {
    lignes,
    capitalFinal: capital,
    totalVerse: verse,
    interets: capital.minus(verse),
    capitalFinalReel: capital.div(inflation.plus(1).pow(annees)),
    anneesDoublement: tauxEffectif.gt(0) ? new Decimal(2).ln().div(tauxEffectif.plus(1).ln()) : null,
  };
}
