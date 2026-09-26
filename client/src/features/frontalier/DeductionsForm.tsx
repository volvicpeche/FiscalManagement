import type { DeductionsFoyer } from '@shared/frontalier.js';
import { useFrontalierStore } from '@/store/frontalierStore';
import { Montant, Titre } from './ui';

const CHAMPS: { cle: keyof DeductionsFoyer; label: string; aide?: string }[] = [
  {
    cle: 'primesAssuranceMaladie',
    label: 'Primes maladie et accidents',
    aide: 'LAMal ou CMU/PUMa, complementaires comprises, pour tout le foyer.',
  },
  { cle: 'primesAssuranceVie', label: 'Assurance-vie (3e pilier B)' },
  {
    cle: 'interetsPassifs',
    label: 'Interets de dettes privees',
    aide: 'Hors emprunts des biens en France, saisis avec chaque bien.',
  },
  { cle: 'rendementFortune', label: 'Rendement de la fortune', aide: 'Plafonne les interets : rendement + 50 000.' },
  { cle: 'pensionAlimentaire', label: 'Pension alimentaire versee' },
  { cle: 'fraisMedicaux', label: 'Frais medicaux a charge', aide: 'Deductibles au-dela de 0,5 % (ICC) et 5 % (IFD).' },
  { cle: 'dons', label: 'Dons a des institutions suisses' },
];

export function DeductionsForm() {
  const { deductions, sources, updateDeductions } = useFrontalierStore();
  return (
    <div className="space-y-4">
      <Titre aide="Un quasi-resident obtient toutes les deductions d’un resident genevois.">Deductions du foyer</Titre>
      <div className="grid grid-cols-2 gap-4">
        {CHAMPS.map(({ cle, label, aide }) => (
          <Montant
            key={cle}
            label={label}
            value={deductions[cle]}
            onChange={(v) => updateDeductions({ [cle]: v })}
            source={sources[`deductions.${cle}`]}
            aide={aide}
          />
        ))}
      </div>
    </div>
  );
}
