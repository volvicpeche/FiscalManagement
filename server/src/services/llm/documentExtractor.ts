import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// Same v4 mirror trick as anthropicProvider.ts: the SDK helper wants the
// zod/v4 API, the result is re-validated through the shared schema below.
import * as zv4 from 'zod/v4';
import {
  ChampCible,
  DocumentExtractionSchema,
  DocumentType,
  type DocumentExtraction,
} from '@shared/frontalier.js';
import { resolveLlmProvider } from './index.js';

/**
 * Reads a Swiss or French tax document — salary certificate, 3a statement,
 * insurance premiums, loan interest, copro charges... — and returns the
 * amounts the frontalier form needs, each tagged with where it goes.
 *
 * Only Anthropic is wired: the listing extractor supports four providers
 * because it sends text, but this one sends the PDF or the photo itself, and
 * the other providers' document inputs differ enough to need their own code.
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
- Facture de travaux d'entretien ou de renovation -> BIEN_TRAVAUX.
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

export async function extractDocument(buffer: Buffer, mime: MediaTypeAccepte, fileName: string): Promise<DocumentExtraction> {
  if (resolveLlmProvider() !== 'anthropic') {
    throw new Error('La lecture de documents necessite LLM_PROVIDER=anthropic.');
  }

  const data = buffer.toString('base64');
  const fichier: Anthropic.ContentBlockParam =
    MEDIA_TYPES[mime] === 'document'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
      : { type: 'image', source: { type: 'base64', media_type: mime as Exclude<MediaTypeAccepte, 'application/pdf'>, data } };

  const client = new Anthropic();
  const response = await client.messages.parse({
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-5',
    max_tokens: 4000,
    system: DOCUMENT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [fichier, { type: 'text', text: `Fichier : ${fileName}. Extrais les montants de ce justificatif.` }],
      },
    ],
    output_config: { format: zodOutputFormat(DocumentExtractionSchemaV4) },
  });

  if (!response.parsed_output) {
    throw new Error('La lecture du document a echoue (Anthropic)');
  }

  // A negative amount is a misread, not a deduction: drop it rather than
  // failing the whole document.
  const raw = response.parsed_output;
  return DocumentExtractionSchema.parse({ ...raw, champs: raw.champs.filter((c) => c.valeur >= 0) });
}
