import { describe, it, expect, beforeEach } from 'vitest';
import { ETAPES_IMMO, alertes, etapesVisibles } from '@/store/parcoursImmo';
import { PRET_PAR_DEFAUT, selectSharedInputs, useDirectStore, useScenarioStore } from '@/store/scenarioStore';

const ids = (s: Parameters<typeof etapesVisibles>[0]) => etapesVisibles(s).map((e) => e.id);

describe('parcours de saisie immobilier', () => {
  beforeEach(() => {
    useScenarioStore.getState().nouveau();
    useDirectStore.getState().nouveau();
  });

  it('should hide the financing step without a loan, and show it with one', () => {
    const s = useScenarioStore.getState();
    expect(ids({ ...s, asset: { ...s.asset, loan: undefined } })).not.toContain('financement');
    expect(ids({ ...s, asset: { ...s.asset, loan: PRET_PAR_DEFAUT } })).toContain('financement');
    expect(ETAPES_IMMO[0].id).toBe('projet');
    expect(ETAPES_IMMO.at(-1)!.id).toBe('resultat');
  });

  it('should warn on an empty price, a loan above the total cost and parts not totalling 100 %', () => {
    const s = useScenarioStore.getState();
    expect(alertes('bien', { ...s, asset: { ...s.asset, purchasePrice: '0' } })).toContain('Le prix d’achat est vide.');
    const trop = { ...s, asset: { ...s.asset, loan: { ...PRET_PAR_DEFAUT, principal: '99999999.00' } } };
    expect(alertes('financement', trop)).toContain('Le pret depasse le cout total de l’operation.');
    const parts = { ...s, associes: s.associes.map((a) => ({ ...a, partsPercent: 0.3 })) };
    expect(alertes('proprietaires', parts)).toContain('La repartition des parts doit totaliser 100 %.');
  });

  it('should raise nothing on the default inputs, so a new project starts clean', () => {
    const s = useScenarioStore.getState();
    for (const e of etapesVisibles(s)) expect(alertes(e.id, s), e.id).toEqual([]);
  });

  it('should start a new project on the first step, blank, with no result and no saved scenario', () => {
    const st = useScenarioStore.getState();
    st.updateAsset({ purchasePrice: '1.00' });
    st.setScenarioCourant({ id: 'x', nom: 'Ancien' });
    st.setVue('resultats');
    st.nouveau();
    const n = useScenarioStore.getState();
    expect(n.vue).toBe('parcours');
    expect(n.etape).toBe('projet');
    expect(n.etapesVues).toEqual(['projet']);
    expect(n.scenarioCourant).toBeNull();
    expect(n.asset.purchasePrice).not.toBe('1.00');
    expect(Object.values(n.results).every((r) => r === null)).toBe(true);
  });

  it('should open a saved scenario on the results, computed on arrival, its missing keys at default', () => {
    const avant = selectSharedInputs(useScenarioStore.getState());
    useScenarioStore.getState().ouvrir(
      { asset: { ...avant.asset, purchasePrice: '123456.00' } },
      { id: 'abc', nom: 'Studio Lyon' },
    );
    const o = useScenarioStore.getState();
    expect(o.vue).toBe('resultats');
    expect(o.lancerALArrivee).toBe(true);
    expect(o.scenarioCourant).toEqual({ id: 'abc', nom: 'Studio Lyon' });
    expect(o.asset.purchasePrice).toBe('123456.00');
    expect(o.params).toEqual(avant.params);
    expect(o.etapesVues).toEqual(ETAPES_IMMO.map((e) => e.id));
  });

  it('should keep each page on its own view', () => {
    useScenarioStore.getState().setVue('resultats');
    expect(useDirectStore.getState().vue).toBe('parcours');
  });

  it('should record each step opened once', () => {
    const st = useDirectStore.getState();
    st.setEtape('bien');
    st.setEtape('bien');
    st.setEtape('loyers');
    expect(useDirectStore.getState().etapesVues).toEqual(['projet', 'bien', 'loyers']);
  });
});
