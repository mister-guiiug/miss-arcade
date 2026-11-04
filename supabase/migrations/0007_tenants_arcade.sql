-- Multi-tenant Miss Arcade : tenants, admin par client, config/lots/leads,
-- lecture publique du jeu, écriture réservée aux admins (RLS).
-- Prérequis : 0006_super_admin_role.sql (valeur enum dans une transaction à part).

-- ════════════════════════════════════════════════════════════════════════════
-- Rôles : super_admin (plateforme) + admin (historique, élargi ci-dessous)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select has_role('super_admin'::app_role);
$$;

-- Un « admin » au sens large : super admin plateforme OU ancien rôle admin.
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select has_role('admin'::app_role) or has_role('super_admin'::app_role);
$$;

revoke all on function is_super_admin() from public, anon, authenticated;
grant execute on function is_super_admin() to authenticated;
grant execute on function is_admin() to authenticated, anon;
grant execute on function has_role(app_role) to authenticated, anon;

-- ════════════════════════════════════════════════════════════════════════════
-- Tenants
-- ════════════════════════════════════════════════════════════════════════════

create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name text not null check (char_length(name) between 1 and 80),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenants enable row level security;

create trigger tenants_touch_updated_at
  before update on tenants
  for each row execute function touch_updated_at();

-- Un admin client = un tenant (pas de multi-appartenance).
create table tenant_admins (
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id),
  unique (user_id)
);

alter table tenant_admins enable row level security;

create or replace function is_tenant_admin(wanted uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_super_admin()
    or exists (
      select 1 from tenant_admins
      where tenant_id = wanted and user_id = auth.uid()
    );
$$;

create or replace function my_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from tenant_admins where user_id = auth.uid() limit 1;
$$;

revoke all on function is_tenant_admin(uuid) from public, anon;
grant execute on function is_tenant_admin(uuid) to authenticated;
revoke all on function my_tenant_id() from public, anon;
grant execute on function my_tenant_id() to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Config jeu + branding (message, fonds PC/mobile, logo)
-- ════════════════════════════════════════════════════════════════════════════

create table arcade_configs (
  tenant_id uuid primary key references tenants (id) on delete cascade,
  active_game text not null default 'bandit'
    check (active_game in ('bandit', 'roue')),
  welcome_message text not null default 'Tentez votre chance !'
    check (char_length(welcome_message) <= 500),
  win_message text not null default 'Bravo — vous gagnez {lot} !'
    check (char_length(win_message) <= 500),
  lose_message text not null default 'Pas de chance cette fois… Retentez plus tard !'
    check (char_length(lose_message) <= 500),
  lead_form_enabled boolean not null default true,
  lead_fields text[] not null default array['prenom', 'email']::text[],
  wallpaper_desktop text check (
    wallpaper_desktop is null or char_length(wallpaper_desktop) <= 2000
  ),
  wallpaper_mobile text check (
    wallpaper_mobile is null or char_length(wallpaper_mobile) <= 2000
  ),
  logo_url text check (logo_url is null or char_length(logo_url) <= 2000),
  updated_at timestamptz not null default now()
);

alter table arcade_configs enable row level security;

create trigger arcade_configs_touch_updated_at
  before update on arcade_configs
  for each row execute function touch_updated_at();

create table arcade_prizes (
  id text primary key,
  tenant_id uuid not null references tenants (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  weight integer not null default 0 check (weight between 0 and 10000),
  stock integer check (stock is null or stock >= 0),
  color text not null default '#1f8a70',
  symbol text not null default '★' check (char_length(symbol) between 1 and 4),
  lose boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table arcade_prizes enable row level security;

create index arcade_prizes_tenant_idx on arcade_prizes (tenant_id);

create table arcade_leads (
  id text primary key,
  tenant_id uuid not null references tenants (id) on delete cascade,
  prize_id text references arcade_prizes (id) on delete set null,
  prize_label text not null default '',
  game text not null check (game in ('bandit', 'roue')),
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table arcade_leads enable row level security;

create index arcade_leads_tenant_idx on arcade_leads (tenant_id, created_at desc);

-- Config + lots de démonstration pour le tenant « demo » (jeu public).
insert into tenants (slug, name, published)
values ('demo', 'Démo Miss Arcade', true);

insert into arcade_configs (tenant_id)
select id from tenants where slug = 'demo';

insert into arcade_prizes (id, tenant_id, label, weight, stock, color, symbol, lose, sort_order)
select
  v.id,
  t.id,
  v.label,
  v.weight,
  v.stock,
  v.color,
  v.symbol,
  v.lose,
  v.sort_order
from tenants t
cross join (
  values
    ('lot_perdu', 'Perdu', 50, null::integer, '#3d4a5c', '·', true, 0),
    ('lot_goodies', 'Goodies', 30, 40, '#1f8a70', '★', false, 1),
    ('lot_bon', 'Bon -10 %', 15, 20, '#c45c26', '%', false, 2),
    ('lot_grand', 'Grand lot', 5, 3, '#c9a227', '◆', false, 3)
) as v(id, label, weight, stock, color, symbol, lose, sort_order)
where t.slug = 'demo';

-- ════════════════════════════════════════════════════════════════════════════
-- Droits SQL
-- ════════════════════════════════════════════════════════════════════════════

revoke all on tenants from anon, authenticated;
revoke all on tenant_admins from anon, authenticated;
revoke all on arcade_configs from anon, authenticated;
revoke all on arcade_prizes from anon, authenticated;
revoke all on arcade_leads from anon, authenticated;

grant select on tenants to anon, authenticated;
grant select, insert, update, delete on tenants to authenticated;

grant select on tenant_admins to authenticated;
grant select, insert, delete on tenant_admins to authenticated;

grant select on arcade_configs to anon, authenticated;
grant select, insert, update on arcade_configs to authenticated;

grant select on arcade_prizes to anon, authenticated;
grant select, insert, update, delete on arcade_prizes to authenticated;

grant insert on arcade_leads to anon, authenticated;
grant select, delete on arcade_leads to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Politiques
-- ════════════════════════════════════════════════════════════════════════════

-- Tenants : lecture publique des publiés ; super admin gère tout.
create policy tenants_select_published on tenants
  for select to anon, authenticated
  using (published or is_super_admin() or is_tenant_admin(id));

create policy tenants_write_super on tenants
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- Admins tenant : lecture de sa ligne ; super admin gère.
create policy tenant_admins_select on tenant_admins
  for select to authenticated
  using (user_id = auth.uid() or is_super_admin());

create policy tenant_admins_write_super on tenant_admins
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- Config : lecture publique si tenant publié ; écriture admin du tenant.
create policy arcade_configs_select_public on arcade_configs
  for select to anon, authenticated
  using (
    exists (
      select 1 from tenants t
      where t.id = tenant_id and (t.published or is_tenant_admin(t.id))
    )
  );

create policy arcade_configs_write_admin on arcade_configs
  for all to authenticated
  using (is_tenant_admin(tenant_id))
  with check (is_tenant_admin(tenant_id));

create policy arcade_prizes_select_public on arcade_prizes
  for select to anon, authenticated
  using (
    exists (
      select 1 from tenants t
      where t.id = tenant_id and (t.published or is_tenant_admin(t.id))
    )
  );

create policy arcade_prizes_write_admin on arcade_prizes
  for all to authenticated
  using (is_tenant_admin(tenant_id))
  with check (is_tenant_admin(tenant_id));

-- Leads : insertion anonyme sur tenant publié ; lecture admin tenant.
create policy arcade_leads_insert_public on arcade_leads
  for insert to anon, authenticated
  with check (
    exists (select 1 from tenants t where t.id = tenant_id and t.published)
  );

create policy arcade_leads_select_admin on arcade_leads
  for select to authenticated
  using (is_tenant_admin(tenant_id));

create policy arcade_leads_delete_admin on arcade_leads
  for delete to authenticated
  using (is_tenant_admin(tenant_id));

-- ════════════════════════════════════════════════════════════════════════════
-- Tirage public (stock décrémenté côté serveur)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function arcade_public_spin(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  chosen arcade_prizes%rowtype;
  total integer;
  cursor numeric;
begin
  select id into tid
    from tenants
   where slug = p_slug and published
   limit 1;
  if tid is null then
    raise exception 'tenant inconnu' using errcode = 'PT404';
  end if;

  select coalesce(sum(weight), 0) into total
    from arcade_prizes
   where tenant_id = tid
     and weight > 0
     and (stock is null or stock > 0);

  if total <= 0 then
    raise exception 'aucun lot disponible' using errcode = 'PT409';
  end if;

  cursor := random() * total;
  for chosen in
    select *
      from arcade_prizes
     where tenant_id = tid
       and weight > 0
       and (stock is null or stock > 0)
     order by sort_order, id
  loop
    cursor := cursor - chosen.weight;
    if cursor <= 0 then
      if chosen.stock is not null and not chosen.lose then
        update arcade_prizes
           set stock = stock - 1
         where id = chosen.id
           and stock > 0;
      end if;
      return jsonb_build_object(
        'id', chosen.id,
        'label', chosen.label,
        'weight', chosen.weight,
        'stock', chosen.stock,
        'color', chosen.color,
        'symbol', chosen.symbol,
        'lose', chosen.lose
      );
    end if;
  end loop;

  raise exception 'aucun lot disponible' using errcode = 'PT409';
end;
$$;

revoke all on function arcade_public_spin(text) from public;
grant execute on function arcade_public_spin(text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Hook jeton : rôles + tenant_id
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  claims jsonb;
  roles jsonb;
  tid uuid;
begin
  select coalesce(jsonb_agg(role::text order by role), '[]'::jsonb)
    into roles
    from public.user_roles
   where user_id = (event ->> 'user_id')::uuid;

  select tenant_id into tid
    from public.tenant_admins
   where user_id = (event ->> 'user_id')::uuid
   limit 1;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  claims := jsonb_set(
    claims,
    '{app_metadata}',
    coalesce(claims -> 'app_metadata', '{}'::jsonb)
      || jsonb_build_object(
        'roles', roles,
        'tenant_id', to_jsonb(tid)
      )
  );
  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- Storage branding (fonds + logo), chemin = {tenant_id}/…
-- ════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'branding',
  'branding',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set public = excluded.public;

create policy branding_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'branding');

create policy branding_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'branding'
    and is_tenant_admin((split_part(name, '/', 1))::uuid)
  );

create policy branding_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'branding'
    and is_tenant_admin((split_part(name, '/', 1))::uuid)
  );

create policy branding_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'branding'
    and is_tenant_admin((split_part(name, '/', 1))::uuid)
  );
