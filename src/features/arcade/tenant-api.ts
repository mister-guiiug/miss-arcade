import { createLogger } from '@mister-guiiug/dev-pwa-config/logger';
import { supabase } from '../../backend/supabase.ts';
import { coverage } from '../../backend/index.ts';
import {
  defaultArcade,
  type ArcadeSnapshot,
  type GameType,
  type Lead,
  type LeadField,
  type Prize,
} from './model.ts';

const log = createLogger('arcade-tenant');

export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
}

export interface BrandingUrls {
  wallpaperDesktop: string | null;
  wallpaperMobile: string | null;
  logoUrl: string | null;
}

function remote(): boolean {
  return coverage.kind === 'supabase';
}

/**
 * Le typage `SupabaseLike` du squelette ne couvre que les notes.
 * Ici on élargit localement pour tenants / storage / rpc.
 */
type ArcadeClient = {
  from: (table: string) => {
    select: (columns: string) => ArcadeQuery;
    insert: (rows: unknown) => ArcadeQuery;
    upsert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
    delete: () => ArcadeQuery;
    update: (rows: unknown) => ArcadeQuery;
  };
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        file: File,
        opts?: { upsert?: boolean; contentType?: string }
      ) => Promise<{ error: { message: string } | null }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
};

type ArcadeQuery = {
  eq: (column: string, value: string) => ArcadeQuery;
  order: (
    column: string,
    options?: { ascending: boolean }
  ) => ArcadeQuery;
  limit: (n: number) => ArcadeQuery;
  maybeSingle: () => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
  single: () => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
  select: (columns?: string) => ArcadeQuery;
  then?: Promise<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>['then'];
} & PromiseLike<{
  data: unknown[] | null;
  error: { message: string } | null;
}>;

async function db(): Promise<ArcadeClient> {
  return (await supabase.getClient()) as unknown as ArcadeClient;
}

export async function fetchTenantBySlug(slug: string): Promise<TenantInfo | null> {
  if (!remote()) return { id: 'local', slug: 'demo', name: 'Démo locale' };
  const client = await db();
  const { data, error } = await client
    .from('tenants')
    .select('id, slug, name')
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    log.error('lecture tenant', { message: error.message });
    throw new Error(error.message);
  }
  return data as TenantInfo | null;
}

export async function fetchPublicArcade(
  tenantId: string
): Promise<ArcadeSnapshot & BrandingUrls> {
  if (!remote()) {
    return { ...defaultArcade(), ...emptyBranding() };
  }
  const client = await db();
  const [configRes, prizesRes] = await Promise.all([
    client.from('arcade_configs').select('*').eq('tenant_id', tenantId).single(),
    client
      .from('arcade_prizes')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('sort_order'),
  ]);
  if (configRes.error) throw new Error(configRes.error.message);
  if (prizesRes.error) throw new Error(prizesRes.error.message);
  const c = configRes.data as Record<string, unknown>;
  return {
    activeGame: c.active_game as GameType,
    welcomeMessage: String(c.welcome_message),
    winMessage: String(c.win_message),
    loseMessage: String(c.lose_message),
    leadFormEnabled: Boolean(c.lead_form_enabled),
    leadFields: (c.lead_fields as LeadField[]) ?? [],
    prizes: (prizesRes.data ?? []).map(mapPrize),
    leads: [],
    wallpaperDesktop: (c.wallpaper_desktop as string) ?? null,
    wallpaperMobile: (c.wallpaper_mobile as string) ?? null,
    logoUrl: (c.logo_url as string) ?? null,
  };
}

export async function fetchAdminLeads(tenantId: string): Promise<Lead[]> {
  if (!remote()) return [];
  const client = await db();
  const { data, error } = await client
    .from('arcade_leads')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map(row => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      createdAt: String(r.created_at),
      prizeId: (r.prize_id as string) ?? null,
      prizeLabel: String(r.prize_label ?? ''),
      game: r.game as GameType,
      fields: (r.fields as Record<string, string>) ?? {},
    };
  });
}

export async function saveConfig(
  tenantId: string,
  snapshot: ArcadeSnapshot,
  branding: BrandingUrls
): Promise<void> {
  if (!remote()) return;
  const client = await db();
  const { error } = await client.from('arcade_configs').upsert({
    tenant_id: tenantId,
    active_game: snapshot.activeGame,
    welcome_message: snapshot.welcomeMessage,
    win_message: snapshot.winMessage,
    lose_message: snapshot.loseMessage,
    lead_form_enabled: snapshot.leadFormEnabled,
    lead_fields: snapshot.leadFields,
    wallpaper_desktop: branding.wallpaperDesktop,
    wallpaper_mobile: branding.wallpaperMobile,
    logo_url: branding.logoUrl,
  });
  if (error) throw new Error(error.message);
}

export async function replacePrizes(
  tenantId: string,
  prizes: Prize[]
): Promise<void> {
  if (!remote()) return;
  const client = await db();
  const { error: del } = await client
    .from('arcade_prizes')
    .delete()
    .eq('tenant_id', tenantId);
  if (del) throw new Error(del.message);
  if (prizes.length === 0) return;
  const { error } = await client.from('arcade_prizes').insert(
    prizes.map((p, i) => ({
      id: p.id,
      tenant_id: tenantId,
      label: p.label,
      weight: p.weight,
      stock: p.stock,
      color: p.color,
      symbol: p.symbol,
      lose: p.lose,
      sort_order: i,
    }))
  );
  if (error) throw new Error(error.message);
}

export async function publicSpin(slug: string): Promise<Prize | null> {
  if (!remote()) return null;
  const client = await db();
  const { data, error } = await client.rpc('arcade_public_spin', {
    p_slug: slug,
  });
  if (error) {
    log.error('spin', { message: error.message });
    throw new Error(error.message);
  }
  if (!data) return null;
  const d = data as Record<string, unknown>;
  return {
    id: String(d.id),
    label: String(d.label),
    weight: Number(d.weight),
    stock: d.stock === null || d.stock === undefined ? null : Number(d.stock),
    color: String(d.color),
    symbol: String(d.symbol),
    lose: Boolean(d.lose),
  };
}

export async function insertLead(
  tenantId: string,
  lead: Lead
): Promise<void> {
  if (!remote()) return;
  const client = await db();
  const { error } = await client.from('arcade_leads').insert({
    id: lead.id,
    tenant_id: tenantId,
    prize_id: lead.prizeId,
    prize_label: lead.prizeLabel,
    game: lead.game,
    fields: lead.fields,
    created_at: lead.createdAt,
  });
  if (error) throw new Error(error.message);
}

export async function uploadBranding(
  tenantId: string,
  kind: 'desktop' | 'mobile' | 'logo',
  file: File
): Promise<string> {
  if (!remote()) throw new Error('upload hors ligne indisponible');
  const client = await db();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `${tenantId}/${kind}.${ext}`;
  const { error } = await client.storage.from('branding').upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  const { data } = client.storage.from('branding').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function listTenants(): Promise<TenantInfo[]> {
  if (!remote()) return [{ id: 'local', slug: 'demo', name: 'Démo locale' }];
  const client = await db();
  const { data, error } = await client
    .from('tenants')
    .select('id, slug, name')
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as TenantInfo[];
}

export async function createTenant(slug: string, name: string): Promise<TenantInfo> {
  if (!remote()) throw new Error('création de tenant hors ligne indisponible');
  const client = await db();
  const { data, error } = await client
    .from('tenants')
    .insert({ slug, name, published: true })
    .select('id, slug, name')
    .single();
  if (error) throw new Error(error.message);
  const tenant = data as TenantInfo;
  const seed = defaultArcade();
  await saveConfig(tenant.id, seed, emptyBranding());
  await replacePrizes(tenant.id, seed.prizes);
  return tenant;
}

export async function assignTenantAdmin(
  tenantId: string,
  userId: string
): Promise<void> {
  if (!remote()) throw new Error('assignation hors ligne indisponible');
  const client = await db();
  const { error } = await client.from('tenant_admins').upsert({
    tenant_id: tenantId,
    user_id: userId,
  });
  if (error) throw new Error(error.message);
}

function mapPrize(row: unknown): Prize {
  const r = row as Record<string, unknown>;
  return {
    id: String(r.id),
    label: String(r.label),
    weight: Number(r.weight),
    stock: r.stock === null || r.stock === undefined ? null : Number(r.stock),
    color: String(r.color),
    symbol: String(r.symbol),
    lose: Boolean(r.lose),
  };
}

function emptyBranding(): BrandingUrls {
  return {
    wallpaperDesktop: null,
    wallpaperMobile: null,
    logoUrl: null,
  };
}
