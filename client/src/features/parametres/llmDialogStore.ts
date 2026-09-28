import { create } from 'zustand';

/** The « Clé LLM » dialog, openable from the header and from any feature that needs a key. */
export const useLlmDialog = create<{ ouvert: boolean; ouvrir: () => void; fermer: () => void }>((set) => ({
  ouvert: false,
  ouvrir: () => set({ ouvert: true }),
  fermer: () => set({ ouvert: false }),
}));
