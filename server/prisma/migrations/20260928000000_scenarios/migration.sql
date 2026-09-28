-- Applied with search_path = tax (prisma.config.ts): the unqualified names
-- below land in the `tax` schema, which Prisma creates if it is missing.

-- CreateTable
CREATE TABLE "scenarios" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nom" VARCHAR(120) NOT NULL,
    "kind" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_usage" (
    "user_id" UUID NOT NULL,
    "jour" DATE NOT NULL,
    "appels" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "llm_usage_pkey" PRIMARY KEY ("user_id","jour")
);

-- CreateIndex
CREATE INDEX "scenarios_user_id_updated_at_idx" ON "scenarios"("user_id", "updated_at" DESC);


-- ─── Added by hand: what Prisma cannot model ────────────────────────────────

-- Deleting a Supabase account deletes its scenarios and its quota rows.
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE CASCADE;
ALTER TABLE "llm_usage" ADD CONSTRAINT "llm_usage_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE CASCADE;

-- Only the Fastify server may touch these tables: it connects as `postgres`,
-- which bypasses RLS, and filters every query by user itself. The Supabase
-- Data API (PostgREST, reachable with the public anon key) does not expose
-- the `tax` schema; should anyone add it to the exposed schemas one day, no
-- usage on the schema, RLS with no policy and no grant still keep it shut.
REVOKE ALL ON SCHEMA "tax" FROM anon, authenticated;
ALTER TABLE "scenarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "llm_usage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "scenarios", "llm_usage" FROM anon, authenticated;
