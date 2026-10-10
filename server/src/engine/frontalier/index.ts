/**
 * Frontalier en Suisse: TOU of a quasi-resident against the source tax.
 * commun.ts and federal.ts hold what every canton shares, one file per canton
 * the rest (geneve.ts; zurich.ts is still a placeholder), cantons.ts the list.
 */
export { CANTONS, CantonIndisponibleError, moduleCantonal } from './cantons.js';
export type { CantonIndisponible, ModuleCantonal } from './cantons.js';
export { DEDUCTIONS, computeTest90, type CodeDeduction } from './commun.js';
export { impotIfdBareme } from './federal.js';
export { impotBaseIcc, impotBaseIccSplitting } from './geneve.js';
export {
  codeTarifParDefaut,
  computeAssiettes,
  computeImpotSource,
  detailBiens,
  mesurerBien,
  simulateFrontalier,
} from './simulation.js';
export { CHAMPS_DECOMPTE, comparerAuDecompte } from './decompte.js';
