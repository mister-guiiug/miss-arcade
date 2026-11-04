-- Valeur d'enum isolée : Postgres refuse d'utiliser une nouvelle valeur
-- d'`app_role` dans la même transaction que `ADD VALUE` (SQLSTATE 55P04).
alter type app_role add value if not exists 'super_admin';
