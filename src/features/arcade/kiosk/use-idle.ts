import { useEffect, useRef } from 'react';

const ACTIVITY = ['pointerdown', 'keydown', 'input', 'wheel', 'touchstart'];

/**
 * Appelle `onIdle` après `timeoutMs` sans le moindre geste, tant que `active`.
 *
 * C'est ce qui remet une borne à zéro quand le joueur s'en va au milieu du
 * formulaire : sans lui, le visiteur suivant trouvait le prénom et l'adresse
 * du précédent dans les champs.
 */
export function useIdle(
  timeoutMs: number,
  onIdle: () => void,
  active: boolean
): void {
  const callback = useRef(onIdle);
  useEffect(() => {
    callback.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!active) return undefined;
    let timer = window.setTimeout(() => callback.current(), timeoutMs);
    const restart = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback.current(), timeoutMs);
    };
    for (const type of ACTIVITY) {
      window.addEventListener(type, restart, { passive: true });
    }
    return () => {
      window.clearTimeout(timer);
      for (const type of ACTIVITY) window.removeEventListener(type, restart);
    };
  }, [timeoutMs, active]);
}
