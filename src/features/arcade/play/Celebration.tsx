import type { CSSProperties } from 'react';

const PIECES = 28;
const GOLDEN = 0.618_033_988_75;

/**
 * Des confettis en CSS seul, sans bibliothèque : 28 éléments posés une fois,
 * répartis par la suite de Weyl (multiples du nombre d'or) plutôt que par
 * `Math.random`, pour un rendu pur et identique d'un affichage à l'autre.
 * Masqués sous `prefers-reduced-motion` (règle de `index.css`).
 */
export function Celebration({ colors }: { colors: readonly string[] }) {
  const palette = colors.length > 0 ? colors : ['#c9a227'];
  return (
    <div className="arcade-confetti" aria-hidden="true">
      {Array.from({ length: PIECES }, (_, i) => {
        const spread = (i * GOLDEN) % 1;
        const style = {
          '--x': `${(spread * 100).toFixed(1)}%`,
          '--delay': `${((i * 0.37) % 1).toFixed(2)}s`,
          '--drift': `${(((i * 0.73) % 1) * 40 - 20).toFixed(0)}px`,
          '--turn': `${(i % 2 === 0 ? 1 : -1) * (180 + (i % 5) * 90)}deg`,
          background: palette[i % palette.length],
        } as CSSProperties;
        return <span key={i} className="arcade-confetti-piece" style={style} />;
      })}
    </div>
  );
}
