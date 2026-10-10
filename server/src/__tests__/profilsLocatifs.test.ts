import { describe, it, expect } from 'vitest';
import { ScenarioProfile, SimulationRequestSchema } from '@shared/schemas.js';
import { ENTITY_SPECS, PROFILE_META, PROFILE_ORDER, PROFILS_DIRECT, PROFILS_SOCIETE } from '@/lib/profiles';
import { buildScenario, selectSharedInputs, useDirectStore, useScenarioStore } from '@/store/scenarioStore';
import { runSimulation } from '../engine/simulator.js';

const shared = () => selectSharedInputs(useScenarioStore.getState());

describe('profils des deux pages locatives', () => {
  it('should know every profile of the schema, in one display order', () => {
    expect([...PROFILE_ORDER].sort()).toEqual([...ScenarioProfile.options].sort());
    for (const p of PROFILE_ORDER) {
      expect(PROFILE_META[p].label).toBeTruthy();
      expect(ENTITY_SPECS[p].length).toBeGreaterThan(0);
    }
  });

  it('should keep companies on one page and direct holding on the other, nothing shared', () => {
    expect(PROFILS_DIRECT).toEqual(['NU_MICRO', 'NU_REEL', 'LMNP_MICRO', 'LMNP_REEL']);
    expect(PROFILS_SOCIETE).toEqual(['SCI_IR', 'SCI_IS_SEULE', 'SCI_IS_HOLDING']);
    expect(PROFILS_DIRECT.filter((p) => PROFILS_SOCIETE.includes(p))).toEqual([]);
  });

  it('should name each built entity as ENTITY_SPECS does, so cost overrides find it', () => {
    for (const p of PROFILE_ORDER) {
      const req = buildScenario(p, shared());
      const noms = req.structures.flatMap((s) => [s.name, ...(s.subsidiaries ?? []).map((f: { name: string }) => f.name)]);
      expect(noms, p).toEqual(ENTITY_SPECS[p].map((e) => e.name));
    }
  });
});

describe('location nue en direct', () => {
  it.each([
    ['NU_MICRO', 'MICRO_FONCIER'],
    ['NU_REEL', 'REEL'],
  ] as const)('%s should hold the walls directly, unfurnished, at %s', (profil, regime) => {
    const req = SimulationRequestSchema.parse(buildScenario(profil, shared()));
    const [s] = req.structures;
    expect(s).toMatchObject({ type: 'INDIVIDUAL', regimeFoncier: regime });
    expect(s.assets[0].mobilier).toBe('0.00');
    expect(req.params).toMatchObject({ dividendDistributionRate: 0, illiquidityDiscount: 0 });
  });

  it('should run end to end and owe no compte courant at the horizon', () => {
    const result = runSimulation(SimulationRequestSchema.parse(buildScenario('NU_REEL', shared())));
    const dernier = result.yearlyData.at(-1)!;
    expect(Object.values(dernier.entities).every((e) => e.ccaSolde === '0.00')).toBe(true);
  });
});

describe('deux saisies, une par page', () => {
  it('should keep the direct page’s inputs apart from the company page’s', () => {
    const avant = useScenarioStore.getState().asset.purchasePrice;
    useDirectStore.getState().updateAsset({ purchasePrice: '123456.00' });
    expect(useScenarioStore.getState().asset.purchasePrice).toBe(avant);
    expect(useDirectStore.getState().asset.purchasePrice).toBe('123456.00');
  });

  it('should start the direct page without any compte courant: there is no company to lend to', () => {
    const fresh = useDirectStore.getInitialState();
    expect(fresh.associes.every((a) => a.apportCompteCourant === '0.00')).toBe(true);
    const total = (xs: typeof fresh.associes) => xs.reduce((s, a) => s + parseFloat(a.apportCapital) + parseFloat(a.apportCompteCourant), 0);
    expect(total(fresh.associes)).toBe(total(useScenarioStore.getInitialState().associes));
  });

  it('should copy one page’s inputs into the other and ask it to run on arrival', () => {
    useDirectStore.getState().updateAsset({ purchasePrice: '222222.00' });
    const cible = useScenarioStore.getState();
    cible.hydrate(selectSharedInputs(useDirectStore.getState()));
    cible.setLancerALArrivee(true);
    expect(useScenarioStore.getState().asset.purchasePrice).toBe('222222.00');
    expect(useScenarioStore.getState().lancerALArrivee).toBe(true);
  });
});
