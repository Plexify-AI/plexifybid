/**
 * useTenantVocab — render-layer vocabulary translation
 *
 * Reads vocab_skin from the tenant record in SandboxContext.
 * Returns a translate function: t('prospects') → 'sponsors' (for Republic Events)
 * Falls through to a display-friendly form of the canonical term if no override exists.
 *
 * NEVER modifies API calls or database queries — render-layer only.
 */

import { useSandbox } from '../contexts/SandboxContext';
import { useCallback } from 'react';

// Default display labels for canonical terms (used when no vocab_skin override)
const DEFAULT_LABELS: Record<string, string> = {
  prospects: 'Prospects',
  pipeline: 'Pipeline',
  outreach: 'Outreach',
  deal: 'Deal',
  lead: 'Lead',
  deal_room: 'Deal Room',
  artifact: 'Artifact',
  outreach_draft: 'Outreach Draft',
};

function capitalize(str: string): string {
  return str
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function useTenantVocab() {
  const { tenant } = useSandbox();
  const vocabSkin = tenant?.vocab_skin || {};

  const t = useCallback(
    (canonicalTerm: string): string => {
      if (vocabSkin[canonicalTerm]) {
        return capitalize(vocabSkin[canonicalTerm]);
      }
      return DEFAULT_LABELS[canonicalTerm] || canonicalTerm;
    },
    [vocabSkin]
  );

  return { t };
}
