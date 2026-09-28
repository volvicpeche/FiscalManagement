/**
 * Start-up check of the Supabase settings, in plain French, in the server's
 * logs (`docker compose logs server | grep Supabase`).
 *
 * Configuring a shared Supabase project has pitfalls the server can detect
 * better than a person reading docs: a mistyped anon key, e-mail sign-in
 * turned off, a project still signing its tokens with the legacy JWT secret.
 * Each line says what is wrong and exactly where to click to fix it.
 *
 * Read-only (two public GET requests), never fatal: Supabase can be paused or
 * slow when the container starts, and a warning must not keep the app down.
 * The only fatal checks stay in index.ts and the entrypoint (SUPABASE_URL,
 * DATABASE_URL missing).
 */

import { MESSAGE_CLE_SECRETE, natureCleSupabase } from './cleSupabase.js';

export type Niveau = 'ok' | 'info' | 'avertissement' | 'erreur';

export interface LigneDiagnostic {
  niveau: Niveau;
  message: string;
}

export interface DiagnosticOptions {
  supabaseUrl: string;
  anonKey?: string;
  jwtSecret?: string;
  fetchImpl?: typeof fetch;
  delaiMs?: number;
}

interface Reglages {
  external?: { email?: boolean };
  disable_signup?: boolean;
  mailer_autoconfirm?: boolean;
}

export async function diagnostiquerSupabase(opts: DiagnosticOptions): Promise<LigneDiagnostic[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const delai = opts.delaiMs ?? 5000;
  const base = `${opts.supabaseUrl.replace(/\/+$/, '')}/auth/v1`;
  const lignes: LigneDiagnostic[] = [];
  const ok = (message: string) => lignes.push({ niveau: 'ok', message });
  const info = (message: string) => lignes.push({ niveau: 'info', message });
  const avert = (message: string) => lignes.push({ niveau: 'avertissement', message });
  const erreur = (message: string) => lignes.push({ niveau: 'erreur', message });

  const lire = async (chemin: string): Promise<Response | null> => {
    try {
      return await fetchImpl(`${base}${chemin}`, {
        headers: opts.anonKey ? { apikey: opts.anonKey } : {},
        signal: AbortSignal.timeout(delai),
      });
    } catch {
      return null;
    }
  };

  // ── 1. The address and the public key ───────────────────────────────────
  if (!opts.anonKey) {
    erreur(
      'SUPABASE_ANON_KEY absente de server/.env : la page de connexion ne peut pas s’afficher. ' +
        'Copiez la cle « publishable » depuis Supabase → Project Settings → API Keys.',
    );
  } else {
    const nature = natureCleSupabase(opts.anonKey);
    if (nature === 'secret') {
      // Refused by /api/config too: it never reaches a browser.
      erreur(MESSAGE_CLE_SECRETE);
    } else if (nature === 'anon_legacy') {
      info(
        'Cle « anon » legacy : elle fonctionne, mais Supabase retire progressivement ces cles. ' +
          'Remplacez-la quand vous voulez par la cle « publishable » (Project Settings → API Keys).',
      );
    }
  }

  const reglages = await lire('/settings');
  if (!reglages) {
    avert(
      `Supabase injoignable a ${opts.supabaseUrl} (projet en pause ? adresse mal copiee ?). ` +
        'Verification ignoree ; l’application demarre quand meme. ' +
        'Verifiez SUPABASE_URL (Project Settings → Data API → Project URL) et que le projet est actif.',
    );
  } else if (reglages.status === 401 || reglages.status === 403) {
    erreur(
      'SUPABASE_ANON_KEY refusee par Supabase. Recopiez la cle « publishable » depuis ' +
        'Project Settings → API Keys, sans espace ni guillemet en trop.',
    );
  } else if (!reglages.ok) {
    avert(`Supabase a repondu HTTP ${reglages.status} sur ${base}/settings : verifiez SUPABASE_URL.`);
  } else {
    ok('Adresse du projet et cle publique acceptees.');

    // ── 2. Sign-in settings ─────────────────────────────────────────────────
    const r = (await reglages.json().catch(() => ({}))) as Reglages;
    if (r.external?.email === false) {
      erreur(
        'La connexion par e-mail est desactivee : personne ne peut se connecter. ' +
          'Activez-la dans Authentication → Sign In / Providers → Email.',
      );
    }
    if (r.mailer_autoconfirm === true) {
      avert(
        '« Confirm email » est desactive : n’importe qui peut creer un compte avec l’adresse de quelqu’un d’autre. ' +
          'Activez-le dans Authentication → Sign In / Providers → Email.',
      );
    }
    if (r.disable_signup === true) {
      info('Inscriptions fermees dans Supabase : seuls les comptes existants peuvent se connecter.');
    }
  }

  // ── 3. How tokens are signed ────────────────────────────────────────────
  const jwks = await lire('/.well-known/jwks.json');
  if (jwks?.ok) {
    const { keys = [] } = ((await jwks.json().catch(() => ({}))) as { keys?: unknown[] });
    if (keys.length > 0) {
      ok('Signature des jetons : cles publiques du projet (rien a configurer).');
    } else if (opts.jwtSecret) {
      ok('Signature des jetons : ancien secret JWT (SUPABASE_JWT_SECRET renseigne).');
    } else {
      erreur(
        'Votre projet signe ses jetons avec l’ancien secret JWT, et SUPABASE_JWT_SECRET est vide : ' +
          'chaque connexion echouera (« Session expiree »). Copiez le secret depuis Supabase → ' +
          'Project Settings → JWT Keys → « Legacy JWT Secret » dans SUPABASE_JWT_SECRET (server/.env), ' +
          'puis `docker compose up -d --force-recreate server`.',
      );
    }
  }

  // Cannot be read from outside Supabase: a reminder, every time.
  info(
    'A verifier a la main : Authentication → URL Configuration → Redirect URLs doit contenir ' +
      '« https://<votre domaine>/auth/confirmer** », sinon le lien de confirmation par e-mail ' +
      'renvoie vers une autre de vos applications.',
  );

  return lignes;
}

const SYMBOLES: Record<Niveau, string> = { ok: '✓', info: 'i', avertissement: '⚠', erreur: '✗' };

/** One readable line per check — plain text, not the JSON of the request log. */
export function formaterDiagnostic(lignes: LigneDiagnostic[]): string {
  const erreurs = lignes.filter((l) => l.niveau === 'erreur').length;
  const avertissements = lignes.filter((l) => l.niveau === 'avertissement').length;
  const entete =
    erreurs > 0
      ? `[Supabase] ${erreurs} probleme(s) a corriger :`
      : avertissements > 0
        ? `[Supabase] ${avertissements} point(s) a verifier :`
        : '[Supabase] Configuration verifiee :';
  return [entete, ...lignes.map((l) => `[Supabase]   ${SYMBOLES[l.niveau]} ${l.message}`)].join('\n');
}
