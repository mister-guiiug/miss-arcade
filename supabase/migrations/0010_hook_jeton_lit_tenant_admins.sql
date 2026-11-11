-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0010 — Le hook du jeton peut lire `tenant_admins`.                       ║
-- ║                                                                          ║
-- ║ PERSONNE NE POUVAIT SE CONNECTER. Le 12/11/2026, le lien reçu par e-mail ║
-- ║ ramenait à l'application sans session. Le journal d'Auth disait          ║
-- ║ pourquoi : à l'échange du code (`/token`, `grant_type=pkce`), le hook    ║
-- ║ `custom_access_token_hook` levait « permission denied for table          ║
-- ║ tenant_admins (42501) ». Sans jeton, pas de session ; et le lien,        ║
-- ║ consommé par cette première tentative, répondait ensuite « expiré ».     ║
-- ║                                                                          ║
-- ║ GoTrue appelle le hook sous `supabase_auth_admin`. 0004 lui avait ouvert ║
-- ║ `user_roles` (droit SQL ET politique) ; 0007 a fait lire `tenant_admins` ║
-- ║ au hook sans lui ouvrir cette table. Les tests appelaient le hook sous   ║
-- ║ `postgres`, qui lit tout : ils ne pouvaient pas le voir.                 ║
-- ║                                                                          ║
-- ║ Le même double verrou que 0004. Cette politique n'ouvre rien à l'API :   ║
-- ║ `supabase_auth_admin` n'est jamais le rôle d'une requête PostgREST.      ║
-- ║ `hook-jeton.test.sql` exige désormais ce droit pour CHAQUE table que le  ║
-- ║ hook lit.                                                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

grant select on table public.tenant_admins to supabase_auth_admin;

create policy tenant_admins_select_auth_admin on public.tenant_admins
  as permissive for select
  to supabase_auth_admin
  using (true);
