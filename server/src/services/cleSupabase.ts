/**
 * What kind of Supabase API key was pasted into SUPABASE_ANON_KEY.
 *
 * That key is sent to every browser (GET /api/config), so it must be a PUBLIC
 * one: the publishable key (`sb_publishable_…`, current) or the legacy `anon`
 * JWT (being retired by Supabase). The secret key (`sb_secret_…`) and the
 * legacy `service_role` JWT bypass every security rule of the database:
 * pasting one there by mistake must never reach a browser.
 */
export type NatureCle = 'publishable' | 'anon_legacy' | 'secret' | 'inconnue';

export function natureCleSupabase(cle: string): NatureCle {
  const k = cle.trim();
  if (k.startsWith('sb_publishable_')) return 'publishable';
  if (k.startsWith('sb_secret_')) return 'secret';

  // Legacy keys are JWTs: read the `role` claim. No signature check — this is
  // only to recognise what was pasted, never to trust it.
  const parties = k.split('.');
  if (parties.length === 3) {
    try {
      const { role } = JSON.parse(Buffer.from(parties[1], 'base64url').toString('utf8')) as { role?: unknown };
      if (role === 'anon') return 'anon_legacy';
      if (role === 'service_role') return 'secret';
    } catch {
      // Not a JWT after all.
    }
  }
  return 'inconnue';
}

export const MESSAGE_CLE_SECRETE =
  'SUPABASE_ANON_KEY contient une cle SECRETE (secret ou service_role) : elle donne tous les droits sur la base ' +
  'et serait envoyee au navigateur. Remplacez-la par la cle publishable (Project Settings → API Keys), ' +
  'puis regenerez la cle secrete dans Supabase si elle a pu etre exposee.';
