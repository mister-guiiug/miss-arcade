import { useEffect, useState } from 'react';
import type { Prize } from '../model.ts';
import type { FaceOf } from '../icons/faces.ts';
import { PrizeIcon } from '../icons/PrizeIcon.tsx';
import { pickFace, restingFaces, type Faces } from './animation.ts';

const TICK_MS = 80;

/**
 * Trois bobines. Elles tournent dès l'appui, AVANT que le serveur réponde :
 * le joueur voit son geste pris en compte tout de suite. Elles s'arrêtent sur
 * la face du lot tiré, jamais l'inverse (animer puis « choisir » mentirait
 * sur les probabilités).
 *
 * Purement visuelles : `aria-hidden`, le résultat est annoncé ailleurs. Une
 * région vivante sur des bobines qui changent douze fois par seconde serait
 * un vacarme pour un lecteur d'écran.
 */
export function BanditReels({
  prizes,
  faceOf,
  spinning,
  landing,
}: {
  prizes: readonly Prize[];
  /** Le jeu d'icônes appliqué (`faceResolver`). */
  faceOf: FaceOf;
  spinning: boolean;
  /** Les faces d'arrivée, ou `null` au repos. */
  landing: Faces | null;
}) {
  const [ticking, setTicking] = useState<Faces | null>(null);

  useEffect(() => {
    if (!spinning) return undefined;
    const timer = window.setInterval(() => {
      setTicking([
        pickFace(prizes, faceOf),
        pickFace(prizes, faceOf),
        pickFace(prizes, faceOf),
      ]);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [spinning, prizes, faceOf]);

  const faces = spinning
    ? (ticking ?? restingFaces(prizes, faceOf))
    : (landing ?? restingFaces(prizes, faceOf));

  return (
    <div
      className={`arcade-reels${spinning ? ' is-spinning' : ''}`}
      aria-hidden="true"
    >
      {faces.map((face, index) => (
        <div key={index} className="arcade-reel">
          <span className="arcade-reel-face">
            <PrizeIcon face={face} />
          </span>
        </div>
      ))}
    </div>
  );
}
