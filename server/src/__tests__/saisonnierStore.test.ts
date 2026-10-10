import { describe, it, expect, beforeEach } from 'vitest';
import { ManagementMode, SimulationRequestSchema, StructureType } from '@shared/schemas.js';
import type { CostPresets } from '@/hooks/useCostPresets';
import {
  MONTAGES_SAISONNIER,
  associesSauves,
  buildSaisonnierRequests,
  donneesASauver,
  sarlFamillePossible,
  useSaisonnierStore,
} from '@/store/saisonnierStore';
import { getPresetCostLines } from '../engine/costs.js';
import { runSimulation } from '../engine/simulator.js';

/** The presets as /api/costs/presets serves them. */
function presets(): CostPresets {
  const out: Record<string, Record<string, unknown>> = {};
  for (const mode of ManagementMode.options) {
    out[mode] = {};
    const plat = (l: { label: string; montant: { toFixed: (n: number) => string } }) => ({ label: l.label, montant: l.montant.toFixed(2) });
    for (const type of StructureType.options) {
      const lines = getPresetCostLines(mode, type);
      out[mode][type] = { constitution: lines.constitution.map(plat), annuel: lines.annuel.map(plat) };
    }
    const micro = getPresetCostLines(mode, 'LMNP', 'MICRO_BIC');
    out[mode].LMNP_MICRO_BIC = { constitution: micro.constitution.map(plat), annuel: micro.annuel.map(plat) };
  }
  return out as CostPresets;
}

const etatInitial = useSaisonnierStore.getState();
beforeEach(() => useSaisonnierStore.setState(etatInitial, true));

describe('buildSaisonnierRequests — trois montages', () => {
  it('should build three valid requests from one set of inputs', () => {
    const r = buildSaisonnierRequests(useSaisonnierStore.getState(), presets());
    expect(Object.keys(r)).toEqual(MONTAGES_SAISONNIER);
    for (const m of MONTAGES_SAISONNIER) expect(() => SimulationRequestSchema.parse(r[m]), m).not.toThrow();
  });

  it('should hold it directly with the status left to the engine, and the SARL always at the reel', () => {
    useSaisonnierStore.getState().setRegimeLMNP('MICRO_BIC');
    const r = buildSaisonnierRequests(useSaisonnierStore.getState(), presets());
    expect(r.DIRECT.structures[0]).toMatchObject({ type: 'LMNP', statutMeubleAuto: true, regimeLMNP: 'MICRO_BIC' });
    expect(r.SARL_FAMILLE.structures[0]).toMatchObject({ type: 'LMNP', statutMeubleAuto: true, regimeLMNP: 'REEL' });
    expect(r.SOCIETE_IS.structures[0]).toMatchObject({ type: 'SCI_IS', taxRegime: 'IS' });
  });

  it('should give the SARL de famille a company’s setup costs and an LMP’s yearly books', () => {
    const p = presets();
    const r = buildSaisonnierRequests(useSaisonnierStore.getState(), p);
    const mode = useSaisonnierStore.getState().managementMode;
    expect(r.SARL_FAMILLE.structures[0].costs).toEqual({ mode, constitution: p[mode].SCI_IS.constitution, annuel: p[mode].LMP.annuel });
    expect(r.SARL_FAMILLE.structures[0].costs!.constitution.length).toBeGreaterThan(0);
  });

  it('should distribute everything at IS and nothing held directly', () => {
    const r = buildSaisonnierRequests(useSaisonnierStore.getState(), presets());
    expect(r.SOCIETE_IS.params.dividendDistributionRate).toBe(1);
    expect(r.DIRECT.params).toMatchObject({ dividendDistributionRate: 0, illiquidityDiscount: 0 });
  });

  it('should run all three end to end', () => {
    const r = buildSaisonnierRequests(useSaisonnierStore.getState(), presets());
    for (const m of MONTAGES_SAISONNIER) {
      const res = runSimulation(SimulationRequestSchema.parse(r[m]));
      expect(res.yearlyData.length, m).toBeGreaterThan(1);
    }
  });
});

describe('associes et SARL de famille', () => {
  it('should allow a SARL de famille between parents, children and siblings only', () => {
    const s = useSaisonnierStore.getState();
    s.addAssocie();
    expect(sarlFamillePossible(useSaisonnierStore.getState().associes)).toBe(true);
    useSaisonnierStore.getState().updateAssocie(1, { relation: 'OTHER' });
    expect(sarlFamillePossible(useSaisonnierStore.getState().associes)).toBe(false);
  });

  it('should keep the parts at 100 % when an associe joins', () => {
    useSaisonnierStore.getState().addAssocie();
    const total = useSaisonnierStore.getState().associes.reduce((a, x) => a + x.partsPercent, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe('scenarios enregistres', () => {
  it('should turn an older save’s single owner into the only associe, dropping its chosen status', () => {
    const ancien = { ...etatInitial.associes[0], nom: 'Florian', partsPercent: 0.4, relation: 'OTHER' as const };
    useSaisonnierStore.getState().hydrate({ proprietaire: ancien, statut: 'LMP' });
    const { associes } = useSaisonnierStore.getState();
    expect(associes).toEqual([{ ...ancien, relation: 'SELF', partsPercent: 1 }]);
  });

  it('should save and reload every input', () => {
    useSaisonnierStore.getState().setParahotellerie(true);
    useSaisonnierStore.getState().addAssocie();
    const sauve = donneesASauver(useSaisonnierStore.getState());
    useSaisonnierStore.setState(etatInitial, true);
    useSaisonnierStore.getState().hydrate(JSON.parse(JSON.stringify(sauve)));
    expect(donneesASauver(useSaisonnierStore.getState())).toEqual(sauve);
    expect(associesSauves({})).toBeUndefined();
  });
});
