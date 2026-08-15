import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { resolveCosts, getPresetCostLines, indexedAnnualCost } from '../costs.js';

describe('resolveCosts — constitution', () => {
  it('should charge nothing for statutes when the user does it themselves', () => {
    const costs = resolveCosts('SOI_MEME', 'SCI_IR');
    const statuts = costs.lignesConstitution.find((l) => l.label.startsWith('Redaction'));
    expect(statuts?.montant.toNumber()).toBe(0);
  });

  it('should still charge the mandatory formalities in SOI_MEME mode', () => {
    // Annonce legale + greffe are legal requirements, not optional services.
    const costs = resolveCosts('SOI_MEME', 'SCI_IR');
    expect(costs.constitution.toNumber()).toBe(185 + 70);
  });

  it('should increase with the level of professional involvement', () => {
    const soiMeme = resolveCosts('SOI_MEME', 'SCI_IS').constitution;
    const enLigne = resolveCosts('EN_LIGNE', 'SCI_IS').constitution;
    const ec = resolveCosts('EXPERT_COMPTABLE', 'SCI_IS').constitution;
    const notaire = resolveCosts('NOTAIRE_AVOCAT', 'SCI_IS').constitution;

    expect(enLigne.gt(soiMeme)).toBe(true);
    expect(ec.gt(enLigne)).toBe(true);
    expect(notaire.gt(ec)).toBe(true);
  });

  it('should cost more to incorporate a holding than an SCI', () => {
    const sci = resolveCosts('EXPERT_COMPTABLE', 'SCI_IS').constitution;
    const holding = resolveCosts('EXPERT_COMPTABLE', 'HOLDING').constitution;
    expect(holding.gt(sci)).toBe(true);
  });
});

describe('resolveCosts — annual', () => {
  it('should be cheaper to run an SCI at IR than at IS', () => {
    // No commercial bookkeeping, and location nue is outside the scope of CFE.
    const ir = resolveCosts('EXPERT_COMPTABLE', 'SCI_IR').annuel;
    const is = resolveCosts('EXPERT_COMPTABLE', 'SCI_IS').annuel;
    expect(is.gt(ir)).toBe(true);
  });

  it('should charge no CFE at IR but charge it at IS', () => {
    const ir = resolveCosts('EXPERT_COMPTABLE', 'SCI_IR');
    const is = resolveCosts('EXPERT_COMPTABLE', 'SCI_IS');
    expect(ir.lignesAnnuel.find((l) => l.label === 'CFE')?.montant.toNumber()).toBe(0);
    expect(is.lignesAnnuel.find((l) => l.label === 'CFE')?.montant.toNumber()).toBe(250);
  });

  it('should not charge PNO insurance to a holding, which owns no walls', () => {
    const holding = resolveCosts('EXPERT_COMPTABLE', 'HOLDING');
    expect(holding.lignesAnnuel.some((l) => l.label.includes('PNO'))).toBe(false);
  });

  it('should charge consolidation work to a holding only', () => {
    const holding = resolveCosts('EXPERT_COMPTABLE', 'HOLDING');
    const sci = resolveCosts('EXPERT_COMPTABLE', 'SCI_IS');
    expect(holding.lignesAnnuel.some((l) => l.label.includes('Consolidation'))).toBe(true);
    expect(sci.lignesAnnuel.some((l) => l.label.includes('Consolidation'))).toBe(false);
  });

  it('should reduce to zero for direct individual ownership', () => {
    const individual = resolveCosts('EXPERT_COMPTABLE', 'INDIVIDUAL');
    expect(individual.constitution.toNumber()).toBe(0);
    expect(individual.annuel.toNumber()).toBe(0);
  });

  it('should still bill the accounting under NOTAIRE_AVOCAT — a notaire keeps no books', () => {
    const notaire = resolveCosts('NOTAIRE_AVOCAT', 'SCI_IS');
    const ec = resolveCosts('EXPERT_COMPTABLE', 'SCI_IS');
    const compta = (r: typeof notaire) =>
      r.lignesAnnuel.find((l) => l.label.startsWith('Comptabilite'))?.montant.toNumber();
    expect(compta(notaire)).toBe(compta(ec));
  });
});

describe('resolveCosts — SCI_IS_HOLDING profile', () => {
  it('should roughly double the structure cost versus an SCI alone', () => {
    // The tree carries two entities, each with its own costs.
    const sci = resolveCosts('EXPERT_COMPTABLE', 'SCI_IS');
    const holding = resolveCosts('EXPERT_COMPTABLE', 'HOLDING');

    const combined = sci.annuel.plus(holding.annuel);
    expect(combined.gt(sci.annuel.mul('1.8'))).toBe(true);
    expect(combined.lt(sci.annuel.mul('2.5'))).toBe(true);
  });
});

describe('resolveCosts — overrides', () => {
  it('should replace the preset entirely when overrides are provided', () => {
    const costs = resolveCosts('EXPERT_COMPTABLE', 'SCI_IS', {
      annuel: [{ label: 'Forfait negocie', montant: '600.00' }],
    });
    expect(costs.annuel.toNumber()).toBe(600);
    expect(costs.lignesAnnuel).toHaveLength(1);
  });

  it('should fall back to the preset for the block that is not overridden', () => {
    const preset = resolveCosts('EN_LIGNE', 'SCI_IS');
    const costs = resolveCosts('EN_LIGNE', 'SCI_IS', {
      constitution: [{ label: 'Pack complet', montant: '990.00' }],
    });
    expect(costs.constitution.toNumber()).toBe(990);
    expect(costs.annuel.toNumber()).toBe(preset.annuel.toNumber());
  });

  it('should ignore empty override arrays', () => {
    const preset = resolveCosts('EN_LIGNE', 'SCI_IR');
    const costs = resolveCosts('EN_LIGNE', 'SCI_IR', { constitution: [], annuel: [] });
    expect(costs.constitution.toNumber()).toBe(preset.constitution.toNumber());
    expect(costs.annuel.toNumber()).toBe(preset.annuel.toNumber());
  });
});

describe('getPresetCostLines', () => {
  it('should expose every line individually so the UI can edit them', () => {
    const lines = getPresetCostLines('EXPERT_COMPTABLE', 'SCI_IS');
    expect(lines.constitution.length).toBeGreaterThan(0);
    expect(lines.annuel.length).toBeGreaterThan(0);
    for (const l of [...lines.constitution, ...lines.annuel]) {
      expect(l.label.length).toBeGreaterThan(0);
      expect(l.montant).toBeInstanceOf(Decimal);
    }
  });
});

describe('indexedAnnualCost', () => {
  it('should leave year 1 unindexed', () => {
    const cost = indexedAnnualCost(new Decimal('1000'), 1, new Decimal('0.02'));
    expect(cost.toNumber()).toBe(1000);
  });

  it('should compound inflation from year 2 onwards', () => {
    const cost = indexedAnnualCost(new Decimal('1000'), 3, new Decimal('0.02'));
    expect(cost.toNumber()).toBeCloseTo(1040.4, 2);
  });

  it('should return 0 for year 0 — the company is not running yet', () => {
    expect(indexedAnnualCost(new Decimal('1000'), 0, new Decimal('0.02')).toNumber()).toBe(0);
  });
});
