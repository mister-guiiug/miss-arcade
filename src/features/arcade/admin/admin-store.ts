import { create } from 'zustand';
import { createStore } from '@mister-guiiug/dev-pwa-config/storage';
import { createLogger } from '@mister-guiiug/dev-pwa-config/logger';
import { arcade } from '../../../backend/index.ts';
import { z } from 'zod';
import {
  gameConfigSchema,
  newPrizeId,
  prizeSchema,
  type Access,
  type AdminSnapshot,
  type GameConfig,
  type Prize,
  type PrizeInput,
} from '../model.ts';
import { toArcadeError, type ArcadeErrorCode } from '../backend/errors.ts';

const log = createLogger('admin');

/** Le client choisi par le super admin, retrouvé d'une visite à l'autre. */
const prefs = createStore('miss-arcade-admin-');

const COLORS = [
  '#1f8a70',
  '#c45c26',
  '#c9a227',
  '#3d4a5c',
  '#2a6f97',
  '#9b2226',
];

interface Draft {
  config: GameConfig;
  prizes: Prize[];
  /** Les lots dont l'admin a touché le stock : seuls ceux-là l'écrivent. */
  stockTouched: string[];
}

interface AdminState {
  access: Access | null;
  tenantId: string | null;
  snapshot: AdminSnapshot | null;
  draft: Draft | null;
  dirty: boolean;
  loading: boolean;
  saving: boolean;
  error: ArcadeErrorCode | null;
  conflict: boolean;
  init: () => Promise<void>;
  selectTenant: (tenantId: string) => Promise<void>;
  reload: () => Promise<void>;
  setConfig: (patch: Partial<GameConfig>) => void;
  setPrize: (id: string, patch: Partial<Prize>) => void;
  addPrize: (label: string) => void;
  removePrize: (id: string) => Prize | null;
  restorePrize: (prize: Prize, index: number) => void;
  movePrize: (id: string, delta: -1 | 1) => void;
  save: () => Promise<boolean>;
  discard: () => void;
  forget: () => void;
}

function draftOf(snapshot: AdminSnapshot): Draft {
  return {
    config: snapshot.config,
    prizes: snapshot.prizes,
    stockTouched: [],
  };
}

/**
 * L'ADMINISTRATION, EN BROUILLON. Jusqu'au 07/11/2026, chaque frappe dans un
 * champ réécrivait la config ET supprimait puis recréait tous les lots en base
 * (effaçant au passage le lot de tous les leads, et recréditant les stocks que
 * la borne avait décomptés). Les modifications vivent maintenant ici, dans un
 * brouillon, jusqu'à « Enregistrer » : une seule transaction côté serveur
 * (`arcade_save_config`), qui refuse d'écraser une modification faite ailleurs.
 *
 * Le client administré vient du SERVEUR (`arcade_whoami`), plus d'une valeur
 * codée en dur : l'écran chargeait toujours le client `demo`, et l'admin d'un
 * autre client ne pouvait rien enregistrer.
 */
export const useAdmin = create<AdminState>((set, get) => ({
  access: null,
  tenantId: null,
  snapshot: null,
  draft: null,
  dirty: false,
  loading: false,
  saving: false,
  error: null,
  conflict: false,

  async init() {
    set({ loading: true, error: null });
    try {
      const access = await arcade.whoami();
      const remembered = prefs.get<string | null>('client', null);
      const tenantId =
        access.tenants.find(t => t.id === get().tenantId)?.id ??
        access.tenants.find(t => t.id === remembered)?.id ??
        access.tenants[0]?.id ??
        null;
      set({ access });
      if (tenantId) await get().selectTenant(tenantId);
      else set({ loading: false });
    } catch (cause) {
      const error = toArcadeError(cause);
      log.error('accès admin', { code: error.code, message: error.message });
      set({ loading: false, error: error.code });
    }
  },

  async selectTenant(tenantId) {
    set({ tenantId, loading: true, error: null, conflict: false });
    prefs.set('client', tenantId);
    try {
      const snapshot = await arcade.adminLoad(tenantId);
      if (get().tenantId !== tenantId) return;
      set({ snapshot, draft: draftOf(snapshot), dirty: false, loading: false });
    } catch (cause) {
      const error = toArcadeError(cause);
      log.error('chargement admin', {
        code: error.code,
        message: error.message,
      });
      set({ loading: false, error: error.code });
    }
  },

  async reload() {
    const { tenantId } = get();
    if (tenantId) await get().selectTenant(tenantId);
  },

  setConfig(patch) {
    const draft = get().draft;
    if (!draft) return;
    set({
      draft: { ...draft, config: { ...draft.config, ...patch } },
      dirty: true,
    });
  },

  setPrize(id, patch) {
    const draft = get().draft;
    if (!draft) return;
    set({
      draft: {
        ...draft,
        prizes: draft.prizes.map(p => (p.id === id ? { ...p, ...patch } : p)),
        stockTouched:
          'stock' in patch && !draft.stockTouched.includes(id)
            ? [...draft.stockTouched, id]
            : draft.stockTouched,
      },
      dirty: true,
    });
  },

  addPrize(label) {
    const draft = get().draft;
    if (!draft || draft.prizes.length >= 12) return;
    const prize: Prize = {
      id: newPrizeId(),
      label,
      weight: 10,
      stock: 10,
      color: COLORS[draft.prizes.length % COLORS.length]!,
      symbol: '★',
      lose: false,
    };
    set({
      draft: {
        ...draft,
        prizes: [...draft.prizes, prize],
        stockTouched: [...draft.stockTouched, prize.id],
      },
      dirty: true,
    });
  },

  removePrize(id) {
    const draft = get().draft;
    if (!draft || draft.prizes.length <= 1) return null;
    const removed = draft.prizes.find(p => p.id === id) ?? null;
    set({
      draft: { ...draft, prizes: draft.prizes.filter(p => p.id !== id) },
      dirty: true,
    });
    return removed;
  },

  restorePrize(prize, index) {
    const draft = get().draft;
    if (!draft || draft.prizes.some(p => p.id === prize.id)) return;
    const prizes = [...draft.prizes];
    prizes.splice(Math.min(index, prizes.length), 0, prize);
    set({ draft: { ...draft, prizes }, dirty: true });
  },

  movePrize(id, delta) {
    const draft = get().draft;
    if (!draft) return;
    const index = draft.prizes.findIndex(p => p.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= draft.prizes.length) return;
    const prizes = [...draft.prizes];
    const [moved] = prizes.splice(index, 1);
    prizes.splice(target, 0, moved!);
    set({ draft: { ...draft, prizes }, dirty: true });
  },

  async save() {
    const { tenantId, snapshot, draft } = get();
    if (!tenantId || !snapshot || !draft) return false;
    // Refuser ici ce que la base refuserait : l'écran a déjà dit pourquoi,
    // champ par champ.
    const valid =
      gameConfigSchema.safeParse(draft.config).success &&
      z.array(prizeSchema).min(1).max(12).safeParse(draft.prizes).success;
    if (!valid) {
      set({ error: 'invalid', conflict: false });
      return false;
    }
    set({ saving: true, error: null, conflict: false });
    const knownIds = new Set(snapshot.prizes.map(p => p.id));
    const prizes: PrizeInput[] = draft.prizes.map(prize => {
      const { stock, ...rest } = prize;
      // Le stock d'un lot existant n'est envoyé que si l'admin l'a touché :
      // sinon la borne, qui le décompte entre-temps, serait recréditée.
      return !knownIds.has(prize.id) || draft.stockTouched.includes(prize.id)
        ? { ...rest, stock }
        : rest;
    });
    try {
      const next = await arcade.adminSave(tenantId, {
        config: draft.config,
        prizes,
        expectedUpdatedAt: snapshot.updatedAt,
      });
      set({
        snapshot: next,
        draft: draftOf(next),
        dirty: false,
        saving: false,
      });
      return true;
    } catch (cause) {
      const error = toArcadeError(cause);
      log.error('enregistrement admin', {
        code: error.code,
        message: error.message,
      });
      set({
        saving: false,
        error: error.code,
        conflict: error.code === 'conflict',
      });
      return false;
    }
  },

  discard() {
    const snapshot = get().snapshot;
    if (snapshot) set({ draft: draftOf(snapshot), dirty: false, error: null });
  },

  /** Après une déconnexion ou une suppression de compte. */
  forget() {
    prefs.clear();
    set({
      access: null,
      tenantId: null,
      snapshot: null,
      draft: null,
      dirty: false,
      error: null,
      conflict: false,
    });
  },
}));

export function forgetAdminPreferences(): void {
  useAdmin.getState().forget();
}
