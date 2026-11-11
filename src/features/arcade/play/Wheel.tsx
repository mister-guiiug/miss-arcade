import type { Prize } from '../model.ts';
import type { FaceOf } from '../icons/faces.ts';
import { PrizeIcon } from '../icons/PrizeIcon.tsx';

/**
 * La roue, purement affichée : `GameStage` décide de la rotation et de sa
 * transition. Les parts portent l'icône ET le libellé : une roue d'icônes
 * seules ne dit pas au joueur ce qu'il peut gagner.
 */
export function Wheel({
  slices,
  faceOf,
  rotation,
  transition,
  label,
}: {
  slices: readonly Prize[];
  faceOf: FaceOf;
  rotation: number;
  transition: string | undefined;
  label: string;
}) {
  const count = Math.max(slices.length, 1);
  const gradient = slices
    .map(
      (p, i) =>
        `${p.color} ${(i / count) * 360}deg ${((i + 1) / count) * 360}deg`
    )
    .join(', ');

  return (
    <div className="arcade-wheel-stage">
      <div className="arcade-wheel-pointer" aria-hidden="true" />
      <div
        className="arcade-wheel-disc"
        style={{
          background: `conic-gradient(${gradient})`,
          transform: `rotate(${rotation}deg)`,
          transition,
        }}
        role="img"
        aria-label={label}
      >
        {slices.map((prize, i) => (
          <span
            key={prize.id}
            className="arcade-wheel-label"
            style={{ transform: `rotate(${(i + 0.5) * (360 / count)}deg)` }}
            aria-hidden="true"
          >
            <span className="arcade-wheel-symbol">
              <PrizeIcon face={faceOf(prize)} />
            </span>
            <span className="arcade-wheel-text">{prize.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
