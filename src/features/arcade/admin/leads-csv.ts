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
 * Les contacts en CSV, au dialecte `excel-fr` du socle : point-virgule et BOM
 * UTF-8. Sans le BOM, Excel lit l'UTF-8 comme du Latin-1 et « Hélène » devient
 * « HÃ©lÃ¨ne » ; sans le point-virgule, un Excel français met tout dans une
 * seule colonne. Le texte du consentement suit chaque ligne : c'est la preuve.
 *
 * LES FORMULES SONT NEUTRALISÉES PAR LE SOCLE (6.33.0, `neutralizeFormulas`
 * d'`excel-fr`). Les champs sont saisis par des visiteurs : un prénom
 * `=HYPERLINK(…)` s'exécuterait dans l'Excel de l'organisateur, et un
 * téléphone `+33…` y deviendrait un nombre sans son « + ». L'app le faisait
 * elle-même jusqu'à la 0.2.0 ; le socle l'a repris.
 */
export function leadsToCsv(
  leads: readonly LeadRecord[],
  labels: LeadCsvLabels,
  formatDate: (iso: string) => string
): string {
  const rows = leads.map(lead => ({
    date: formatDate(lead.createdAt),
    outcome: lead.lose === null ? '' : lead.lose ? labels.lost : labels.won,
    prize: lead.prizeLabel,
    code: lead.redeemCode ?? '',
    prenom: lead.fields.prenom ?? '',
    nom: lead.fields.nom ?? '',
    email: lead.fields.email ?? '',
    telephone: lead.fields.telephone ?? '',
    source: lead.source === 'offline' ? labels.offline : labels.online,
    consentAt: lead.consentAt ? formatDate(lead.consentAt) : '',
    consentText: lead.consentText ?? '',
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
