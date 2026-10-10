import { describe, it, expect } from 'vitest';
import { FrontalierRequestSchema, PrevoyanceRequestSchema } from '@shared/frontalier.js';
import { SAISIE_VIDE, VERSEMENTS_DEFAUT, buildPrevoyanceRequest, foyerSimple, type SaisieSimple } from '@/store/prevoyanceStore';
import { simulerPrevoyance } from '../engine/frontalier/index.js';

const saisie = (over: Partial<SaisieSimple> = {}): SaisieSimple => ({
  ...SAISIE_VIDE,
  salaireBrut: '100000.00',
  cotisationsSociales: '7400.00',
  lppOrdinaire: '5000.00',
  ...over,
});

describe('foyerSimple', () => {
  it.each(['AUCUNE', 'FRANCE', 'SUISSE'] as const)('should build a valid household for a married couple, spouse %s', (activite) => {
    const req = FrontalierRequestSchema.parse(
      foyerSimple(saisie({ etatCivil: 'MARIE', conjointActivite: activite, conjointRevenuBrut: '40000.00', conjointRevenuNetEur: '31000.00' })),
    );
    expect(req.conjoint?.activite).toBe(activite);
    if (activite === 'FRANCE') expect(req.conjoint?.revenuFranceNetEur).toBe('31000.00');
    if (activite === 'SUISSE') expect(req.conjoint?.salaireBrut).toBe('40000.00');
  });

  it('should leave the spouse out for a single person, whatever was typed', () => {
    expect(foyerSimple(saisie({ conjointActivite: 'SUISSE', conjointRevenuBrut: '40000.00' })).conjoint).toBeUndefined();
  });

  it('should count the children, without childcare costs', () => {
    const req = FrontalierRequestSchema.parse(foyerSimple(saisie({ enfants: 2 })));
    expect(req.enfants).toEqual([
      { age: 10, fraisGarde: '0.00' },
      { age: 10, fraisGarde: '0.00' },
    ]);
  });
});

describe('buildPrevoyanceRequest', () => {
  it('should leave out an unknown buy-back potential, and run end to end', () => {
    const req = PrevoyanceRequestSchema.parse(buildPrevoyanceRequest(foyerSimple(saisie()), { ...VERSEMENTS_DEFAUT, rachatLpp: '10000.00' }));
    expect(req.potentielRachat).toBeUndefined();
    expect(parseFloat(simulerPrevoyance(req).economieTotale)).toBeGreaterThan(0);
  });

  it('should pass a known potential through', () => {
    const req = buildPrevoyanceRequest(foyerSimple(saisie()), { ...VERSEMENTS_DEFAUT, potentielRachat: '25000' });
    expect(req.potentielRachat).toBe('25000.00');
    expect(buildPrevoyanceRequest(foyerSimple(saisie()), { ...VERSEMENTS_DEFAUT, potentielRachat: 'abc' }).potentielRachat).toBeUndefined();
  });
});
