import { toCsv } from '@mister-guiiug/dev-pwa-config/csv';
import type { LeadRecord } from '../model.ts';

export interface LeadCsvLabels {
  date: string;
  outcome: string;
  prize: string;
  code: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  source: string;
  consentAt: string;
  consentText: string;
  won: string;
  lost: string;
  online: string;
  offline: string;
}

/**
 * Une cellule qui commence par `=`, `+`, `-`, `@` (ou une tabulation, un
 * retour) est lue comme une FORMULE par Excel : un visiteur qui tape
 * `=HYPERLINK(…)` en guise de prénom l'exécuterait chez l'organisateur.
 * L'apostrophe de tête la force en texte, et Excel ne l'affiche pas (OWASP,
 * « CSV injection »). Le socle ne le fait pas : `csv.js` n'écrit que du texte.
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/**
 * Les contacts en CSV, au dialecte `excel-fr` du socle : point-virgule et BOM
 * UTF-8. Sans le BOM, Excel lit l'UTF-8 comme du Latin-1 et « Hélène » devient
 * « HÃ©lÃ¨ne » ; sans le point-virgule, un Excel français met tout dans une
 * seule colonne. Le texte du consentement suit chaque ligne : c'est la preuve.
 */
export function leadsToCsv(
  leads: readonly LeadRecord[],
  labels: LeadCsvLabels,
  formatDate: (iso: string) => string
): string {
  const safe = neutralizeFormula;
  const rows = leads.map(lead => ({
    date: formatDate(lead.createdAt),
    outcome: lead.lose === null ? '' : lead.lose ? labels.lost : labels.won,
    prize: safe(lead.prizeLabel),
    code: lead.redeemCode ?? '',
    prenom: safe(lead.fields.prenom ?? ''),
    nom: safe(lead.fields.nom ?? ''),
    email: safe(lead.fields.email ?? ''),
    telephone: safe(lead.fields.telephone ?? ''),
    source: lead.source === 'offline' ? labels.offline : labels.online,
    consentAt: lead.consentAt ? formatDate(lead.consentAt) : '',
    consentText: safe(lead.consentText ?? ''),
  }));
  return toCsv(rows, {
    dialect: 'excel-fr',
    columns: (
      [
        'date',
        'outcome',
        'prize',
        'code',
        'prenom',
        'nom',
        'email',
        'telephone',
        'source',
        'consentAt',
        'consentText',
      ] as const
    ).map(key => ({ key, header: labels[key] })),
  });
}
