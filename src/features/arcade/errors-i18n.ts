import type { ArcadeErrorCode } from './backend/errors.ts';

type ErrorKey =
  | 'errors.network'
  | 'errors.notFound'
  | 'errors.forbidden'
  | 'errors.conflict'
  | 'errors.soldOut'
  | 'errors.rateLimited'
  | 'errors.invalid'
  | 'errors.unsupported'
  | 'errors.queueFull'
  | 'errors.offlineRequired'
  | 'errors.unknown';

const KEYS: Record<ArcadeErrorCode, ErrorKey> = {
  network: 'errors.network',
  'not-found': 'errors.notFound',
  forbidden: 'errors.forbidden',
  conflict: 'errors.conflict',
  'sold-out': 'errors.soldOut',
  'rate-limited': 'errors.rateLimited',
  invalid: 'errors.invalid',
  unsupported: 'errors.unsupported',
  'queue-full': 'errors.queueFull',
  'offline-required': 'errors.offlineRequired',
  unknown: 'errors.unknown',
};

/** La clé du message d'écran d'un code d'échec : le visiteur ne lit jamais le message brut. */
export function errorKey(code: ArcadeErrorCode): ErrorKey {
  return KEYS[code];
}
