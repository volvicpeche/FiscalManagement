import { describe, it, expect, vi, beforeEach } from 'vitest';

// The SDKs are replaced by spies: these tests check what each provider is
// sent and how its answer is read, without any network call.
const openaiCreate = vi.fn();
const geminiGenerate = vi.fn();
const geminiModel = vi.fn();

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: openaiCreate } };
    constructor(public options: unknown) {}
  },
}));
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel(opts: unknown) {
      geminiModel(opts);
      return { generateContent: geminiGenerate };
    }
  },
}));

const { extractDocument, validerExtraction, DOCUMENT_JSON_SHAPE } = await import('../documentExtractor.js');

const reponse = {
  type: 'CERTIFICAT_SALAIRE',
  personne: 'CONTRIBUABLE',
  titulaire: 'Jean Dupont',
  annee: 2026,
  champs: [
    { cible: 'SALAIRE_BRUT', valeur: 100000, devise: 'CHF', source: 'case 8' },
    { cible: 'LPP_RACHATS', valeur: -50, devise: 'CHF', source: 'case 10.2' },
  ],
  codeTarifIS: null,
  remarques: '',
};

const pdf = Buffer.from('%PDF-1.7');
const config = (provider: 'openai' | 'gemini' | 'openai_compatible') => ({
  provider,
  apiKey: 'sk-test',
  model: 'm',
  baseUrl: provider === 'openai_compatible' ? 'https://api.example.com/v1' : undefined,
  source: 'serveur' as const,
});

beforeEach(() => {
  openaiCreate.mockReset();
  geminiGenerate.mockReset();
  geminiModel.mockReset();
});

describe('extractDocument — OpenAI', () => {
  it('should send a PDF as a file part and read the JSON answer', async () => {
    openaiCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(reponse) } }] });

    const ex = await extractDocument(pdf, 'application/pdf', 'certificat.pdf', config('openai'));

    const { messages, response_format } = openaiCreate.mock.calls[0][0];
    expect(response_format).toEqual({ type: 'json_object' });
    expect(messages[0].content).toContain(DOCUMENT_JSON_SHAPE);
    expect(messages[1].content[0]).toEqual({
      type: 'file',
      file: { filename: 'certificat.pdf', file_data: `data:application/pdf;base64,${pdf.toString('base64')}` },
    });
    expect(ex.champs.map((c) => c.cible)).toEqual(['SALAIRE_BRUT']);
  });

  it('should send a photo as an image part', async () => {
    openaiCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(reponse) } }] });
    await extractDocument(Buffer.from('img'), 'image/png', 'photo.png', config('openai'));
    expect(openaiCreate.mock.calls[0][0].messages[1].content[0].type).toBe('image_url');
  });

  it('should explain a PDF refused by a compatible endpoint', async () => {
    openaiCreate.mockRejectedValue(Object.assign(new Error('Bad Request'), { status: 400 }));
    await expect(extractDocument(pdf, 'application/pdf', 'a.pdf', config('openai_compatible'))).rejects.toThrow(
      /refuse les PDF/,
    );
  });
});

describe('extractDocument — Gemini', () => {
  it('should send the file inline and read the JSON answer, even fenced', async () => {
    geminiGenerate.mockResolvedValue({ response: { text: () => '```json\n' + JSON.stringify(reponse) + '\n```' } });

    const ex = await extractDocument(pdf, 'application/pdf', 'certificat.pdf', config('gemini'));

    expect(geminiGenerate.mock.calls[0][0][0]).toEqual({
      inlineData: { mimeType: 'application/pdf', data: pdf.toString('base64') },
    });
    expect(geminiModel.mock.calls[0][0]).toMatchObject({ generationConfig: { responseMimeType: 'application/json' } });
    expect(ex.type).toBe('CERTIFICAT_SALAIRE');
  });
});

describe('validerExtraction', () => {
  it('should drop negative amounts rather than fail the document', () => {
    expect(validerExtraction(reponse).champs).toHaveLength(1);
  });

  it('should reject an answer that does not match the schema', () => {
    expect(() => validerExtraction({ type: 'FACTURE_INCONNUE' })).toThrow(/format attendu/);
  });
});
