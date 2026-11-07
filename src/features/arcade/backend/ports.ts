import type {
  Access,
  AdminRow,
  AdminSnapshot,
  GameConfig,
  GameType,
  KioskInfo,
  KioskRow,
  LeadRecord,
  LeadSubmission,
  OfflineSpin,
  PrizeInput,
  PublicGame,
  SpinOutcome,
  Stats,
  TenantSummary,
} from '../model.ts';

/**
 * LE PORT DE L'ARCADE : ce dont l'application a besoin, pas ce que Supabase
 * sait faire. Deux adaptateurs l'implémentent : `local.ts` (l'app démarre sans
 * configuration, sur l'appareil) et `supabase.ts` (le serveur décide les
 * tirages et garde les leads).
 *
 * Tout est asynchrone, même ce qui ne l'est pas en local : un port dessiné sur
 * l'implémentation synchrone de `localStorage` serait inimplémentable par un
 * adaptateur distant, la leçon que le squelette a payée avec ses notes.
 */

export type BrandingKind = 'desktop' | 'mobile' | 'logo';

export interface SpinRequest {
  slug: string;
  spinId: string;
  game: GameType;
  /** Le jeton de la borne appairée, s'il y en a une. */
  kioskToken: string | null;
  signal?: AbortSignal;
}

export interface SaveRequest {
  config: Partial<GameConfig> | null;
  prizes: PrizeInput[] | null;
  expectedUpdatedAt: string | null;
}

export interface LeadQuery {
  page: number;
  pageSize: number;
  search: string;
}

export interface Capabilities {
  /** Plusieurs clients, un super admin. */
  tenants: boolean;
  /** Appairer des bornes, tirer hors ligne. */
  kiosks: boolean;
  /** Héberger des images de marque. */
  branding: boolean;
  /** Exporter et importer un fichier de configuration. */
  dataFile: boolean;
}

export interface ArcadeBackend {
  readonly kind: 'local' | 'supabase';
  readonly capabilities: Capabilities;

  // ── Le jeu public ─────────────────────────────────────────────────────
  loadGame(slug: string): Promise<PublicGame>;
  spin(request: SpinRequest): Promise<SpinOutcome>;
  recordOfflineSpin(
    spin: OfflineSpin,
    kioskToken: string
  ): Promise<{ oversold: boolean }>;
  submitLead(lead: LeadSubmission, kioskToken: string | null): Promise<void>;
  kioskStatus(token: string): Promise<KioskInfo>;

  // ── L'administration ──────────────────────────────────────────────────
  whoami(): Promise<Access>;
  adminLoad(tenantId: string): Promise<AdminSnapshot>;
  adminSave(tenantId: string, request: SaveRequest): Promise<AdminSnapshot>;
  listLeads(
    tenantId: string,
    query: LeadQuery
  ): Promise<{ rows: LeadRecord[]; total: number }>;
  deleteLead(tenantId: string, id: string): Promise<void>;
  deleteAllLeads(tenantId: string): Promise<void>;
  stats(tenantId: string, days: number, timeZone: string): Promise<Stats>;
  uploadBranding(
    tenantId: string,
    kind: BrandingKind,
    file: File
  ): Promise<string>;

  listKiosks(tenantId: string): Promise<KioskRow[]>;
  createKiosk(
    tenantId: string,
    label: string
  ): Promise<{ id: string; label: string; token: string }>;
  revokeKiosk(tenantId: string, id: string): Promise<void>;

  createTenant(slug: string, name: string): Promise<TenantSummary>;
  updateTenant(
    id: string,
    patch: { name?: string; published?: boolean }
  ): Promise<void>;
  deleteTenant(id: string): Promise<void>;
  listAdmins(tenantId: string): Promise<AdminRow[]>;
  assignAdmin(tenantId: string, email: string): Promise<void>;
  removeAdmin(tenantId: string, userId: string): Promise<void>;

  // ── Le fichier de configuration (mode local) ──────────────────────────
  exportData(): Promise<string | null>;
  importData(json: string): Promise<number>;
  resetData(): Promise<void>;
}
