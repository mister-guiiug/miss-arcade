import { useEffect, useState } from 'react';
import { qrToSvg } from '@mister-guiiug/dev-pwa-config/qr';

/**
 * Un QR code rendu en `<img>` (SVG en `data:`), jamais en `innerHTML` : la CSP
 * de l'app accepte `data:` en `img-src`, et rien n'est injecté dans le DOM.
 * `uqr` n'est chargé qu'ici, à la première ouverture d'un écran qui en montre.
 */
export function QrCode({
  text,
  label,
  size = 192,
}: {
  text: string;
  label: string;
  size?: number;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    qrToSvg(text, { margin: 2, errorCorrectionLevel: 'M' })
      .then(svg => {
        if (alive)
          setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      })
      .catch(() => {
        if (alive) setSrc(null);
      });
    return () => {
      alive = false;
    };
  }, [text]);

  if (!src) return null;
  return (
    <img
      src={src}
      alt={label}
      width={size}
      height={size}
      className="arcade-qr"
    />
  );
}
