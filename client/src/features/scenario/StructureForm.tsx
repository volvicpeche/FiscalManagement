import { PROFILE_META, PROFILE_ORDER } from '@/lib/profiles';

export function StructureForm() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Montages compares</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Meme bien, meme financement, memes associes — seule la structure change.
        </p>
      </div>

      <div className="space-y-2">
        {PROFILE_ORDER.map((profile) => {
          const meta = PROFILE_META[profile];
          return (
            <div key={profile} className={`p-3 rounded-md border ${meta.bg} ${meta.border}`}>
              <p className={`text-sm font-medium ${meta.text}`}>{meta.label}</p>
              <p className="text-xs text-gray-600 mt-1">{meta.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
