import { describe, it, expect, beforeEach } from 'vitest';
import { useFrontalierStore } from '@/store/frontalierStore';
import { alertes, etapesVisibles, piecesEtape, typesAttendus } from '@/features/frontalier/parcours';

const store = () => useFrontalierStore.getState();
const etatInitial = useFrontalierStore.getState();

beforeEach(() => useFrontalierStore.setState(etatInitial, true));

const ids = () => etapesVisibles(store()).map((e) => e.id);

describe('parcours TOU — etapes visibles', () => {
  it('should show only the common steps to a single earner with nothing in France', () => {
    expect(ids()).toEqual(['profil', 'documents', 'foyer', 'contribuable', 'deductions', 'resultat']);
  });

  it('should add the spouse, France and works steps when the profile says so', () => {
    store().updateFoyer({ etatCivil: 'MARIE' });
    store().updateProfil({ revenusFrance: true });
    store().setTravauxActifs(true);
    expect(ids()).toEqual(['profil', 'documents', 'foyer', 'contribuable', 'conjoint', 'deductions', 'france', 'travaux', 'resultat']);
  });

  it('should hide the works step when there is no French property', () => {
    store().setTravauxActifs(true);
    expect(ids()).not.toContain('travaux');
  });
});

describe('parcours TOU — documents', () => {
  it('should ask for a Swiss salary certificate for a spouse working in Switzerland', () => {
    store().updateFoyer({ etatCivil: 'MARIE' });
    store().updatePersonne('conjoint', { activite: 'SUISSE' });
    expect(typesAttendus('conjoint', store())).toContain('CERTIFICAT_SALAIRE');
  });

  it('should ask for a French payslip, not a readable document, for a spouse working in France', () => {
    store().updateFoyer({ etatCivil: 'MARIE' });
    const pieces = piecesEtape('conjoint', store());
    expect(pieces).toHaveLength(1);
    expect(pieces[0].type).toBeUndefined();
  });

  it('should ask for childcare invoices only with children', () => {
    expect(typesAttendus('foyer', store())).toEqual([]);
    store().updateProfil({ enfants: true });
    expect(typesAttendus('foyer', store())).toEqual(['FRAIS_GARDE']);
  });
});

describe('parcours TOU — alertes', () => {
  it('should warn about a zero salary without blocking anything', () => {
    store().updatePersonne('contribuable', { salaireBrut: '0.00' });
    expect(alertes('contribuable', store()).some((m) => m.includes('Salaire brut'))).toBe(true);
  });

  it('should warn about a rented property without rents', () => {
    store().updateProfil({ revenusFrance: true });
    expect(alertes('france', store()).some((m) => m.includes('sans loyers'))).toBe(true);
  });
});
