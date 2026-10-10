import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import type { AssocieInput, SimulationRequest, SimulationResult, StructureInput } from '@shared/schemas.js';
import { computeExitLMP, tauxExoneration151Septies, type ExitParams } from '../exit.js';
import { runSimulation } from '../simulator.js';

describe('tauxExoneration151Septies', () => {
  const t = (recettes: number, duree = 10, para = false) =>
    tauxExoneration151Septies(new Decimal(recettes), duree, para).toNumber();

  it('should exempt everything up to 90 000 EUR, nothing from 126 000, linearly in between', () => {
    expect(t(90000)).toBe(1);
    expect(t(108000)).toBeCloseTo(0.5, 10);
    expect(t(126000)).toBe(0);
  });

  it('should need five years of activity', () => {
    expect(t(10000, 4)).toBe(0);
    expect(t(10000, 5)).toBe(1);
  });

  it('should use the 250 000 / 350 000 thresholds with para-hotel services', () => {
    expect(t(200000, 10, true)).toBe(1);
    expect(t(300000, 10, true)).toBeCloseTo(0.5, 10);
  });
});

describe('computeExitLMP — art. 151 septies', () => {
  const p: ExitParams = {
    prixVente: new Decimal(500000),
    prixAcquisition: new Decimal(400000),
    prixAchat: new Decimal(380000),
    travauxReels: new Decimal(0),
    baseAmortissable: new Decimal(400000),
    cumulAmortissements: new Decimal(150000),
    detteResiduelle: new Decimal(0),
    dureeDetention: 10,
    regimeSocial: 'STANDARD',
    capitalSocial: new Decimal(0),
  };
  const vendeur: AssocieInput = {
    nom: 'Vous', partsPercent: 1, relation: 'SELF', maritalStatus: 'SINGLE', childrenCount: 0,
    autresRevenus: '30000.00', socialChargeRegime: 'STANDARD', apportCapital: '0.00', apportCompteCourant: '0.00', tauxInteretCCA: 0,
  };

  it('should tax nothing for a small operation after five years', () => {
    const r = computeExitLMP(p, vendeur, new Decimal('0.35'), { recettesAnnuelles: new Decimal(40000) });
    expect(r.impot.toNumber()).toBe(0);
    expect(r.plusValueBrute.toNumber()).toBe(250000);
  });

  it('should tax half of it at mid-range, and all of it above', () => {
    const plein = computeExitLMP(p, vendeur, new Decimal('0.35'), { recettesAnnuelles: new Decimal(200000) }).impot;
    const moitie = computeExitLMP(p, vendeur, new Decimal('0.35'), { recettesAnnuelles: new Decimal(108000) }).impot;
    expect(plein.gt(0)).toBe(true);
    expect(moitie.gt(0)).toBe(true);
    expect(moitie.lt(plein)).toBe(true);
  });
});

// ─── In the projection ───────────────────────────────────────────────────────

const vous = (over: Partial<AssocieInput> = {}): AssocieInput => ({
  nom: 'Vous', partsPercent: 1, relation: 'SELF', maritalStatus: 'SINGLE', childrenCount: 0,
  autresRevenus: '20000.00', socialChargeRegime: 'STANDARD', apportCapital: '0.00', apportCompteCourant: '0.00', tauxInteretCCA: 0,
  ...over,
});

function gite(ca: number, structure: Partial<StructureInput> = {}, associe = vous()): SimulationRequest {
  return {
    userProfile: { maritalStatus: 'SINGLE', childrenCount: 0, socialChargeRegime: 'STANDARD', autresRevenus: associe.autresRevenus },
    structures: [
      {
        name: 'Gite',
        type: 'LMNP',
        taxRegime: 'IR',
        ownershipShare: 1,
        tauxCotisationsSocialesLMP: 0.35,
        cotisationsMinimalesLMP: '1200.00',
        regimeLMNP: 'REEL',
        statutMeubleAuto: true,
        associes: [associe],
        costs: { mode: 'SOI_MEME', constitution: [{ label: 'Aucun', montant: '0.00' }], annuel: [{ label: 'Aucun', montant: '0.00' }] },
        assets: [
          {
            type: 'REAL_ESTATE', label: 'Mas', purchasePrice: '300000.00', notaryFees: '24000.00', renovationCosts: '0.00',
            mobilier: '10000.00', acquisitionDate: '2026-01-01T00:00:00.000Z', annualRent: '0.00',
            chargesYearly: '3000.00', propertyTax: '1500.00', landRatio: 0.15,
            saisonnier: {
              hauteSaison: { tauxOccupation: 0.9, caPeriode: (ca * 0.6).toFixed(2) },
              moyenneSaison: { tauxOccupation: 0.6, caPeriode: (ca * 0.3).toFixed(2) },
              basseSaison: { tauxOccupation: 0.3, caPeriode: (ca * 0.1).toFixed(2) },
              gestion: 'SOI_MEME', commissionPlateforme: 0.03, fraisMenageLingeAnnuel: '0.00', fraisConciergeriePercent: 0,
            },
          },
        ],
        subsidiaries: [],
        ...structure,
      },
    ],
    params: {
      horizonYears: 20, inflationRate: 0.02, propertyGrowth: 0.02, rentGrowthRate: 0, chargesGrowthRate: 0,
      propertyTaxGrowthRate: 0, dividendDistributionRate: 0, ccaRepaymentRate: 0, illiquidityDiscount: 0,
      demembrement: false, objectif: 'TRANSMISSION',
    },
  };
}

const an1 = (r: SimulationResult) => r.yearlyData.find((y) => y.year === 1)!.entities['Gite'];

describe('statut du loueur en meuble decide par le moteur — art. 155 IV', () => {
  it('should be LMP above 23 000 EUR of receipts that exceed the other activity income', () => {
    expect(an1(runSimulation(gite(30000))).statutMeuble).toBe('LMP');
  });

  it('should stay LMNP when the other income is higher, or the receipts below 23 000 EUR', () => {
    expect(an1(runSimulation(gite(30000, {}, vous({ autresRevenus: '60000.00' })))).statutMeuble).toBe('LMNP');
    expect(an1(runSimulation(gite(20000, {}, vous({ autresRevenus: '0.00' })))).statutMeuble).toBe('LMNP');
  });

  it('should count a Swiss salary as activity income', () => {
    const frontalier = vous({ autresRevenus: '0.00', revenusExoneres: '80000.00' });
    expect(an1(runSimulation(gite(30000, {}, frontalier))).statutMeuble).toBe('LMNP');
  });

  it('should leave the declared type alone without the option', () => {
    expect(an1(runSimulation(gite(30000, { statutMeubleAuto: false }))).statutMeuble).toBeUndefined();
  });
});

describe('LMP a la revente et a l’IFI', () => {
  it('should owe no exit tax on a small gite held twenty years', () => {
    const r = runSimulation(gite(30000));
    expect(r.summary.sortie.regime).toBe('LMP');
    expect(r.summary.sortie.impot).toBe('0.00');
    expect(parseFloat(r.summary.sortie.plusValueBrute)).toBeGreaterThan(0);
  });

  it('should take the walls out of the IFI when the profit exceeds the other income', () => {
    const rentable = gite(90000);
    rentable.structures[0].assets[0].purchasePrice = '100000.00';
    const r = an1(runSimulation(rentable));
    expect(r.statutMeuble).toBe('LMP');
    expect(parseFloat(r.taxableProfit)).toBeGreaterThan(20000);
    expect(r.ifiExonere).toBe(true);
  });

  it('should keep the walls in the IFI while depreciation leaves no profit', () => {
    const r = runSimulation(gite(30000));
    expect(an1(r).ifiExonere).toBe(false);
  });
});
