import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { LLM_PROVIDER_LABELS } from '@shared/llmSettings.js';
import { useLlmSettings } from '@/hooks/useLlmSettings';

/**
 * Consent to send documents to an LLM provider, asked once per provider
 * (RGPD: a transfer of tax documents to a processor, mostly outside the EU).
 * Changing provider, or the base URL of a compatible API, asks again.
 * Kept in this browser; the server only checks that the client asked
 * (`?consentement=oui` on /api/frontalier/documents).
 */
export const useConsentementsIa = create<{
  fournisseurs: string[];
  accepter: (cle: string) => void;
  retirer: (cle: string) => void;
}>()(
  persist(
    (set) => ({
      fournisseurs: [],
      accepter: (cle) => set((s) => ({ fournisseurs: [...new Set([...s.fournisseurs, cle])] })),
      retirer: (cle) => set((s) => ({ fournisseurs: s.fournisseurs.filter((f) => f !== cle) })),
    }),
    { name: 'patrimonia.consentementIa', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

/** Which provider the documents would go to right now, by the server's own rule: the user's key first. */
export function useFournisseurIa(): { cle: string; libelle: string } | null {
  const { data } = useLlmSettings();
  if (!data) return null;
  if (data.provider) {
    if (data.provider === 'openai_compatible' && data.baseUrl) {
      let hote = data.baseUrl;
      try {
        hote = new URL(data.baseUrl).host;
      } catch {
        /* shown as typed */
      }
      return { cle: `openai_compatible:${hote}`, libelle: hote };
    }
    return { cle: data.provider, libelle: LLM_PROVIDER_LABELS[data.provider] };
  }
  if (data.cleServeurAutorisee) return { cle: 'serveur', libelle: 'le fournisseur d’IA du site' };
  return null;
}

/** The consent for the current provider: given or not, and how to give or withdraw it. */
export function useConsentementIa() {
  const fournisseur = useFournisseurIa();
  const { fournisseurs, accepter, retirer } = useConsentementsIa();
  return {
    fournisseur,
    accepte: fournisseur !== null && fournisseurs.includes(fournisseur.cle),
    accepter: () => fournisseur && accepter(fournisseur.cle),
    retirer: () => fournisseur && retirer(fournisseur.cle),
  };
}
