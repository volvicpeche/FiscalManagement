import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { FrontalierRequestSchema, PrevoyanceRequestSchema, type FrontalierRequestInput, type PrevoyanceRequestInput } from '@shared/frontalier.js';
import { simulateFrontalier, simulerPrevoyance } from '../frontalier/index.js';

const foyer = (over: Partial<FrontalierRequestInput> = {}): FrontalierRequestInput => ({
  annee: 2026,
  etatCivil: 'CELIBATAIRE',
  communeTravail: 'GENEVE',
  tauxChangeEurChf: '0.93',
  contribuable: {
    activite: 'SUISSE',
    salaireBrut: '110000.00',
    cotisationsSociales: '7040.00',
    lppOrdinaire: '6000.00',
    codeTarifIS: 'A0',
    impotSourceRetenu: '15000.00',
  },
  deductions: { primesAssuranceMaladie: '4000.00' },
  ...over,
});

const prevoyance = (over: Partial<PrevoyanceRequestInput> = {}) =>
  simulerPrevoyance(PrevoyanceRequestSchema.parse({ requete: foyer(), pilier3a: '7258.00', rachatLpp: '20000.00', ...over }));

const touDe = (input: FrontalierRequestInput) => new Decimal(simulateFrontalier(FrontalierRequestSchema.parse(input)).totalTou);

describe('simulerPrevoyance', () => {
  it('should measure each payment as the TOU it removes, one after the other', () => {
    const r = prevoyance();
    const c = foyer().contribuable;
    const sans = touDe(foyer());
    const avec3a = touDe(foyer({ contribuable: { ...c, pilier3a: '7258.00' } }));
    const avecTout = touDe(foyer({ contribuable: { ...c, pilier3a: '7258.00', lppRachats: '20000.00' } }));

    expect(r.touSans).toBe(sans.toFixed(2));
    expect(r.economie3a).toBe(sans.minus(avec3a).toFixed(2));
    expect(r.economieRachat).toBe(avec3a.minus(avecTout).toFixed(2));
    expect(new Decimal(r.economieTotale).eq(new Decimal(r.economie3a).plus(r.economieRachat))).toBe(true);
    expect(r.taux3a).toBeGreaterThan(0.15);
    expect(r.taux3a).toBeLessThan(0.45);
  });

  it('should replace the amounts already in the household, not add to them', () => {
    const deja = foyer({ contribuable: { ...foyer().contribuable, pilier3a: '7258.00', lppRachats: '50000.00' } });
    const r = simulerPrevoyance(PrevoyanceRequestSchema.parse({ requete: deja, pilier3a: '7258.00', rachatLpp: '20000.00' }));
    expect(r).toEqual(prevoyance());
  });

  it('should cap the 3a at its ceiling and the buy-back at the potential, and say so', () => {
    const r = prevoyance({ pilier3a: '10000.00', rachatLpp: '30000.00', potentielRachat: '20000.00' });
    expect(r.plafond3a).toBe('7258.00');
    expect(r.pilier3aDeductible).toBe('7258.00');
    expect(r.rachatDeductible).toBe('20000.00');
    expect(r.economieTotale).toBe(prevoyance().economieTotale);
    expect(r.avertissements.join(' ')).toMatch(/plafond 2026/);
    expect(r.avertissements.join(' ')).toMatch(/potentiel de rachat/);
  });

  it('should warn about the 3-year lock on capital after a buy-back', () => {
    expect(prevoyance().avertissements.join(' ')).toMatch(/3 ans/);
    expect(prevoyance({ rachatLpp: '0.00' }).avertissements.join(' ')).not.toMatch(/3 ans/);
  });

  it('should draw a curve up to the potential, savings rising and marginal rate falling', () => {
    const r = prevoyance({ potentielRachat: '80000.00' });
    expect(r.courbe[0]).toEqual({ rachat: '0.00', economie: '0.00', tauxMarginal: 0 });
    expect(r.courbe.at(-1)!.rachat).toBe('80000.00');
    for (let i = 1; i < r.courbe.length; i++) {
      expect(parseFloat(r.courbe[i].economie)).toBeGreaterThanOrEqual(parseFloat(r.courbe[i - 1].economie));
      if (i > 1) expect(r.courbe[i].tauxMarginal).toBeLessThanOrEqual(r.courbe[i - 1].tauxMarginal + 1e-9);
    }
  });

  it('should say the TOU is closed when the 90 % test fails', () => {
    const r = prevoyance({
      requete: foyer({
        etatCivil: 'MARIE',
        contribuable: { ...foyer().contribuable, codeTarifIS: 'C0' },
        conjoint: { activite: 'FRANCE', revenuFranceBrutEur: '60000.00', revenuFranceNetEur: '47000.00' },
      }),
    });
    expect(r.eligibleTou).toBe(false);
    expect(r.avertissements[0]).toMatch(/TOU est fermee/);
  });

  it('should refuse a person who does not work in Switzerland', () => {
    expect(() =>
      prevoyance({
        requete: foyer({ etatCivil: 'MARIE', conjoint: { activite: 'FRANCE' } }),
        personne: 'conjoint',
      }),
    ).toThrow(/salaire suisse/);
  });
});
