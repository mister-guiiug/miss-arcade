-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Les jeux d'icônes (0009) : pgTAP.                                        ║
-- ║                                                                          ║
-- ║ Ce qui est tenu : le jeu d'icônes et les champs de chaque lot passent    ║
-- ║ par la sauvegarde atomique et reviennent au visiteur ; une admin restée  ║
-- ║ sur l'ancien bundle, qui ne les envoie pas, ne les efface pas ; la base  ║
-- ║ refuse ce qui n'a rien à faire dans un `<img src>`.                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

begin;
select plan(12);

-- ── Décor ────────────────────────────────────────────────────────────────

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-0000000000f1', 'icones@exemple.test');

insert into tenants (id, slug, name, published) values
  ('b0000000-0000-0000-0000-0000000000f1', 'icones', 'Icônes', true);

insert into arcade_configs (tenant_id)
values ('b0000000-0000-0000-0000-0000000000f1');

insert into arcade_prizes (id, tenant_id, label, weight, stock, color, symbol, lose, sort_order) values
  ('lot_icones_g', 'b0000000-0000-0000-0000-0000000000f1', 'Gagné', 100, null, '#1f8a70', '★', false, 0),
  ('lot_icones_p', 'b0000000-0000-0000-0000-0000000000f1', 'Perdu', 0, null, '#3d4a5c', '·', true, 1);

insert into tenant_admins (tenant_id, user_id) values
  ('b0000000-0000-0000-0000-0000000000f1', 'a0000000-0000-0000-0000-0000000000f1');

select is(
  (select icon_set from arcade_configs
    where tenant_id = 'b0000000-0000-0000-0000-0000000000f1'),
  'symboles',
  'un client existant garde ses symboles : l’affichage d’avant 0009'
);

-- ── L'admin enregistre ───────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"a0000000-0000-0000-0000-0000000000f1","role":"authenticated"}';

select is(
  (select arcade_save_config(
     'b0000000-0000-0000-0000-0000000000f1',
     '{"iconSet":"dessin"}',
     '[{"id":"lot_icones_g","label":"Gagné","weight":100,"color":"#1f8a70","symbol":"★","drawing":"cerise","image":"https://exemple.test/storage/v1/object/public/branding/x/icones/g.webp","lose":false},
       {"id":"lot_icones_p","label":"Perdu","weight":0,"color":"#3d4a5c","symbol":"·","drawing":"nuage","image":null,"lose":true}]'
   ) -> 'config' ->> 'iconSet'),
  'dessin',
  'le jeu d’icônes s’enregistre avec la config'
);
select is(
  (select arcade_admin_load('b0000000-0000-0000-0000-0000000000f1') -> 'prizes' -> 0
     ->> 'drawing'),
  'cerise',
  'le dessin d’un lot s’enregistre et revient à l’admin'
);
select matches(
  (select arcade_admin_load('b0000000-0000-0000-0000-0000000000f1') -> 'prizes' -> 0
     ->> 'image'),
  '^https://exemple\.test/.*/icones/g\.webp$',
  'son image aussi'
);

-- Une admin ouverte AVANT la mise à jour envoie ses lots sans `drawing` ni
-- `image` : la sauvegarde ne doit pas les effacer.
select lives_ok(
  $$ select arcade_save_config(
       'b0000000-0000-0000-0000-0000000000f1', null,
       '[{"id":"lot_icones_g","label":"Gagné !","weight":100,"color":"#1f8a70","symbol":"★","lose":false},
         {"id":"lot_icones_p","label":"Perdu","weight":0,"color":"#3d4a5c","symbol":"·","lose":true}]') $$,
  'un client d’avant 0009 enregistre ses lots'
);
select throws_ok(
  $$ select arcade_save_config('b0000000-0000-0000-0000-0000000000f1',
       '{"iconSet":"paillettes"}', null) $$,
  '23514', null,
  'un jeu d’icônes inconnu est refusé'
);
select throws_ok(
  $$ select arcade_save_config('b0000000-0000-0000-0000-0000000000f1', null,
       '[{"id":"lot_icones_g","label":"Gagné","weight":100,"color":"#1f8a70","symbol":"★","image":"javascript:alert(1)","lose":false}]') $$,
  '23514', null,
  'une image qui n’est pas en https est refusée'
);
select throws_ok(
  $$ select arcade_save_config('b0000000-0000-0000-0000-0000000000f1', null,
       '[{"id":"lot_icones_g","label":"Gagné","weight":100,"color":"#1f8a70","symbol":"★","drawing":"<svg onload=x>","lose":false}]') $$,
  '23514', null,
  'un nom de dessin hors de sa forme est refusé'
);

reset role;

select is(
  (select drawing || '|' || label from arcade_prizes where id = 'lot_icones_g'),
  'cerise|Gagné !',
  'le lot enregistré par l’ancien client garde son dessin'
);
select isnt(
  (select image_url from arcade_prizes where id = 'lot_icones_g'),
  null,
  'et son image'
);

-- ── Le visiteur ──────────────────────────────────────────────────────────

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is(
  (select arcade_public_game('icones') -> 'config' ->> 'iconSet'),
  'dessin',
  'le jeu public rend le jeu d’icônes'
);
select is(
  (select arcade_spin('icones', 'spin_icones_00000001') -> 'prize' ->> 'drawing'),
  'cerise',
  'un tirage rend le dessin du lot tiré'
);

reset role;

select * from finish();
rollback;
