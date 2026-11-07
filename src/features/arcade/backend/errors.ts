import { isTransientMessage } from '@mister-guiiug/dev-pwa-config/react/net';

/**
 * LES ÉCHECS, PAR CODE ET NON PAR MESSAGE. Le visiteur d'une borne ne doit
 * jamais lire « permission denied for function is_super_admin » : c'est ce
 * qu'affichait la production jusqu'au 07/11/2026. L'écran traduit le code ; le
 * message d'origine part au journal.
 */
export type ArcadeErrorCode =
  | 'network'
  | 'not-found'
  | 'forbidden'
  | 'conflict'
  | 'sold-out'
  | 'rate-limited'
  | 'invalid'
  | 'unsupported'
  | 'queue-full'
  | 'offline-required'
  | 'unknown';

export class ArcadeError extends Error {
  readonly code: ArcadeErrorCode;
  /** Le statut HTTP, lu par `defaultShouldRetry` du socle. */
  readonly status: number | undefined;

  constructor(code: ArcadeErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'ArcadeError';
    this.code = code;
    this.status = status;
  }
}

/** Ce que rend PostgREST : un code SQLSTATE (`PT404`…) et un statut HTTP. */
export interface PostgrestFailure {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}

/**
 * Traduit un échec Supabase en `ArcadeError`. Les fonctions de 0008 lèvent des
 * codes `PTxxx`, que PostgREST rend tels quels en statut HTTP : c'est sur eux
 * qu'on décide, pas sur le texte.
 */
export function fromPostgrest(
  failure: PostgrestFailure,
  status?: number
): ArcadeError {
  const code = failure.code ?? '';
  const message = failure.message || 'erreur inconnue';
  // Le code d'abord : le texte trompe (« borne non reconnue » contient
  // « econn », que l'heuristique réseau du socle prend pour une coupure).
  const http = code.startsWith('PT') ? Number(code.slice(2)) : status;
  switch (http) {
    case 400:
      return new ArcadeError('invalid', message, 400);
    case 401:
    case 403:
      return new ArcadeError('forbidden', message, http);
    case 404:
      return new ArcadeError('not-found', message, 404);
    case 409:
      return new ArcadeError('conflict', message, 409);
    case 410:
      return new ArcadeError('sold-out', message, 410);
    case 429:
      return new ArcadeError('rate-limited', message, 429);
    default:
      break;
  }
  if (code === '42501') return new ArcadeError('forbidden', message, 403);
  if (code === '23505') return new ArcadeError('conflict', message, 409);
  if (code === '23514' || code === '22P02' || code === '23502') {
    return new ArcadeError('invalid', message, 400);
  }
  // Sans statut exploitable (coupure, délai), seul le message peut dire.
  if (!http || isTransientMessage(message)) {
    return new ArcadeError('network', message, http || undefined);
  }
  return new ArcadeError('unknown', message, http);
}

/** N'importe quel échec, ramené à un code d'écran. */
export function toArcadeError(cause: unknown): ArcadeError {
  if (cause instanceof ArcadeError) return cause;
  const message = cause instanceof Error ? cause.message : String(cause);
  if (cause instanceof Error && cause.name === 'AbortError') {
    return new ArcadeError('network', message);
  }
  if (cause instanceof Error && cause.name === 'TimeoutError') {
    return new ArcadeError('network', message);
  }
  if (isTransientMessage(message)) return new ArcadeError('network', message);
  return new ArcadeError('unknown', message);
}

/**
 * Un nouvel essai peut-il réussir ? Réseau, débit et pannes serveur : oui. Un
 * refus (droits, validation, doublon) échouera à l'identique : il part en
 * lettre morte, montré à l'admin, plutôt que de bloquer la file.
 */
export function isRetryable(cause: unknown): boolean {
  const error = toArcadeError(cause);
  if (error.code === 'network' || error.code === 'rate-limited') return true;
  if (error.code === 'unknown') {
    return error.status === undefined || error.status >= 500;
  }
  return false;
}
