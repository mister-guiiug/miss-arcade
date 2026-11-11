import { z } from 'zod';
import { createLogger } from '@mister-guiiug/dev-pwa-config/logger';
import { supabase } from '../../../backend/supabase.ts';
import {
  accessSchema,
  adminRowSchema,
  adminSnapshotSchema,
  gameTypeSchema,
  kioskInfoSchema,
  kioskRowSchema,
  leadRecordSchema,
  publicGameSchema,
  spinOutcomeSchema,
  spinSourceSchema,
  statsSchema,
  tenantSummarySchema,
  type LeadRecord,
} from '../model.ts';
import { ArcadeError, fromPostgrest, type PostgrestFailure } from './errors.ts';
import type { ArcadeBackend } from './ports.ts';

const log = createLogger('arcade-supabase');

/**
 * L'ADAPTATEUR SUPABASE. Les écritures passent par les fonctions de 0008, qui
 * décident côté serveur (le tirage, le lot d'un lead, le stock) ; les lectures
 * de l'admin passent par la RLS. Chaque réponse est relue par un schéma Zod :
 * un `jsonb` n'a pas de type côté client, et une colonne renommée doit casser
 * ici, bruyamment, plutôt qu'afficher `undefined` sur la borne.
 *
 * Le type du client est déclaré au plus juste, sans figer une version du SDK.
 */
interface Result<T = unknown> {
  data: T | null;
  error: PostgrestFailure | null;
  status: number;
  count?: number | null;
}

interface Query extends PromiseLike<Result<unknown[]>> {
  eq(column: string, value: unknown): Query;
  or(filter: string): Query;
  order(column: string, options?: { ascending: boolean }): Query;
  range(from: number, to: number): Query;
}

interface RpcCall extends PromiseLike<Result> {
  abortSignal(signal: AbortSignal): RpcCall;
}

interface ArcadeClient {
  rpc(fn: string, args?: Record<string, unknown>): RpcCall;
  from(table: string): {
    select(columns: string, options?: { count?: 'exact' }): Query;
    update(values: Record<string, unknown>): Query;
    delete(): Query;
  };
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        file: Blob,
        options?: { upsert?: boolean; contentType?: string }
      ): Promise<{ error: PostgrestFailure | null }>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
}

async function db(): Promise<ArcadeClient> {
  return (await supabase.getClient()) as unknown as ArcadeClient;
}

/** Appelle une fonction de 0008 et relit sa réponse. */
async function call<T>(
  schema: z.ZodType<T>,
  fn: string,
  args: Record<string, unknown>,
  signal?: AbortSignal
): Promise<T> {
  const client = await db();
  let request = client.rpc(fn, args);
  if (signal) request = request.abortSignal(signal);
  const { data, error, status } = await request;
  if (error) {
    log.warn('appel refusé', { fn, code: error.code, message: error.message });
    throw fromPostgrest(error, status);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    log.error('réponse illisible', { fn, issues: parsed.error.issues });
    throw new ArcadeError('unknown', `réponse illisible de ${fn}`);
  }
  return parsed.data;
}

async function run(
  query: PromiseLike<Result<unknown[]>>
): Promise<Result<unknown[]>> {
  const result = await query;
  if (result.error) throw fromPostgrest(result.error, result.status);
  return result;
}

/**
 * Dépose une image dans le bucket `branding`, à `<base>.<ext>`, et rend son
 * adresse publique. Le `?v=` change à chaque envoi : le service worker garde
 * les images en `CacheFirst`, une adresse inchangée servirait l'ancienne.
 */
async function upload(base: string, file: Blob): Promise<string> {
  const client = await db();
  const ext =
    file.type === 'image/png'
      ? 'png'
      : file.type === 'image/webp'
        ? 'webp'
        : 'jpg';
  const path = `${base}.${ext}`;
  const bucket = client.storage.from('branding');
  const { error } = await bucket.upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw fromPostgrest(error);
  return `${bucket.getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
}

const statusSchema = z.object({ status: z.string() }).loose();
const createdKioskSchema = z.object({
  id: z.string(),
  label: z.string(),
  token: z.string(),
});

const leadRowSchema = z
  .object({
    id: z.string(),
    spin_id: z.string().nullable(),
    created_at: z.string(),
    prize_label: z.string(),
    lose: z.boolean().nullable(),
    game: gameTypeSchema,
    redeem_code: z.string().nullable(),
    fields: z.record(z.string(), z.string()),
    consent_at: z.string().nullable(),
    consent_text: z.string().nullable(),
    source: spinSourceSchema,
  })
  .transform((row): LeadRecord =>
    leadRecordSchema.parse({
      id: row.id,
      spinId: row.spin_id,
      createdAt: row.created_at,
      prizeLabel: row.prize_label,
      lose: row.lose,
      game: row.game,
      redeemCode: row.redeem_code,
      fields: row.fields,
      consentAt: row.consent_at,
      consentText: row.consent_text,
      source: row.source,
    })
  );

const kioskDbSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    created_at: z.string(),
    last_seen_at: z.string().nullable(),
    revoked_at: z.string().nullable(),
  })
  .transform(row =>
    kioskRowSchema.parse({
      id: row.id,
      label: row.label,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      revokedAt: row.revoked_at,
    })
  );

/**
 * Une recherche entre dans un filtre PostgREST (`or=(…)`) : les caractères de
 * sa syntaxe en sont retirés, plutôt que d'ouvrir une injection de filtre.
 */
export function searchFilter(search: string): string | null {
  const term = search.replace(/[,()*\\%:"]/g, ' ').trim();
  if (!term) return null;
  return [
    'fields->>email',
    'fields->>prenom',
    'fields->>nom',
    'fields->>telephone',
    'redeem_code',
    'prize_label',
  ]
    .map(column => `${column}.ilike.*${term}*`)
    .join(',');
}

const LEAD_COLUMNS =
  'id, spin_id, created_at, prize_label, lose, game, redeem_code, fields, consent_at, consent_text, source';

function unsupported(): never {
  throw new ArcadeError('unsupported', 'réservé au mode local');
}

export function createSupabaseBackend(): ArcadeBackend {
  return {
    kind: 'supabase',
    capabilities: {
      tenants: true,
      kiosks: true,
      branding: true,
      dataFile: false,
    },

    loadGame: slug =>
      call(publicGameSchema, 'arcade_public_game', { p_slug: slug }),

    spin: ({ slug, spinId, game, kioskToken, signal }) =>
      call(
        spinOutcomeSchema,
        'arcade_spin',
        {
          p_slug: slug,
          p_spin_id: spinId,
          p_game: game,
          p_kiosk_token: kioskToken,
        },
        signal
      ),

    async recordOfflineSpin(spin, kioskToken) {
      const result = await call(
        z.object({ status: z.string(), oversold: z.boolean() }),
        'arcade_record_offline_spin',
        {
          p_kiosk_token: kioskToken,
          p_spin_id: spin.spinId,
          p_prize_id: spin.prizeId,
          p_prize_label: spin.prizeLabel,
          p_lose: spin.lose,
          p_game: spin.game,
          p_redeem_code: spin.redeemCode,
          p_played_at: spin.playedAt,
        }
      );
      return { oversold: result.oversold };
    },

    async submitLead(lead, kioskToken) {
      await call(statusSchema, 'arcade_submit_lead', {
        p_lead_id: lead.id,
        p_spin_id: lead.spinId,
        p_fields: lead.fields,
        p_consent_text: lead.consentText,
        p_consented_at: lead.consentedAt,
        p_kiosk_token: kioskToken,
      });
    },

    kioskStatus: token =>
      call(kioskInfoSchema, 'arcade_kiosk_status', { p_kiosk_token: token }),

    whoami: () => call(accessSchema, 'arcade_whoami', {}),

    adminLoad: tenantId =>
      call(adminSnapshotSchema, 'arcade_admin_load', { p_tenant_id: tenantId }),

    adminSave: (tenantId, { config, prizes, expectedUpdatedAt }) =>
      call(adminSnapshotSchema, 'arcade_save_config', {
        p_tenant_id: tenantId,
        p_config: config,
        p_prizes: prizes,
        p_expected_updated_at: expectedUpdatedAt,
      }),

    async listLeads(tenantId, { page, pageSize, search }) {
      const client = await db();
      let query = client
        .from('arcade_leads')
        .select(LEAD_COLUMNS, { count: 'exact' })
        .eq('tenant_id', tenantId);
      const filter = searchFilter(search);
      if (filter) query = query.or(filter);
      const { data, count } = await run(
        query
          .order('created_at', { ascending: false })
          .range(page * pageSize, page * pageSize + pageSize - 1)
      );
      return {
        rows: z.array(leadRowSchema).parse(data ?? []),
        total: count ?? 0,
      };
    },

    async deleteLead(tenantId, id) {
      const client = await db();
      await run(
        client
          .from('arcade_leads')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('id', id)
      );
    },

    async deleteAllLeads(tenantId) {
      const client = await db();
      await run(client.from('arcade_leads').delete().eq('tenant_id', tenantId));
    },

    stats: (tenantId, days, timeZone) =>
      call(statsSchema, 'arcade_stats', {
        p_tenant_id: tenantId,
        p_days: days,
        p_tz: timeZone,
      }),

    uploadBranding: (tenantId, kind, file) =>
      upload(`${tenantId}/${kind}`, file),

    // Même bucket, même politique (le premier segment du chemin est le
    // client) : la règle `runtimeCaching` qui garde la marque pour le hors
    // ligne garde aussi les icônes.
    uploadIcon: (tenantId, prizeId, file) =>
      upload(`${tenantId}/icones/${prizeId.replace(/[^\w-]/g, '')}`, file),

    async listKiosks(tenantId) {
      const client = await db();
      const { data } = await run(
        client
          .from('arcade_kiosks')
          .select('id, label, created_at, last_seen_at, revoked_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: true })
      );
      return z.array(kioskDbSchema).parse(data ?? []);
    },

    createKiosk: (tenantId, label) =>
      call(createdKioskSchema, 'arcade_create_kiosk', {
        p_tenant_id: tenantId,
        p_label: label,
      }),

    async revokeKiosk(tenantId, id) {
      const client = await db();
      await run(
        client
          .from('arcade_kiosks')
          .update({ revoked_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('id', id)
      );
    },

    createTenant: (slug, name) =>
      call(tenantSummarySchema, 'arcade_create_tenant', {
        p_slug: slug,
        p_name: name,
      }),

    async updateTenant(id, patch) {
      const client = await db();
      await run(client.from('tenants').update(patch).eq('id', id));
    },

    async deleteTenant(id) {
      const client = await db();
      await run(client.from('tenants').delete().eq('id', id));
    },

    listAdmins: tenantId =>
      call(z.array(adminRowSchema), 'arcade_list_admins', {
        p_tenant_id: tenantId,
      }),

    async assignAdmin(tenantId, email) {
      await call(
        z.object({ userId: z.string() }).loose(),
        'arcade_assign_admin',
        {
          p_tenant_id: tenantId,
          p_email: email,
        }
      );
    },

    async removeAdmin(tenantId, userId) {
      const client = await db();
      await run(
        client
          .from('tenant_admins')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('user_id', userId)
      );
    },

    exportData: async () => unsupported(),
    importData: async () => unsupported(),
    resetData: async () => unsupported(),
  };
}
