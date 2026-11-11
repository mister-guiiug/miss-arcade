-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0009 — Les jeux d'icônes (ADR 0016).                                     ║
-- ║                                                                          ║
-- ║ Un client choisit comment ses lots se montrent sur les bobines et la     ║
-- ║ roue : `symboles` (le texte libre de chaque lot, l'affichage d'avant),   ║
-- ║ `dessin` (une illustration du catalogue embarqué dans l'application) ou  ║
-- ║ `perso` (une image envoyée par l'admin dans le bucket `branding`).       ║
-- ║                                                                          ║
-- ║ CHAQUE LOT GARDE SES TROIS VALEURS. Changer de jeu d'icônes ne réécrit   ║
-- ║ pas les lots : revenir aux symboles retrouve les symboles.               ║
-- ║                                                                          ║
-- ║ Aucune fonction nouvelle, aucun droit nouveau : les fonctions qui        ║
-- ║ rendent la config, les lots et un tirage, et la sauvegarde atomique,     ║
-- ║ sont remplacées à l'identique, plus les nouveaux champs. `create or      ║
-- ║ replace` garde leurs droits (0008, section des droits).                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table arcade_configs
  add column icon_set text not null default 'symboles'
    check (icon_set in ('symboles', 'dessin', 'perso'));

-- Le nom d'un dessin n'est pas une liste fermée ici : l'application peut
-- enrichir son catalogue sans migration, et remplace un nom qu'elle ne connaît
-- pas. La forme, elle, est tenue : le nom finit dans le code, jamais tel quel
-- dans le HTML, mais rien ne justifie d'y laisser entrer autre chose.
alter table arcade_prizes
  add column drawing text
    check (drawing is null or drawing ~ '^[a-z0-9-]{1,32}$'),
  -- L'image finit dans un `<img src>` : la règle des images de marque
  -- (`arcade_configs_branding_https`), https et 2 000 caractères.
  add column image_url text
    check (
      image_url is null
      or (char_length(image_url) <= 2000 and image_url ~ '^https://')
    );

create or replace function arcade_config_json(c arcade_configs) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'activeGame', c.active_game,
    'iconSet', c.icon_set,
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
        'drawing', p.drawing,
        'image', p.image_url,
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
      'symbol', coalesce(p.symbol, '?'),
      'drawing', p.drawing,
      'image', p.image_url
    )
  )
  from (select 1) as un
  left join arcade_prizes p on p.id = s.prize_id;
$$;

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
      icon_set = case when p_config ? 'iconSet'
        then p_config ->> 'iconSet' else icon_set end,
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
        id, tenant_id, label, weight, stock, color, symbol, drawing, image_url,
        lose, sort_order
      ) values (
        item ->> 'id',
        p_tenant_id,
        item ->> 'label',
        (item ->> 'weight')::integer,
        (item ->> 'stock')::integer,
        coalesce(item ->> 'color', '#1f8a70'),
        coalesce(item ->> 'symbol', '★'),
        item ->> 'drawing',
        item ->> 'image',
        coalesce((item ->> 'lose')::boolean, false),
        item_order - 1
      )
      on conflict (id) do update set
        label = excluded.label,
        weight = excluded.weight,
        color = excluded.color,
        symbol = excluded.symbol,
        -- Un client d'avant 0009 (une admin restée ouverte sur l'ancien
        -- bundle) n'envoie ni dessin ni image : il ne les efface pas.
        drawing = case when item ? 'drawing'
          then excluded.drawing else arcade_prizes.drawing end,
        image_url = case when item ? 'image'
          then excluded.image_url else arcade_prizes.image_url end,
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
