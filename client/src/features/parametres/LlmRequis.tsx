import { useLlmSettings } from '@/hooks/useLlmSettings';
import { useLlmDialog } from './llmDialogStore';

type Usage = 'annonce' | 'document';

/**
 * Whether a paid LLM feature is usable right now. While the settings load,
 * or if they cannot be read, the feature stays enabled: the server has the
 * last word anyway (403 with the same message).
 */
export function useLlmDisponible(usage: Usage): boolean {
  const { data } = useLlmSettings();
  return data ? data.disponible[usage] : true;
}

const MESSAGES: Record<Usage, string> = {
  annonce: 'L’analyse automatique utilise votre propre cle API (Anthropic, OpenAI, Gemini…).',
  document: 'La lecture des justificatifs envoie vos documents au modele : elle utilise votre propre cle API (Anthropic, OpenAI, Gemini…).',
};

/** Shown in place of a disabled feature: why, and the way to fix it in one click. */
export function LlmRequis({ usage }: { usage: Usage }) {
  const ouvrir = useLlmDialog((s) => s.ouvrir);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <span>{MESSAGES[usage]} Renseignez-la pour activer cette fonction.</span>
      <button
        type="button"
        onClick={ouvrir}
        className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
      >
        Renseigner ma cle
      </button>
    </div>
  );
}
