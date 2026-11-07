import { describe, expect, it } from 'vitest';
import {
  REDEEM_CODE,
  chances,
  decrementStock,
  drawPrize,
  formatPrizeMessage,
  newLeadId,
  newRedeemCode,
  newSpinId,
  validateLeadValue,
  type Prize,
} from './model.ts';

const lot = (
  id: string,
  weight: number,
  stock: number | null = null,
  lose = false
): Prize => ({
  id,
  label: id,
  weight,
  stock,
  color: '#000000',
  symbol: '·',
  lose,
});

describe('drawPrize', () => {
  it('ignore les lots à poids ou stock nul', () => {
    const prize = drawPrize(
      [lot('a', 0, 5), lot('b', 10, 0), lot('c', 1, 1)],
      () => 0
    );
    expect(prize?.id).toBe('c');
  });

  it('respecte les poids relatifs', () => {
    const prizes = [lot('rare', 1), lot('commun', 99)];
    const counts = { rare: 0, commun: 0 };
    for (let i = 0; i < 1000; i++) {
      const drawn = drawPrize(prizes)!;
      counts[drawn.id as 'rare' | 'commun'] += 1;
    }
    expect(counts.commun).toBeGreaterThan(counts.rare);
    expect(counts.rare).toBeGreaterThan(0);
  });

  it('tire comme `arcade_spin` : le curseur passe sous zéro sur le lot tiré', () => {
    const prizes = [lot('a', 10), lot('b', 30)];
    expect(drawPrize(prizes, () => 0)?.id).toBe('a');
    expect(drawPrize(prizes, () => 0.24)?.id).toBe('a');
    expect(drawPrize(prizes, () => 0.25)?.id).toBe('b');
    expect(drawPrize(prizes, () => 0.9999)?.id).toBe('b');
  });

  it('rend null quand plus rien n’est tirable', () => {
    expect(drawPrize([lot('a', 0), lot('b', 5, 0)])).toBeNull();
  });
});

describe('chances', () => {
  it('rend la part de chaque lot au prochain tirage, zéro pour un épuisé', () => {
    const odds = chances([lot('a', 1), lot('b', 3), lot('c', 6, 0)]);
    expect(odds.get('a')).toBeCloseTo(0.25);
    expect(odds.get('b')).toBeCloseTo(0.75);
    expect(odds.get('c')).toBe(0);
  });

  it('ne divise pas par zéro quand rien n’est tirable', () => {
    expect(chances([lot('a', 0)]).get('a')).toBe(0);
  });
});

describe('decrementStock', () => {
  it('décompte un gagnant, jamais un perdant ni un illimité, jamais sous zéro', () => {
    const prizes = [
      lot('g', 1, 2),
      lot('p', 1, 2, true),
      lot('i', 1, null),
      lot('z', 1, 0),
    ];
    expect(decrementStock(prizes, 'g')[0]!.stock).toBe(1);
    expect(decrementStock(prizes, 'p')[1]!.stock).toBe(2);
    expect(decrementStock(prizes, 'i')[2]!.stock).toBeNull();
    expect(decrementStock(prizes, 'z')[3]!.stock).toBe(0);
  });
});

describe('formatPrizeMessage', () => {
  it('remplace toutes les occurrences de {lot}', () => {
    expect(formatPrizeMessage('Gagnez {lot}, oui, {lot} !', 'Goodies')).toBe(
      'Gagnez Goodies, oui, Goodies !'
    );
  });
});

describe('identifiants et codes', () => {
  it('un tirage et un lead ont un identifiant que la base accepte et qui ne se devine pas', () => {
    const format = /^[A-Za-z0-9_-]{8,64}$/;
    expect(newSpinId()).toMatch(format);
    expect(newLeadId()).toMatch(format);
    expect(newSpinId()).not.toBe(newSpinId());
    // Un UUID entier, pas les huit caractères de `createId`.
    expect(newSpinId().length).toBeGreaterThan(36);
  });

  it('le code de retrait hors ligne suit l’alphabet du serveur (ni 0/O ni 1/I)', () => {
    for (let i = 0; i < 200; i++) expect(newRedeemCode()).toMatch(REDEEM_CODE);
  });
});

describe('validateLeadValue', () => {
  it('reprend les règles de `arcade_submit_lead`', () => {
    expect(validateLeadValue('email', 'ada@exemple.test')).toBeNull();
    expect(validateLeadValue('email', 'ada@exemple')).toBe('invalid');
    expect(validateLeadValue('telephone', '+33 6 12 34 56 78')).toBeNull();
    expect(validateLeadValue('telephone', 'appelez-moi')).toBe('invalid');
    expect(validateLeadValue('prenom', 'x'.repeat(121))).toBe('too-long');
    expect(validateLeadValue('nom', '   ')).toBeNull();
  });
});
