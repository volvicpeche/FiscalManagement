import { useScenarioStore } from '@/store/scenarioStore';

export function UserProfileForm() {
  const { userProfile: profile, updateUserProfile } = useScenarioStore();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Profil fiscal</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Situation familiale
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={profile.maritalStatus}
            onChange={(e) => updateUserProfile({ maritalStatus: e.target.value as 'SINGLE' | 'MARRIED' | 'PACSED' })}
          >
            <option value="SINGLE">Celibataire</option>
            <option value="MARRIED">Marie(e)</option>
            <option value="PACSED">Pacse(e)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre d'enfants
          </label>
          <input
            type="number"
            min={0}
            max={10}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={profile.childrenCount}
            onChange={(e) => updateUserProfile({ childrenCount: parseInt(e.target.value) || 0 })}
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Regime de prelevements sociaux
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={profile.socialChargeRegime}
            onChange={(e) => updateUserProfile({ socialChargeRegime: e.target.value as 'STANDARD' | 'SWISS_EXEMPT' })}
          >
            <option value="STANDARD">Standard (CSG + CRDS + PS = 17.2%)</option>
            <option value="SWISS_EXEMPT">Affilie suisse (PS solidarite uniquement = 7.5%)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
