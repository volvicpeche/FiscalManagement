import { describe, it, expect } from 'vitest';
import { assertPublicHttpUrl, htmlToText, analyzeListingText, MIN_TEXT_CHARS } from '../listingAnalyzer.js';
import { ListingAnalyzeRequestSchema } from '@shared/listing.js';

describe('assertPublicHttpUrl', () => {
  it('should accept a plain https URL', () => {
    expect(() => assertPublicHttpUrl('https://www.seloger.com/annonce/123')).not.toThrow();
  });

  it('should reject a non-http(s) scheme', () => {
    expect(() => assertPublicHttpUrl('file:///etc/passwd')).toThrow();
    expect(() => assertPublicHttpUrl('ftp://example.com/x')).toThrow();
  });

  it('should reject an invalid URL', () => {
    expect(() => assertPublicHttpUrl('not a url')).toThrow();
  });

  it('should reject loopback and link-local hosts', () => {
    expect(() => assertPublicHttpUrl('http://localhost:3000/admin')).toThrow();
    expect(() => assertPublicHttpUrl('http://127.0.0.1/secret')).toThrow();
    expect(() => assertPublicHttpUrl('http://169.254.169.254/latest/meta-data')).toThrow();
  });

  it('should reject private network ranges', () => {
    expect(() => assertPublicHttpUrl('http://10.0.0.5/')).toThrow();
    expect(() => assertPublicHttpUrl('http://192.168.1.1/')).toThrow();
    expect(() => assertPublicHttpUrl('http://172.16.0.1/')).toThrow();
    expect(() => assertPublicHttpUrl('http://172.31.255.255/')).toThrow();
  });

  it('should not reject a public address that merely starts with a private-looking octet', () => {
    // 172.32.x.x is outside the 172.16-31 private range.
    expect(() => assertPublicHttpUrl('http://172.32.0.1/')).not.toThrow();
  });
});

describe('htmlToText', () => {
  it('should strip tags and collapse whitespace', () => {
    const html = '<html><body><h1>Mas  en   Provence</h1><p>Superbe   villa</p></body></html>';
    expect(htmlToText(html)).toBe('Mas en Provence Superbe villa');
  });

  it('should drop script and style contents entirely', () => {
    const html = '<script>trackUser();</script><style>.x{color:red}</style><p>Texte utile</p>';
    expect(htmlToText(html)).toBe('Texte utile');
  });

  it('should drop HTML comments', () => {
    expect(htmlToText('<!-- internal note --><p>Visible</p>')).toBe('Visible');
  });

  it('should decode common entities', () => {
    expect(htmlToText('<p>Terrain&nbsp;&amp;&nbsp;piscine</p>')).toBe('Terrain & piscine');
  });
});

describe('analyzeListingText', () => {
  it('should reject a paste that is too short to analyse', async () => {
    await expect(analyzeListingText('Joli mas en Provence')).rejects.toThrow(/trop court/);
  });

  it('should say how short the paste was and what the minimum is', async () => {
    await expect(analyzeListingText('abc')).rejects.toThrow(
      new RegExp(`3 caracteres, minimum ${MIN_TEXT_CHARS}`),
    );
  });

  it('should count the trimmed length, not the surrounding whitespace', async () => {
    await expect(analyzeListingText('   x   '.padEnd(400, ' '))).rejects.toThrow(
      /1 caracteres/,
    );
  });
});

describe('ListingAnalyzeRequestSchema', () => {
  it('should accept a url on its own', () => {
    expect(ListingAnalyzeRequestSchema.safeParse({ url: 'https://www.bienici.com/annonce/1' }).success).toBe(true);
  });

  it('should accept pasted text on its own', () => {
    expect(ListingAnalyzeRequestSchema.safeParse({ text: 'Mas en Provence...' }).success).toBe(true);
  });

  it('should reject a request carrying neither', () => {
    expect(ListingAnalyzeRequestSchema.safeParse({}).success).toBe(false);
  });

  it('should reject a malformed url', () => {
    expect(ListingAnalyzeRequestSchema.safeParse({ url: 'pas-une-url' }).success).toBe(false);
  });

  it('should reject empty text', () => {
    expect(ListingAnalyzeRequestSchema.safeParse({ text: '' }).success).toBe(false);
  });
});
