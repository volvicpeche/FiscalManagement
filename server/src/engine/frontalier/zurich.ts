import type { CantonIndisponible } from './cantons.js';

/**
 * Zurich — prevu, pas encore calcule.
 *
 * Zurich taxes its frontaliers at source (it is not party to the 1983
 * agreement), so a quasi-resident can ask for the TOU there as in Geneva.
 * What is shared (IFD, 90 % test, French properties, comparison with the
 * source tax) already works; what is missing is purely cantonal, and must be
 * read in the official 2026 texts, never estimated:
 *
 * To plug it in, write a `baremesZurich.ts` (like baremesGeneve.ts) and turn
 * this into a `ModuleCantonal` (see geneve.ts):
 * - `computeImpot`: einfache Staatssteuer per the Grundtarif / Verheiratetentarif
 *   (StG ZH § 35), times the Staatssteuerfuss, plus the Gemeindesteuerfuss of
 *   the commune of work (a list of communes, like CENTIMES_COMMUNAUX) — fill
 *   `impotBase`, `centimesCantonaux`, `impotCommunal`, `centimesCommunaux`,
 *   and `reductionLdirpp` at zero;
 * - `regles`: the StG ZH § 31-34 deductions (Berufsauslagen, Versicherungs-
 *   prämien, Kinderabzug, Zweiverdienerabzug...);
 * - `forfaitEntretien`: the Zurich Unterhaltspauschale;
 * - `tarifSource`: generated from the AFC file tar26zh.txt with
 *   server/scripts/generate-tarif-source.mjs (tarifs/tarifSourceZh2026.ts);
 * - `autorite` (Kantonales Steueramt Zürich) and `dateLimite` of the request.
 */
export const MODULE_ZH: CantonIndisponible = {
  canton: 'ZH',
  disponible: false,
  nom: 'Zurich',
  donneesManquantes: [
    'le bareme 2026 de l\'impot cantonal zurichois (Grundtarif et Verheiratetentarif)',
    'les coefficients 2026 du canton et des communes (Steuerfuss)',
    'les deductions cantonales zurichoises',
    'le bareme zurichois de l\'impot a la source (fichier AFC tar26zh.txt)',
  ],
};
