import type { Prize, SpinOutcome } from '../model.ts';

export type Faces = [string, string, string];

export function pickSymbol(prizes: readonly Prize[], exclude?: string): string {
  const pool = prizes.filter(p => p.symbol !== exclude);
  const list = pool.length > 0 ? pool : prizes;
  return list[Math.floor(Math.random() * list.length)]?.symbol ?? '★';
}

/** Les trois symboles d'arrivée : trois fois le lot gagné, ou un alignement raté. */
export function landingFaces(
  prizes: readonly Prize[],
  outcome: SpinOutcome
): Faces {
  const symbol = outcome.prize.symbol;
  return outcome.prize.lose
    ? [pickSymbol(prizes, symbol), symbol, pickSymbol(prizes, symbol)]
    : [symbol, symbol, symbol];
}

export function restingFaces(prizes: readonly Prize[]): Faces {
  const first = prizes.find(p => !p.lose)?.symbol ?? '★';
  return [first, first, first];
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
