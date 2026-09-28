import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase client, used for authentication only: scenarios go through
 * our own API, never straight to the database.
 *
 * Two deliberate choices:
 * - The URL is our own origin + /supabase, relayed by nginx (and by Vite in
 *   dev) to the Supabase project. The browser never talks to supabase.co,
 *   which a corporate proxy may block, and the CSP stays `connect-src 'self'`.
 * - The anon key comes from GET /api/config at start-up rather than from the
 *   build, so one web image serves any Supabase project.
 */
let client: Promise<SupabaseClient> | null = null;

async function create(): Promise<SupabaseClient> {
  let response: Response;
  try {
    response = await fetch('/api/config');
  } catch {
    throw new Error('Serveur injoignable. Est-il demarre (npm run dev:server) ?');
  }
  const body = (await response.json().catch(() => null)) as
    | { supabaseAnonKey?: string; error?: string }
    | null;
  if (!response.ok || !body?.supabaseAnonKey) {
    throw new Error(body?.error ?? `Configuration indisponible (HTTP ${response.status}).`);
  }

  return createClient(`${window.location.origin}/supabase`, body.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // PKCE: the e-mail links (default Supabase templates) come back to
      // /auth/confirmer with a `code`, exchanged there by ConfirmPage against
      // the verifier this browser kept — not parsed from the URL by the
      // library.
      flowType: 'pkce',
      detectSessionInUrl: false,
    },
  });
}

export function getSupabase(): Promise<SupabaseClient> {
  if (!client) {
    client = create();
    // A failed start-up (server down) must be retryable, not cached forever.
    client.catch(() => {
      client = null;
    });
  }
  return client;
}
