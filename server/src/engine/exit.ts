import Decimal from 'decimal.js';
import type { AssocieInput, SocialChargeRegime } from '@shared/schemas.js';
import { computeCapitalGainIS, computeCapitalGainIR, computeIR, getSocialChargeRate } from './tax.js';

/**
 * What selling at the end of the horizon actually costs.
 *
 * This is where the comparison between regimes is decided, and it runs the
 * opposite way to the yearly figures. An SCI at IS pays almost no tax for
 * twenty years because it depreciates the building — but depreciation lowers
 * the book value, and the gain is computed against that book value, not the
 * purchase price. The tax saved along the way comes back at the exit.
 *
 * A projection that stops at the horizon without pricing the sale therefore
 * flatters the IS. These figures are reported alongside the IRR so the choice
 * is made on the whole cycle rather than on the comfortable part of it.
 */

export type ExitRegime = 'IS' | 'IR' | 'LMP';

export interface ExitResult {
  regime: ExitRegime;
  prixVente: Decimal;
  /** Purchase price + fees + works, less everything depreciated. IS and LMP. */
  valeurNetteComptable: Decimal;
  /** Acquisition cost used as the baseline at IR. */
  prixAcquisition: Decimal;
  plusValueBrute: Decimal;
  /** Portion that only exists because depreciation lowered the book value. */
  amortissementsRepris: Decimal;
  impot: Decimal;
  detteResiduelle: Decimal;
  /** Sale price, less the tax, less what is still owed to the bank. */
  produitNet: Decimal;
}

export interface ExitParams {
  prixVente: Decimal;
  prixAcquisition: Decimal;
  /** Bare purchase price, before fees and works — the base of the 15 % forfait. */
  prixAchat: Decimal;
  /** Works actually carried out, already inside `prixAcquisition`. */
  travauxReels: Decimal;
  /** Cost basis for book value: acquisition plus works. */
  baseAmortissable: Decimal;
  cumulAmortissements: Decimal;
  detteResiduelle: Decimal;
  dureeDetention: number;
  regimeSocial: SocialChargeRegime;
}

const PFU_IR_RATE = new Decimal('0.128');

function empty(regime: ExitRegime, p: ExitParams): ExitResult {
  return {
    regime,
    prixVente: p.prixVente,
    valeurNetteComptable: p.baseAmortissable.minus(p.cumulAmortissements),
    prixAcquisition: p.prixAcquisition,
    plusValueBrute: new Decimal(0),
    amortissementsRepris: new Decimal(0),
    impot: new Decimal(0),
    detteResiduelle: p.detteResiduelle,
    produitNet: p.prixVente.minus(p.detteResiduelle),
  };
}

/**
 * SCI at IS: the gain is measured against the net book value, so every euro
 * depreciated is a euro of gain at the exit. Taxed at the corporate rate.
 */
export function computeExitIS(p: ExitParams): ExitResult {
  const vnc = p.baseAmortissable.minus(p.cumulAmortissements);
  const { taxableGain, tax } = computeCapitalGainIS(p.prixVente, vnc);

  if (taxableGain.lte(0)) return empty('IS', p);

  return {
    regime: 'IS',
    prixVente: p.prixVente,
    valeurNetteComptable: vnc,
    prixAcquisition: p.prixAcquisition,
    plusValueBrute: taxableGain,
    // The share of the gain that exists purely because of depreciation.
    amortissementsRepris: Decimal.min(taxableGain, p.cumulAmortissements),
    impot: tax,
    detteResiduelle: p.detteResiduelle,
    produitNet: p.prixVente.minus(tax).minus(p.detteResiduelle),
  };
}

/**
 * SCI at IR: the gain is measured against the purchase price, and abatements
 * for holding period apply — full exemption from income tax after 22 years,
 * from social charges after 30.
 */
export function computeExitIR(p: ExitParams): ExitResult {
  // Past five years of holding the seller may value the works at a flat 15 %
  // of the purchase price instead of the invoices. It is an option, so the
  // more favourable of the two applies — here, a top-up when the real works
  // fall short of the forfait.
  const forfaitTravaux = p.dureeDetention > 5 ? p.prixAchat.mul('0.15') : new Decimal(0);
  const complementForfait = Decimal.max(new Decimal(0), forfaitTravaux.minus(p.travauxReels));
  const baseAcquisition = p.prixAcquisition.plus(complementForfait);

  const { taxableGain, total } = computeCapitalGainIR(
    p.prixVente,
    baseAcquisition,
    p.dureeDetention,
    p.regimeSocial,
  );

  if (taxableGain.lte(0)) return empty('IR', { ...p, prixAcquisition: baseAcquisition });

  return {
    regime: 'IR',
    prixVente: p.prixVente,
    valeurNetteComptable: p.baseAmortissable.minus(p.cumulAmortissements),
    // The basis actually used against the sale price, forfait included.
    prixAcquisition: baseAcquisition,
    plusValueBrute: taxableGain,
    // No depreciation at IR, so nothing is ever added back.
    amortissementsRepris: new Decimal(0),
    impot: total,
    detteResiduelle: p.detteResiduelle,
    produitNet: p.prixVente.minus(total).minus(p.detteResiduelle),
  };
}

/**
 * LMP: a professional capital gain, split in two.
 *
 * The short-term part — capped at the depreciation taken — goes back into the
 * BIC result and is taxed at the operator's own marginal rate plus TNS
 * contributions. The long-term part is taxed at 12,8 % plus social charges,
 * after the article 151 septies B abatement of 10 % per year of holding
 * beyond the fifth, which exempts it entirely at fifteen years.
 *
 * Simplification: the article 151 septies exemption (available below roughly
 * 90 000 EUR of annual receipts after five years of activity) is NOT applied.
 * For a small operation that qualifies, the real tax may be far lower — the
 * figure here is the unfavourable end of the range.
 */
export function computeExitLMP(
  p: ExitParams,
  associe: AssocieInput,
  tauxCotisationsTNS: Decimal,
): ExitResult {
  const vnc = p.baseAmortissable.minus(p.cumulAmortissements);
  const plusValue = p.prixVente.minus(vnc);

  if (plusValue.lte(0)) return empty('LMP', p);

  const courtTerme = Decimal.min(plusValue, p.cumulAmortissements);
  const longTermeBrut = plusValue.minus(courtTerme);

  // Article 151 septies B: the long-term share of a gain on a building used
  // for the business is abated 10 % per year of holding beyond the fifth, so
  // it is fully exempt at fifteen years. Over a long horizon this is most of
  // the LMP exit bill, and leaving it out made the regime look far worse than
  // it is.
  const abattement151B = Decimal.min(
    new Decimal(1),
    Decimal.max(new Decimal(0), new Decimal(p.dureeDetention - 5).mul('0.10')),
  );
  const longTerme = longTermeBrut.mul(new Decimal(1).minus(abattement151B));

  // Short-term: added to the operator's income, so taxed differentially.
  const autresRevenus = new Decimal(associe.autresRevenus);
  const irCourtTerme = computeIR(
    autresRevenus.plus(courtTerme),
    associe.maritalStatus,
    associe.childrenCount,
  ).minus(computeIR(autresRevenus, associe.maritalStatus, associe.childrenCount));
  const tnsCourtTerme = courtTerme.mul(tauxCotisationsTNS);

  // Long-term: flat 12,8 % plus social charges.
  const psRate = getSocialChargeRate(associe.socialChargeRegime);
  const impotLongTerme = longTerme.mul(PFU_IR_RATE.plus(psRate));

  const impot = irCourtTerme.plus(tnsCourtTerme).plus(impotLongTerme);

  return {
    regime: 'LMP',
    prixVente: p.prixVente,
    valeurNetteComptable: vnc,
    prixAcquisition: p.prixAcquisition,
    plusValueBrute: plusValue,
    amortissementsRepris: courtTerme,
    impot,
    detteResiduelle: p.detteResiduelle,
    produitNet: p.prixVente.minus(impot).minus(p.detteResiduelle),
  };
}
