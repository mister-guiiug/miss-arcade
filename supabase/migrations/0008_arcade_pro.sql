-- miss-arcade 0008 : le jeu public remis en marche, le serveur garant des lots
-- et des leads, les bornes appairées et le hors ligne.
--
-- Relevé du 07/11/2026 en production : la lecture anonyme de `tenants`
-- répondait 401, « permission denied for function is_super_admin ». La
-- politique `published or is_super_admin() or is_tenant_admin(id)` appelait
-- des fonctions qu'anon n'a pas le droit d'exécuter, et PostgreSQL vérifie ce
-- droit à l'INITIALISATION du plan : `published` ne court-circuitait rien. Le
-- visiteur jouait donc sur les lots de démonstration de son navigateur, et
-- aucun lead n'atteignait la base. Tout le reste de ce fichier découle de la
-- même relecture (docs/adr/0013 à 0015).

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Lecture publique : une politique PAR RÔLE
-- ════════════════════════════════════════════════════════════════════════════
--
-- anon ne voit que ce qui est publié, sans appeler aucune fonction. Ouvrir
-- `is_super_admin()` à anon aurait aussi « marché », au prix d'élargir la liste
-- relue de `structure-securite.test.sql` pour une mauvaise raison.

drop policy tenants_select_published on tenants;

create policy tenants_select_anon on tenants
  for select to anon
  using (published);

create policy tenants_select_authenticated on tenants
  for select to authenticated
  using (published or is_tenant_admin(id));

drop policy arcade_configs_select_public on arcade_configs;

create policy arcade_configs_select_anon on arcade_configs
  for select to anon
  using (exists (select 1 from tenants t where t.id = tenant_id and t.published));

create policy arcade_configs_select_authenticated on arcade_configs
  for select to authenticated
  using (
    is_tenant_admin(tenant_id)
    or exists (select 1 from tenants t where t.id = tenant_id and t.published)
  );

drop policy arcade_prizes_select_public on arcade_prizes;

create policy arcade_prizes_select_anon on arcade_prizes
  for select to anon
  using (exists (select 1 from tenants t where t.id = tenant_id and t.published));

create policy arcade_prizes_select_authenticated on arcade_prizes
  for select to authenticated
  using (
    is_tenant_admin(tenant_id)
    or exists (select 1 from tenants t where t.id = tenant_id and t.published)
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Réglages du client : formulaire, consentement, borne
-- ════════════════════════════════════════════════════════════════════════════

alter table arcade_configs
  add column lead_required text[] not null default array['email']::text[],
  add column consent_text text not null default
    'J’accepte que l’organisateur utilise ces coordonnées pour me remettre mon lot '
    'et me recontacter au sujet de ses offres. Je peux retirer mon accord à tout '
    'moment en le contactant.'
    check (char_length(consent_text) between 1 and 1000),
  add column privacy_contact text
    check (privacy_contact is null or char_length(privacy_contact) <= 200),
  add column retention_days integer not null default 365
    check (retention_days between 30 and 1825),
  add column idle_seconds integer not null default 45
    check (idle_seconds between 15 and 600),
  add column sound_enabled boolean not null default false,
  add column max_spins_per_minute integer not null default 30
    check (max_spins_per_minute between 1 and 600);

alter table arcade_configs
  add constraint arcade_configs_lead_fields_known
    check (lead_fields <@ array['prenom', 'nom', 'email', 'telephone']::text[]),
  add constraint arcade_configs_lead_required_known
    check (lead_required <@ array['prenom', 'nom', 'email', 'telephone']::text[]),
  -- Les images de marque finissent dans un `url(...)` CSS : rien d'autre qu'une
  -- adresse https n'a à y entrer.
  add constraint arcade_configs_branding_https check (
    (wallpaper_desktop is null or wallpaper_desktop ~ '^https://')
    and (wallpaper_mobile is null or wallpaper_mobile ~ '^https://')
    and (logo_url is null or logo_url ~ '^https://')
  );

-- La teinte d'un lot entre dans un `conic-gradient` : six chiffres hexa, rien
-- d'autre.
alter table arcade_prizes
  add constraint arcade_prizes_color_hex check (color ~ '^#[0-9a-fA-F]{6}$');

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Bornes appairées
-- ════════════════════════════════════════════════════════════════════════════
--
-- Une borne est un appareil auquel un admin a remis un jeton. Le jeton n'est
-- stocké que haché : la base ne peut pas le rendre, seulement le reconnaître.
-- C'est lui qui autorise une borne à déclarer des tirages faits HORS LIGNE,
-- que le serveur n'a pas pu décider lui-même.

create table arcade_kiosks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  token_hash bytea not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);

alter table arcade_kiosks enable row level security;

create index arcade_kiosks_tenant_idx on arcade_kiosks (tenant_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Journal des tirages
-- ════════════════════════════════════════════════════════════════════════════
--
-- Chaque tirage laisse une ligne : c'est ce qui rend un lead vérifiable (il
-- cite un tirage réel), le débit limitable, et les statistiques possibles.
-- L'identifiant vient du client : rejouer le même appel après une coupure rend
-- le même résultat au lieu de tirer une seconde fois.

create table arcade_spins (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{8,64}$'),
  tenant_id uuid not null references tenants (id) on delete cascade,
  prize_id text references arcade_prizes (id) on delete set null,
  prize_label text not null check (char_length(prize_label) between 1 and 80),
  lose boolean not null,
  game text not null check (game in ('bandit', 'roue')),
  source text not null check (source in ('online', 'offline')),
  kiosk_id uuid references arcade_kiosks (id) on delete set null,
  redeem_code text not null check (redeem_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  -- Hors ligne, plus de lots gagnés que de stock : le lot promis au visiteur
  -- est honoré, la survente est signalée au tableau de bord.
  oversold boolean not null default false,
  played_at timestamptz not null default now(),
  received_at timestamptz not null default now()
);

alter table arcade_spins enable row level security;

create index arcade_spins_tenant_played_idx on arcade_spins (tenant_id, played_at desc);
create index arcade_spins_tenant_received_idx on arcade_spins (tenant_id, received_at desc);

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Leads : rattachés à un tirage, consentement daté
-- ════════════════════════════════════════════════════════════════════════════

alter table arcade_leads
  add column spin_id text unique references arcade_spins (id) on delete set null,
  add column lose boolean,
  add column redeem_code text,
  add column consent_at timestamptz,
  add column consent_text text
    check (consent_text is null or char_length(consent_text) <= 1000),
  add column source text not null default 'online'
    check (source in ('online', 'offline')),
  add column kiosk_id uuid references arcade_kiosks (id) on delete set null,
  add column received_at timestamptz not null default now();

alter table arcade_leads
  add constraint arcade_leads_fields_size check (pg_column_size(fields) <= 4096);

-- Plus d'insertion directe : n'importe qui pouvait déclarer avoir gagné le
-- « Grand lot », sans limite. Un lead passe désormais par
-- `arcade_submit_lead`, qui reprend le lot du tirage côté serveur.
drop policy arcade_leads_insert_public on arcade_leads;
revoke insert on arcade_leads from anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Droits SQL des tables neuves
-- ════════════════════════════════════════════════════════════════════════════

revoke all on arcade_kiosks from anon, authenticated;
revoke all on arcade_spins from anon, authenticated;

-- Le haché du jeton ne sort pas, même vers un admin.
grant select (id, tenant_id, label, created_by, created_at, last_seen_at, revoked_at)
  on arcade_kiosks to authenticated;
grant update (label, revoked_at) on arcade_kiosks to authenticated;

grant select on arcade_spins to authenticated;

create policy arcade_kiosks_select_admin on arcade_kiosks
  for select to authenticated
  using (is_tenant_admin(tenant_id));

create policy arcade_kiosks_update_admin on arcade_kiosks
  for update to authenticated
  using (is_tenant_admin(tenant_id))
  with check (is_tenant_admin(tenant_id));

create policy arcade_spins_select_admin on arcade_spins
  for select to authenticated
  using (is_tenant_admin(tenant_id));

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Aides internes (fermées à tous les rôles de l'API)
-- ════════════════════════════════════════════════════════════════════════════

-- L'alphabet `antiConfusion` du socle (`pairing.js`) : ni 0/O ni 1/I, un code
-- qu'une hôtesse lit sans se tromper.
create or replace function arcade_new_redeem_code() returns text
language sql volatile set search_path = public as $$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1),
    ''
  )
  from generate_series(1, 6);
$$;

create or replace function arcade_kiosk_by_token(p_token text) returns arcade_kiosks
language sql stable set search_path = public as $$
  select *
    from arcade_kiosks
   where token_hash = sha256(convert_to(coalesce(p_token, ''), 'UTF8'))
     and revoked_at is null;
$$;

create or replace function arcade_config_json(c arcade_configs) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'activeGame', c.active_game,
    'welcomeMessage', c.welcome_message,
    'winMessage', c.win_message,
    'loseMessage', c.lose_message,
    'leadFormEnabled', c.lead_form_enabled,
    'leadFields', to_jsonb(c.lead_fields),
    'leadRequired', to_jsonb(c.lead_required),
    'consentText', c.consent_text,
    'privacyContact', c.privacy_contact,
    'retentionDays', c.retention_days,
    'idleSeconds', c.idle_seconds,
    'soundEnabled', c.sound_enabled,
    'maxSpinsPerMinute', c.max_spins_per_minute,
    'wallpaperDesktop', c.wallpaper_desktop,
    'wallpaperMobile', c.wallpaper_mobile,
    'logoUrl', c.logo_url
  );
$$;

create or replace function arcade_prizes_json(p_tenant_id uuid) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'label', p.label,
        'weight', p.weight,
        'stock', p.stock,
        'color', p.color,
        'symbol', p.symbol,
        'lose', p.lose
      )
      order by p.sort_order, p.id
    ),
    '[]'::jsonb
  )
  from arcade_prizes p
  where p.tenant_id = p_tenant_id;
$$;

create or replace function arcade_spin_json(s arcade_spins) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'spinId', s.id,
    'redeemCode', s.redeem_code,
    'source', s.source,
    'playedAt', s.played_at,
    'prize', jsonb_build_object(
      'id', coalesce(s.prize_id, ''),
      'label', s.prize_label,
      'lose', s.lose,
      'weight', coalesce(p.weight, 0),
      'stock', p.stock,
      'color', coalesce(p.color, '#3d4a5c'),
      'symbol', coalesce(p.symbol, '?')
    )
  )
  from (select 1) as un
  left join arcade_prizes p on p.id = s.prize_id;
$$;

create or replace function arcade_admin_snapshot(p_tenant_id uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'tenant', jsonb_build_object(
      'id', t.id, 'slug', t.slug, 'name', t.name, 'published', t.published
    ),
    'config', arcade_config_json(c),
    'prizes', arcade_prizes_json(t.id),
    'updatedAt', c.updated_at
  )
  from tenants t
  join arcade_configs c on c.tenant_id = t.id
  where t.id = p_tenant_id;
$$;

revoke all on function arcade_new_redeem_code() from public, anon, authenticated;
revoke all on function arcade_kiosk_by_token(text) from public, anon, authenticated;
revoke all on function arcade_config_json(arcade_configs) from public, anon, authenticated;
revoke all on function arcade_prizes_json(uuid) from public, anon, authenticated;
revoke all on function arcade_spin_json(arcade_spins) from public, anon, authenticated;
revoke all on function arcade_admin_snapshot(uuid) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. Le jeu public
-- ════════════════════════════════════════════════════════════════════════════

-- Tout ce qu'une borne doit savoir, en un aller-retour.
create or replace function arcade_public_game(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  t tenants%rowtype;
  c arcade_configs%rowtype;
begin
  select * into t from tenants where slug = p_slug and published;
  if not found then
    raise exception 'borne inconnue' using errcode = 'PT404';
  end if;
  select * into c from arcade_configs where tenant_id = t.id;
  return jsonb_build_object(
    'tenant', jsonb_build_object('id', t.id, 'slug', t.slug, 'name', t.name),
    'config', arcade_config_json(c) - 'maxSpinsPerMinute',
    'prizes', arcade_prizes_json(t.id)
  );
end;
$$;

-- Le tirage EN LIGNE, décidé par le serveur.
--
-- Le verrou sur les lots du client passe avant tout le reste : deux tirages
-- simultanés ne se disputent plus le dernier lot (le second UPDATE ne touchait
-- aucune ligne et la fonction répondait « gagné » quand même), et l'idempotence
-- se vérifie sous verrou.
create or replace function arcade_spin(
  p_slug text,
  p_spin_id text,
  p_game text default null,
  p_kiosk_token text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  t tenants%rowtype;
  cfg arcade_configs%rowtype;
  k arcade_kiosks%rowtype;
  s arcade_spins%rowtype;
  chosen arcade_prizes%rowtype;
  total integer;
  remaining numeric;
  recent integer;
begin
  if p_spin_id is null or p_spin_id !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception 'identifiant de tirage invalide' using errcode = 'PT400';
  end if;
  if p_game is not null and p_game not in ('bandit', 'roue') then
    raise exception 'type de jeu inconnu' using errcode = 'PT400';
  end if;

  select * into t from tenants where slug = p_slug and published;
  if not found then
    raise exception 'borne inconnue' using errcode = 'PT404';
  end if;

  if p_kiosk_token is not null then
    k := arcade_kiosk_by_token(p_kiosk_token);
    if k.id is null or k.tenant_id <> t.id then
      raise exception 'borne non reconnue' using errcode = 'PT403';
    end if;
  end if;

  perform 1 from arcade_prizes where tenant_id = t.id for update;

  select * into s from arcade_spins where id = p_spin_id;
  if found then
    if s.tenant_id <> t.id then
      raise exception 'tirage d''une autre borne' using errcode = 'PT409';
    end if;
    return arcade_spin_json(s);
  end if;

  select * into cfg from arcade_configs where tenant_id = t.id;

  -- Une borne appairée n'est pas limitée : c'est le visiteur anonyme, ou le
  -- script qui se fait passer pour lui, qu'on ralentit.
  if k.id is null then
    select count(*) into recent
      from arcade_spins
     where tenant_id = t.id
       and kiosk_id is null
       and source = 'online'
       and received_at > now() - interval '1 minute';
    if recent >= coalesce(cfg.max_spins_per_minute, 30) then
      raise exception 'trop de tirages, réessayez dans un instant'
        using errcode = 'PT429';
    end if;
  end if;

  select coalesce(sum(weight), 0) into total
    from arcade_prizes
   where tenant_id = t.id
     and weight > 0
     and (stock is null or stock > 0);
  if total <= 0 then
    raise exception 'aucun lot disponible' using errcode = 'PT410';
  end if;

  remaining := random() * total;
  for chosen in
    select *
      from arcade_prizes
     where tenant_id = t.id
       and weight > 0
       and (stock is null or stock > 0)
     order by sort_order, id
  loop
    remaining := remaining - chosen.weight;
    exit when remaining < 0;
  end loop;

  if chosen.stock is not null and not chosen.lose then
    update arcade_prizes set stock = stock - 1 where id = chosen.id;
  end if;

  insert into arcade_spins (
    id, tenant_id, prize_id, prize_label, lose, game, source, kiosk_id, redeem_code
  ) values (
    p_spin_id, t.id, chosen.id, chosen.label, chosen.lose,
    coalesce(p_game, cfg.active_game, 'bandit'), 'online', k.id,
    arcade_new_redeem_code()
  )
  returning * into s;

  if k.id is not null then
    update arcade_kiosks set last_seen_at = now() where id = k.id;
  end if;

  return arcade_spin_json(s);
end;
$$;

-- Un tirage fait HORS LIGNE par une borne appairée, déclaré au retour du
-- réseau. Le serveur ne l'a pas décidé : il le croit parce que le jeton le
-- couvre, et il le note `offline`.
create or replace function arcade_record_offline_spin(
  p_kiosk_token text,
  p_spin_id text,
  p_prize_id text,
  p_prize_label text,
  p_lose boolean,
  p_game text,
  p_redeem_code text,
  p_played_at timestamptz
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  k arcade_kiosks%rowtype;
  s arcade_spins%rowtype;
  p arcade_prizes%rowtype;
  over boolean := false;
begin
  k := arcade_kiosk_by_token(p_kiosk_token);
  if k.id is null then
    raise exception 'borne non reconnue' using errcode = 'PT403';
  end if;
  if p_spin_id is null or p_spin_id !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception 'identifiant de tirage invalide' using errcode = 'PT400';
  end if;
  if p_prize_label is null or char_length(p_prize_label) not between 1 and 80
     or p_lose is null
     or p_game is null or p_game not in ('bandit', 'roue')
     or p_redeem_code is null or p_redeem_code !~ '^[A-HJ-NP-Z2-9]{6}$' then
    raise exception 'tirage hors ligne illisible' using errcode = 'PT400';
  end if;

  perform 1 from arcade_prizes where tenant_id = k.tenant_id for update;

  select * into s from arcade_spins where id = p_spin_id;
  if found then
    if s.tenant_id <> k.tenant_id then
      raise exception 'tirage d''une autre borne' using errcode = 'PT409';
    end if;
    return jsonb_build_object('status', 'duplicate', 'oversold', s.oversold);
  end if;

  if p_prize_id is not null then
    select * into p
      from arcade_prizes
     where id = p_prize_id and tenant_id = k.tenant_id;
  end if;

  if p.id is not null and not p_lose and p.stock is not null then
    if p.stock > 0 then
      update arcade_prizes set stock = stock - 1 where id = p.id;
    else
      over := true;
    end if;
  end if;

  insert into arcade_spins (
    id, tenant_id, prize_id, prize_label, lose, game, source, kiosk_id,
    redeem_code, oversold, played_at
  ) values (
    p_spin_id, k.tenant_id, p.id, p_prize_label, p_lose, p_game, 'offline', k.id,
    p_redeem_code, over,
    least(greatest(coalesce(p_played_at, now()), now() - interval '30 days'), now())
  );

  update arcade_kiosks set last_seen_at = now() where id = k.id;

  return jsonb_build_object('status', 'ok', 'oversold', over);
end;
$$;

-- Les coordonnées d'un joueur, gagnant OU perdant, rattachées à son tirage.
-- Le lot vient du tirage, jamais du client.
create or replace function arcade_submit_lead(
  p_lead_id text,
  p_spin_id text,
  p_fields jsonb,
  p_consent_text text,
  p_consented_at timestamptz,
  p_kiosk_token text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s arcade_spins%rowtype;
  k arcade_kiosks%rowtype;
  cleaned jsonb := '{}'::jsonb;
  field_key text;
  field_value text;
  stamp timestamptz;
begin
  if p_lead_id is null or p_lead_id !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception 'identifiant de lead invalide' using errcode = 'PT400';
  end if;

  if exists (select 1 from arcade_leads where id = p_lead_id) then
    return jsonb_build_object('status', 'duplicate');
  end if;

  select * into s from arcade_spins where id = p_spin_id;
  if not found then
    raise exception 'tirage inconnu' using errcode = 'PT404';
  end if;

  if p_kiosk_token is not null then
    k := arcade_kiosk_by_token(p_kiosk_token);
  end if;
  -- Un tirage hors ligne n'a été vu que par sa borne : c'est elle seule qui
  -- peut y rattacher des coordonnées.
  if s.source = 'offline' and (k.id is null or k.tenant_id <> s.tenant_id) then
    raise exception 'borne non reconnue' using errcode = 'PT403';
  end if;

  if exists (select 1 from arcade_leads where spin_id = s.id) then
    raise exception 'ce tirage a déjà ses coordonnées' using errcode = 'PT409';
  end if;

  if p_consent_text is null or btrim(p_consent_text) = ''
     or char_length(p_consent_text) > 1000 then
    raise exception 'consentement requis' using errcode = 'PT400';
  end if;

  if p_fields is null or jsonb_typeof(p_fields) <> 'object' then
    raise exception 'coordonnées illisibles' using errcode = 'PT400';
  end if;

  for field_key, field_value in select * from jsonb_each_text(p_fields) loop
    continue when field_key not in ('prenom', 'nom', 'email', 'telephone');
    field_value := btrim(coalesce(field_value, ''));
    continue when field_value = '';
    if char_length(field_value) > 120 then
      raise exception 'champ trop long' using errcode = 'PT400';
    end if;
    if field_key = 'email' and field_value !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'adresse e-mail invalide' using errcode = 'PT400';
    end if;
    if field_key = 'telephone' and field_value !~ '^[0-9 +().-]{6,20}$' then
      raise exception 'numéro de téléphone invalide' using errcode = 'PT400';
    end if;
    cleaned := cleaned || jsonb_build_object(field_key, field_value);
  end loop;

  if cleaned = '{}'::jsonb then
    raise exception 'aucune coordonnée' using errcode = 'PT400';
  end if;

  stamp := least(coalesce(p_consented_at, now()), now());

  insert into arcade_leads (
    id, tenant_id, spin_id, prize_id, prize_label, lose, game, redeem_code,
    fields, consent_at, consent_text, source, kiosk_id, created_at
  ) values (
    p_lead_id, s.tenant_id, s.id, s.prize_id, s.prize_label, s.lose, s.game,
    s.redeem_code, cleaned, stamp, p_consent_text, s.source,
    coalesce(k.id, s.kiosk_id), stamp
  );

  return jsonb_build_object('status', 'ok');
end;
$$;

-- Ce qu'une borne vérifie à l'appairage, puis à chaque ouverture.
create or replace function arcade_kiosk_status(p_kiosk_token text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  k arcade_kiosks%rowtype;
  t tenants%rowtype;
begin
  k := arcade_kiosk_by_token(p_kiosk_token);
  if k.id is null then
    raise exception 'borne non reconnue' using errcode = 'PT403';
  end if;
  select * into t from tenants where id = k.tenant_id;
  update arcade_kiosks set last_seen_at = now() where id = k.id;
  return jsonb_build_object(
    'kioskId', k.id,
    'label', k.label,
    'tenantSlug', t.slug,
    'tenantName', t.name
  );
end;
$$;

revoke all on function arcade_public_game(text) from public, anon, authenticated;
revoke all on function arcade_spin(text, text, text, text) from public, anon, authenticated;
revoke all on function arcade_record_offline_spin(text, text, text, text, boolean, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function arcade_submit_lead(text, text, jsonb, text, timestamptz, text)
  from public, anon, authenticated;
revoke all on function arcade_kiosk_status(text) from public, anon, authenticated;

grant execute on function arcade_public_game(text) to anon, authenticated;
grant execute on function arcade_spin(text, text, text, text) to anon, authenticated;
grant execute on function arcade_record_offline_spin(text, text, text, text, boolean, text, text, timestamptz)
  to anon, authenticated;
grant execute on function arcade_submit_lead(text, text, jsonb, text, timestamptz, text)
  to anon, authenticated;
grant execute on function arcade_kiosk_status(text) to anon, authenticated;

-- L'ancien tirage n'écrivait aucun journal et ne verrouillait rien.
drop function arcade_public_spin(text);

-- ════════════════════════════════════════════════════════════════════════════
-- 9. L'administration
-- ════════════════════════════════════════════════════════════════════════════

-- Qui suis-je, et quels clients puis-je administrer ? Lu par l'interface au
-- lieu du jeton : le hook `custom_access_token_hook` s'active à la main sur un
-- projet hébergé, et l'administration ne doit plus dépendre de ce geste.
create or replace function arcade_whoami() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'superAdmin', is_super_admin(),
    'tenants', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', t.id, 'slug', t.slug, 'name', t.name, 'published', t.published
          )
          order by t.name
        )
        from tenants t
        where is_super_admin()
           or exists (
             select 1 from tenant_admins a
              where a.tenant_id = t.id and a.user_id = auth.uid()
           )
      ),
      '[]'::jsonb
    )
  );
$$;

create or replace function arcade_admin_load(p_tenant_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_tenant_admin(p_tenant_id) then
    raise exception 'accès refusé' using errcode = 'PT403';
  end if;
  return arcade_admin_snapshot(p_tenant_id);
end;
$$;

-- UNE transaction pour la config ET les lots, à la place des trois requêtes
-- par frappe d'avant (upsert, DELETE de tous les lots, INSERT) :
--   - plus de fenêtre sans aucun lot ;
--   - plus de `prize_id` effacé sur tous les leads (le DELETE déclenchait
--     `on delete set null`) : un lot gardé est mis à jour, pas recréé ;
--   - le stock n'est écrit que si l'admin l'a touché (clé `stock` présente),
--     sinon les tirages de la borne seraient recrédités ;
--   - `p_expected_updated_at` refuse d'écraser une modification faite ailleurs.
create or replace function arcade_save_config(
  p_tenant_id uuid,
  p_config jsonb,
  p_prizes jsonb,
  p_expected_updated_at timestamptz default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  current_at timestamptz;
  item jsonb;
  item_order bigint;
  ids text[];
begin
  if not is_tenant_admin(p_tenant_id) then
    raise exception 'accès refusé' using errcode = 'PT403';
  end if;

  select updated_at into current_at
    from arcade_configs
   where tenant_id = p_tenant_id
     for update;
  if not found then
    raise exception 'client inconnu' using errcode = 'PT404';
  end if;
  if p_expected_updated_at is not null
     and current_at is distinct from p_expected_updated_at then
    raise exception 'la configuration a changé depuis son ouverture'
      using errcode = 'PT409', hint = 'conflict';
  end if;

  if p_config is not null then
    update arcade_configs set
      active_game = case when p_config ? 'activeGame'
        then p_config ->> 'activeGame' else active_game end,
      welcome_message = case when p_config ? 'welcomeMessage'
        then p_config ->> 'welcomeMessage' else welcome_message end,
      win_message = case when p_config ? 'winMessage'
        then p_config ->> 'winMessage' else win_message end,
      lose_message = case when p_config ? 'loseMessage'
        then p_config ->> 'loseMessage' else lose_message end,
      lead_form_enabled = case when p_config ? 'leadFormEnabled'
        then (p_config ->> 'leadFormEnabled')::boolean else lead_form_enabled end,
      lead_fields = case when p_config ? 'leadFields'
        then array(select jsonb_array_elements_text(p_config -> 'leadFields'))
        else lead_fields end,
      lead_required = case when p_config ? 'leadRequired'
        then array(select jsonb_array_elements_text(p_config -> 'leadRequired'))
        else lead_required end,
      consent_text = case when p_config ? 'consentText'
        then p_config ->> 'consentText' else consent_text end,
      privacy_contact = case when p_config ? 'privacyContact'
        then nullif(btrim(p_config ->> 'privacyContact'), '') else privacy_contact end,
      retention_days = case when p_config ? 'retentionDays'
        then (p_config ->> 'retentionDays')::integer else retention_days end,
      idle_seconds = case when p_config ? 'idleSeconds'
        then (p_config ->> 'idleSeconds')::integer else idle_seconds end,
      sound_enabled = case when p_config ? 'soundEnabled'
        then (p_config ->> 'soundEnabled')::boolean else sound_enabled end,
      max_spins_per_minute = case when p_config ? 'maxSpinsPerMinute'
        then (p_config ->> 'maxSpinsPerMinute')::integer else max_spins_per_minute end,
      wallpaper_desktop = case when p_config ? 'wallpaperDesktop'
        then p_config ->> 'wallpaperDesktop' else wallpaper_desktop end,
      wallpaper_mobile = case when p_config ? 'wallpaperMobile'
        then p_config ->> 'wallpaperMobile' else wallpaper_mobile end,
      logo_url = case when p_config ? 'logoUrl'
        then p_config ->> 'logoUrl' else logo_url end
    where tenant_id = p_tenant_id;
  end if;

  if p_prizes is not null then
    if jsonb_typeof(p_prizes) <> 'array'
       or jsonb_array_length(p_prizes) not between 1 and 12 then
      raise exception 'entre 1 et 12 lots' using errcode = 'PT400';
    end if;

    select array_agg(e ->> 'id') into ids from jsonb_array_elements(p_prizes) e;
    if exists (select 1 from unnest(ids) i where i is null) then
      raise exception 'lot sans identifiant' using errcode = 'PT400';
    end if;
    if exists (
      select 1 from arcade_prizes where id = any (ids) and tenant_id <> p_tenant_id
    ) then
      raise exception 'identifiant de lot déjà pris' using errcode = 'PT409';
    end if;

    delete from arcade_prizes
     where tenant_id = p_tenant_id
       and id <> all (ids);

    for item, item_order in
      select e, o from jsonb_array_elements(p_prizes) with ordinality as x (e, o)
    loop
      insert into arcade_prizes (
        id, tenant_id, label, weight, stock, color, symbol, lose, sort_order
      ) values (
        item ->> 'id',
        p_tenant_id,
        item ->> 'label',
        (item ->> 'weight')::integer,
        (item ->> 'stock')::integer,
        coalesce(item ->> 'color', '#1f8a70'),
        coalesce(item ->> 'symbol', '★'),
        coalesce((item ->> 'lose')::boolean, false),
        item_order - 1
      )
      on conflict (id) do update set
        label = excluded.label,
        weight = excluded.weight,
        color = excluded.color,
        symbol = excluded.symbol,
        lose = excluded.lose,
        sort_order = excluded.sort_order,
        stock = case when item ? 'stock' then excluded.stock else arcade_prizes.stock end;
    end loop;
  end if;

  -- Les lots changent aussi le jeton de concurrence : un second onglet qui les
  -- aurait modifiés entre-temps doit le savoir.
  update arcade_configs set updated_at = now() where tenant_id = p_tenant_id;

  return arcade_admin_snapshot(p_tenant_id);
end;
$$;

create or replace function arcade_stats(
  p_tenant_id uuid,
  p_days integer default 30,
  p_tz text default 'Europe/Paris'
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  since timestamptz;
  result jsonb;
begin
  if not is_tenant_admin(p_tenant_id) then
    raise exception 'accès refusé' using errcode = 'PT403';
  end if;
  if p_days is null or p_days not between 1 and 366 then
    raise exception 'période invalide' using errcode = 'PT400';
  end if;
  if not exists (select 1 from pg_timezone_names where name = p_tz) then
    raise exception 'fuseau inconnu' using errcode = 'PT400';
  end if;

  since := (date_trunc('day', now() at time zone p_tz) - make_interval(days => p_days - 1))
    at time zone p_tz;

  with s as (
    select * from arcade_spins
     where tenant_id = p_tenant_id and played_at >= since
  ),
  l as (
    select * from arcade_leads
     where tenant_id = p_tenant_id and created_at >= since
  )
  select jsonb_build_object(
    'since', since,
    'totals', jsonb_build_object(
      'spins', (select count(*) from s),
      'wins', (select count(*) from s where not lose),
      'leads', (select count(*) from l),
      'offline', (select count(*) from s where source = 'offline'),
      'oversold', (select count(*) from s where oversold)
    ),
    'byPrize', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('label', x.label, 'lose', x.lose, 'count', x.n)
          order by x.n desc, x.label
        )
        from (
          select prize_label as label, lose, count(*) as n
            from s group by prize_label, lose
        ) x
      ),
      '[]'::jsonb
    ),
    'byDay', (
      select jsonb_agg(
        jsonb_build_object(
          'day', to_char(g.d, 'YYYY-MM-DD'),
          'spins', coalesce(sp.n, 0),
          'wins', coalesce(sp.w, 0),
          'leads', coalesce(ld.n, 0)
        )
        order by g.d
      )
      from generate_series(
        (since at time zone p_tz)::date::timestamp,
        (now() at time zone p_tz)::date::timestamp,
        interval '1 day'
      ) as g (d)
      left join (
        select (played_at at time zone p_tz)::date as d,
               count(*) as n,
               count(*) filter (where not lose) as w
          from s group by 1
      ) sp on sp.d = g.d::date
      left join (
        select (created_at at time zone p_tz)::date as d, count(*) as n
          from l group by 1
      ) ld on ld.d = g.d::date
    ),
    'byHour', (
      select jsonb_agg(coalesce(h.n, 0) order by g.h)
      from generate_series(0, 23) as g (h)
      left join (
        select extract(hour from played_at at time zone p_tz)::integer as h,
               count(*) as n
          from s group by 1
      ) h on h.h = g.h
    )
  ) into result;

  return result;
end;
$$;

-- Une borne de plus : le jeton n'est rendu qu'ici, une fois.
create or replace function arcade_create_kiosk(p_tenant_id uuid, p_label text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  token text;
  created arcade_kiosks%rowtype;
begin
  if not is_tenant_admin(p_tenant_id) then
    raise exception 'accès refusé' using errcode = 'PT403';
  end if;
  -- Deux UUID v4 : 244 bits d'aléa tirés par `pg_strong_random`, sans pgcrypto
  -- (qui vit dans `extensions` sur Supabase, hors du chemin épinglé).
  token := 'k_' || replace(gen_random_uuid()::text, '-', '')
                || replace(gen_random_uuid()::text, '-', '');
  insert into arcade_kiosks (tenant_id, label, token_hash, created_by)
  values (
    p_tenant_id,
    btrim(p_label),
    sha256(convert_to(token, 'UTF8')),
    auth.uid()
  )
  returning * into created;
  return jsonb_build_object('id', created.id, 'label', created.label, 'token', token);
end;
$$;

-- Un client neuf, sa config et ses lots de démonstration, d'un seul geste.
create or replace function arcade_create_tenant(p_slug text, p_name text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  created tenants%rowtype;
begin
  if not is_super_admin() then
    raise exception 'accès refusé' using errcode = 'PT403';
  end if;
  insert into tenants (slug, name, published)
  values (lower(btrim(p_slug)), btrim(p_name), true)
  returning * into created;

  insert into arcade_configs (tenant_id) values (created.id);

  insert into arcade_prizes (id, tenant_id, label, weight, stock, color, symbol, lose, sort_order)
  select 'lot_' || replace(gen_random_uuid()::text, '-', ''), created.id,
         v.label, v.weight, v.stock, v.color, v.symbol, v.lose, v.sort_order
    from (values
      ('Perdu', 50, null::integer, '#3d4a5c', '·', true, 0),
      ('Goodies', 30, 40, '#1f8a70', '★', false, 1),
      ('Bon -10 %', 15, 20, '#c45c26', '%', false, 2),
      ('Grand lot', 5, 3, '#c9a227', '◆', false, 3)
    ) as v (label, weight, stock, color, symbol, lose, sort_order);

  return jsonb_build_object(
    'id', created.id, 'slug', created.slug, 'name', created.name,
    'published', created.published
  );
end;
$$;

-- Rattacher un admin par son adresse, et non plus par un `user_id` à
-- retrouver en SQL. La personne doit s'être connectée une fois : la base ne
-- crée pas de compte à sa place.
create or replace function arcade_assign_admin(p_tenant_id uuid, p_email text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  found_user uuid;
begin
  if not is_super_admin() then
    raise exception 'accès refusé' using errcode = 'PT403';
  end if;
  select id into found_user
    from auth.users
   where lower(email) = lower(btrim(p_email))
   limit 1;
  if found_user is null then
    raise exception 'aucun compte pour cette adresse : la personne doit se connecter une fois'
      using errcode = 'PT404';
  end if;
  insert into tenant_admins (tenant_id, user_id)
  values (p_tenant_id, found_user)
  on conflict (user_id) do update set tenant_id = excluded.tenant_id;
  return jsonb_build_object('userId', found_user, 'email', lower(btrim(p_email)));
end;
$$;

create or replace function arcade_list_admins(p_tenant_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_tenant_admin(p_tenant_id) then
    raise exception 'accès refusé' using errcode = 'PT403';
  end if;
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('userId', a.user_id, 'email', u.email, 'since', a.created_at)
        order by u.email
      )
      from tenant_admins a
      join auth.users u on u.id = a.user_id
      where a.tenant_id = p_tenant_id
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function arcade_whoami() from public, anon, authenticated;
revoke all on function arcade_admin_load(uuid) from public, anon, authenticated;
revoke all on function arcade_save_config(uuid, jsonb, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function arcade_stats(uuid, integer, text) from public, anon, authenticated;
revoke all on function arcade_create_kiosk(uuid, text) from public, anon, authenticated;
revoke all on function arcade_create_tenant(text, text) from public, anon, authenticated;
revoke all on function arcade_assign_admin(uuid, text) from public, anon, authenticated;
revoke all on function arcade_list_admins(uuid) from public, anon, authenticated;

grant execute on function arcade_whoami() to authenticated;
grant execute on function arcade_admin_load(uuid) to authenticated;
grant execute on function arcade_save_config(uuid, jsonb, jsonb, timestamptz) to authenticated;
grant execute on function arcade_stats(uuid, integer, text) to authenticated;
grant execute on function arcade_create_kiosk(uuid, text) to authenticated;
grant execute on function arcade_create_tenant(text, text) to authenticated;
grant execute on function arcade_assign_admin(uuid, text) to authenticated;
grant execute on function arcade_list_admins(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 10. Conservation limitée des leads
-- ════════════════════════════════════════════════════════════════════════════

create or replace function arcade_purge_expired_leads() returns integer
language plpgsql volatile security definer set search_path = public as $$
declare
  purged integer;
begin
  delete from arcade_leads l
   using arcade_configs c
   where c.tenant_id = l.tenant_id
     and l.created_at < now() - make_interval(days => c.retention_days);
  get diagnostics purged = row_count;
  return purged;
end;
$$;

revoke all on function arcade_purge_expired_leads() from public, anon, authenticated;

-- Chaque nuit, si la plateforme a pg_cron (c'est le cas d'un projet Supabase).
-- Une pile qui ne l'a pas garde la fonction : à lancer à la main.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'arcade-purge-leads',
    '23 3 * * *',
    'select public.arcade_purge_expired_leads()'
  );
exception when others then
  raise notice 'purge planifiée indisponible (%) : arcade_purge_expired_leads() à lancer à la main',
    sqlerrm;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 11. Le ménage du squelette : les notes
-- ════════════════════════════════════════════════════════════════════════════
--
-- La table d'exemple du squelette n'a jamais servi l'arcade. La fonction de
-- suppression de compte la citait : sans cette réécriture, elle échouerait à
-- l'exécution (« relation notes does not exist »), pas à la migration.

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'suppression de compte sans session'
      using errcode = '42501';
  end if;
  delete from public.tenant_admins where user_id = uid;
  delete from public.user_roles where user_id = uid;
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

drop table notes;
