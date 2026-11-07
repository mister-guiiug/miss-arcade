import { describe, expect, it } from 'vitest';
import type { LeadRecord } from '../model.ts';
import { leadsToCsv, neutralizeFormula } from './leads-csv.ts';

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

  it('neutralise une formule tapée par un visiteur', () => {
    expect(neutralizeFormula('=HYPERLINK("http://x")')).toBe(
      '\'=HYPERLINK("http://x")'
    );
    expect(neutralizeFormula('+33 6 12 34 56 78')).toBe("'+33 6 12 34 56 78");
    expect(neutralizeFormula('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(neutralizeFormula('Ada')).toBe('Ada');
    const csv = leadsToCsv([lead({ nom: '=1+1' })], labels, iso => iso);
    expect(csv).toContain("'=1+1");
  });
});
