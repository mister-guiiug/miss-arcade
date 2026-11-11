import type { IconSet, Prize } from '../model.ts';
import { isDrawingName, type DrawingName } from './drawing-names.ts';

/**
 * CE QU'UN LOT MONTRE, une fois le jeu d'icônes appliqué. La bobine, la roue
 * et l'administration affichent toutes une `Face`, jamais un champ du lot :
 * c'est ici, et seulement ici, que le jeu d'icônes est lu.
 *
 * `key` est l'identité VISUELLE : deux lots qui se montrent pareil ont la même
 * clé. Le bandit s'en sert pour qu'un tirage perdant n'aligne jamais trois
 * fois la même image.
 */
export type Face =
  | { kind: 'text'; key: string; text: string }
  | { kind: 'drawing'; key: string; name: DrawingName }
  | { kind: 'image'; key: string; src: string; fallback: string };

export type FaceOf = (prize: Prize) => Face;

const text = (value: string): Face => ({
  kind: 'text',
  key: `t:${value}`,
  text: value,
});
const drawing = (name: DrawingName): Face => ({
  kind: 'drawing',
  key: `d:${name}`,
  name,
});

/** Les symboles d'avant 0009 dont le dessin va de soi. */
const FROM_SYMBOL: Readonly<Record<string, DrawingName>> = {
  '★': 'etoile',
  '☆': 'etoile',
  '⭐': 'etoile',
  '◆': 'diamant',
  '♦': 'diamant',
  '💎': 'diamant',
  '%': 'etiquette',
  '♥': 'coeur',
  '❤': 'coeur',
  '❤️': 'coeur',
  '7': 'sept',
  '🍒': 'cerise',
  '🍋': 'citron',
  '🔔': 'cloche',
  '🍀': 'trefle',
  '♣': 'trefle',
  '🎁': 'cadeau',
  '👑': 'couronne',
  '€': 'piece',
  '🪙': 'piece',
  '🏆': 'trophee',
  '🍉': 'pasteque',
  '🍬': 'bonbon',
  '·': 'nuage',
  '☁': 'nuage',
  '☁️': 'nuage',
};

/** L'ordre dans lequel un lot gagnant reçoit un dessin que personne n'a choisi. */
const ROTATION: readonly DrawingName[] = [
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
];

/**
 * Le dessin de chaque lot de la liste. Celui que l'admin a choisi d'abord,
 * même s'il le donne à deux lots ; pour les autres, le dessin que suggère son
 * symbole, puis le nuage pour une case perdante, puis le suivant de la
 * rotation — chaque fois en évitant un dessin déjà pris, pour que deux lots se
 * distinguent sur les bobines.
 */
export function defaultDrawings(
  prizes: readonly Prize[]
): Map<string, DrawingName> {
  const result = new Map<string, DrawingName>();
  const used = new Set<DrawingName>();
  for (const prize of prizes) {
    if (isDrawingName(prize.drawing)) {
      result.set(prize.id, prize.drawing);
      used.add(prize.drawing);
    }
  }
  const take = (wanted: DrawingName | undefined): DrawingName => {
    const choice =
      (wanted && !used.has(wanted) ? wanted : undefined) ??
      ROTATION.find(name => !used.has(name)) ??
      wanted ??
      'etoile';
    used.add(choice);
    return choice;
  };
  for (const prize of prizes) {
    if (result.has(prize.id)) continue;
    result.set(
      prize.id,
      take(FROM_SYMBOL[prize.symbol] ?? (prize.lose ? 'nuage' : undefined))
    );
  }
  return result;
}

/** Le dessin d'un lot qui n'est pas (ou plus) dans la liste. */
function lonelyDrawing(prize: Prize): DrawingName {
  if (isDrawingName(prize.drawing)) return prize.drawing;
  return FROM_SYMBOL[prize.symbol] ?? (prize.lose ? 'nuage' : 'etoile');
}

/**
 * La fonction qui donne sa face à chaque lot, pour une liste et un jeu
 * d'icônes. Un lot de la liste se montre TOUJOURS comme dans la liste, même
 * s'il arrive par un tirage du serveur : la bobine s'arrête sur ce que la roue
 * et l'accueil montraient. Un lot inconnu (supprimé depuis le chargement) se
 * montre par ses propres champs.
 */
export function faceResolver(prizes: readonly Prize[], set: IconSet): FaceOf {
  const byId = new Map(prizes.map(p => [p.id, p]));
  const listed = (prize: Prize) => byId.get(prize.id) ?? prize;

  if (set === 'dessin') {
    const drawings = defaultDrawings(prizes);
    return prize =>
      drawing(drawings.get(prize.id) ?? lonelyDrawing(listed(prize)));
  }
  if (set === 'perso') {
    return prize => {
      const shown = listed(prize);
      return shown.image
        ? {
            kind: 'image',
            key: `i:${shown.image}`,
            src: shown.image,
            fallback: shown.symbol,
          }
        : text(shown.symbol);
    };
  }
  return prize => text(listed(prize).symbol);
}
