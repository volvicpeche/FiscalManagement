import { useAuth } from './AuthContext';

/** Who is logged in, and the way out. */
export function UserMenu() {
  const { user, signOut } = useAuth();
  return (
    <div className="flex items-center gap-2">
      <span className="hidden lg:inline text-sm text-gray-500 max-w-[16rem] truncate" title={user.email ?? ''}>
        {user.email}
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-md whitespace-nowrap hover:bg-gray-50"
      >
        Se deconnecter
      </button>
    </div>
  );
}
