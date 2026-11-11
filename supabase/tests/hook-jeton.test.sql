-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Le hook du jeton, sous le rôle qui l'appelle vraiment : pgTAP.          ║
-- ║                                                                          ║
-- ║ CE FICHIER EXISTE PARCE QUE PERSONNE NE POUVAIT SE CONNECTER. GoTrue     ║
-- ║ appelle `custom_access_token_hook` sous `supabase_auth_admin`, et le     ║
-- ║ hook levait « permission denied for table tenant_admins » : 0007 lui     ║
-- ║ faisait lire une table que ce rôle ne pouvait pas lire. `rls.test.sql`   ║
-- ║ appelle le hook sous `postgres`, qui lit tout, et restait vert.          ║
-- ║                                                                          ║
-- ║ POURQUOI PAS `set role supabase_auth_admin`. `postgres` n'en est pas     ║
-- ║ membre dans la pile de test (relevé par miss-lookhouse) : on ne peut     ║
-- ║ pas endosser ce rôle. On vérifie donc ce dont il a besoin, table par     ║
-- ║ table — et la liste des tables est LUE dans le corps du hook, pas        ║
-- ║ recopiée ici : une table ajoutée au hook sans son droit fait rougir ce   ║
-- ║ test.                                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

begin;
select plan(4);

create temporary table tables_du_hook on commit drop as
select distinct m[1] as nom
  from regexp_matches(
         pg_get_functiondef('public.custom_access_token_hook(jsonb)'::regprocedure),
         'from\s+public\.([a-z_]+)',
         'gi'
       ) as m;

select ok(
  (select count(*) from tables_du_hook) >= 2,
  'le hook lit au moins user_roles et tenant_admins : la lecture de son corps trouve ses tables'
);

select ok(
  has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'execute')
  and has_schema_privilege('supabase_auth_admin', 'public', 'usage'),
  'supabase_auth_admin peut appeler le hook (exécution + usage du schéma)'
);

select is_empty(
  $$ select nom from tables_du_hook
      where not has_table_privilege('supabase_auth_admin', 'public.' || nom, 'select') $$,
  'chaque table que lit le hook est lisible par supabase_auth_admin (droit SQL)'
);

select is_empty(
  $$ select t.nom from tables_du_hook t
      where not exists (
        select 1 from pg_policies p
         where p.schemaname = 'public'
           and p.tablename = t.nom
           and p.cmd in ('SELECT', 'ALL')
           and 'supabase_auth_admin' = any (p.roles)
      ) $$,
  'chaque table que lit le hook a une politique pour supabase_auth_admin (la RLS le filtrerait sinon)'
);

select * from finish();
rollback;
