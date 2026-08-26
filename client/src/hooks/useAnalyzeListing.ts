import { useMutation } from '@tanstack/react-query';
import type { ListingExtraction } from '@shared/listing.js';

async function analyzeListing(url: string): Promise<ListingExtraction> {
  const response = await fetch('/api/listings/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error ?? "Erreur lors de l'analyse de l'annonce");
  }

  return response.json();
}

export function useAnalyzeListing() {
  return useMutation({ mutationFn: analyzeListing });
}
