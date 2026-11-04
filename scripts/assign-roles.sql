-- À exécuter dans le SQL Editor du projet (service role), après inscription.
-- Remplacer les UUID / emails.

-- Super admin plateforme
-- insert into user_roles (user_id, role)
-- select id, 'super_admin'::app_role from auth.users where email = 'vous@exemple.fr'
-- on conflict do nothing;

-- Admin d'un tenant client (un user = un tenant)
-- insert into tenant_admins (tenant_id, user_id)
-- select t.id, u.id
--   from tenants t
--   join auth.users u on u.email = 'client@exemple.fr'
--  where t.slug = 'magasin-lyon'
-- on conflict do nothing;
--
-- Optionnel : rôle « admin » dans le jeton pour le badge UI
-- insert into user_roles (user_id, role)
-- select id, 'admin'::app_role from auth.users where email = 'client@exemple.fr'
-- on conflict do nothing;
