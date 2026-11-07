import { useSyncExternalStore } from 'react';
import { arcade } from '../../../backend/index.ts';
import { currentKioskToken } from '../kiosk/device.ts';
import { createOutbox, type Outbox, type OutboxSnapshot } from './outbox.ts';

/**
 * La file d'envoi de l'application, une seule, démarrée au chargement : une
 * borne rouverte après une coupure envoie ce qu'elle a gardé sans attendre
 * qu'on rejoue.
 */
export const outbox: Outbox = createOutbox({
  backend: arcade,
  kioskToken: currentKioskToken,
});

let started = false;

export function startOutbox(): void {
  if (started) return;
  started = true;
  void outbox.start();
}

export function useOutbox(): OutboxSnapshot {
  return useSyncExternalStore(
    outbox.subscribe,
    outbox.getSnapshot,
    outbox.getSnapshot
  );
}
