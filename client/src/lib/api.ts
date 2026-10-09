import { getSupabase } from './supabase';

/**
 * `fetch` for our own /api, with the Supabase access token attached.
 *
 * A drop-in replacement: each hook keeps its own error handling. getSession()
 * refreshes an expired token before returning it. A 401 means the session is
 * gone for good (revoked, refresh failed): signing out sends the user back to
 * the home page (AuthProvider reloads on SIGNED_OUT).
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`);

  const response = await fetch(input, { ...init, headers });
  if (response.status === 401 && data.session) {
    await supabase.auth.signOut({ scope: 'local' });
  }
  return response;
}
