-- Applied with search_path = tax (prisma.config.ts).

-- CreateTable
CREATE TABLE "llm_settings" (
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model" VARCHAR(100),
    "base_url" VARCHAR(300),
    "cle_chiffree" TEXT NOT NULL,
    "cle_fin" VARCHAR(4) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "llm_settings_pkey" PRIMARY KEY ("user_id")
);

-- ─── Added by hand ──────────────────────────────────────────────────────────

-- Deleting a Supabase account deletes its key.
ALTER TABLE "llm_settings" ADD CONSTRAINT "llm_settings_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE CASCADE;

-- Same lock as the other tables: only the Fastify server, never the Data API.
ALTER TABLE "llm_settings" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "llm_settings" FROM anon, authenticated;
