import { createContext, useContext } from 'react';
import { useScenarioStore, type StoreLocatif } from './scenarioStore';

/**
 * Which page's store the shared forms and dashboard read: the SCI page's by
 * default, the direct page's under its provider (ComparateurLocatif).
 */
export const StoreLocatifContext = createContext<StoreLocatif>(useScenarioStore);

/** The store hook of the page being shown, to subscribe like `useScenarioStore()`. */
export function useStoreLocatifHook(): StoreLocatif {
  return useContext(StoreLocatifContext);
}

/** The page's store state, re-rendering on change. */
export function useStoreLocatif() {
  return useStoreLocatifHook()();
}
