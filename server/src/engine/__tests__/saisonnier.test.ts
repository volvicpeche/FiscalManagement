import { describe, it, expect } from 'vitest';
import type { SaisonnierParams } from '@shared/schemas.js';
import { computeSaisonnierRevenue } from '../saisonnier.js';

function baseParams(overrides: Partial<SaisonnierParams> = {}): SaisonnierParams {
  return {
    hauteSaison: { tauxOccupation: 0.9, caPeriode: '18000.00' },
    moyenneSaison: { tauxOccupation: 0.6, caPeriode: '9000.00' },
    basseSaison: { tauxOccupation: 0.3, caPeriode: '3000.00' },
    gestion: 'SOI_MEME',
    commissionPlateforme: 0.15,
    fraisMenageLingeAnnuel: '2000.00',
    fraisConciergeriePercent: 0.25,
    ...overrides,
  };
}

describe('computeSaisonnierRevenue — CA', () => {
  it('should sum the three season buckets into the gross annual CA', () => {
    const result = computeSaisonnierRevenue(baseParams());
    expect(result.caAnnuelBrut.toNumber()).toBe(18000 + 9000 + 3000);
  });
});

describe('computeSaisonnierRevenue — SOI_MEME', () => {
  it('should charge the platform commission on the gross CA', () => {
    const result = computeSaisonnierRevenue(baseParams());
    expect(result.commissionPlateforme.toNumber()).toBe(30000 * 0.15);
  });

  it('should add the flat menage/linge cost on top of the commission', () => {
    const result = computeSaisonnierRevenue(baseParams());
    expect(result.fraisMenageLinge.toNumber()).toBe(2000);
    expect(result.fraisConciergerie.toNumber()).toBe(0);
    expect(result.totalFraisExploitation.toNumber()).toBe(30000 * 0.15 + 2000);
  });
});

describe('computeSaisonnierRevenue — CONCIERGERIE', () => {
  it('should keep the platform commission and charge the conciergerie on the CA net of it', () => {
    const result = computeSaisonnierRevenue(baseParams({ gestion: 'CONCIERGERIE' }));
    expect(result.commissionPlateforme.toNumber()).toBe(30000 * 0.15);
    expect(result.fraisMenageLinge.toNumber()).toBe(0);
    expect(result.fraisConciergerie.toNumber()).toBe((30000 - 4500) * 0.25);
    expect(result.totalFraisExploitation.toNumber()).toBe(4500 + 6375);
  });

  it('should cost more than running it oneself on these numbers', () => {
    const soiMeme = computeSaisonnierRevenue(baseParams());
    const conciergerie = computeSaisonnierRevenue(baseParams({ gestion: 'CONCIERGERIE' }));
    // 4 500 + 6 375 = 10 875 against 4 500 + 2 000 = 6 500.
    expect(conciergerie.totalFraisExploitation.toNumber()).toBe(10875);
    expect(soiMeme.totalFraisExploitation.toNumber()).toBe(6500);
  });
});

describe('computeSaisonnierRevenue — nuits × occupation × prix', () => {
  it('should derive the CA of a season from its nights, occupancy and price', () => {
    const result = computeSaisonnierRevenue(
      baseParams({
        hauteSaison: { tauxOccupation: 0.8, caPeriode: '0.00', nuits: 90, prixNuit: '150.00' },
      }),
    );
    expect(result.caParSaison.hauteSaison.toNumber()).toBe(90 * 0.8 * 150);
  });

  it('should keep the typed CA when the price per night is missing', () => {
    const result = computeSaisonnierRevenue(
      baseParams({ hauteSaison: { tauxOccupation: 0.8, caPeriode: '18000.00', nuits: 90 } }),
    );
    expect(result.caParSaison.hauteSaison.toNumber()).toBe(18000);
  });
});

describe('computeSaisonnierRevenue — net', () => {
  it('should compute caNetExploitation as CA minus total operating fees', () => {
    const result = computeSaisonnierRevenue(baseParams());
    expect(result.caNetExploitation.toNumber()).toBe(30000 - result.totalFraisExploitation.toNumber());
  });
});
