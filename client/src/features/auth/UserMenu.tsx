import { useRef, useState } from 'react';
import { useFermeture } from '@/components/useFermeture';
import { LlmSettingsDialog, useLlmDialog } from '@/features/parametres';
import { useLlmSettings } from '@/hooks/useLlmSettings';
import { useAuth } from './AuthContext';

/**
 * Who is logged in, their LLM key and the way out, folded into one compact
 * button so the header fits a medium screen. An amber dot flags a missing
 * LLM key. The « Clé LLM » dialog lives here but can be opened from anywhere
 * (useLlmDialog), e.g. from a feature that needs a key.
 */
export function UserMenu() {
  const { user, signOut } = useAuth();
  const { ouvert: dialogOuvert, ouvrir, fermer } = useLlmDialog();
  const { data: llm } = useLlmSettings();
  const [menu, setMenu] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  // Optional chaining: a server older than the client sends no `disponible`,
  // and this menu sits in the header — a throw here blanks the whole app.
  const sansCle = llm?.disponible ? !llm.disponible.annonce : false;
  const email = user.email ?? 'Mon compte';

  useFermeture(racine, menu, () => setMenu(false));

  const item = 'block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50';

  return (
    <div ref={racine} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setMenu((m) => !m)}
        aria-label={sansCle ? `Mon compte (${email}) — cle LLM a renseigner` : `Mon compte (${email})`}
        aria-haspopup="menu"
        aria-expanded={menu}
        title={email}
        className="relative flex items-center gap-2 rounded-full border border-gray-300 py-1 pl-1 pr-3 text-sm text-gray-600 hover:bg-gray-50"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold uppercase text-white">
          {email.charAt(0)}
        </span>
        <span className="hidden 2xl:inline max-w-[12rem] truncate">{email}</span>
        <span aria-hidden>▾</span>
        {sansCle && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" title="Aucune cle LLM" />
        )}
      </button>

      {menu && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-lg border bg-white shadow-lg">
          <p className="truncate border-b px-3 py-2 text-xs text-gray-500">{email}</p>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setMenu(false);
              ouvrir();
            }}
          >
            Cle LLM
            {sansCle && <span className="ml-2 text-xs text-amber-700">a renseigner</span>}
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setMenu(false);
              void signOut();
            }}
          >
            Se deconnecter
          </button>
        </div>
      )}

      {dialogOuvert && <LlmSettingsDialog onFermer={fermer} />}
    </div>
  );
}
