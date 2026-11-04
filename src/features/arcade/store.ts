import { create } from 'zustand';
import { createVersionedStore } from '@mister-guiiug/dev-pwa-config/versioned-store';
import { createId } from '@mister-guiiug/dev-pwa-config/id';
import { createLogger } from '@mister-guiiug/dev-pwa-config/logger';
import { coverage } from '../../backend/index.ts';
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
import {
  fetchAdminLeads,
  fetchPublicArcade,
  fetchTenantBySlug,
  insertLead,
  publicSpin,
  replacePrizes,
  saveConfig,
  type TenantInfo,
} from './tenant-api.ts';

const log = createLogger('arcade');

/** Repli local hors ligne / sans backend. */
export const arcadeStore = createVersionedStore<ArcadeSnapshot>({
  store: 'miss-arcade',
  key: 'arcade',
  version: 2,
  validate: data => arcadeSchema.parse(data),
  seed: defaultArcade,
  migrations: {
    1: (data: unknown) => {
      const d = (data ?? {}) as Record<string, unknown>;
      return {
        ...defaultArcade(),
        ...d,
        wallpaperDesktop: null,
        wallpaperMobile: null,
        logoUrl: null,
      };
    },
  },
});

interface ArcadeState {
  tenant: TenantInfo | null;
  snapshot: ArcadeSnapshot;
  ready: boolean;
  error: string | null;
  lastPrize: Prize | null;
  load: (slug?: string) => Promise<void>;
  setActiveGame: (game: GameType) => Promise<void>;
  updateConfig: (
    patch: Partial<
      Pick<
        ArcadeSnapshot,
        | 'welcomeMessage'
        | 'winMessage'
        | 'loseMessage'
        | 'leadFormEnabled'
        | 'leadFields'
        | 'wallpaperDesktop'
        | 'wallpaperMobile'
        | 'logoUrl'
      >
    >
  ) => Promise<void>;
  setPrizes: (prizes: Prize[]) => Promise<void>;
  upsertPrize: (prize: Prize) => Promise<void>;
  removePrize: (id: string) => Promise<void>;
  spin: () => Promise<Prize | null>;
  clearLastPrize: () => void;
  addLead: (fields: Record<string, string>) => Promise<void>;
  clearLeads: () => Promise<void>;
  clearAll: () => Promise<void>;
  exportJson: () => string | null;
  importJson: (json: string) => number | null;
  persistRemote: () => Promise<void>;
}

function remote() {
  return coverage.kind === 'supabase';
}

async function writeLocal(
  next: ArcadeSnapshot,
  set: (partial: Partial<ArcadeState>) => void
) {
  try {
    arcadeStore.save(next);
    set({ snapshot: next, error: null });
  } catch (cause) {
    log.error('écriture arcade locale', { cause });
    set({
      error: cause instanceof Error ? cause.message : String(cause),
    });
  }
}

export const useArcade = create<ArcadeState>((set, get) => ({
  tenant: null,
  snapshot: defaultArcade(),
  ready: false,
  error: null,
  lastPrize: null,

  async load(slug = 'demo') {
    try {
      if (remote()) {
        const tenant = await fetchTenantBySlug(slug);
        if (!tenant) {
          set({
            ready: true,
            error: `Borne « ${slug} » introuvable`,
            tenant: null,
          });
          return;
        }
        const snapshot = await fetchPublicArcade(tenant.id);
        let leads: Lead[] = [];
        try {
          leads = await fetchAdminLeads(tenant.id);
        } catch {
          // Anon : pas de lecture leads — normal.
        }
        set({
          tenant,
          snapshot: { ...snapshot, leads },
          ready: true,
          error: null,
        });
        return;
      }
      const snapshot = arcadeStore.load();
      set({
        tenant: { id: 'local', slug: 'demo', name: 'Démo locale' },
        snapshot,
        ready: true,
        error: null,
      });
    } catch (cause) {
      log.error('lecture arcade', { cause });
      set({
        ready: true,
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  },

  async persistRemote() {
    const { tenant, snapshot } = get();
    if (!remote() || !tenant || tenant.id === 'local') return;
    await saveConfig(tenant.id, snapshot, {
      wallpaperDesktop: snapshot.wallpaperDesktop,
      wallpaperMobile: snapshot.wallpaperMobile,
      logoUrl: snapshot.logoUrl,
    });
    await replacePrizes(tenant.id, snapshot.prizes);
  },

  async setActiveGame(game) {
    const next = { ...get().snapshot, activeGame: game };
    await writeLocal(next, set);
    try {
      await get().persistRemote();
    } catch (cause) {
      set({
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  },

  async updateConfig(patch) {
    const next = { ...get().snapshot, ...patch };
    await writeLocal(next, set);
    try {
      await get().persistRemote();
    } catch (cause) {
      set({
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  },

  async setPrizes(prizes) {
    const next = { ...get().snapshot, prizes };
    await writeLocal(next, set);
    try {
      await get().persistRemote();
    } catch (cause) {
      set({
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  },

  async upsertPrize(prize) {
    const prizes = [...get().snapshot.prizes];
    const index = prizes.findIndex(p => p.id === prize.id);
    if (index >= 0) prizes[index] = prize;
    else prizes.push(prize);
    await get().setPrizes(prizes);
  },

  async removePrize(id) {
    const prizes = get().snapshot.prizes.filter(p => p.id !== id);
    if (prizes.length === 0) return;
    await get().setPrizes(prizes);
  },

  async spin() {
    const { snapshot, tenant } = get();
    try {
      if (remote() && tenant && tenant.id !== 'local') {
        const prize = await publicSpin(tenant.slug);
        if (!prize) {
          set({ lastPrize: null, error: 'Aucun lot disponible' });
          return null;
        }
        // Recharger les stocks après tirage serveur.
        const refreshed = await fetchPublicArcade(tenant.id);
        set({
          snapshot: { ...refreshed, leads: snapshot.leads },
          lastPrize: prize,
          error: null,
        });
        return prize;
      }
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
      await writeLocal({ ...snapshot, prizes }, set);
      set({ lastPrize: prize });
      return prize;
    } catch (cause) {
      set({
        error: cause instanceof Error ? cause.message : String(cause),
      });
      return null;
    }
  },

  clearLastPrize() {
    set({ lastPrize: null });
  },

  async addLead(fields) {
    const { snapshot, lastPrize, tenant } = get();
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
    const next = { ...snapshot, leads: [lead, ...snapshot.leads] };
    await writeLocal(next, set);
    if (remote() && tenant && tenant.id !== 'local') {
      try {
        await insertLead(tenant.id, lead);
      } catch (cause) {
        set({
          error: cause instanceof Error ? cause.message : String(cause),
        });
      }
    }
  },

  async clearLeads() {
    const next = { ...get().snapshot, leads: [] };
    await writeLocal(next, set);
  },

  async clearAll() {
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
