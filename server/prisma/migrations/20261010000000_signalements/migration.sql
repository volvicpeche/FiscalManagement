-- Applied with search_path = tax (prisma.config.ts).

-- CreateTable
CREATE TABLE "signalements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "canton" VARCHAR(2) NOT NULL,
    "annee" INTEGER NOT NULL,
    "requete" JSONB NOT NULL,
    "resultat" JSONB NOT NULL,
    "decompte" JSONB NOT NULL,
    "commentaire" VARCHAR(2000) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signalements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signalements_user_id_created_at_idx" ON "signalements"("user_id", "created_at" DESC);

-- ─── Added by hand ──────────────────────────────────────────────────────────

-- Deleting a Supabase account deletes its reports.
ALTER TABLE "signalements" ADD CONSTRAINT "signalements_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE CASCADE;

-- Same lock as the other tables: only the Fastify server, never the Data API.
ALTER TABLE "signalements" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "signalements" FROM anon, authenticated;
