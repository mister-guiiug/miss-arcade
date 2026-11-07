-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Isolation entre comptes — pgTAP. Lancement : `supabase test db`.         ║
-- ║                                                                          ║
-- ║ CE QUE CES TESTS PROUVENT, et qu'une relecture de politiques ne prouve   ║
-- ║ pas : deux comptes ne se voient pas, `anon` ne voit rien, et personne    ║
-- ║ ne peut s'attribuer un rôle ni écrire au nom d'un autre.                 ║
-- ║                                                                          ║
-- ║ Une politique se lit vite et se trompe de même. La RLS est le seul       ║
-- ║ endroit du système où une erreur d'une ligne expose toute une table à    ║
-- ║ une clé publique — elle mérite d'être exécutée, pas relue.               ║
-- ║                                                                          ║
-- ║ `set local role authenticated` + `request.jwt.claims` : c'est ainsi      ║
-- ║ qu'on se fait passer pour un utilisateur donné. Sans le rôle, la session ║
-- ║ garde `bypassrls` et TOUT passe — le test serait vert et faux.           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

begin;
select plan(14);

-- ── Décor : deux comptes, Alice admin d'un client, Bob administrateur ────

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@exemple.test'),
  ('22222222-2222-2222-2222-222222222222', 'bob@exemple.test');

-- Le rôle se pose par le serveur (ici : la session de test, sous `postgres`),
-- jamais par une requête du client — c'est ce que vérifie le § « Ce qu'elle
-- ne peut pas faire ».
insert into user_roles (user_id, role)
values ('22222222-2222-2222-2222-222222222222', 'admin');

-- ── Le rôle arrive DANS le jeton, par le hook ─────────────────────────────
--
-- `useRole()` lit `app_metadata.roles` ; jusqu'au 05/09/2026 rien ne l'y
-- écrivait, et le badge admin ne pouvait jamais s'afficher. Le hook de 0004
-- est appelé par GoTrue à chaque émission ; on l'appelle ici tel quel.

select is(
  (select custom_access_token_hook(
     '{"user_id":"22222222-2222-2222-2222-222222222222","claims":{"app_metadata":{"provider":"email"}}}'::jsonb
   ) -> 'claims' -> 'app_metadata' -> 'roles'),
  '["admin"]'::jsonb,
  'le hook recopie le rôle de Bob dans le jeton, sans écraser le reste d’app_metadata'
);

select is(
  (select custom_access_token_hook(
     '{"user_id":"11111111-1111-1111-1111-111111111111","claims":{}}'::jsonb
   ) -> 'claims' -> 'app_metadata' -> 'roles'),
  '[]'::jsonb,
  'sans rôle, un tableau vide — jamais une absence à interpréter'
);

-- Le déclencheur `handle_new_user` a créé les deux profils.
select is(
  (select count(*)::int from profiles
   where id in ('11111111-1111-1111-1111-111111111111',
                '22222222-2222-2222-2222-222222222222')),
  2,
  'le profil naît avec le compte, sans requête du client'
);

-- Deux clients, un lead chacun ; Alice administre le premier seulement.
-- (Les notes du squelette ont servi ici jusqu'au 07/11/2026 : la table est
-- partie avec 0008, l'isolation se prouve désormais sur les données de
-- l'arcade, qui sont les seules à protéger.)
insert into tenants (id, slug, name) values
  ('33333333-3333-3333-3333-333333333333', 'rls-x', 'Client X'),
  ('44444444-4444-4444-4444-444444444444', 'rls-y', 'Client Y');
insert into tenant_admins (tenant_id, user_id)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111');
insert into arcade_leads (id, tenant_id, prize_label, game, fields) values
  ('lead_x', '33333333-3333-3333-3333-333333333333', 'Lot de X', 'bandit', '{"prenom":"Xavier"}'),
  ('lead_y', '44444444-4444-4444-4444-444444444444', 'Lot de Y', 'roue', '{"prenom":"Yvonne"}');

select is(
  (select custom_access_token_hook(
     '{"user_id":"11111111-1111-1111-1111-111111111111","claims":{}}'::jsonb
   ) -> 'claims' -> 'app_metadata' ->> 'tenant_id'),
  '33333333-3333-3333-3333-333333333333',
  'le hook recopie le client administré dans le jeton'
);

-- ── `anon` ne voit rien ───────────────────────────────────────────────────

set local role anon;

-- PLUS FORT QU'UNE LISTE VIDE : la lecture est REFUSÉE. Le premier verrou
-- (`revoke all … from anon`) fait échouer la requête en 42501 avant même que
-- les politiques ne filtrent. Ces assertions attendaient un zéro ; la première
-- exécution réelle (06/09/2026, pile jetable en CI) a montré qu'elles
-- n'avaient jamais pu passer : elles étaient vertes et fausses, parce que
-- jamais jouées.
select throws_ok(
  $$ select count(*) from tenant_admins $$, '42501', null,
  'anon ne peut même pas lire qui administre quoi'
);
select throws_ok(
  $$ select count(*) from profiles $$, '42501', null,
  'anon ne peut même pas lire la table des profils'
);
select throws_ok(
  $$ select count(*) from user_roles $$, '42501', null,
  'anon ne peut même pas lire la table des rôles'
);

-- ── Alice ne voit que son client ──────────────────────────────────────────

reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  (select count(*)::int from arcade_leads),
  1,
  'un admin de client ne voit que les leads de son client'
);
select is(
  (select prize_label from arcade_leads),
  'Lot de X',
  'et ce sont bien les siens'
);
select is(
  (select count(*)::int from profiles),
  1,
  'un compte ne voit que son propre profil'
);

-- ── Ce qu'elle ne peut pas faire ──────────────────────────────────────────

select throws_ok(
  $$ insert into arcade_leads (id, tenant_id, prize_label, game, fields)
     values ('usurpe', '44444444-4444-4444-4444-444444444444', 'Faux', 'bandit', '{}') $$,
  '42501',
  null,
  'écrire un lead à la main est refusé par la base, même connecté'
);

select throws_ok(
  $$ insert into user_roles (user_id, role)
     values ('11111111-1111-1111-1111-111111111111', 'admin') $$,
  '42501',
  null,
  's’attribuer un rôle est impossible depuis le navigateur'
);

select is(
  (select count(*)::int from arcade_leads
   where id = 'lead_y'),
  0,
  'le lead d’un autre client reste invisible, même nommé'
);

-- Supprimer le lead d'un autre ne lève pas : la RLS le rend simplement
-- invisible, donc la suppression ne trouve rien. C'est le comportement
-- attendu, et il vaut d'être figé : un test qui attendrait une erreur ici
-- échouerait sans qu'aucune faille n'existe.
delete from arcade_leads where id = 'lead_y';
reset role;
select is(
  (select count(*)::int from arcade_leads where id = 'lead_y'),
  1,
  'le lead d’un autre client survit à une tentative de suppression'
);

select * from finish();
rollback;
