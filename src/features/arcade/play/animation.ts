import type { Prize, SpinOutcome } from '../model.ts';
import type { Face, FaceOf } from '../icons/faces.ts';

export type Faces = [Face, Face, Face];

const PLACEHOLDER: Face = { kind: 'text', key: 't:★', text: '★' };

/**
 * Une face au hasard parmi les lots, sauf celle qu'il faut éviter. La
 * comparaison porte sur ce qui SE VOIT (`key`), pas sur le lot : deux lots au
 * même dessin feraient sinon un faux alignement sur un tirage perdant.
 */
export function pickFace(
  prizes: readonly Prize[],
  faceOf: FaceOf,
  excludeKey?: string
): Face {
  const faces = prizes.map(faceOf);
  const pool = faces.filter(f => f.key !== excludeKey);
  const list = pool.length > 0 ? pool : faces;
  return list[Math.floor(Math.random() * list.length)] ?? PLACEHOLDER;
}

/** Les trois faces d'arrivée : trois fois le lot gagné, ou un alignement raté. */
export function landingFaces(
  prizes: readonly Prize[],
  outcome: SpinOutcome,
  faceOf: FaceOf
): Faces {
  const face = faceOf(outcome.prize);
  return outcome.prize.lose
    ? [
        pickFace(prizes, faceOf, face.key),
        face,
        pickFace(prizes, faceOf, face.key),
      ]
    : [face, face, face];
}

export function restingFaces(prizes: readonly Prize[], faceOf: FaceOf): Faces {
  const first = prizes.find(p => !p.lose);
  const face = first ? faceOf(first) : PLACEHOLDER;
  return [face, face, face];
}

/** Angle d'arrivée (degrés, sens horaire) pour que le pointeur tombe sur la part `index`. */
export function landingAngle(
  index: number,
  count: number,
  jitter: number = Math.random()
): number {
  const slice = 360 / count;
  const center = index * slice + slice / 2;
  // Un peu de jeu dans la part, jamais sur la frontière.
  const offset = (jitter - 0.5) * slice * 0.6;
  return (((360 - (center + offset)) % 360) + 360) % 360;
}

/**
 * La rotation finale : au moins cinq tours depuis la position courante, puis
 * la part du lot tiré sous le pointeur. L'angle est DÉRIVÉ du lot, jamais
 * l'inverse. Un lot disparu de la liste (supprimé entre-temps) est retrouvé par
 * son libellé ; à défaut, la première part.
 */
export function finalRotation(
  current: number,
  slices: readonly Prize[],
  outcome: SpinOutcome,
  jitter?: number
): number {
  let index = slices.findIndex(p => p.id === outcome.prize.id);
  if (index < 0) index = slices.findIndex(p => p.label === outcome.prize.label);
  if (index < 0) index = 0;
  const base = Math.ceil(current / 360) * 360;
  return (
    base + 360 * 5 + landingAngle(index, Math.max(slices.length, 1), jitter)
  );
}
