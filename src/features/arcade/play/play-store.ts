import { create } from 'zustand';
import { createLogger } from '@mister-guiiug/dev-pwa-config/logger';
import { arcade } from '../../../backend/index.ts';
import {
  decrementStock,
  drawPrize,
  newLeadId,
  newRedeemCode,
  newSpinId,
  type LeadField,
  type PublicGame,
  type SpinOutcome,
} from '../model.ts';
import {
  ArcadeError,
  toArcadeError,
  type ArcadeErrorCode,
} from '../backend/errors.ts';
import { kioskTokenFor } from '../kiosk/device.ts';
import { outbox } from '../sync/index.ts';
import { readCachedGame, warmImages, writeCachedGame } from './cache.ts';

const log = createLogger('jeu');

/** Au-delà, une requête de tirage est tenue pour perdue (réseau « lie-fi »). */
const SPIN_TIMEOUT_MS = 8000;
const LOAD_TIMEOUT_MS = 10_000;

export type LeadResult = 'sent' | 'queued' | 'full';

interface PlayState {
  slug: string | null;
  game: PublicGame | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: ArcadeErrorCode | null;
  /** Hors ligne, la borne joue sur sa dernière config connue. */
  fromCache: boolean;
  outcome: SpinOutcome | null;
  busy: boolean;
  load: (slug: string) => Promise<void>;
  spin: () => Promise<SpinOutcome | ArcadeErrorCode>;
  submitLead: (fields: Partial<Record<LeadField, string>>) => LeadResult;
  clearOutcome: () => void;
}

/**
 * Une requête qui ne répond pas est un échec réseau : c'est ce qui permet de
 * basculer en hors ligne sur une connexion qui accroche sans rien rendre.
 */
async function withTimeout<T>(
  ms: number,
  run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ArcadeError('network', 'délai dépassé'));
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal), expired]);
  } finally {
    clearTimeout(timer);
  }
}

function isOffline(): boolean {
  return globalThis.navigator?.onLine === false;
}

/**
 * LE JEU PUBLIC. Trois chemins pour un tirage :
 *
 * 1. EN LIGNE, le serveur décide (`arcade_spin`) : pondération, stock, code de
 *    retrait. Un échec réseau est retenté UNE fois avec le MÊME identifiant :
 *    si la première requête avait abouti sans que la réponse revienne, le
 *    serveur rend ce tirage-là au lieu d'en tirer un second.
 * 2. HORS LIGNE, sur une borne APPAIRÉE : tirage local sur la dernière config
 *    connue, mis en file d'envoi, déclaré au retour du réseau. Le lot promis
 *    est honoré ; une survente éventuelle est signalée au tableau de bord.
 * 3. HORS LIGNE, sans borne : le jeu le dit. Un téléphone de visiteur n'a
 *    aucun titre à déclarer des gains que personne n'a vus.
 *
 * En mode local (sans serveur), le premier chemin est le stockage de
 * l'appareil : il n'échoue jamais pour raison de réseau.
 */
export const usePlay = create<PlayState>((set, get) => ({
  slug: null,
  game: null,
  status: 'idle',
  error: null,
  fromCache: false,
  outcome: null,
  busy: false,

  async load(slug) {
    const same = get().slug === slug && get().game !== null;
    set({
      slug,
      status: same ? 'ready' : 'loading',
      error: null,
      ...(same ? {} : { game: null, outcome: null }),
    });
    try {
      const game = await withTimeout(LOAD_TIMEOUT_MS, () =>
        arcade.loadGame(slug)
      );
      if (get().slug !== slug) return;
      writeCachedGame(slug, game);
      warmImages(game);
      set({ game, status: 'ready', fromCache: false, error: null });
    } catch (cause) {
      if (get().slug !== slug) return;
      const error = toArcadeError(cause);
      const cached = readCachedGame(slug);
      if (cached && (error.code === 'network' || error.code === 'unknown')) {
        log.warn('jeu servi depuis le cache', { slug, code: error.code });
        set({
          game: cached.game,
          status: 'ready',
          fromCache: true,
          error: null,
        });
        return;
      }
      log.error('jeu introuvable', {
        slug,
        code: error.code,
        message: error.message,
      });
      set({
        status: 'error',
        error: error.code,
        game: same ? get().game : null,
      });
    }
  },

  async spin() {
    const { game, slug, busy } = get();
    if (busy || !game || !slug) return 'invalid';
    set({ busy: true, outcome: null });
    const token = arcade.kind === 'supabase' ? kioskTokenFor(slug) : null;
    const spinId = newSpinId();
    const type = game.config.activeGame;

    const online = () =>
      withTimeout(SPIN_TIMEOUT_MS, signal =>
        arcade.spin({ slug, spinId, game: type, kioskToken: token, signal })
      );

    try {
      let outcome: SpinOutcome;
      try {
        if (arcade.kind === 'supabase' && isOffline()) {
          throw new ArcadeError('network', 'hors ligne');
        }
        try {
          outcome = await online();
        } catch (first) {
          if (toArcadeError(first).code !== 'network' || isOffline())
            throw first;
          await new Promise(resolve => setTimeout(resolve, 800));
          outcome = await online();
        }
        const prizes = game.prizes.map(p =>
          p.id === outcome.prize.id ? { ...p, stock: outcome.prize.stock } : p
        );
        const next = { ...game, prizes };
        writeCachedGame(slug, next);
        set({ game: next, outcome, busy: false, fromCache: false });
        return outcome;
      } catch (cause) {
        const error = toArcadeError(cause);
        if (error.code !== 'network' || arcade.kind !== 'supabase') throw error;
        if (!token) {
          throw new ArcadeError('offline-required', 'connexion nécessaire');
        }
        return offlineSpin(spinId, game, slug);
      }
    } catch (cause) {
      const error = toArcadeError(cause);
      log.warn('tirage refusé', { code: error.code, message: error.message });
      set({ busy: false });
      return error.code;
    }

    function offlineSpin(id: string, current: PublicGame, key: string) {
      const prize = drawPrize(current.prizes);
      if (!prize)
        throw new ArcadeError('sold-out', 'aucun lot disponible', 410);
      const playedAt = new Date().toISOString();
      const redeemCode = newRedeemCode();
      const pushed = outbox.push({
        kind: 'spin',
        spin: {
          spinId: id,
          prizeId: prize.id,
          prizeLabel: prize.label,
          lose: prize.lose,
          game: current.config.activeGame,
          redeemCode,
          playedAt,
        },
      });
      if (!pushed) throw new ArcadeError('queue-full', 'file d’envoi pleine');
      const next = {
        ...current,
        prizes: decrementStock(current.prizes, prize.id),
      };
      writeCachedGame(key, next);
      const outcome: SpinOutcome = {
        spinId: id,
        redeemCode,
        source: 'offline',
        playedAt,
        prize,
      };
      set({ game: next, outcome, busy: false, fromCache: true });
      return outcome;
    }
  },

  submitLead(fields) {
    const { outcome, game } = get();
    if (!outcome || !game) return 'full';
    const cleaned: Partial<Record<LeadField, string>> = {};
    for (const [key, value] of Object.entries(fields) as [
      LeadField,
      string,
    ][]) {
      if (value.trim()) cleaned[key] = value.trim();
    }
    const pushed = outbox.push({
      kind: 'lead',
      lead: {
        id: newLeadId(),
        spinId: outcome.spinId,
        fields: cleaned,
        consentText: game.config.consentText,
        consentedAt: new Date().toISOString(),
      },
    });
    if (!pushed) return 'full';
    return arcade.kind === 'local' || !isOffline() ? 'sent' : 'queued';
  },

  clearOutcome() {
    set({ outcome: null });
  },
}));
