import { z } from 'zod';
import { createVersionedStore } from '@mister-guiiug/dev-pwa-config/versioned-store';
import {
  colorSchema,
  decrementStock,
  defaultConfig,
  defaultPrizes,
  drawPrize,
  gameConfigSchema,
  gameTypeSchema,
  leadFieldSchema,
  leadRecordSchema,
  newRedeemCode,
  prizeSchema,
  spinSourceSchema,
  validateLeadValue,
  type AdminSnapshot,
  type GameConfig,
  type LeadRecord,
  type Prize,
  type PrizeInput,
  type Stats,
  type TenantSummary,
} from '../model.ts';
import { ArcadeError } from './errors.ts';
import type { ArcadeBackend } from './ports.ts';

/**
 * L'ADAPTATEUR LOCAL : l'application démarre sans configuration, sur
 * l'appareil. C'est une propriété à garder : elle rend possibles les tests
 * sans secrets, la démonstration, et une borne sans serveur du tout. Le
 * fichier exporté est alors la seule façon d'emporter les leads.
 *
 * Un seul « client », celui de l'appareil. Le tirage suit le même algorithme
 * que `arcade_spin`, et le journal des tirages nourrit les mêmes statistiques.
 */

export const LOCAL_TENANT: TenantSummary = {
  id: 'local',
  slug: 'demo',
  name: 'Démo locale',
  published: true,
};

/** Au-delà, les plus anciens tirages sortent du journal (pas les leads). */
const MAX_SPINS = 5000;

const localSpinSchema = z.object({
  id: z.string().min(1),
  prizeId: z.string().nullable(),
  prizeLabel: z.string(),
  lose: z.boolean(),
  game: gameTypeSchema,
  redeemCode: z.string(),
  source: spinSourceSchema,
  playedAt: z.string(),
});
type LocalSpin = z.infer<typeof localSpinSchema>;

export const localStateSchema = z.object({
  config: gameConfigSchema,
  prizes: z.array(prizeSchema).min(1).max(12),
  spins: z.array(localSpinSchema),
  leads: z.array(leadRecordSchema),
  updatedAt: z.string(),
});
export type LocalState = z.infer<typeof localStateSchema>;

function seed(): LocalState {
  return {
    config: defaultConfig(),
    prizes: defaultPrizes(),
    spins: [],
    leads: [],
    updatedAt: new Date().toISOString(),
  };
}

type Loose = Record<string, unknown>;

/**
 * v2 → v3 : l'instantané plat d'avant 0008 (messages, lots, leads et fonds au
 * même niveau) devient config + lots + journal. Rien n'est perdu : les leads
 * d'avant n'ont simplement ni tirage ni consentement daté.
 */
export function migrateV2(data: unknown): LocalState {
  const d = (data ?? {}) as Loose;
  const base = defaultConfig();
  const https = (value: unknown) =>
    typeof value === 'string' && value.startsWith('https://') ? value : null;
  const knownFields = Array.isArray(d.leadFields)
    ? d.leadFields.filter(f => leadFieldSchema.safeParse(f).success)
    : base.leadFields;
  const prizes = Array.isArray(d.prizes)
    ? (d.prizes as Loose[]).map(p => ({
        id: String(p.id ?? ''),
        label: String(p.label ?? ''),
        weight: Number(p.weight ?? 0),
        stock:
          p.stock === null || p.stock === undefined ? null : Number(p.stock),
        color: colorSchema.safeParse(p.color).success
          ? String(p.color)
          : '#1f8a70',
        symbol: String(p.symbol ?? '★'),
        lose: Boolean(p.lose),
      }))
    : defaultPrizes();
  const leads = Array.isArray(d.leads)
    ? (d.leads as Loose[]).map(l => ({
        id: String(l.id ?? ''),
        spinId: null,
        createdAt: String(l.createdAt ?? new Date().toISOString()),
        prizeLabel: String(l.prizeLabel ?? ''),
        lose: null,
        game: gameTypeSchema.safeParse(l.game).success
          ? (l.game as 'bandit' | 'roue')
          : 'bandit',
        redeemCode: null,
        fields: (l.fields ?? {}) as Record<string, string>,
        consentAt: null,
        consentText: null,
        source: 'online' as const,
      }))
    : [];
  return {
    config: {
      ...base,
      activeGame: d.activeGame === 'roue' ? 'roue' : 'bandit',
      welcomeMessage: String(d.welcomeMessage ?? base.welcomeMessage),
      winMessage: String(d.winMessage ?? base.winMessage),
      loseMessage: String(d.loseMessage ?? base.loseMessage),
      leadFormEnabled:
        typeof d.leadFormEnabled === 'boolean'
          ? d.leadFormEnabled
          : base.leadFormEnabled,
      leadFields: knownFields as GameConfig['leadFields'],
      leadRequired: [],
      wallpaperDesktop: https(d.wallpaperDesktop),
      wallpaperMobile: https(d.wallpaperMobile),
      logoUrl: https(d.logoUrl),
    },
    prizes,
    spins: [],
    leads,
    updatedAt: new Date().toISOString(),
  };
}

export const arcadeStore = createVersionedStore<LocalState>({
  store: 'miss-arcade',
  key: 'arcade',
  version: 3,
  validate: data => localStateSchema.parse(data),
  seed,
  migrations: {
    // v1 n'avait pas les images de marque ; v2 les ajoutait à plat.
    1: (data: unknown) => ({
      ...((data ?? {}) as Loose),
      wallpaperDesktop: null,
      wallpaperMobile: null,
      logoUrl: null,
    }),
    2: migrateV2,
  },
});

/** Un horodatage strictement plus récent que le précédent : c'est un jeton. */
function nextStamp(previous: string): string {
  const now = new Date();
  if (now.toISOString() <= previous) {
    return new Date(Date.parse(previous) + 1).toISOString();
  }
  return now.toISOString();
}

function snapshotOf(state: LocalState): AdminSnapshot {
  return {
    tenant: LOCAL_TENANT,
    config: state.config,
    prizes: state.prizes,
    updatedAt: state.updatedAt,
  };
}

function unsupported(): never {
  throw new ArcadeError('unsupported', 'indisponible sans serveur');
}

function mergePrizes(
  current: readonly Prize[],
  inputs: readonly PrizeInput[]
): Prize[] {
  return inputs.map(input => {
    const previous = current.find(p => p.id === input.id);
    const stock =
      'stock' in input && input.stock !== undefined
        ? input.stock
        : (previous?.stock ?? null);
    return { ...input, stock };
  });
}

function dayKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function hourOf(iso: string, timeZone: string): number {
  return (
    Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(iso))
    ) % 24
  );
}

/** Les statistiques du journal local, à la forme de `arcade_stats`. */
export function computeStats(
  state: Pick<LocalState, 'spins' | 'leads'>,
  days: number,
  timeZone: string,
  now: Date = new Date()
): Stats {
  const dayList: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    dayList.push(
      dayKey(new Date(now.getTime() - i * 86_400_000).toISOString(), timeZone)
    );
  }
  const first = dayList[0] ?? dayKey(now.toISOString(), timeZone);
  const spins = state.spins.filter(s => dayKey(s.playedAt, timeZone) >= first);
  const leads = state.leads.filter(l => dayKey(l.createdAt, timeZone) >= first);

  const byPrize = new Map<
    string,
    { label: string; lose: boolean; count: number }
  >();
  for (const spin of spins) {
    const key = `${spin.prizeLabel}|${spin.lose}`;
    const entry = byPrize.get(key) ?? {
      label: spin.prizeLabel,
      lose: spin.lose,
      count: 0,
    };
    entry.count += 1;
    byPrize.set(key, entry);
  }

  const byHour = Array.from({ length: 24 }, () => 0);
  for (const spin of spins) byHour[hourOf(spin.playedAt, timeZone)]! += 1;

  return {
    since: `${first}T00:00:00`,
    totals: {
      spins: spins.length,
      wins: spins.filter(s => !s.lose).length,
      leads: leads.length,
      offline: spins.filter(s => s.source === 'offline').length,
      oversold: 0,
    },
    byPrize: [...byPrize.values()].sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label)
    ),
    byDay: dayList.map(day => ({
      day,
      spins: spins.filter(s => dayKey(s.playedAt, timeZone) === day).length,
      wins: spins.filter(s => !s.lose && dayKey(s.playedAt, timeZone) === day)
        .length,
      leads: leads.filter(l => dayKey(l.createdAt, timeZone) === day).length,
    })),
    byHour,
  };
}

function matches(lead: LeadRecord, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [...Object.values(lead.fields), lead.redeemCode ?? '', lead.prizeLabel]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

export function createLocalBackend(): ArcadeBackend {
  // Le premier instantané est ÉCRIT dès sa première lecture : sinon chaque
  // `load()` rend une graine neuve, et le jeu affiché, le tirage et l'admin
  // ne parlent pas des mêmes lots.
  const read = () => {
    const state = arcadeStore.load();
    // `export()` relit par `load()`, donc rend la graine : c'est la clé brute
    // qui dit si quelque chose est écrit.
    if (arcadeStore.store.getRaw('arcade') === null) arcadeStore.save(state);
    return state;
  };
  const write = (next: LocalState) => {
    if (!arcadeStore.save(next)) {
      throw new ArcadeError('unknown', 'stockage de l’appareil refusé');
    }
    return next;
  };

  return {
    kind: 'local',
    capabilities: {
      tenants: false,
      kiosks: false,
      branding: false,
      dataFile: true,
    },

    async loadGame() {
      const state = read();
      return {
        tenant: LOCAL_TENANT,
        config: state.config,
        prizes: state.prizes,
      };
    },

    async spin({ spinId, game }) {
      const state = read();
      const existing = state.spins.find(s => s.id === spinId);
      const prize = existing
        ? state.prizes.find(p => p.id === existing.prizeId)
        : drawPrize(state.prizes);
      if (!existing && !prize) {
        throw new ArcadeError('sold-out', 'aucun lot disponible', 410);
      }
      const spin: LocalSpin = existing ?? {
        id: spinId,
        prizeId: prize!.id,
        prizeLabel: prize!.label,
        lose: prize!.lose,
        game,
        redeemCode: newRedeemCode(),
        source: 'online',
        playedAt: new Date().toISOString(),
      };
      if (!existing) {
        write({
          ...state,
          prizes: decrementStock(state.prizes, prize!.id),
          spins: [...state.spins, spin].slice(-MAX_SPINS),
        });
      }
      const shown = prize ?? {
        id: '',
        label: spin.prizeLabel,
        lose: spin.lose,
        weight: 0,
        stock: null,
        color: '#3d4a5c',
        symbol: '?',
      };
      return {
        spinId: spin.id,
        redeemCode: spin.redeemCode,
        source: 'online',
        playedAt: spin.playedAt,
        prize: shown,
      };
    },

    async recordOfflineSpin() {
      return unsupported();
    },

    async submitLead(lead) {
      const state = read();
      if (state.leads.some(l => l.id === lead.id)) return;
      const spin = state.spins.find(s => s.id === lead.spinId);
      if (!spin) throw new ArcadeError('not-found', 'tirage inconnu', 404);
      if (state.leads.some(l => l.spinId === spin.id)) {
        throw new ArcadeError(
          'conflict',
          'ce tirage a déjà ses coordonnées',
          409
        );
      }
      const fields: Record<string, string> = {};
      for (const [key, value] of Object.entries(lead.fields)) {
        const parsed = leadFieldSchema.safeParse(key);
        if (!parsed.success || typeof value !== 'string') continue;
        if (validateLeadValue(parsed.data, value)) {
          throw new ArcadeError('invalid', `champ ${key} invalide`, 400);
        }
        if (value.trim()) fields[key] = value.trim();
      }
      if (Object.keys(fields).length === 0) {
        throw new ArcadeError('invalid', 'aucune coordonnée', 400);
      }
      const record: LeadRecord = {
        id: lead.id,
        spinId: spin.id,
        createdAt: lead.consentedAt,
        prizeLabel: spin.prizeLabel,
        lose: spin.lose,
        game: spin.game,
        redeemCode: spin.redeemCode,
        fields,
        consentAt: lead.consentedAt,
        consentText: lead.consentText,
        source: spin.source,
      };
      write({ ...state, leads: [record, ...state.leads] });
    },

    async kioskStatus() {
      return unsupported();
    },

    async whoami() {
      return { superAdmin: false, tenants: [LOCAL_TENANT] };
    },

    async adminLoad() {
      return snapshotOf(read());
    },

    async adminSave(_tenantId, { config, prizes, expectedUpdatedAt }) {
      const state = read();
      if (expectedUpdatedAt !== null && expectedUpdatedAt !== state.updatedAt) {
        throw new ArcadeError(
          'conflict',
          'la configuration a changé depuis son ouverture',
          409
        );
      }
      const nextConfig = gameConfigSchema.safeParse({
        ...state.config,
        ...(config ?? {}),
      });
      if (!nextConfig.success) {
        throw new ArcadeError('invalid', nextConfig.error.message, 400);
      }
      const nextPrizes = prizes
        ? mergePrizes(state.prizes, prizes)
        : state.prizes;
      const checked = z.array(prizeSchema).min(1).max(12).safeParse(nextPrizes);
      if (!checked.success) {
        throw new ArcadeError('invalid', checked.error.message, 400);
      }
      const next = write({
        ...state,
        config: nextConfig.data,
        prizes: checked.data,
        updatedAt: nextStamp(state.updatedAt),
      });
      return snapshotOf(next);
    },

    async listLeads(_tenantId, { page, pageSize, search }) {
      const all = read()
        .leads.filter(lead => matches(lead, search))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const start = page * pageSize;
      return { rows: all.slice(start, start + pageSize), total: all.length };
    },

    async deleteLead(_tenantId, id) {
      const state = read();
      write({ ...state, leads: state.leads.filter(l => l.id !== id) });
    },

    async deleteAllLeads() {
      const state = read();
      write({ ...state, leads: [] });
    },

    async stats(_tenantId, days, timeZone) {
      return computeStats(read(), days, timeZone);
    },

    async uploadBranding() {
      return unsupported();
    },
    async listKiosks() {
      return [];
    },
    async createKiosk() {
      return unsupported();
    },
    async revokeKiosk() {
      return unsupported();
    },
    async createTenant() {
      return unsupported();
    },
    async updateTenant() {
      return unsupported();
    },
    async deleteTenant() {
      return unsupported();
    },
    async listAdmins() {
      return [];
    },
    async assignAdmin() {
      return unsupported();
    },
    async removeAdmin() {
      return unsupported();
    },

    async exportData() {
      return arcadeStore.export();
    },

    async importData(json) {
      try {
        return arcadeStore.import(json).leads.length;
      } catch (cause) {
        throw new ArcadeError(
          'invalid',
          cause instanceof Error ? cause.message : String(cause),
          400
        );
      }
    },

    async resetData() {
      arcadeStore.clear();
      arcadeStore.save(seed());
    },
  };
}
