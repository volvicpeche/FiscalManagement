import { EXPORT_FORMAT_VERSION, type ExportCompte, type ResumeCompte } from '@shared/compte.js';
import type { AuthUser } from '../plugins/auth.js';
import { db } from './db.js';

/**
 * The account as a whole: its summary, its export and its deletion.
 *
 * Same access rule as the rest of the server: every query filters on the
 * user's id, the only access control there is (the server connects as
 * `postgres` and bypasses RLS).
 */

/** What an account without an e-mail address types to confirm its deletion. */
export const MOT_CONFIRMATION = 'SUPPRIMER';

export async function resumerCompte(userId: string): Promise<ResumeCompte> {
  const [parKind, cle, signalements] = await Promise.all([
    db().scenario.groupBy({ by: ['kind'], where: { userId }, _count: { _all: true } }),
    db().llmSettings.count({ where: { userId } }),
    db().signalement.count({ where: { userId } }),
  ]);
  const n = (kind: string) => parKind.find((g) => g.kind === kind)?._count._all ?? 0;
  return { scenarios: { sci: n('sci'), saisonnier: n('saisonnier'), frontalier: n('frontalier') }, cleLlm: cle > 0, signalements };
}

/**
 * Every row the user owns, as stored. Scenarios go out raw, without the
 * schema check of scenarioStore: an export must not drop a row the current
 * format no longer reads. The LLM key is left out, even encrypted.
 */
export async function exporterCompte(user: AuthUser, now: Date = new Date()): Promise<ExportCompte> {
  const [scenarios, cle, usage, signalements] = await Promise.all([
    db().scenario.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }),
    db().llmSettings.findUnique({ where: { userId: user.id } }),
    db().llmUsage.findMany({ where: { userId: user.id }, orderBy: { jour: 'asc' } }),
    db().signalement.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }),
  ]);
  return {
    format: EXPORT_FORMAT_VERSION,
    exporteLe: now.toISOString(),
    compte: { id: user.id, email: user.email ?? null },
    scenarios: scenarios.map((s) => ({
      id: s.id,
      nom: s.nom,
      kind: s.kind,
      version: s.version,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      data: s.data,
    })),
    cleLlm: cle
      ? {
          provider: cle.provider,
          model: cle.model,
          baseUrl: cle.baseUrl,
          cleFin: cle.cleFin,
          updatedAt: cle.updatedAt.toISOString(),
        }
      : null,
    consommationLlm: usage.map((u) => ({ jour: u.jour.toISOString().slice(0, 10), appels: u.appels })),
    signalements: signalements.map((s) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      canton: s.canton,
      annee: s.annee,
      requete: s.requete,
      resultat: s.resultat,
      decompte: s.decompte,
      commentaire: s.commentaire,
    })),
  };
}

/** The address typed back must be the account's own, whatever its case. */
export function confirmationValide(user: AuthUser, confirmation: string): boolean {
  const attendu = user.email ?? MOT_CONFIRMATION;
  return confirmation.trim().toLowerCase() === attendu.trim().toLowerCase();
}

/**
 * Deletes the account and everything attached to it, at once and for good.
 *
 * Our tables are emptied explicitly rather than left to ON DELETE CASCADE, so
 * the deletion does not depend on the foreign keys staying in place. Then the
 * Supabase user goes, and with it, by Supabase's own cascades, its
 * identities, sessions and refresh tokens. One transaction: either all of it
 * or nothing.
 */
export async function supprimerCompte(userId: string): Promise<void> {
  await db().$transaction([
    db().scenario.deleteMany({ where: { userId } }),
    db().llmSettings.deleteMany({ where: { userId } }),
    db().llmUsage.deleteMany({ where: { userId } }),
    db().signalement.deleteMany({ where: { userId } }),
    db().$executeRaw`DELETE FROM auth.users WHERE id = ${userId}::uuid`,
  ]);
}
