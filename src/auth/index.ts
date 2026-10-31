import { supabaseAuthAdapter } from '@mister-guiiug/dev-pwa-config/auth/supabase';
import { useAuthContext } from '@mister-guiiug/dev-pwa-config/react/auth-provider';
import { supabase } from '../backend/supabase.ts';
import { coverage } from '../backend/index.ts';

let cache: object | null | undefined;

export function authAdapter(): object | null {
  if (cache !== undefined) return cache;
  if (coverage.kind !== 'supabase') {
    cache = null;
    return cache;
  }

  cache = supabaseAuthAdapter({
    client: {
      auth: new Proxy(
        {},
        {
          get(_cible, methode) {
            return async (...args: unknown[]) => {
              const client = (await supabase.getClient()) as {
                auth: Record<string, (...a: unknown[]) => unknown>;
              };
              const fn = client.auth[methode as string];
              if (typeof fn !== 'function') {
                throw new TypeError(`auth.${String(methode)} inconnu`);
              }
              return fn.apply(client.auth, args);
            };
          },
        }
      ) as object,
    },
  }) as unknown as object;

  return cache;
}

/**
 * Rôles lus dans le jeton (confort UI). La RLS reste la vraie barrière.
 * - superAdmin : plateforme (tous les tenants)
 * - tenantAdmin : admin d'un client (tenant_id dans le jeton)
 * - admin : l'un ou l'autre (accès à /admin)
 */
export function useRole(): {
  admin: boolean;
  superAdmin: boolean;
  tenantAdmin: boolean;
  tenantId: string | null;
  ready: boolean;
} {
  const { user, ready } = useAuthContext<unknown, Utilisateur>();
  const roles = user?.app_metadata?.roles;
  const list = Array.isArray(roles) ? roles : [];
  const superAdmin = list.includes('super_admin');
  const legacyAdmin = list.includes('admin');
  const tenantId =
    typeof user?.app_metadata?.tenant_id === 'string'
      ? user.app_metadata.tenant_id
      : null;
  const tenantAdmin = Boolean(tenantId) || legacyAdmin;
  return {
    superAdmin,
    tenantAdmin,
    tenantId,
    admin: superAdmin || tenantAdmin,
    ready,
  };
}

interface Utilisateur {
  app_metadata?: { roles?: unknown; tenant_id?: unknown };
}
