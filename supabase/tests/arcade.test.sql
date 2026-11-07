-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Le jeu, les tirages, les leads et les bornes : pgTAP.                    ║
-- ║ Lancement : `supabase test db`.                                          ║
-- ║                                                                          ║
-- ║ CE FICHIER EXISTE PARCE QUE LE JEU PUBLIC A ÉTÉ CASSÉ SANS QU'AUCUN TEST ║
-- ║ NE ROUGISSE. Jusqu'au 07/11/2026, aucune assertion ne lisait les tables  ║
-- ║ de l'arcade en `anon` : la politique `published or is_super_admin()`     ║
-- ║ répondait 401 au visiteur, et la CI restait verte. La première assertion ║
-- ║ ci-dessous est celle qui manquait.                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

begin;
select plan(60);

-- ── Décor ────────────────────────────────────────────────────────────────

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'super@exemple.test'),
  ('a0000000-0000-0000-0000-000000000002', 'alpha@exemple.test'),
  ('a0000000-0000-0000-0000-000000000003', 'beta@exemple.test'),
  ('a0000000-0000-0000-0000-000000000004', 'visiteur@exemple.test');

insert into user_roles (user_id, role)
values ('a0000000-0000-0000-0000-000000000001', 'super_admin');

insert into tenants (id, slug, name, published) values
  ('b0000000-0000-0000-0000-00000000000a', 'alpha', 'Alpha', true),
  ('b0000000-0000-0000-0000-00000000000b', 'beta', 'Beta', true),
  ('b0000000-0000-0000-0000-00000000000c', 'cache', 'Caché', false);

insert into arcade_configs (tenant_id)
select id from tenants where slug in ('alpha', 'beta', 'cache');

update arcade_configs set max_spins_per_minute = 2
 where tenant_id = 'b0000000-0000-0000-0000-00000000000b';

-- Alpha : un seul lot gagnant, un seul en stock. Le tirage est donc écrit
-- d'avance, ce qui rend l'épuisement et l'idempotence vérifiables.
insert into arcade_prizes (id, tenant_id, label, weight, stock, color, symbol, lose, sort_order) values
  ('lot_alpha_gagne', 'b0000000-0000-0000-0000-00000000000a', 'Gagné A', 100, 1, '#1f8a70', '★', false, 0),
  ('lot_alpha_perdu', 'b0000000-0000-0000-0000-00000000000a', 'Perdu A', 0, null, '#3d4a5c', '·', true, 1),
  ('lot_beta_perdu', 'b0000000-0000-0000-0000-00000000000b', 'Perdu B', 100, null, '#3d4a5c', '·', true, 0),
  ('lot_cache', 'b0000000-0000-0000-0000-00000000000c', 'Caché', 100, null, '#3d4a5c', '·', false, 0);

insert into tenant_admins (tenant_id, user_id) values
  ('b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000003');

-- Une borne d'Alpha, au jeton connu du test, et une borne révoquée.
insert into arcade_kiosks (id, tenant_id, label, token_hash) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000a',
   'Stand A', sha256(convert_to('k_jeton_alpha', 'UTF8')));
insert into arcade_kiosks (tenant_id, label, token_hash, revoked_at) values
  ('b0000000-0000-0000-0000-00000000000a', 'Ancienne', sha256(convert_to('k_jeton_revoque', 'UTF8')), now());

-- ── anon : le jeu public se lit ──────────────────────────────────────────

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is(
  (select count(*)::int from tenants where slug = 'alpha'), 1,
  'anon lit un client publié : la lecture que la politique de 0007 refusait (401)'
);
select is(
  (select count(*)::int from tenants where slug = 'cache'), 0,
  'anon ne voit pas un client non publié'
);
select is(
  (select count(*)::int from arcade_configs
    where tenant_id = 'b0000000-0000-0000-0000-00000000000a'), 1,
  'anon lit la config d’un client publié'
);
select is(
  (select count(*)::int from arcade_prizes
    where tenant_id = 'b0000000-0000-0000-0000-00000000000a'), 2,
  'anon lit les lots d’un client publié'
);
select is(
  (select count(*)::int from arcade_prizes
    where tenant_id = 'b0000000-0000-0000-0000-00000000000c'), 0,
  'anon ne lit pas les lots d’un client non publié'
);
select is(
  (select arcade_public_game('alpha') -> 'tenant' ->> 'slug'), 'alpha',
  'arcade_public_game rend le client'
);
select is(
  (select jsonb_array_length(arcade_public_game('alpha') -> 'prizes')), 2,
  'arcade_public_game rend ses lots'
);
select ok(
  not (arcade_public_game('alpha') -> 'config' ? 'maxSpinsPerMinute'),
  'la limite de débit ne sort pas vers le public'
);
select throws_ok(
  $$ select arcade_public_game('cache') $$, 'PT404', null,
  'un client non publié est introuvable'
);

-- ── anon : ce qui lui est fermé ──────────────────────────────────────────

select throws_ok(
  $$ insert into arcade_leads (id, tenant_id, prize_label, game, fields)
     values ('lead_forge', 'b0000000-0000-0000-0000-00000000000a', 'Grand lot', 'bandit', '{}') $$,
  '42501', null,
  'plus d’insertion directe de lead : on ne déclare plus son gain soi-même'
);
select throws_ok(
  $$ select count(*) from arcade_leads $$, '42501', null,
  'anon ne lit pas les leads'
);
select throws_ok(
  $$ select count(*) from arcade_spins $$, '42501', null,
  'anon ne lit pas le journal des tirages'
);
select throws_ok(
  $$ select count(*) from arcade_kiosks $$, '42501', null,
  'anon ne lit pas les bornes'
);

-- ── Le tirage en ligne ───────────────────────────────────────────────────

select is(
  (select arcade_spin('alpha', 'spin_test_0001', 'bandit') -> 'prize' ->> 'label'),
  'Gagné A',
  'le tirage rend le seul lot tirable'
);
select matches(
  (select arcade_spin('alpha', 'spin_test_0001') ->> 'redeemCode'),
  '^[A-HJ-NP-Z2-9]{6}$',
  'il porte un code de retrait lisible (ni 0/O ni 1/I)'
);
select throws_ok(
  $$ select arcade_spin('alpha', 'spin_test_0002') $$, 'PT410', null,
  'le stock épuisé, plus rien n’est tirable'
);
select throws_ok(
  $$ select arcade_spin('alpha', 'x') $$, 'PT400', null,
  'un identifiant de tirage trop court est refusé'
);
select throws_ok(
  $$ select arcade_spin('cache', 'spin_test_0003') $$, 'PT404', null,
  'on ne tire pas chez un client non publié'
);

select lives_ok(
  $$ select arcade_spin('beta', 'spin_beta_0001') $$,
  'débit : premier tirage'
);
select lives_ok(
  $$ select arcade_spin('beta', 'spin_beta_0002') $$,
  'débit : second tirage'
);
select throws_ok(
  $$ select arcade_spin('beta', 'spin_beta_0003') $$, 'PT429', null,
  'débit : le troisième dans la minute est refusé (limite 2)'
);
select lives_ok(
  $$ select arcade_spin('beta', 'spin_beta_0001') $$,
  'rejouer un tirage déjà fait n’est pas compté : il rend le résultat d’origine'
);

-- ── Les leads, gagnants ou perdants ──────────────────────────────────────

select is(
  (select arcade_submit_lead('lead_test_0001', 'spin_test_0001',
     '{"prenom":"Ada","email":"ada@exemple.test","admin":"oui"}',
     'J’accepte.', now()) ->> 'status'),
  'ok',
  'un lead se rattache à un tirage en ligne'
);
select is(
  (select arcade_submit_lead('lead_test_0001', 'spin_test_0001',
     '{"prenom":"Ada"}', 'J’accepte.', now()) ->> 'status'),
  'duplicate',
  'le même lead renvoyé (rejeu de la file) n’est pas doublé'
);
select throws_ok(
  $$ select arcade_submit_lead('lead_test_0002', 'spin_test_0001',
       '{"prenom":"Bis"}', 'J’accepte.', now()) $$,
  'PT409', null,
  'un seul lead par tirage'
);
select is(
  (select arcade_submit_lead('lead_beta_0001', 'spin_beta_0001',
     '{"email":"perdant@exemple.test"}', 'J’accepte.', now()) ->> 'status'),
  'ok',
  'un perdant laisse aussi ses coordonnées'
);
select throws_ok(
  $$ select arcade_submit_lead('lead_beta_0002', 'spin_beta_0002',
       '{"email":"x@exemple.test"}', '', now()) $$,
  'PT400', null,
  'sans consentement, pas de lead'
);
select throws_ok(
  $$ select arcade_submit_lead('lead_beta_0003', 'spin_beta_0002',
       '{"email":"pas-une-adresse"}', 'J’accepte.', now()) $$,
  'PT400', null,
  'une adresse illisible est refusée'
);
select throws_ok(
  $$ select arcade_submit_lead('lead_beta_0004', 'spin_inconnu_01',
       '{"email":"x@exemple.test"}', 'J’accepte.', now()) $$,
  'PT404', null,
  'un lead sans tirage réel est refusé'
);

-- ── La borne hors ligne ──────────────────────────────────────────────────

select throws_ok(
  $$ select arcade_record_offline_spin('k_faux', 'spin_off_0001', 'lot_alpha_gagne',
       'Gagné A', false, 'bandit', 'ABCDEF', now()) $$,
  'PT403', null,
  'sans jeton, pas de tirage hors ligne'
);
select throws_ok(
  $$ select arcade_record_offline_spin('k_jeton_revoque', 'spin_off_0001', 'lot_alpha_gagne',
       'Gagné A', false, 'bandit', 'ABCDEF', now()) $$,
  'PT403', null,
  'une borne révoquée ne déclare plus rien'
);
select is(
  (select arcade_record_offline_spin('k_jeton_alpha', 'spin_off_0001', 'lot_alpha_gagne',
     'Gagné A', false, 'bandit', 'ABCDEF', now() - interval '2 hours')),
  '{"status":"ok","oversold":true}'::jsonb,
  'un gain hors ligne sur un stock vide est HONORÉ et signalé en survente'
);
select is(
  (select arcade_record_offline_spin('k_jeton_alpha', 'spin_off_0001', 'lot_alpha_gagne',
     'Gagné A', false, 'bandit', 'ABCDEF', now()) ->> 'status'),
  'duplicate',
  'le même tirage renvoyé au retour du réseau n’est pas compté deux fois'
);
select throws_ok(
  $$ select arcade_submit_lead('lead_off_0001', 'spin_off_0001',
       '{"email":"hors@exemple.test"}', 'J’accepte.', now()) $$,
  'PT403', null,
  'les coordonnées d’un tirage hors ligne ne viennent que de sa borne'
);
select is(
  (select arcade_submit_lead('lead_off_0001', 'spin_off_0001',
     '{"email":"hors@exemple.test"}', 'J’accepte.', now() - interval '2 hours',
     'k_jeton_alpha') ->> 'status'),
  'ok',
  'avec son jeton, la borne transmet le lead hors ligne'
);
select is(
  (select arcade_kiosk_status('k_jeton_alpha') ->> 'tenantSlug'), 'alpha',
  'une borne reconnaît son client par son jeton'
);
select throws_ok(
  $$ select arcade_kiosk_status('k_faux') $$, 'PT403', null,
  'un jeton inconnu n’ouvre rien'
);

reset role;

-- Le lot vient du tirage, jamais du client ; les clés inconnues sont jetées.
select is(
  (select prize_label || '|' || (fields ? 'admin')::text from arcade_leads
    where id = 'lead_test_0001'),
  'Gagné A|false',
  'le lead porte le lot du tirage, et rien d’autre que les champs connus'
);
select is(
  (select source || '|' || (kiosk_id is not null)::text from arcade_leads
    where id = 'lead_off_0001'),
  'offline|true',
  'le lead hors ligne garde sa borne et sa source'
);
select is(
  (select stock from arcade_prizes where id = 'lot_alpha_gagne'), 0,
  'le stock n’est pas descendu sous zéro'
);

-- ── L'admin d'Alpha ──────────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select arcade_whoami()),
  '{"superAdmin":false,"tenants":[{"id":"b0000000-0000-0000-0000-00000000000a","name":"Alpha","slug":"alpha","published":true}]}'::jsonb,
  'l’admin d’un client ne voit que le sien'
);
select is(
  (select count(*)::int from arcade_leads
    where tenant_id = 'b0000000-0000-0000-0000-00000000000b'), 0,
  'il ne lit pas les leads d’un autre client'
);
select throws_ok(
  $$ select arcade_admin_load('b0000000-0000-0000-0000-00000000000b') $$, 'PT403', null,
  'ni sa configuration'
);
select throws_ok(
  $$ select token_hash from arcade_kiosks $$, '42501', null,
  'le haché du jeton d’une borne ne sort pas, même vers son admin'
);
select lives_ok(
  $$ update arcade_kiosks set revoked_at = now()
      where id = 'c0000000-0000-0000-0000-000000000001' $$,
  'il révoque une borne'
);
select throws_ok(
  $$ update arcade_kiosks set token_hash = '\x00'
      where id = 'c0000000-0000-0000-0000-000000000001' $$,
  '42501', null,
  'il ne réécrit pas son jeton'
);
select throws_ok(
  $$ select arcade_create_kiosk('b0000000-0000-0000-0000-00000000000b', 'Intrus') $$,
  'PT403', null,
  'il ne crée pas de borne chez un autre'
);
select matches(
  (select arcade_create_kiosk('b0000000-0000-0000-0000-00000000000a', 'Stand B') ->> 'token'),
  '^k_[0-9a-f]{64}$',
  'le jeton d’une borne neuve n’est rendu qu’à sa création'
);

-- La sauvegarde atomique : le lot gardé n'est pas recréé, le stock non touché
-- n'est pas réécrit, et le lead garde son lot.
select is(
  (select arcade_save_config(
     'b0000000-0000-0000-0000-00000000000a',
     '{"welcomeMessage":"Salut"}',
     '[{"id":"lot_alpha_gagne","label":"Gagné A+","weight":100,"color":"#1f8a70","symbol":"★","lose":false},
       {"id":"lot_alpha_neuf","label":"Neuf","weight":10,"stock":5,"color":"#c45c26","symbol":"%","lose":false}]',
     (select updated_at from arcade_configs where tenant_id = 'b0000000-0000-0000-0000-00000000000a')
   ) -> 'config' ->> 'welcomeMessage'),
  'Salut',
  'la config et les lots s’enregistrent en une fois'
);
select throws_ok(
  $$ select arcade_save_config('b0000000-0000-0000-0000-00000000000a',
       '{"welcomeMessage":"Écrasé"}', null, '2000-01-01T00:00:00Z') $$,
  'PT409', null,
  'une version périmée ne peut pas écraser une modification faite ailleurs'
);
select throws_ok(
  $$ select arcade_save_config('b0000000-0000-0000-0000-00000000000a', null,
       '[{"id":"lot_beta_perdu","label":"Volé","weight":1,"color":"#1f8a70","symbol":"x","lose":false}]') $$,
  'PT409', null,
  'on ne s’approprie pas le lot d’un autre client'
);
select throws_ok(
  $$ select arcade_stats('b0000000-0000-0000-0000-00000000000b') $$, 'PT403', null,
  'ni ses statistiques'
);
select is(
  (select (arcade_stats('b0000000-0000-0000-0000-00000000000a') -> 'totals' ->> 'spins')::int),
  2,
  'les statistiques comptent les tirages en ligne et hors ligne'
);

reset role;

select is(
  (select stock::text || '|' || label from arcade_prizes where id = 'lot_alpha_gagne'),
  '0|Gagné A+',
  'le lot gardé est mis à jour sans que son stock soit recrédité'
);
select is(
  (select prize_id from arcade_leads where id = 'lead_test_0001'),
  'lot_alpha_gagne',
  'le lead garde son lot : plus de DELETE qui effaçait prize_id à chaque frappe'
);
select is(
  (select count(*)::int from arcade_prizes where id = 'lot_alpha_perdu'), 0,
  'un lot retiré de la liste est supprimé'
);

-- ── Le super admin ───────────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select arcade_create_tenant('gamma', 'Gamma') ->> 'slug'), 'gamma',
  'le super admin crée un client'
);
select is(
  (select arcade_assign_admin(
     (select id from tenants where slug = 'gamma'), 'Visiteur@Exemple.test') ->> 'email'),
  'visiteur@exemple.test',
  'et lui rattache un admin par son adresse, casse ignorée'
);
select throws_ok(
  $$ select arcade_assign_admin((select id from tenants where slug = 'gamma'), 'personne@exemple.test') $$,
  'PT404', null,
  'une adresse sans compte est signalée, pas inventée'
);

reset role;

-- ── La conservation ──────────────────────────────────────────────────────

update arcade_configs set retention_days = 30
 where tenant_id = 'b0000000-0000-0000-0000-00000000000b';
update arcade_leads set created_at = now() - interval '40 days'
 where id = 'lead_beta_0001';

select is(
  (select arcade_purge_expired_leads()), 1,
  'la purge efface ce qui dépasse la durée de conservation du client'
);

select * from finish();
rollback;
