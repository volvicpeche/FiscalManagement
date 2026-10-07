import { describe, it, expect, beforeEach } from 'vitest';
import { buildFrontalierRequest, useFrontalierStore } from '@/store/frontalierStore';

const store = () => useFrontalierStore.getState();
const etatInitial = useFrontalierStore.getState();

beforeEach(() => useFrontalierStore.setState(etatInitial, true));

describe('frontalierStore — travaux', () => {
  it('should create the principal residence when works are added with no property', () => {
    store().addTravaux();
    expect(store().biensFrance).toHaveLength(1);
    expect(store().biensFrance[0].usage).toBe('RESIDENCE_PRINCIPALE');
    expect(store().travauxActifs).toBe(true);
  });

  it('should total the lines per property and category in the request', () => {
    store().addTravaux();
    store().addTravaux();
    const [a, b] = store().travaux;
    store().updateTravaux(a.id, { montantEur: '8000.00', categorie: 'ENTRETIEN' });
    store().updateTravaux(b.id, { montantEur: '3000.00', categorie: 'PLUS_VALUE' });

    const [bien] = buildFrontalierRequest(store()).biensFrance!;
    expect(bien.travauxEntretienEur).toBe('8000.00');
    expect(bien.travauxPlusValueEur).toBe('3000.00');
    expect(bien.travauxEnergieEur).toBe('0.00');
  });

  it('should send no works while the switch is off, and keep the lines', () => {
    store().addTravaux();
    store().updateTravaux(store().travaux[0].id, { montantEur: '8000.00' });
    store().setTravauxActifs(false);

    expect(buildFrontalierRequest(store()).biensFrance![0].travauxEntretienEur).toBe('0.00');
    expect(store().travaux).toHaveLength(1);
  });

  it('should drop the works of a removed property and re-point the others', () => {
    store().addBien();
    store().addBien();
    store().addTravaux();
    store().addTravaux();
    const [a, b] = store().travaux;
    store().updateTravaux(a.id, { bien: 0 });
    store().updateTravaux(b.id, { bien: 1 });

    store().removeBien(0);
    expect(store().travaux).toHaveLength(1);
    expect(store().travaux[0].bien).toBe(0);
  });

  it('should turn works saved inside a property into lines', () => {
    store().hydrate({
      biensFrance: [
        { travauxEur: '5000.00', usage: 'RESIDENCE_PRINCIPALE' } as never,
        { usage: 'LOCATIF', travauxEnergieEur: '2000.00' } as never,
      ],
    });
    const lignes = store().travaux;
    expect(lignes.map((l) => [l.bien, l.categorie, l.montantEur])).toEqual([
      [0, 'ENTRETIEN', '5000.00'],
      [1, 'ENERGIE', '2000.00'],
    ]);
    expect(store().travauxActifs).toBe(true);
    expect(store().biensFrance[1].travauxEnergieEur).toBe('0.00');
  });
});

describe('frontalierStore — canton de travail', () => {
  it('should send the canton, Geneva by default', () => {
    expect(buildFrontalierRequest(store()).canton).toBe('GE');
  });

  it('should load a scenario saved before the canton choice as Geneva', () => {
    useFrontalierStore.setState({ canton: 'ZH' });
    store().hydrate({ etatCivil: 'MARIE' });
    expect(store().canton).toBe('GE');
  });
});

describe('frontalierStore — profil du parcours', () => {
  it('should start a list with an empty line when the answer becomes yes', () => {
    store().updateProfil({ enfants: true, revenusFrance: true });
    expect(store().enfants).toHaveLength(1);
    expect(store().biensFrance).toHaveLength(1);
  });

  it('should leave children and French income out of the request on a no, and keep them', () => {
    store().updateProfil({ enfants: true, revenusFrance: true });
    store().updateFoyer({ autresRevenusEtrangersEur: '1000.00' });
    store().updateProfil({ enfants: false, revenusFrance: false });

    const req = buildFrontalierRequest(store());
    expect(req.enfants).toEqual([]);
    expect(req.biensFrance).toEqual([]);
    expect(req.autresRevenusEtrangersEur).toBe('0.00');
    expect(store().enfants).toHaveLength(1);
    expect(store().biensFrance).toHaveLength(1);

    store().updateProfil({ revenusFrance: true });
    expect(buildFrontalierRequest(store()).biensFrance).toHaveLength(1);
  });

  it('should derive the profile of a scenario saved before the wizard', () => {
    store().hydrate({ enfants: [{ age: 3, fraisGarde: '0.00' }], biensFrance: [], autresRevenusEtrangersEur: '500.00' });
    expect(store().profil).toEqual({ enfants: true, revenusFrance: true });
  });
});
