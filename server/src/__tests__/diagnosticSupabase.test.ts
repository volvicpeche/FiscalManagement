import { describe, it, expect } from 'vitest';
import { diagnostiquerSupabase, formaterDiagnostic, type DiagnosticOptions } from '../services/diagnosticSupabase.js';

const URL_PROJET = 'https://projet.supabase.co';

/** A fake Supabase: `/settings` and the JWKS, keyed on the anon key it accepts. */
function faux(o: { reglages?: object; cles?: unknown[]; cleValide?: string; injoignable?: boolean } = {}): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    if (o.injoignable) throw new TypeError('fetch failed');
    const url = String(input);
    const apikey = (init?.headers as Record<string, string> | undefined)?.apikey;
    if (url.endsWith('/auth/v1/settings')) {
      if (apikey !== (o.cleValide ?? 'anon-ok')) return new Response('{"message":"Invalid API key"}', { status: 401 });
      return Response.json(o.reglages ?? { external: { email: true }, disable_signup: false, mailer_autoconfirm: false });
    }
    if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: o.cles ?? [{ kty: 'EC' }] });
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
}

const lancer = (o: Partial<DiagnosticOptions> & { fetchImpl: typeof fetch }) =>
  diagnostiquerSupabase({ supabaseUrl: URL_PROJET, anonKey: 'anon-ok', ...o });

const niveaux = (lignes: { niveau: string }[]) => lignes.map((l) => l.niveau);

describe('diagnostiquerSupabase', () => {
  it('should pass a healthy project, with the Redirect URLs reminder', async () => {
    const lignes = await lancer({ fetchImpl: faux() });
    expect(niveaux(lignes)).toEqual(['ok', 'ok', 'info']);
    expect(lignes[2].message).toMatch(/Redirect URLs.*\/auth\/confirmer\*\*/);
    expect(formaterDiagnostic(lignes)).toMatch(/^\[Supabase\] Configuration verifiee/);
  });

  it('should say where to find a missing or refused anon key', async () => {
    const absente = await lancer({ anonKey: undefined, fetchImpl: faux() });
    expect(absente[0]).toMatchObject({ niveau: 'erreur', message: expect.stringMatching(/Project Settings → API Keys/) });

    const refusee = await lancer({ anonKey: 'mauvaise', fetchImpl: faux() });
    expect(refusee.find((l) => l.niveau === 'erreur')?.message).toMatch(/SUPABASE_ANON_KEY refusee/);
    expect(formaterDiagnostic(refusee)).toMatch(/probleme\(s\) a corriger/);
  });

  it('should flag e-mail sign-in turned off, and confirmation turned off', async () => {
    const lignes = await lancer({
      fetchImpl: faux({ reglages: { external: { email: false }, mailer_autoconfirm: true } }),
    });
    expect(lignes.find((l) => l.niveau === 'erreur')?.message).toMatch(/Sign In \/ Providers → Email/);
    expect(lignes.find((l) => l.niveau === 'avertissement')?.message).toMatch(/Confirm email/);
  });

  it('should ask for the legacy JWT secret when the project has no public keys', async () => {
    const sans = await lancer({ fetchImpl: faux({ cles: [] }) });
    expect(sans.find((l) => l.niveau === 'erreur')?.message).toMatch(/JWT Keys → « Legacy JWT Secret ».*SUPABASE_JWT_SECRET/);

    const avec = await lancer({ jwtSecret: 'secret', fetchImpl: faux({ cles: [] }) });
    expect(avec.some((l) => l.niveau === 'erreur')).toBe(false);
    expect(avec.map((l) => l.message).join()).toMatch(/ancien secret JWT \(SUPABASE_JWT_SECRET renseigne\)/);
  });

  it('should only warn, never fail, when Supabase is unreachable', async () => {
    const lignes = await lancer({ fetchImpl: faux({ injoignable: true }) });
    expect(niveaux(lignes)).toEqual(['avertissement', 'info']);
    expect(lignes[0].message).toMatch(/injoignable.*demarre quand meme/);
    expect(formaterDiagnostic(lignes)).toMatch(/^\[Supabase\] 1 point\(s\) a verifier/);
  });
});
