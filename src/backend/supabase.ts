import { createSupabaseClientFactory } from '@mister-guiiug/dev-pwa-config/supabase-client';

/**
 * LA FABRIQUE DU SOCLE, PAS UN `createClient` EN HAUT DE FICHIER.
 *
 * Elle est **paresseuse** : `@supabase/supabase-js` n'est chargé qu'au premier
 * appel réel. Une application configurée mais dont personne n'ouvre le compte
 * ne paie donc pas les cinquante kilo-octets du SDK au premier rendu — c'est
 * ce que faisait une app du parc, qui préchargeait Supabase avant même l'écran
 * d'accueil.
 *
 * Elle sait aussi dire ce qui manque (`missing()`) plutôt que d'échouer sur un
 * `undefined`, et c'est ce que l'écran de réglages affiche.
 */
export const supabase = createSupabaseClientFactory<SupabaseLike>({
  // L'ENVIRONNEMENT SE DONNE. Jusqu'au socle 6.28.4, la fabrique lisait `{}`
  // sans lui : `getClient()` répondait « configuration manquante » alors que
  // les variables étaient dans le bundle ; l'écran Compte s'affichait et la
  // connexion échouait (mister-settle le 07/09, miss-holi-voyage, miss-arcade
  // le 04/11/2026). Le socle lit désormais l'environnement Vite seul
  // (dev-pwa-config#482) ; le passer reste utile aux tests : Vitest exécute le
  // socle sans Vite, et `vi.stubEnv` agit sur ce `import.meta.env`-ci.
  env: import.meta.env,
  // `flowType: 'pkce'` N'EST PAS UN RÉGLAGE DE SÉCURITÉ ICI, C'EST UNE
  // NÉCESSITÉ DE ROUTAGE. La connexion par lien renvoie, en flux implicite,
  // le jeton dans le FRAGMENT (`#access_token=…`) — l'endroit exact où un
  // `HashRouter` lit la route : il y verrait une adresse inconnue, la
  // remplacerait par « / », et le jeton disparaîtrait avant d'avoir servi.
  // PKCE renvoie `?code=…` dans la query, que le routeur ne touche pas. Ce
  // squelette route par chemin (ADR 0001) et n'en souffrirait pas ; il le
  // pose quand même, parce que neuf applications de la famille routent par
  // `#` et que ce fichier part chez elles. Mister-miss-koh l'a payé.
  auth: { flowType: 'pkce' },
});

/** Le strict nécessaire du client, pour ne pas figer une version du SDK. */
export interface SupabaseLike {
  auth: {
    getUser(): Promise<{ data: { user: { id: string } | null } }>;
    /**
     * `scope` EST OBLIGATOIRE ICI, et c'est tout l'intérêt de le déclarer.
     * Une déconnexion « globale » demande au serveur de révoquer les jetons —
     * ce qu'il refuse quand le compte vient d'être effacé, puisque
     * l'utilisateur n'existe plus. `'local'` efface la session sur l'appareil
     * sans rien demander à personne : c'est la seule qui puisse suivre une
     * suppression de compte.
     */
    signOut(options: { scope: 'local' | 'global' }): Promise<{
      error: { message: string } | null;
    }>;
  };
  /** Appel d'une fonction Postgres exposée par PostgREST (`security definer`). */
  rpc(
    fn: string,
    args?: Record<string, unknown>
  ): Promise<{ error: { message: string } | null }>;
}
