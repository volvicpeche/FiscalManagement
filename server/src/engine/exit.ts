import Decimal from 'decimal.js';
import type { AssocieInput, SocialChargeRegime } from '@shared/schemas.js';
import {
  computeCapitalGainIS,
  computeCapitalGainIR,
  computeIRFoyer,
  computePFU,
  getSocialChargeRate,
} from './tax.js';

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

export type ExitRegime = 'IS' | 'IR' | 'LMP' | 'LMNP';

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
  /** Tax the COMPANY pays on the gain. Zero at IR and for an LMP. */
  impotSociete: Decimal;
  /**
   * Tax the ASSOCIES pay to get the money out. At IS this is the second floor
   * of the building: the company has paid its corporate tax, but the proceeds
   * are still inside it, and taking them home costs the flat tax on the boni
   * de liquidation. At IR and LMP the tax is already personal, so the whole
   * bill sits here.
   */
  impotAssocies: Decimal;
  /**
   * Sale proceeds after corporate tax and debt, plus the cash the companies
   * kept, less the comptes courants and the capital returned.
   */
  boniLiquidation: Decimal;
  /** The two floors added up — what leaving actually costs. */
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
  /** Share capital, handed back to the associes free of tax on a winding-up. */
  capitalSocial: Decimal;
  /**
   * IS only: cash still held by the companies at the horizon. It is made of
   * profits already taxed at IS but never distributed, so it is part of the
   * boni and pays the flat tax on the way out. Leaving it out flattered the
   * IS whenever the company kept its cash.
   */
  tresorerie?: Decimal;
  /**
   * IS only: what the companies still owe the associes at the horizon —
   * comptes courants not yet repaid, and the part of the apport they never
   * declared (it still came out of their pocket). Repaid before the boni is
   * measured, free of tax. Leaving it in taxed the associes' own money as if
   * it were profit.
   */
  comptesCourants?: Decimal;
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
    impotSociete: new Decimal(0),
    impotAssocies: new Decimal(0),
    boniLiquidation: new Decimal(0),
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
  const tresorerie = p.tresorerie ?? new Decimal(0);
  const comptesCourants = p.comptesCourants ?? new Decimal(0);

  // Second floor. The corporate tax leaves the money inside the company; the
  // associes still have to take it home. Winding the SCI up hands back the
  // comptes courants and the share capital free of tax, and taxes the rest —
  // the boni de liquidation, retained cash included — as a distribution.
  // Reporting only the corporate tax made the IS look cheaper to leave than
  // the IR, which settles in one go and is final. The boni exists even when
  // the building itself shows no gain, as long as the company kept profits.
  const produitApresIS = p.prixVente
    .minus(tax)
    .minus(p.detteResiduelle)
    .plus(tresorerie)
    .minus(comptesCourants);
  const boni = Decimal.max(new Decimal(0), produitApresIS.minus(p.capitalSocial));

  if (taxableGain.lte(0) && boni.lte(0)) return empty('IS', p);

  const impotAssocies = computePFU(boni, p.regimeSocial);
  const impot = tax.plus(impotAssocies);

  return {
    regime: 'IS',
    prixVente: p.prixVente,
    valeurNetteComptable: vnc,
    prixAcquisition: p.prixAcquisition,
    plusValueBrute: taxableGain,
    // The share of the gain that exists purely because of depreciation.
    amortissementsRepris: Decimal.min(taxableGain, p.cumulAmortissements),
    impotSociete: tax,
    impotAssocies,
    boniLiquidation: boni,
    impot,
    detteResiduelle: p.detteResiduelle,
    produitNet: p.prixVente.minus(impot).minus(p.detteResiduelle),
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
    // Translucent: the associes are taxed directly, the SCI pays nothing.
    impotSociete: new Decimal(0),
    impotAssocies: total,
    boniLiquidation: new Decimal(0),
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
  const irCourtTerme = computeIRFoyer(autresRevenus.plus(courtTerme), associe).minus(
    computeIRFoyer(autresRevenus, associe),
  );
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
    // A sole trader: the whole bill is personal, there is no company floor.
    impotSociete: new Decimal(0),
    impotAssocies: impot,
    boniLiquidation: new Decimal(0),
    impot,
    detteResiduelle: p.detteResiduelle,
    produitNet: p.prixVente.minus(impot).minus(p.detteResiduelle),
  };
}

/**
 * LMNP: a private capital gain, taxed like an SCI at IR — 19 % plus social
 * charges, with the holding-period abatements — but since the loi de finances
 * pour 2025 (art. 150 VB II CGI) the acquisition price is reduced by every
 * euro of depreciation actually deducted during the letting. Depreciation
 * still deferred at the sale was never deducted, so it is not added back.
 *
 * The holding-period abatements soften the add-back: past 22 years the
 * income-tax part is exempt whatever the depreciation, past 30 the social
 * charges too.
 *
 * Simplification: the exception for student, senior and EHPAD residences
 * (which keep the old rule) is not modelled.
 *
 * @param amortissementsDeduits - What the reel actually deducted. Zero under
 *   the micro-BIC, which knows no depreciation.
 */
export function computeExitLMNP(p: ExitParams, amortissementsDeduits: Decimal): ExitResult {
  const ir = computeExitIR({
    ...p,
    prixAcquisition: p.prixAcquisition.minus(amortissementsDeduits),
    cumulAmortissements: amortissementsDeduits,
  });

  return {
    ...ir,
    regime: 'LMNP',
    valeurNetteComptable: p.baseAmortissable.minus(amortissementsDeduits),
    amortissementsRepris: Decimal.min(ir.plusValueBrute, amortissementsDeduits),
  };
}
