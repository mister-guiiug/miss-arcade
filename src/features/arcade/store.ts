import { create } from 'zustand';
import { createVersionedStore } from '@mister-guiiug/dev-pwa-config/versioned-store';
import { createId } from '@mister-guiiug/dev-pwa-config/id';
import { createLogger } from '@mister-guiiug/dev-pwa-config/logger';
import {
  arcadeSchema,
  defaultArcade,
  drawPrize,
  type ArcadeSnapshot,
  type GameType,
  type Lead,
  type LeadField,
  type Prize,
} from './model.ts';

const log = createLogger('arcade');

/**
 * Magasin versionné dédié au métier stand. Séparé du port `notes` du squelette :
 * les leads et lots ne sont pas des notes, et un export « notes » mélangé
 * tromperait l'opérateur qui configure une borne hors ligne.
 */
export const arcadeStore = createVersionedStore<ArcadeSnapshot>({
  store: 'miss-arcade',
  key: 'arcade',
  version: 1,
  validate: data => arcadeSchema.parse(data),
  seed: defaultArcade,
  migrations: {} as Record<number, (data: unknown) => unknown>,
});

interface ArcadeState {
  snapshot: ArcadeSnapshot;
  ready: boolean;
  error: string | null;
  /** Dernier lot tiré (session), pour l'écran de résultat. */
  lastPrize: Prize | null;
  load: () => void;
  setActiveGame: (game: GameType) => void;
  updateConfig: (
    patch: Partial<
      Pick<
        ArcadeSnapshot,
        | 'welcomeMessage'
        | 'winMessage'
        | 'loseMessage'
        | 'leadFormEnabled'
        | 'leadFields'
      >
    >
  ) => void;
  setPrizes: (prizes: Prize[]) => void;
  upsertPrize: (prize: Prize) => void;
  removePrize: (id: string) => void;
  /** Tire un lot, décrémente le stock si besoin, persiste. */
  spin: () => Prize | null;
  clearLastPrize: () => void;
  addLead: (fields: Record<string, string>) => void;
  clearLeads: () => void;
  clearAll: () => void;
  exportJson: () => string | null;
  importJson: (json: string) => number | null;
}

function write(
  next: ArcadeSnapshot,
  set: (partial: Partial<ArcadeState>) => void
) {
  try {
    arcadeStore.save(next);
    set({ snapshot: next, error: null });
  } catch (cause) {
    log.error('écriture arcade', { cause });
    set({
      error: cause instanceof Error ? cause.message : String(cause),
    });
  }
}

export const useArcade = create<ArcadeState>((set, get) => ({
  snapshot: defaultArcade(),
  ready: false,
  error: null,
  lastPrize: null,

  load() {
    try {
      const snapshot = arcadeStore.load();
      set({ snapshot, ready: true, error: null });
    } catch (cause) {
      log.error('lecture arcade', { cause });
      set({
        ready: true,
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  },

  setActiveGame(game) {
    write({ ...get().snapshot, activeGame: game }, set);
  },

  updateConfig(patch) {
    write({ ...get().snapshot, ...patch }, set);
  },

  setPrizes(prizes) {
    write({ ...get().snapshot, prizes }, set);
  },

  upsertPrize(prize) {
    const prizes = [...get().snapshot.prizes];
    const index = prizes.findIndex(p => p.id === prize.id);
    if (index >= 0) prizes[index] = prize;
    else prizes.push(prize);
    write({ ...get().snapshot, prizes }, set);
  },

  removePrize(id) {
    const prizes = get().snapshot.prizes.filter(p => p.id !== id);
    if (prizes.length === 0) return;
    write({ ...get().snapshot, prizes }, set);
  },

  spin() {
    const { snapshot } = get();
    const prize = drawPrize(snapshot.prizes);
    if (!prize) {
      set({ lastPrize: null, error: 'Aucun lot disponible' });
      return null;
    }
    const prizes = snapshot.prizes.map(p => {
      if (p.id !== prize.id) return p;
      if (p.stock === null || p.lose) return p;
      return { ...p, stock: Math.max(0, p.stock - 1) };
    });
    write({ ...snapshot, prizes }, set);
    set({ lastPrize: prize });
    return prize;
  },

  clearLastPrize() {
    set({ lastPrize: null });
  },

  addLead(fields) {
    const { snapshot, lastPrize } = get();
    const cleaned: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      const trimmed = value.trim();
      if (trimmed) cleaned[key] = trimmed;
    }
    if (Object.keys(cleaned).length === 0) return;
    const lead: Lead = {
      id: createId('lead'),
      createdAt: new Date().toISOString(),
      prizeId: lastPrize?.id ?? null,
      prizeLabel: lastPrize?.label ?? '',
      game: snapshot.activeGame,
      fields: cleaned,
    };
    write({ ...snapshot, leads: [lead, ...snapshot.leads] }, set);
  },

  clearLeads() {
    write({ ...get().snapshot, leads: [] }, set);
  },

  clearAll() {
    arcadeStore.clear();
    const snapshot = defaultArcade();
    arcadeStore.save(snapshot);
    set({ snapshot, lastPrize: null, error: null });
  },

  exportJson() {
    return arcadeStore.export();
  },

  importJson(json) {
    try {
      const snapshot = arcadeStore.import(json);
      set({ snapshot, error: null, lastPrize: null });
      return snapshot.leads.length;
    } catch (cause) {
      log.error('import arcade', { cause });
      set({
        error: cause instanceof Error ? cause.message : String(cause),
      });
      return null;
    }
  },
}));

export type { LeadField };
