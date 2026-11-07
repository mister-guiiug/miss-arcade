import {
  createSyncQueue,
  type SyncQueue,
  type SyncQueueEntry,
} from '@mister-guiiug/dev-pwa-config/sync-queue';
import { createStore } from '@mister-guiiug/dev-pwa-config/storage';
import { createLogger } from '@mister-guiiug/dev-pwa-config/logger';
import type { LeadSubmission, OfflineSpin } from '../model.ts';
import type { ArcadeBackend } from '../backend/ports.ts';
import { ArcadeError, isRetryable, toArcadeError } from '../backend/errors.ts';

const log = createLogger('envoi');

/**
 * LA FILE D'ENVOI, ET POURQUOI UNE FILE PLUTÔT QU'UNE PILE.
 *
 * Ce qui part vers le serveur part DANS L'ORDRE où cela s'est passé : le
 * tirage hors ligne avant le lead qui s'y rattache, sinon le serveur refuse le
 * lead (« tirage inconnu »). Une pile (dernier entré, premier sorti) inverserait
 * exactement cet ordre. C'est donc une file : `createSyncQueue` du socle, qui
 * persiste, draine en série, rejoue en retrait exponentiel au retour du réseau,
 * et met de côté (lettre morte) ce que le serveur refuse durablement au lieu de
 * bloquer tout ce qui suit.
 *
 * CHAQUE ÉLÉMENT PORTE SON IDENTIFIANT, et le serveur est idempotent dessus :
 * un envoi dont la réponse s'est perdue est simplement renvoyé, sans doublon.
 *
 * Les coordonnées n'y restent que le temps de partir : retirées à l'accusé de
 * réception, jamais gardées en historique sur la borne.
 */
export type OutboxItem =
  { kind: 'spin'; spin: OfflineSpin } | { kind: 'lead'; lead: LeadSubmission };

export type OutboxStatus = 'synced' | 'pending' | 'offline' | 'error';

export interface OutboxSnapshot {
  status: OutboxStatus;
  pending: number;
  dead: number;
  lastError: string | null;
}

export interface Outbox {
  /** `false` quand la file est pleine : l'appelant doit le dire, pas jeter. */
  push(item: OutboxItem): boolean;
  flush(): Promise<void>;
  start(): Promise<void>;
  stop(): void;
  retryDead(): number;
  clearDead(): void;
  /** Vide tout, file et lettres mortes (tests, appareil rendu). */
  clear(): void;
  deadLetters(): SyncQueueEntry<OutboxItem>[];
  pendingItems(): SyncQueueEntry<OutboxItem>[];
  subscribe(listener: () => void): () => void;
  getSnapshot(): OutboxSnapshot;
}

export interface OutboxOptions {
  backend: ArcadeBackend;
  /** Le jeton de la borne appairée, lu au moment de l'envoi. */
  kioskToken: () => string | null;
  prefix?: string;
  isOnline?: () => boolean;
  env?: unknown;
  maxQueueSize?: number;
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
}

/**
 * Deux mille éléments : une journée de salon hors ligne tient largement, et
 * `localStorage` est partagé par toute la famille sur la même origine (≈ 5 Mo).
 */
const MAX_QUEUE = 2000;

export function createOutbox(options: OutboxOptions): Outbox {
  const {
    backend,
    kioskToken,
    prefix = 'miss-arcade-envoi-',
    maxQueueSize = MAX_QUEUE,
    env = globalThis,
  } = options;
  // En local, il n'y a pas de réseau à traverser : la file se vide tout de
  // suite, hors ligne compris.
  const isOnline =
    options.isOnline ??
    (() => backend.kind === 'local' || globalThis.navigator?.onLine !== false);

  let snapshot: OutboxSnapshot = {
    status: isOnline() ? 'synced' : 'offline',
    pending: 0,
    dead: 0,
    lastError: null,
  };
  const listeners = new Set<() => void>();

  // Un objet MÉMORISÉ, remplacé seulement quand il change : `useSyncExternalStore`
  // compare par identité, et un objet neuf à chaque lecture fait boucler le rendu.
  function publish(next: Partial<OutboxSnapshot>) {
    const candidate: OutboxSnapshot = { ...snapshot, ...next };
    candidate.status =
      candidate.dead > 0
        ? 'error'
        : !isOnline()
          ? 'offline'
          : candidate.pending > 0
            ? 'pending'
            : 'synced';
    if (
      candidate.status === snapshot.status &&
      candidate.pending === snapshot.pending &&
      candidate.dead === snapshot.dead &&
      candidate.lastError === snapshot.lastError
    ) {
      return;
    }
    snapshot = candidate;
    for (const listener of listeners) listener();
  }

  const queue: SyncQueue<OutboxItem> = createSyncQueue<OutboxItem>({
    store: createStore(prefix),
    async process(item) {
      const token = kioskToken();
      if (item.kind === 'spin') {
        if (!token) {
          throw new ArcadeError(
            'forbidden',
            'tirage hors ligne sans borne',
            403
          );
        }
        await backend.recordOfflineSpin(item.spin, token);
      } else {
        await backend.submitLead(item.lead, token);
      }
    },
    keyOf: item =>
      item.kind === 'spin'
        ? `spin:${item.spin.spinId}`
        : `lead:${item.lead.id}`,
    shouldRetry: error => isRetryable(error),
    // Un échec réseau n'épuise jamais un lead : seuls les refus du serveur
    // (droits, validation) l'envoient en lettre morte, dès le premier.
    maxAttempts: Number.MAX_SAFE_INTEGER,
    maxQueueSize,
    backoff: { baseDelayMs: 2000, maxDelayMs: 60_000 },
    isOnline,
    onDead: (entry, error) => {
      const failure = toArcadeError(error);
      log.error('envoi refusé durablement', {
        kind: entry.payload.kind,
        code: failure.code,
        message: failure.message,
      });
      publish({ lastError: failure.code });
    },
    onChange: ({ pending, dead }) => publish({ pending, dead }),
    env,
    ...(options.setTimeout ? { setTimeout: options.setTimeout } : {}),
    ...(options.clearTimeout ? { clearTimeout: options.clearTimeout } : {}),
  });

  publish({ pending: queue.pending(), dead: queue.deadLetters().length });

  const target = env as {
    addEventListener?: (type: string, listener: () => void) => void;
    removeEventListener?: (type: string, listener: () => void) => void;
  };
  const onNetwork = () => publish({});

  return {
    push(item) {
      const entry = queue.enqueue(item);
      if (!entry) {
        log.error('file d’envoi pleine', { pending: queue.pending() });
        publish({ lastError: 'queue-full' });
        return false;
      }
      void queue.flush();
      return true;
    },
    async flush() {
      await queue.flush();
    },
    async start() {
      target.addEventListener?.('online', onNetwork);
      target.addEventListener?.('offline', onNetwork);
      await queue.start();
    },
    stop() {
      target.removeEventListener?.('online', onNetwork);
      target.removeEventListener?.('offline', onNetwork);
      queue.stop();
    },
    retryDead() {
      const count = queue.requeueDead();
      publish({ lastError: null });
      void queue.flush();
      return count;
    },
    clearDead() {
      queue.clearDead();
      publish({ dead: 0, lastError: null });
    },
    clear() {
      queue.clear();
      publish({ pending: 0, dead: 0, lastError: null });
    },
    deadLetters: () => queue.deadLetters(),
    pendingItems: () => queue.list(),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
  };
}
