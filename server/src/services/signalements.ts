import type { Prisma } from '../generated/prisma/client.js';
import {
  anonymiserFoyer,
  type DecompteReel,
  type FrontalierRequest,
  type SignalementCree,
  type SignalementResume,
} from '@shared/frontalier.js';
import { comparerAuDecompte, simulateFrontalier } from '../engine/frontalier/index.js';
import { db } from './db.js';

/**
 * « Ce chiffre me semble faux »: a household, anonymised, with what its
 * owner says the canton actually assessed. Every query filters on the user,
 * as everywhere else (the server bypasses RLS).
 */

/** Reports per user and per 24 hours: plenty for honest use, a ceiling for a script. */
export const MAX_SIGNALEMENTS_JOUR = Number(process.env.MAX_SIGNALEMENTS_JOUR ?? 10);

export class TropDeSignalementsError extends Error {
  constructor() {
    super(`Limite de ${MAX_SIGNALEMENTS_JOUR} signalements par jour atteinte. Reessayez demain.`);
    this.name = 'TropDeSignalementsError';
  }
}

const json = (x: unknown) => x as Prisma.InputJsonValue;

/**
 * Stores the report. The result is recomputed here, from the anonymised
 * household: what is kept is what the engine said, not what a client claims.
 */
export async function creerSignalement(
  userId: string,
  input: { requete: FrontalierRequest; decompte: DecompteReel; commentaire: string },
  now: Date = new Date(),
): Promise<SignalementCree> {
  const depuis = new Date(now.getTime() - 24 * 3600 * 1000);
  const recents = await db().signalement.count({ where: { userId, createdAt: { gte: depuis } } });
  if (recents >= MAX_SIGNALEMENTS_JOUR) throw new TropDeSignalementsError();

  const requete = anonymiserFoyer(input.requete);
  const resultat = simulateFrontalier(requete);
  const row = await db().signalement.create({
    data: {
      userId,
      canton: resultat.canton,
      annee: resultat.annee,
      requete: json(requete),
      resultat: json(resultat),
      decompte: json(input.decompte),
      commentaire: input.commentaire,
    },
    select: { id: true },
  });
  return { id: row.id, ecarts: comparerAuDecompte(resultat, input.decompte) };
}

export async function listerSignalements(userId: string): Promise<SignalementResume[]> {
  const rows = await db().signalement.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true, canton: true, annee: true, decompte: true, commentaire: true },
  });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    canton: r.canton,
    annee: r.annee,
    lignesDecompte: Object.keys((r.decompte ?? {}) as object).length,
    commentaire: r.commentaire,
  }));
}

/** false when there is no such report for this user: someone else's is a 404 too. */
export async function supprimerSignalement(userId: string, id: string): Promise<boolean> {
  const { count } = await db().signalement.deleteMany({ where: { id, userId } });
  return count > 0;
}
