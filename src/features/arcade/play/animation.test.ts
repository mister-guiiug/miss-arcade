import { describe, expect, it } from 'vitest';
import type { Prize, SpinOutcome } from '../model.ts';
import { faceResolver } from '../icons/faces.ts';
import {
  finalRotation,
  landingAngle,
  landingFaces,
  restingFaces,
} from './animation.ts';

const lot = (
  id: string,
  lose = false,
  symbol = id,
  drawing: string | null = null
): Prize => ({
  id,
  label: `Lot ${id}`,
  weight: 1,
  stock: null,
  color: '#1f8a70',
  symbol,
  drawing,
  image: null,
  lose,
});

const outcomeOf = (prize: Prize): SpinOutcome => ({
  spinId: 'spin_test_0001',
  redeemCode: 'ABCDEF',
  source: 'online',
  playedAt: '2026-11-07T10:00:00Z',
  prize,
});

/** La part sous le pointeur (en haut) après une rotation horaire de `deg`. */
function sliceUnderPointer(deg: number, count: number): number {
  const angle = (((360 - (deg % 360)) % 360) + 360) % 360;
  return Math.floor(angle / (360 / count));
}

describe('la roue', () => {
  it('arrête le pointeur sur la part du lot tiré, quelle que soit la part', () => {
    for (const count of [2, 3, 4, 7, 12]) {
      for (let index = 0; index < count; index++) {
        for (const jitter of [0, 0.5, 0.999]) {
          expect(
            sliceUnderPointer(landingAngle(index, count, jitter), count)
          ).toBe(index);
        }
      }
    }
  });

  it('fait au moins cinq tours et repart de sa position courante', () => {
    const slices = [lot('a'), lot('b'), lot('c')];
    const next = finalRotation(725, slices, outcomeOf(slices[2]!), 0.5);
    expect(next - 725).toBeGreaterThanOrEqual(360 * 5);
    expect(sliceUnderPointer(next, 3)).toBe(2);
  });

  it('retrouve un lot supprimé entre-temps par son libellé', () => {
    const slices = [lot('a'), lot('b')];
    const ghost = { ...slices[1]!, id: '' };
    expect(
      sliceUnderPointer(finalRotation(0, slices, outcomeOf(ghost), 0.5), 2)
    ).toBe(1);
  });
});

describe('le bandit', () => {
  const prizes = [
    lot('g', false, '★'),
    lot('p', true, '·'),
    lot('x', false, '%'),
  ];
  const symbols = faceResolver(prizes, 'symboles');
  const keys = (faces: readonly { key: string }[]) => faces.map(f => f.key);

  it('aligne trois symboles pour un gain, jamais pour une perte', () => {
    expect(keys(landingFaces(prizes, outcomeOf(prizes[0]!), symbols))).toEqual([
      't:★',
      't:★',
      't:★',
    ]);
    for (let i = 0; i < 50; i++) {
      const [left, middle, right] = keys(
        landingFaces(prizes, outcomeOf(prizes[1]!), symbols)
      );
      expect(middle).toBe('t:·');
      expect(left === 't:·' && right === 't:·').toBe(false);
    }
  });

  it('compare ce qui SE VOIT : deux lots au même dessin ne font pas un faux alignement', () => {
    // Le perdant et un gagnant portent le même dessin : un tirage perdant ne
    // doit pas les montrer côte à côte comme un gain.
    const twins = [
      lot('g', false, '★', 'nuage'),
      lot('p', true, '·', 'nuage'),
      lot('x', false, '%', 'sept'),
    ];
    const drawn = faceResolver(twins, 'dessin');
    for (let i = 0; i < 50; i++) {
      const [left, middle, right] = keys(
        landingFaces(twins, outcomeOf(twins[1]!), drawn)
      );
      expect(middle).toBe('d:nuage');
      expect(left).toBe('d:sept');
      expect(right).toBe('d:sept');
    }
  });

  it('au repos, montre le premier lot gagnant dans le jeu choisi', () => {
    const drawn = faceResolver(prizes, 'dessin');
    expect(keys(restingFaces(prizes, drawn))).toEqual([
      'd:etoile',
      'd:etoile',
      'd:etoile',
    ]);
  });
});
