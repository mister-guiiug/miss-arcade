import { describe, expect, it } from 'vitest';
import type { LeadRecord } from '../model.ts';
import { leadsToCsv } from './leads-csv.ts';

const labels = {
  date: 'Date',
  outcome: 'Résultat',
  prize: 'Lot',
  code: 'Code',
  prenom: 'Prénom',
  nom: 'Nom',
  email: 'E-mail',
  telephone: 'Téléphone',
  source: 'Origine',
  consentAt: 'Accord',
  consentText: 'Texte',
  won: 'Gagné',
  lost: 'Perdu',
  online: 'En ligne',
  offline: 'Hors ligne',
};

const lead = (fields: Record<string, string>): LeadRecord => ({
  id: 'lead_1',
  spinId: 'spin_1',
  createdAt: '2026-11-07T10:00:00.000Z',
  prizeLabel: 'Goodies',
  lose: false,
  game: 'bandit',
  redeemCode: 'ABCDEF',
  fields,
  consentAt: '2026-11-07T10:00:00.000Z',
  consentText: 'J’accepte.',
  source: 'offline',
});

describe('l’export CSV des contacts', () => {
  it('s’ouvre dans un Excel français : BOM UTF-8 et point-virgule', () => {
    const csv = leadsToCsv([lead({ prenom: 'Hélène' })], labels, iso =>
      iso.slice(0, 10)
    );
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Date;Résultat;Lot;Code;Prénom');
    expect(csv).toContain('2026-11-07;Gagné;Goodies;ABCDEF;Hélène');
    expect(csv).toContain('Hors ligne');
  });

  it('neutralise une formule tapée par un visiteur (socle, excel-fr)', () => {
    // La neutralisation vient du socle depuis la 6.33.0 : ce test garde le
    // contrat de l'export, quel que soit celui qui l'assure.
    const csv = leadsToCsv(
      [
        lead({
          prenom: '=HYPERLINK("http://x")',
          nom: '@SUM(A1)',
          email: 'ada@example.org',
          telephone: '+33612345678',
        }),
      ],
      labels,
      iso => iso.slice(0, 10)
    );
    const ligne = csv.split('\r\n')[1] ?? '';
    expect(ligne).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(ligne).toContain("'@SUM(A1)");
    expect(ligne).toContain(';ada@example.org;');
    // Un téléphone en « + » reste du texte : sans l'apostrophe, Excel en
    // ferait un nombre, sans son « + ».
    expect(ligne).toContain("'+33612345678");
  });
});
