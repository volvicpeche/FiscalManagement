import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  AdresseRefuseeError,
  assertUrlPublique,
  creerVerificateur,
  fetchPublic,
  isAdressePrivee,
} from '../netGuard.js';

/** A resolver that answers from a fixed table — no network in the tests. */
const resolveur = (table: Record<string, string[]>) => async (host: string) => {
  const adresses = table[host];
  if (!adresses) throw new Error(`ENOTFOUND ${host}`);
  return adresses;
};

describe('isAdressePrivee', () => {
  it('should refuse loopback, private and link-local IPv4', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0']) {
      expect(isAdressePrivee(ip), ip).toBe(true);
    }
  });

  it('should accept public IPv4', () => {
    expect(isAdressePrivee('93.184.216.34')).toBe(false);
    expect(isAdressePrivee('172.32.0.1')).toBe(false);
  });

  it('should refuse IPv6 loopback, unique-local and link-local', () => {
    for (const ip of ['::1', '::', 'fd00::1', 'fe80::1', 'ff02::1']) {
      expect(isAdressePrivee(ip), ip).toBe(true);
    }
  });

  it('should judge an IPv4-mapped IPv6 address as the IPv4 it wraps', () => {
    expect(isAdressePrivee('::ffff:127.0.0.1')).toBe(true);
    expect(isAdressePrivee('::ffff:7f00:1')).toBe(true);
    expect(isAdressePrivee('::ffff:93.184.216.34')).toBe(false);
  });

  it('should accept a public IPv6 address', () => {
    expect(isAdressePrivee('2a00:1450:4007:80f::200e')).toBe(false);
  });

  it('should refuse anything that is not an IP at all', () => {
    expect(isAdressePrivee('localhost')).toBe(true);
  });
});

describe('assertUrlPublique', () => {
  it('should refuse a public-looking name that resolves to loopback', async () => {
    const r = resolveur({ '127.0.0.1.nip.io': ['127.0.0.1'] });
    await expect(assertUrlPublique(new URL('http://127.0.0.1.nip.io/'), r)).rejects.toBeInstanceOf(
      AdresseRefuseeError,
    );
  });

  it('should refuse when any one of the resolved addresses is private', async () => {
    const r = resolveur({ 'mixte.test': ['93.184.216.34', '10.0.0.1'] });
    await expect(assertUrlPublique(new URL('https://mixte.test/'), r)).rejects.toBeInstanceOf(
      AdresseRefuseeError,
    );
  });

  it('should refuse bracketed IPv6 literals without resolving them', async () => {
    const r = resolveur({});
    await expect(assertUrlPublique(new URL('http://[::1]:3000/'), r)).rejects.toBeInstanceOf(AdresseRefuseeError);
    await expect(assertUrlPublique(new URL('http://[::ffff:127.0.0.1]/'), r)).rejects.toBeInstanceOf(
      AdresseRefuseeError,
    );
  });

  it('should refuse the decimal and hex spellings of 127.0.0.1', async () => {
    // WHATWG URL normalises both to 127.0.0.1 before we ever see them.
    const r = resolveur({});
    await expect(assertUrlPublique(new URL('http://2130706433/'), r)).rejects.toBeInstanceOf(AdresseRefuseeError);
    await expect(assertUrlPublique(new URL('http://0x7f.1/'), r)).rejects.toBeInstanceOf(AdresseRefuseeError);
  });

  it('should refuse non-http schemes', async () => {
    await expect(assertUrlPublique(new URL('file:///etc/passwd'), resolveur({}))).rejects.toThrow();
  });

  it('should accept a name that resolves only to public addresses', async () => {
    const r = resolveur({ 'www.seloger.com': ['93.184.216.34'] });
    await expect(assertUrlPublique(new URL('https://www.seloger.com/annonce/1'), r)).resolves.toBeUndefined();
  });

  it('should report an unknown host as unreachable, not as refused', async () => {
    const err = await assertUrlPublique(new URL('https://inconnu.test/'), resolveur({})).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(AdresseRefuseeError);
  });
});

describe('creerVerificateur', () => {
  it('should resolve each origin only once', async () => {
    let appels = 0;
    const verifier = creerVerificateur(async () => {
      appels++;
      return ['93.184.216.34'];
    });
    await verifier(new URL('https://cdn.test/a.png'));
    await verifier(new URL('https://cdn.test/b.png'));
    expect(appels).toBe(1);
  });

  it('should answer false rather than throw for a private target', async () => {
    const verifier = creerVerificateur(resolveur({}));
    expect(await verifier(new URL('http://10.0.0.1/'))).toBe(false);
  });
});

describe('fetchPublic', () => {
  // A local server standing in for a public page that redirects inward.
  let serveur: Server;
  let port: number;
  let cibleTouchee = false;

  beforeAll(async () => {
    serveur = createServer((req, res) => {
      if (req.url === '/redirige-dedans') {
        res.writeHead(302, { Location: `http://127.0.0.1:${port}/secret` });
        res.end();
      } else if (req.url === '/secret') {
        cibleTouchee = true;
        res.end('secret');
      } else if (req.url === '/redirige-dehors') {
        res.writeHead(301, { Location: '/page' });
        res.end();
      } else {
        res.end('page publique');
      }
    });
    await new Promise<void>((resolve) => serveur.listen(0, '127.0.0.1', resolve));
    port = (serveur.address() as AddressInfo).port;
  });

  afterAll(() => new Promise<void>((resolve) => serveur.close(() => resolve())));

  // "localhost" is declared public here so the FIRST hop reaches the local
  // server; the redirect then targets a literal 127.0.0.1, which must stop it.
  const commePublic = resolveur({ localhost: ['93.184.216.34'] });

  it('should refuse a redirect towards a private address before connecting', async () => {
    await expect(
      fetchPublic(new URL(`http://localhost:${port}/redirige-dedans`), {}, commePublic),
    ).rejects.toBeInstanceOf(AdresseRefuseeError);
    expect(cibleTouchee).toBe(false);
  });

  it('should still follow a redirect that stays on a public host', async () => {
    const res = await fetchPublic(new URL(`http://localhost:${port}/redirige-dehors`), {}, commePublic);
    expect(await res.text()).toBe('page publique');
  });
});
