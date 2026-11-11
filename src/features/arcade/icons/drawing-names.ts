/**
 * LE CATALOGUE DU JEU « dessin », par nom. Les illustrations elles-mêmes sont
 * dans `Drawing.tsx` ; leurs noms lisibles, dans les messages (`drawings.*`).
 *
 * Un nom est ce que la base garde (`arcade_prizes.drawing`) : il ne se
 * renomme pas. Un dessin retiré du catalogue laisse un nom inconnu, que
 * l'affichage remplace par un dessin par défaut (`faces.ts`).
 */
export const DRAWING_NAMES = [
  'etoile',
  'cadeau',
  'diamant',
  'cerise',
  'sept',
  'cloche',
  'trefle',
  'coeur',
  'couronne',
  'piece',
  'trophee',
  'citron',
  'pasteque',
  'etiquette',
  'bonbon',
  'nuage',
] as const;

export type DrawingName = (typeof DRAWING_NAMES)[number];

const KNOWN: ReadonlySet<string> = new Set(DRAWING_NAMES);

export function isDrawingName(value: unknown): value is DrawingName {
  return typeof value === 'string' && KNOWN.has(value);
}
