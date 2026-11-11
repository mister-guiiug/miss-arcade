import type { ReactElement } from 'react';
import type { DrawingName } from './drawing-names.ts';

/** Le trait de tous les dessins : un brun très sombre, plus doux qu'un noir. */
const INK = '#2b2320';
/** Les reflets : un trait clair, sans contour. */
const SHINE = { stroke: '#ffffff', strokeWidth: 2.5, fill: 'none' } as const;

const LEAF =
  'M32 30 C25 26 20 20 22 14 C24 9 30 9 32 14 C34 9 40 9 42 14 C44 20 39 26 32 30 Z';

/**
 * LE JEU « dessin » : seize illustrations dessinées pour l'arcade, sur une
 * grille de 64. Elles sont DANS l'application, pas sur un serveur : une borne
 * qui a perdu le réseau les affiche comme le reste (ADR 0016).
 *
 * Un contour épais et arrondi, des aplats, un reflet : elles restent lisibles
 * à 30 px sur une part de roue colorée comme à 70 px sur une bobine. Les
 * couleurs sont celles de l'objet (une cerise est rouge), pas celle du lot :
 * la couleur du lot reste le fond de sa part de roue.
 */
const ART: Record<DrawingName, ReactElement> = {
  etoile: (
    <>
      <polygon
        points="32,8 38.8,24.7 56.7,26 42.9,37.6 47.3,55 32,45.5 16.7,55 21.1,37.6 7.3,26 25.2,24.7"
        fill="#ffd23f"
      />
      <path d="M30.5 17 L27.5 25" {...SHINE} />
    </>
  ),
  diamant: (
    <>
      <g strokeWidth={2}>
        <polygon points="20,14 26,27 8,27" fill="#b9ecfb" />
        <polygon points="20,14 32,14 26,27" fill="#e3f8ff" />
        <polygon points="32,14 38,27 26,27" fill="#7fd8f6" />
        <polygon points="32,14 44,14 38,27" fill="#e3f8ff" />
        <polygon points="44,14 56,27 38,27" fill="#b9ecfb" />
        <polygon points="8,27 26,27 32,54" fill="#4cc3ea" />
        <polygon points="26,27 38,27 32,54" fill="#7fd8f6" />
        <polygon points="38,27 56,27 32,54" fill="#b9ecfb" />
      </g>
      <polygon points="20,14 44,14 56,27 32,54 8,27" />
    </>
  ),
  cerise: (
    <>
      <path
        d="M21 34 C23 22 29 14 37 9 M44 36 C43 26 40 16 37 9"
        stroke="#3d7a2a"
        strokeWidth={3.5}
      />
      <path
        d="M37 9 C42 3 52 4 56 9 C51 14 42 14 37 9 Z"
        fill="#5cc451"
        strokeWidth={2.5}
      />
      <circle cx="21" cy="44" r="11" fill="#e8253b" />
      <circle cx="44" cy="46" r="11" fill="#d61f33" />
      <path d="M15 42 A6 6 0 0 1 19 37.5" {...SHINE} />
      <path d="M38 44 A6 6 0 0 1 42 39.5" {...SHINE} />
    </>
  ),
  sept: (
    <>
      <path
        d="M14 11 H50 V19 C42 28 37 39 35 53 H23 C25 40 30 29 37 20 H14 Z"
        fill="#ff4757"
      />
      <path d="M18.5 15 H31" {...SHINE} />
    </>
  ),
  cloche: (
    <>
      <circle cx="32" cy="10" r="4" fill="#ffc533" />
      <circle cx="32" cy="54.5" r="4.5" fill="#f0a020" />
      <path
        d="M32 12 C22 12 17 19 17 29 C17 37 15 41 11 45 H53 C49 41 47 37 47 29 C47 19 42 12 32 12 Z"
        fill="#ffc533"
      />
      <rect x="9" y="44" width="46" height="7" rx="3.5" fill="#f0a020" />
      <path d="M23.5 21 C22.5 25 22.5 30 22.5 35" {...SHINE} />
    </>
  ),
  trefle: (
    <>
      <path
        d="M32 30 C34 42 38 50 45 57"
        strokeWidth={7}
        strokeLinecap="round"
      />
      <path d="M32 30 C34 42 38 50 45 57" stroke="#3a9a44" strokeWidth={3} />
      {[0, 90, 180, 270].map(turn => (
        <path
          key={turn}
          d={LEAF}
          fill={turn === 0 ? '#5cc451' : '#47b84f'}
          transform={`rotate(${turn} 32 30)`}
        />
      ))}
      <path d="M25 15 C24.5 17 25 19 26 20.5" {...SHINE} />
    </>
  ),
  coeur: (
    <>
      <path
        d="M32 54 C20 46 8 36 8 23 C8 15 14 10 21 10 C26 10 30 13 32 17 C34 13 38 10 43 10 C50 10 56 15 56 23 C56 36 44 46 32 54 Z"
        fill="#ff5d8f"
      />
      <path d="M14.5 22 C14.5 19 16.5 16.5 19.5 16" {...SHINE} />
    </>
  ),
  cadeau: (
    <>
      <rect x="12" y="29" width="40" height="27" rx="2" fill="#ff5a5f" />
      <rect x="9" y="21" width="46" height="10" rx="2" fill="#ff7b7f" />
      <rect x="28" y="21" width="8" height="35" fill="#ffd23f" />
      <path
        d="M32 21 C26 10 16 9 17 16 C18 21 26 22 32 21 Z M32 21 C38 10 48 9 47 16 C46 21 38 22 32 21 Z"
        fill="#ffd23f"
      />
      <circle cx="32" cy="21" r="3.5" fill="#f5b82e" />
      <path d="M16 35 V43" {...SHINE} />
    </>
  ),
  couronne: (
    <>
      <path
        d="M10 46 L8 20 L21 31 L32 13 L43 31 L56 20 L54 46 Z"
        fill="#ffd23f"
      />
      <rect x="9" y="44" width="46" height="9" rx="2" fill="#f5b82e" />
      <circle cx="8" cy="19" r="3.5" fill="#ff4757" />
      <circle cx="32" cy="12" r="3.5" fill="#4cc3ea" />
      <circle cx="56" cy="19" r="3.5" fill="#ff4757" />
      <g strokeWidth={2}>
        <circle cx="20" cy="48.5" r="2.2" fill="#ff4757" />
        <circle cx="32" cy="48.5" r="2.8" fill="#4cc3ea" />
        <circle cx="44" cy="48.5" r="2.2" fill="#ff4757" />
      </g>
      <path d="M14 39 L13.5 31" {...SHINE} />
    </>
  ),
  piece: (
    <>
      <circle cx="32" cy="32" r="24" fill="#ffcc33" />
      <circle
        cx="32"
        cy="32"
        r="18"
        fill="#ffd95e"
        stroke="#e0a800"
        strokeWidth={2.5}
      />
      <path d="M40 24.5 A10.5 10.5 0 1 0 40 39.5" strokeWidth={3.5} />
      <path d="M21.5 29.5 H34 M21.5 35 H34" strokeWidth={3} />
      <path d="M15 24 A19 19 0 0 1 21 15.5" {...SHINE} />
    </>
  ),
  trophee: (
    <>
      <path
        d="M19 15 H11 C10 25 14 31 21 31 M45 15 H53 C54 25 50 31 43 31"
        strokeWidth={3.5}
      />
      <path
        d="M18 9 H46 V21 C46 30 40 36 32 36 C24 36 18 30 18 21 Z"
        fill="#ffd23f"
      />
      <rect x="28.5" y="35" width="7" height="10" fill="#f5b82e" />
      <rect x="19" y="44" width="26" height="11" rx="2" fill="#a0522d" />
      <rect
        x="26"
        y="47.5"
        width="12"
        height="4"
        rx="1"
        fill="#ffd23f"
        strokeWidth={1.5}
      />
      <path d="M24 14 V23" {...SHINE} />
    </>
  ),
  citron: (
    <>
      <path
        d="M47 19 C50 11 56 8 60 10 C58 17 52 20 47 19 Z"
        fill="#5cc451"
        strokeWidth={2.5}
      />
      <g transform="rotate(-25 32 34)">
        <path
          d="M7 34 C7 32 9 31 11 31 C14 22 22 18 32 18 C42 18 50 22 53 31 C55 31 57 32 57 34 C57 36 55 37 53 37 C50 46 42 50 32 50 C22 50 14 46 11 37 C9 37 7 36 7 34 Z"
          fill="#ffe14d"
        />
        <path d="M19 28 C22 24.5 26 23.5 30 23.5" {...SHINE} />
      </g>
    </>
  ),
  pasteque: (
    <g transform="rotate(-12 32 32)">
      <path d="M6 20 A26 26 0 0 0 58 20 Z" fill="#3cb44b" />
      <path d="M11 20 A21 21 0 0 0 53 20 Z" fill="#eaffd0" stroke="none" />
      <path d="M14 20 A18 18 0 0 0 50 20 Z" fill="#ff4d5e" stroke="none" />
      <path d="M6 20 H58" />
      <g fill={INK} stroke="none">
        <ellipse cx="24" cy="25" rx="1.6" ry="2.6" />
        <ellipse cx="32" cy="29" rx="1.6" ry="2.6" />
        <ellipse cx="40" cy="25" rx="1.6" ry="2.6" />
        <ellipse cx="27" cy="34" rx="1.6" ry="2.6" />
        <ellipse cx="37" cy="34" rx="1.6" ry="2.6" />
      </g>
    </g>
  ),
  etiquette: (
    <>
      <path d="M34 6 H58 V30 L30 58 L6 34 Z" fill="#ff9f1c" />
      <circle cx="49" cy="15" r="3.5" fill="#ffffff" />
      <g strokeWidth={2.75}>
        <circle cx="25" cy="33" r="3.2" />
        <circle cx="36" cy="44" r="3.2" />
        <path d="M23.5 45.5 L37.5 31.5" />
      </g>
    </>
  ),
  bonbon: (
    <>
      <path
        d="M21 32 L7 21 C5 27 5 37 7 43 Z M43 32 L57 21 C59 27 59 37 57 43 Z"
        fill="#c9a7ff"
      />
      <circle cx="32" cy="32" r="13" fill="#9b6dff" />
      <path
        d="M26 27 C29.5 22.5 38 23.5 38.5 30 C39 36 31 38.5 28.5 34"
        {...SHINE}
      />
    </>
  ),
  nuage: (
    <>
      <path
        d="M24 47 L21 54 M33 47 L30 54 M42 47 L39 54"
        stroke="#4c9aff"
        strokeWidth={3}
      />
      <path
        d="M19 42 C12 42 9 36 12 31 C14 27 18 26 20 27 C21 20 27 16 33 17 C39 18 43 22 44 27 C50 26 55 30 55 35 C55 40 51 42 47 42 Z"
        fill="#d9e2ec"
      />
      <g fill={INK} stroke="none">
        <circle cx="28" cy="31" r="1.7" />
        <circle cx="38" cy="31" r="1.7" />
      </g>
      <path d="M29 37.5 C31 35.5 35 35.5 37 37.5" strokeWidth={2} />
    </>
  ),
};

/**
 * Une illustration du catalogue. Décorative (`aria-hidden`) : là où elle
 * s'affiche, le libellé du lot est dit autrement.
 */
export function Drawing({
  name,
  className,
}: {
  name: DrawingName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ART[name]}
      </g>
    </svg>
  );
}
