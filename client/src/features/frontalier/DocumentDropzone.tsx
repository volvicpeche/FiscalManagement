import { useRef, useState } from 'react';
import type { DocumentExtractionResult, DocumentType } from '@shared/frontalier.js';
import { useExtractDocuments } from '@/hooks/useFrontalier';
import {
  LIBELLES_CIBLES,
  cibleEstBien,
  cibleEstPersonnelle,
  useFrontalierStore,
  type QuiPersonne,
} from '@/store/frontalierStore';
import { Titre, inputClass } from './ui';

const LIBELLES_TYPES: Record<DocumentType, string> = {
  CERTIFICAT_SALAIRE: 'Certificat de salaire',
  ATTESTATION_3A: 'Attestation 3e pilier A',
  ATTESTATION_LPP_RACHAT: 'Rachat LPP',
  ASSURANCE_MALADIE: 'Assurance maladie',
  ASSURANCE_VIE: 'Assurance-vie',
  INTERETS_DETTE: 'Interets de dette',
  CHARGES_COPRO: 'Charges de copropriete',
  TAXE_FONCIERE: 'Taxe fonciere',
  FACTURE_TRAVAUX: 'Facture de travaux',
  ATTESTATION_QUITTANCE_IS: 'Attestation impot a la source',
  FRAIS_GARDE: 'Frais de garde',
  AUTRE: 'Document non reconnu',
};

/** A certificate or an annual statement replaces; a receipt among several adds up. */
const REMPLACE: DocumentType[] = ['CERTIFICAT_SALAIRE', 'ATTESTATION_QUITTANCE_IS'];

interface Lecture {
  id: number;
  res: DocumentExtractionResult;
  retenus: Set<number>;
  personne: QuiPersonne;
  bien: number;
  cumuler: boolean;
  etat: 'a_valider' | 'applique' | 'ignore';
  messages: string[];
}

let prochainId = 0;

export function DocumentDropzone() {
  const store = useFrontalierStore();
  const extraction = useExtractDocuments();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [survol, setSurvol] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const envoyer = (fichiers: File[]) => {
    if (fichiers.length === 0) return;
    extraction.mutate(fichiers, {
      onSuccess: (resultats) =>
        setLectures((prev) => [
          ...resultats.map((res): Lecture => {
            const e = res.extraction;
            return {
              id: prochainId++,
              res,
              retenus: new Set(e ? e.champs.map((_, i) => i) : []),
              personne: e?.personne === 'CONJOINT' && store.etatCivil === 'MARIE' ? 'conjoint' : 'contribuable',
              bien: store.biensFrance.length > 0 ? 0 : -1,
              cumuler: e ? !REMPLACE.includes(e.type) : true,
              etat: 'a_valider',
              messages: [],
            };
          }),
          ...prev,
        ]),
    });
  };

  const maj = (id: number, patch: Partial<Lecture>) =>
    setLectures((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const appliquer = (l: Lecture) => {
    if (!l.res.extraction) return;
    const messages = store.appliquerDocument({
      fileName: l.res.fileName,
      extraction: l.res.extraction,
      retenus: [...l.retenus],
      personne: l.personne,
      bien: l.bien,
      cumuler: l.cumuler,
    });
    maj(l.id, { etat: 'applique', messages });
  };

  return (
    <div className="space-y-4">
      <Titre aide="Certificat de salaire, 3e pilier, assurances, interets, charges de copro, taxe fonciere, travaux...">
        Lire mes justificatifs
      </Titre>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          envoyer([...e.dataTransfer.files]);
        }}
        onClick={() => input.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          survol ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:bg-gray-50'
        }`}
      >
        <p className="text-sm font-medium text-gray-700">
          {extraction.isPending ? 'Lecture en cours...' : 'Deposez vos PDF ou photos ici, ou cliquez'}
        </p>
        <p className="text-xs text-gray-400 mt-1">10 fichiers de 10 Mo maximum par envoi</p>
        <input
          ref={input}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            envoyer([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
      </div>
      <p className="text-xs text-gray-400">
        Les fichiers sont transmis a l’API Claude (Anthropic) pour lecture, puis oublies : le serveur ne les
        enregistre pas. Seuls les montants que vous validez rejoignent le formulaire.
      </p>

      {extraction.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {extraction.error.message}
        </div>
      )}

      {lectures.map((l) => (
        <CarteLecture
          key={l.id}
          lecture={l}
          marie={store.etatCivil === 'MARIE'}
          biens={store.biensFrance.map((b, i) => b.label || `Bien ${i + 1}`)}
          onChange={(patch) => maj(l.id, patch)}
          onAppliquer={() => appliquer(l)}
        />
      ))}
    </div>
  );
}

function CarteLecture({
  lecture: l,
  marie,
  biens,
  onChange,
  onAppliquer,
}: {
  lecture: Lecture;
  marie: boolean;
  biens: string[];
  onChange: (patch: Partial<Lecture>) => void;
  onAppliquer: () => void;
}) {
  const e = l.res.extraction;
  const entete = (
    <p className="text-sm font-medium text-gray-900 truncate" title={l.res.fileName}>
      📄 {l.res.fileName}
    </p>
  );

  if (!e) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3">
        {entete}
        <p className="text-xs text-red-700 mt-1">{l.res.erreur}</p>
      </div>
    );
  }

  if (l.etat !== 'a_valider') {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
        {entete}
        <p className="text-xs text-gray-500 mt-1">
          {l.etat === 'applique' ? `Applique (${l.retenus.size} montant(s))` : 'Ignore'}
        </p>
        {l.messages.map((m) => (
          <p key={m} className="text-xs text-amber-700 mt-1">
            {m}
          </p>
        ))}
      </div>
    );
  }

  const aPersonnel = e.champs.some((c) => cibleEstPersonnelle(c.cible)) || !!e.codeTarifIS;
  const aBien = e.champs.some((c) => cibleEstBien(c.cible));
  const basculer = (i: number) => {
    const retenus = new Set(l.retenus);
    if (retenus.has(i)) retenus.delete(i);
    else retenus.add(i);
    onChange({ retenus });
  };

  return (
    <div className="rounded-md border border-indigo-200 p-3 space-y-3">
      <div>
        {entete}
        <p className="text-xs text-gray-500">
          {LIBELLES_TYPES[e.type]}
          {e.titulaire ? ` — ${e.titulaire}` : ''}
          {e.annee ? ` — ${e.annee}` : ''}
          {e.codeTarifIS ? ` — bareme ${e.codeTarifIS}` : ''}
        </p>
        {e.annee && e.annee !== 2026 && (
          <p className="text-xs text-amber-700 mt-1">Document de {e.annee}, la simulation porte sur 2026.</p>
        )}
      </div>

      {e.champs.length === 0 ? (
        <p className="text-xs text-gray-500">Aucun montant utile trouve.</p>
      ) : (
        <ul className="space-y-1">
          {e.champs.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={l.retenus.has(i)} onChange={() => basculer(i)} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-700">{LIBELLES_CIBLES[c.cible]}</span>
                  <span className="font-mono text-gray-900 whitespace-nowrap">
                    {c.valeur.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {c.devise}
                  </span>
                </div>
                <p className="text-xs text-gray-400 truncate" title={c.source}>
                  {c.source}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {e.remarques && <p className="text-xs text-gray-500 italic">{e.remarques}</p>}

      <div className="grid grid-cols-2 gap-2">
        {aPersonnel && marie && (
          <select
            className={inputClass}
            value={l.personne}
            onChange={(ev) => onChange({ personne: ev.target.value as QuiPersonne })}
          >
            <option value="contribuable">Pour le contribuable</option>
            <option value="conjoint">Pour le conjoint</option>
          </select>
        )}
        {aBien && (
          <select
            className={inputClass}
            value={l.bien}
            onChange={(ev) => onChange({ bien: parseInt(ev.target.value) })}
          >
            {biens.map((b, i) => (
              <option key={i} value={i}>
                {b}
              </option>
            ))}
            <option value={-1}>Nouveau bien</option>
          </select>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={l.cumuler} onChange={(ev) => onChange({ cumuler: ev.target.checked })} />
        Ajouter aux montants deja saisis (sinon les remplacer)
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={l.retenus.size === 0 && !e.codeTarifIS}
          onClick={onAppliquer}
          className="flex-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Appliquer
        </button>
        <button
          type="button"
          onClick={() => onChange({ etat: 'ignore' })}
          className="rounded-md border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Ignorer
        </button>
      </div>
    </div>
  );
}
