import { describe, expect, it } from 'vitest';
import { defaultPrizes, type Prize } from '../model.ts';
import { DRAWING_NAMES } from './drawing-names.ts';
import { defaultDrawings, faceResolver } from './faces.ts';

const lot = (id: string, patch: Partial<Prize> = {}): Prize => ({
  id,
  label: `Lot ${id}`,
  weight: 1,
  stock: null,
  color: '#1f8a70',
  symbol: '★',
  drawing: null,
  image: null,
  lose: false,
  ...patch,
});

describe('les dessins par défaut', () => {
  it('reprennent le symbole quand il en suggère un, le nuage pour une case perdante', () => {
    const drawings = defaultDrawings([
      lot('a', { symbol: '◆' }),
      lot('b', { symbol: '%' }),
      lot('c', { symbol: 'Z', lose: true }),
      lot('d', { symbol: '🍒' }),
    ]);
    expect([...drawings.values()]).toEqual([
      'diamant',
      'etiquette',
      'nuage',
      'cerise',
    ]);
  });

  it('ne donnent pas deux fois le même dessin', () => {
    const prizes = Array.from({ length: 12 }, (_, i) => lot(`l${i}`));
    const drawings = [...defaultDrawings(prizes).values()];
    expect(new Set(drawings).size).toBe(12);
    expect(drawings[0]).toBe('etoile');
    expect(drawings[1]).toBe('cadeau');
  });

  it('respectent le choix de l’admin, même répété, et ne le redonnent pas', () => {
    const drawings = defaultDrawings([
      lot('a', { drawing: 'sept' }),
      lot('b', { drawing: 'sept' }),
      lot('c', { symbol: '7' }),
    ]);
    expect(drawings.get('a')).toBe('sept');
    expect(drawings.get('b')).toBe('sept');
    expect(drawings.get('c')).toBe('etoile');
  });

  it('remplacent un nom que cette version ne connaît pas', () => {
    const drawings = defaultDrawings([lot('a', { drawing: 'licorne' })]);
    expect(DRAWING_NAMES).toContain(drawings.get('a'));
  });

  it('donnent un dessin distinct à chaque lot de démonstration', () => {
    const drawings = defaultDrawings(defaultPrizes());
    expect(new Set(drawings.values()).size).toBe(defaultPrizes().length);
  });
});

describe('la face d’un lot', () => {
  const prizes = [
    lot('g', {
      symbol: '★',
      drawing: 'cadeau',
      image: 'https://x.test/g.webp',
    }),
    lot('p', { symbol: '·', lose: true }),
  ];

  it('les symboles montrent le texte du lot', () => {
    const faceOf = faceResolver(prizes, 'symboles');
    expect(faceOf(prizes[0]!)).toEqual({
      kind: 'text',
      key: 't:★',
      text: '★',
    });
  });

  it('les dessins montrent le dessin choisi, ou celui par défaut', () => {
    const faceOf = faceResolver(prizes, 'dessin');
    expect(faceOf(prizes[0]!)).toMatchObject({
      kind: 'drawing',
      name: 'cadeau',
    });
    expect(faceOf(prizes[1]!)).toMatchObject({
      kind: 'drawing',
      name: 'nuage',
    });
  });

  it('les images montrent l’image, et le symbole à défaut', () => {
    const faceOf = faceResolver(prizes, 'perso');
    expect(faceOf(prizes[0]!)).toEqual({
      kind: 'image',
      key: 'i:https://x.test/g.webp',
      src: 'https://x.test/g.webp',
      fallback: '★',
    });
    expect(faceOf(prizes[1]!)).toEqual({
      kind: 'text',
      key: 't:·',
      text: '·',
    });
  });

  it('un lot tiré se montre comme dans la liste, pas comme le serveur le décrit', () => {
    // Le serveur rend le lot tel qu'il est en base ; la bobine doit s'arrêter
    // sur ce que l'accueil affichait, chargé plus tôt.
    const faceOf = faceResolver(prizes, 'dessin');
    expect(faceOf({ ...prizes[0]!, drawing: 'sept' })).toMatchObject({
      name: 'cadeau',
    });
  });

  it('un lot supprimé depuis le chargement se montre par ses propres champs', () => {
    const ghost = lot('', { symbol: '♥' });
    expect(faceResolver(prizes, 'dessin')(ghost)).toMatchObject({
      name: 'coeur',
    });
    expect(faceResolver(prizes, 'symboles')(ghost)).toMatchObject({
      text: '♥',
    });
  });
});
