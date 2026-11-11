import { useState } from 'react';
import { Drawing } from './Drawing.tsx';
import type { Face } from './faces.ts';

/**
 * Une face de lot, quel que soit son jeu d'icônes. Le texte reste du texte nu
 * (les bobines et la roue le stylent déjà) ; un dessin ou une image prend la
 * classe `arcade-icon`, que chaque emplacement dimensionne.
 */
export function PrizeIcon({ face }: { face: Face }) {
  if (face.kind === 'text') return <>{face.text}</>;
  if (face.kind === 'drawing') {
    return <Drawing name={face.name} className="arcade-icon" />;
  }
  return <ImageIcon key={face.src} src={face.src} fallback={face.fallback} />;
}

/**
 * Une image d'admin. Si elle ne vient pas (borne hors ligne qui ne l'avait
 * jamais affichée, fichier retiré du stockage), le symbole du lot la remplace :
 * une case vide sur une bobine ne dit rien au joueur.
 */
function ImageIcon({ src, fallback }: { src: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt=""
      className="arcade-icon arcade-icon--image"
      draggable={false}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
