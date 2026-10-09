import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
// Same v4 mirror trick as anthropicProvider.ts: the SDK helper wants the
// zod/v4 API, the result is re-validated through the shared schema below.
import * as zv4 from 'zod/v4';
import {
  ChampCible,
  DocumentExtractionSchema,
  DocumentType,
  type DocumentExtraction,
} from '@shared/frontalier.js';
import { fetchApiPublique, type LlmConfig } from './config.js';
import { stripCodeFence } from './jsonMode.js';

/**
 * Reads a Swiss or French tax document — salary certificate, 3a statement,
 * insurance premiums, loan interest, copro charges... — and returns the
 * amounts the frontalier form needs, each tagged with where it goes.
 *
 * The file itself goes to the model — PDF or photo — with the user's own
 * provider. Anthropic gets a structured output; the others run in JSON mode
 * with the shape spelled out (DOCUMENT_JSON_SHAPE), and every answer goes
 * through the same shared schema.
 */

const DocumentExtractionSchemaV4 = zv4.object({
  type: zv4.enum(DocumentType.options),
  personne: zv4.enum(['CONTRIBUABLE', 'CONJOINT', 'INCONNU']),
  titulaire: zv4.string().nullable(),
  annee: zv4.number().int().nullable(),
  champs: zv4.array(
    zv4.object({
      cible: zv4.enum(ChampCible.options),
      valeur: zv4.number(),
      devise: zv4.enum(['CHF', 'EUR']),
      source: zv4.string(),
    }),
  ),
  codeTarifIS: zv4.string().nullable(),
  remarques: zv4.string(),
});

export const DOCUMENT_SYSTEM_PROMPT = `Tu lis des justificatifs fiscaux d'un frontalier qui travaille a Geneve et vit en France, pour preparer une demande de taxation ordinaire ulterieure (TOU) de quasi-resident.

Identifie le type de document, puis extrais UNIQUEMENT les montants annuels utiles, chacun avec sa cible :

- Certificat de salaire suisse (formulaire 11) :
  case 8 « Salaire brut total » -> SALAIRE_BRUT ;
  case 9 « Cotisations AVS/AI/APG/AC/AANP » -> COTISATIONS_SOCIALES ;
  case 10.1 « Prevoyance professionnelle, cotisations ordinaires » -> LPP_ORDINAIRE ;
  case 10.2 « Rachats » -> LPP_RACHATS ;
  case 12 « Impot a la source retenu » s'il est rempli -> IMPOT_SOURCE_RETENU.
  Ne reprends pas les frais rembourses (case 13) : ils ne sont pas imposables.
- Attestation 3e pilier A -> PILIER_3A (montant verse dans l'annee).
- Attestation de rachat LPP -> LPP_RACHATS.
- Attestation-quittance d'impot a la source ou fiches de paie -> IMPOT_SOURCE_RETENU (total annuel), et le code bareme (ex. A0, B1, C2, H1) dans codeTarifIS.
- Primes d'assurance-maladie ou accidents (LAMal, complementaires, CMU/PUMa frontalier) -> PRIMES_ASSURANCE_MALADIE (primes payees, net des subsides).
- Assurance-vie (3e pilier B) -> PRIMES_ASSURANCE_VIE.
- Interets d'une dette : si elle finance un bien en France -> BIEN_INTERETS_EMPRUNT, sinon -> INTERETS_PASSIFS. Ne compte jamais l'amortissement du capital.
- Appel de charges ou decompte de copropriete -> BIEN_CHARGES_COPRO (charges de l'exercice, hors fonds de travaux non depenses).
- Avis de taxe fonciere -> BIEN_TAXE_FONCIERE (hors taxe d'enlevement des ordures si elle est recuperee sur le locataire).
- Facture de travaux sur un bien : ventile le montant TTC selon le droit fiscal suisse, en un champ par categorie :
  BIEN_TRAVAUX_ENTRETIEN pour l'entretien et la remise en etat, c'est-a-dire remplacer l'existant par un equivalent (refaire une installation electrique vetuste, remplacer des WC, une cuisine ou une salle de bain de standing comparable, peinture, toiture, canalisations) ;
  BIEN_TRAVAUX_ENERGIE pour les investissements qui economisent l'energie (isolation, fenetres a meilleure performance, pompe a chaleur, panneaux solaires, remplacement d'une chaudiere fioul) ;
  BIEN_TRAVAUX_PLUS_VALUE pour ce qui ajoute ou ameliore (piece ou salle d'eau nouvelle, agrandissement, equipement qui n'existait pas, nette montee en gamme).
  Ventile ligne par ligne quand la facture le permet ; sinon, retiens la categorie dominante et explique la ventilation dans source. Signale toute hesitation dans remarques : l'utilisateur tranchera.
- Assurance habitation ou PNO d'un bien loue -> BIEN_ASSURANCE.
- Releve de loyers encaisses -> BIEN_LOYERS.
- Frais de garde d'enfants (creche, assistante maternelle) -> FRAIS_GARDE.
- Frais medicaux restes a charge -> FRAIS_MEDICAUX ; recus de dons -> DONS ; formation continue -> FRAIS_FORMATION.

Regles :
- Montants annuels, positifs, dans la devise du document (CHF ou EUR). Si seul un montant mensuel figure, multiplie-le et dis-le dans source.
- Dans source, cite la case ou la ligne d'ou vient le montant.
- personne : CONTRIBUABLE ou CONJOINT si le document le permet, sinon INCONNU ; recopie le nom du titulaire.
- N'invente rien : un montant absent n'est pas extrait. Si le document n'est pas un justificatif utile, type AUTRE et champs vide.
- Signale dans remarques toute ambiguite (annee differente, montant partiel, document illisible).`;

/** For the JSON-mode providers, which get no schema object. */
export const DOCUMENT_JSON_SHAPE = `Reponds UNIQUEMENT par un objet JSON, sans texte autour, de cette forme :
{
  "type": ${DocumentType.options.map((o) => `"${o}"`).join(' | ')},
  "personne": "CONTRIBUABLE" | "CONJOINT" | "INCONNU",
  "titulaire": string | null,
  "annee": number | null,
  "champs": [{ "cible": ${ChampCible.options.map((o) => `"${o}"`).join(' | ')}, "valeur": number, "devise": "CHF" | "EUR", "source": string }],
  "codeTarifIS": string | null,
  "remarques": string
}`;

const MEDIA_TYPES = {
  'application/pdf': 'document',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
} as const;
export type MediaTypeAccepte = keyof typeof MEDIA_TYPES;

export function mediaTypeAccepte(mime: string): mime is MediaTypeAccepte {
  return mime in MEDIA_TYPES;
}

const CONSIGNE = (fileName: string) => `Fichier : ${fileName}. Extrais les montants de ce justificatif.`;

async function viaAnthropic(data: string, mime: MediaTypeAccepte, fileName: string, config: LlmConfig): Promise<unknown> {
  const fichier: Anthropic.ContentBlockParam =
    MEDIA_TYPES[mime] === 'document'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
      : { type: 'image', source: { type: 'base64', media_type: mime as Exclude<MediaTypeAccepte, 'application/pdf'>, data } };

  const client = new Anthropic({ apiKey: config.apiKey });
  const response = await client.messages.parse({
    model: config.model,
    max_tokens: 4000,
    system: DOCUMENT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: [fichier, { type: 'text', text: CONSIGNE(fileName) }] }],
    output_config: { format: zodOutputFormat(DocumentExtractionSchemaV4) },
  });
  if (!response.parsed_output) throw new Error('La lecture du document a echoue (Anthropic)');
  return response.parsed_output;
}

/** OpenAI, and any endpoint speaking its chat-completions format. */
async function viaOpenAi(data: string, mime: MediaTypeAccepte, fileName: string, config: LlmConfig): Promise<unknown> {
  const compatible = config.provider === 'openai_compatible';
  if (compatible && !config.baseUrl) throw new Error("URL de l'API compatible OpenAI manquante");
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: compatible ? config.baseUrl : undefined,
    // A base URL typed by a user is guarded like for the listing analysis.
    ...(compatible && config.source === 'utilisateur' && { fetch: fetchApiPublique, maxRetries: 0 }),
  });
  const url = `data:${mime};base64,${data}`;
  const fichier: OpenAI.Chat.ChatCompletionContentPart =
    MEDIA_TYPES[mime] === 'document'
      ? { type: 'file', file: { filename: fileName, file_data: url } }
      : { type: 'image_url', image_url: { url } };

  let completion: OpenAI.Chat.ChatCompletion;
  try {
    completion = await client.chat.completions.create({
      model: config.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${DOCUMENT_SYSTEM_PROMPT}\n\n${DOCUMENT_JSON_SHAPE}` },
        { role: 'user', content: [fichier, { type: 'text', text: CONSIGNE(fileName) }] },
      ],
    });
  } catch (err) {
    // Most compatible endpoints read images but not PDF parts, and say so
    // with a bare 400: point at the way around.
    if (compatible && (err as { status?: number })?.status === 400) {
      throw new Error(
        MEDIA_TYPES[mime] === 'document'
          ? `Ce modele refuse les PDF. Deposez une photo ou une capture du document, ou utilisez un modele qui lit les PDF.`
          : `Ce modele refuse les images : choisissez un modele avec vision dans « Cle LLM ».`,
      );
    }
    throw err;
  }
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('La lecture du document a echoue (reponse vide)');
  return parseJson(raw);
}

async function viaGemini(data: string, mime: MediaTypeAccepte, fileName: string, config: LlmConfig): Promise<unknown> {
  const model = new GoogleGenerativeAI(config.apiKey).getGenerativeModel({
    model: config.model,
    systemInstruction: `${DOCUMENT_SYSTEM_PROMPT}\n\n${DOCUMENT_JSON_SHAPE}`,
    generationConfig: { responseMimeType: 'application/json' },
  });
  const result = await model.generateContent([{ inlineData: { mimeType: mime, data } }, { text: CONSIGNE(fileName) }]);
  const raw = result.response.text();
  if (!raw) throw new Error('La lecture du document a echoue (Gemini)');
  return parseJson(raw);
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(stripCodeFence(raw));
  } catch {
    throw new Error("Le modele n'a pas renvoye un JSON valide");
  }
}

/**
 * Validates a model's answer. A negative amount is a misread, not a
 * deduction: it is dropped rather than failing the whole document.
 */
export function validerExtraction(brut: unknown): DocumentExtraction {
  const champs = (brut as { champs?: unknown })?.champs;
  const filtre = Array.isArray(champs)
    ? { ...(brut as object), champs: champs.filter((c) => !(typeof c?.valeur === 'number' && c.valeur < 0)) }
    : brut;
  const parsed = DocumentExtractionSchema.safeParse(filtre);
  if (!parsed.success) throw new Error('La reponse du modele ne correspond pas au format attendu');
  return parsed.data;
}

export async function extractDocument(
  buffer: Buffer,
  mime: MediaTypeAccepte,
  fileName: string,
  config: LlmConfig,
): Promise<DocumentExtraction> {
  const data = buffer.toString('base64');
  switch (config.provider) {
    case 'anthropic':
      return validerExtraction(await viaAnthropic(data, mime, fileName, config));
    case 'openai':
    case 'openai_compatible':
      return validerExtraction(await viaOpenAi(data, mime, fileName, config));
    case 'gemini':
      return validerExtraction(await viaGemini(data, mime, fileName, config));
  }
}
