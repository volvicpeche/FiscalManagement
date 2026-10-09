import Decimal from 'decimal.js';
import { computeAssetYields } from '../yield.js';
import { mensualite, tauxNotaire, type TypeBien } from './credit.js';

/**
 * Quick rental yield, before tax: what the property returns, and what is
 * left each month once the loan is paid. Tax depends on the montage and is
 * the advanced simulators' job — this one stays a back-of-the-envelope.
 */

export interface EntreeRendement {
  prix: Decimal.Value;
  typeBien: TypeBien;
  tauxNotaire?: Decimal.Value;
  travaux?: Decimal.Value;
  loyerMensuel: Decimal.Value;
  /** Months without a tenant per year, 0 to 12. */
  vacanceMois?: Decimal.Value;
  /** Owner's non-recoverable charges per year (copro, insurance, management...). */
  chargesAnnuelles?: Decimal.Value;
  taxeFonciere?: Decimal.Value;
  /** Absent: bought cash. */
  credit?: { apport?: Decimal.Value; taux: Decimal.Value; annees: number; tauxAssurance?: Decimal.Value };
}

export interface ResultatRendement {
  coutTotal: Decimal;
  loyerAnnuelEncaisse: Decimal;
  /** Full rent over the price: the agency's figure. */
  brute: Decimal;
  /** Rent actually collected, net of charges, over the total cost. */
  nette: Decimal;
  loyerNetMensuel: Decimal;
  capital: Decimal;
  mensualiteCredit: Decimal;
  /** Net rent minus the loan, per month, before tax. */
  cashFlowMensuel: Decimal;
}

const d = (v: Decimal.Value | undefined) => new Decimal(v ?? 0);

export function rendementRapide(e: EntreeRendement): ResultatRendement {
  const prix = d(e.prix);
  const vacance = Decimal.min(12, Decimal.max(0, d(e.vacanceMois)));
  const loyerAnnuelEncaisse = d(e.loyerMensuel).mul(new Decimal(12).minus(vacance));

  const y = computeAssetYields({
    purchasePrice: prix.toFixed(2),
    notaryFees: prix.mul(tauxNotaire(e)).toFixed(2),
    renovationCosts: d(e.travaux).toFixed(2),
    annualRent: loyerAnnuelEncaisse.toFixed(2),
    chargesYearly: d(e.chargesAnnuelles).toFixed(2),
    propertyTax: d(e.taxeFonciere).toFixed(2),
  });

  const loyerNetMensuel = y.loyerNet.div(12);
  let capital = new Decimal(0);
  let mensualiteCredit = new Decimal(0);
  if (e.credit) {
    capital = Decimal.max(0, y.coutTotal.minus(d(e.credit.apport)));
    const mois = Math.max(0, Math.round(e.credit.annees * 12));
    mensualiteCredit = mensualite(capital, e.credit.taux, mois).plus(capital.mul(d(e.credit.tauxAssurance)).div(12));
  }

  return {
    coutTotal: y.coutTotal,
    loyerAnnuelEncaisse,
    brute: prix.gt(0) ? d(e.loyerMensuel).mul(12).div(prix) : new Decimal(0),
    nette: y.nette,
    loyerNetMensuel,
    capital,
    mensualiteCredit,
    cashFlowMensuel: loyerNetMensuel.minus(mensualiteCredit),
  };
}
