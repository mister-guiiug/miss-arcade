import { describe, expect, it } from 'vitest';
import { drawPrize, formatPrizeMessage, type Prize } from './model.ts';

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
  color: '#000',
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

  it('rend null quand plus rien n’est tirable', () => {
    expect(drawPrize([lot('a', 0), lot('b', 5, 0)])).toBeNull();
  });
});

describe('formatPrizeMessage', () => {
  it('remplace toutes les occurrences de {lot}', () => {
    expect(formatPrizeMessage('Gagnez {lot} — oui, {lot} !', 'Goodies')).toBe(
      'Gagnez Goodies — oui, Goodies !'
    );
  });
});
