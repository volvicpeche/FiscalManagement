import { describe, it, expect } from 'vitest';
import { parseExtractionJson } from '../jsonMode.js';

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    label: 'Mas en Provence',
    ville: 'Gordes',
    codePostal: '84220',
    surfaceM2: 180,
    nbPieces: 6,
    nbChambres: 4,
    capaciteCouchage: 8,
    prixVente: 650000,
    atouts: {
      piscine: true,
      vue: true,
      spa: false,
      terrainPetanque: false,
      climatisation: false,
      parking: true,
      autres: ['terrasse'],
    },
    estimationSaisonniere: {
      hauteSaison: { tauxOccupation: 0.85, caPeriode: 15000 },
      moyenneSaison: { tauxOccupation: 0.5, caPeriode: 7000 },
      basseSaison: { tauxOccupation: 0.2, caPeriode: 2000 },
      rationale: 'Localite touristique reputee, bien avec piscine et vue.',
    },
    ...overrides,
  };
}

describe('parseExtractionJson', () => {
  it('should parse a plain JSON string', () => {
    const result = parseExtractionJson(JSON.stringify(validPayload()));
    expect(result.ville).toBe('Gordes');
    expect(result.atouts.piscine).toBe(true);
  });

  it('should strip a markdown code fence around the JSON', () => {
    const fenced = '```json\n' + JSON.stringify(validPayload()) + '\n```';
    const result = parseExtractionJson(fenced);
    expect(result.ville).toBe('Gordes');
  });

  it('should strip a fence with no language tag', () => {
    const fenced = '```\n' + JSON.stringify(validPayload()) + '\n```';
    expect(() => parseExtractionJson(fenced)).not.toThrow();
  });

  it('should throw a clear error on invalid JSON', () => {
    expect(() => parseExtractionJson('not json at all')).toThrow(/JSON valide/);
  });

  it('should throw a clear error when the shape does not match the schema', () => {
    const wrongShape = JSON.stringify({ foo: 'bar' });
    expect(() => parseExtractionJson(wrongShape)).toThrow(/format attendu/);
  });

  it('should accept null for fields the model could not find', () => {
    const result = parseExtractionJson(
      JSON.stringify(validPayload({ ville: null, surfaceM2: null, prixVente: null })),
    );
    expect(result.ville).toBeNull();
    expect(result.surfaceM2).toBeNull();
  });
});
