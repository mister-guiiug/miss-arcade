import { defineConfig, devices } from '@playwright/test';
import { definePwaPlaywrightConfig } from '@mister-guiiug/dev-pwa-config/playwright-base';

/**
 * La fabrique du socle fournit la matrice de navigateurs, les reporters, le
 * gabarit de captures, `reducedMotion` et le serveur de test.
 *
 * `preview: true` : les e2e passent sur un BUILD de production, jamais sur le
 * serveur de développement. C'est le seul moyen d'exercer ce qui n'existe qu'à
 * la fin — service worker, minification, manifeste, repli 404.
 *
 * `VITE_BASE_PATH=/` neutralise le chemin GitHub Pages le temps du test, et le
 * port 4173 évite la collision avec un serveur de développement.
 *
 * `VITE_SUPABASE_URL` NOMME UN PROJET FACTICE, celui que vise l'e2e « la CSP
 * et Supabase ». Depuis le socle 6.32 (#12), `cspPlugin` n'ouvre plus
 * `*.supabase.co` : il lit cette variable et n'ouvre que l'origine EXACTE du
 * projet, comme en production. Sans elle, le build e2e n'ouvrait rien, et le
 * test, resté sur l'ancien joker, rougissait `main` depuis le 06/11/2026. La
 * clé anonyme n'est PAS posée : le backend distant exige les deux, l'app reste
 * donc en mode local pour toute la suite. Le job E2E du socle n'injecte pas le
 * `build-env` de la CI, d'où la valeur dans la commande (même motif que
 * miss-carbook).
 */
const base = definePwaPlaywrightConfig({
  devices,
  testMatch: /.*\.spec\.ts$/,
  preview: true,
  port: 4173,
  command:
    'node scripts/with-env.mjs VITE_POSTHOG_KEY=phc_e2e0000000000000000000000 VITE_SUPABASE_URL=https://exemple-e2e.supabase.co VITE_BASE_PATH=/ -- vite build && node scripts/with-env.mjs VITE_BASE_PATH=/ -- vite preview --port 4173 --strictPort',
});

/**
 * LA LANGUE DU NAVIGATEUR EST FIXÉE, sans quoi la suite est instable par
 * construction.
 *
 * `createI18n` choisit la locale initiale d'après `navigator.language` quand
 * rien n'est stocké. Playwright démarre en `en-US` : l'application s'ouvre donc
 * en anglais, et un test qui cherche « Nouvelle note » attend trente secondes
 * un champ nommé « New note ». Le diagnostic est trompeur, parce que le seul
 * test qui passait était celui qui ne lit qu'un titre identique dans les deux
 * langues.
 *
 * LE `use` EST FUSIONNÉ À LA MAIN, et pas passé par l'option `overrides` de la
 * fabrique : celle-ci REMPLACE la clé au lieu de la compléter, ce qui efface
 * le `baseURL` qu'elle vient de calculer — `page.goto('/')` sort alors en
 * « Cannot navigate to invalid URL ».
 */
// Clé de projet FACTICE pour le serveur e2e : sans elle, `ConsentBanner` ne
// rend rien et la garde de `entree.spec.ts` n’a rien à vérifier. Elle a la
// FORME d’une vraie (`phc_` + 25 caractères), sans quoi le socle la rejette et
// le bandeau reste muet. Le trafic vers PostHog est intercepté par la garde
// elle-même — rien ne sort, aucun projet réel n’est touché.
export default defineConfig({
  ...base,
  use: { ...(base.use as Record<string, unknown>), locale: 'fr-FR' },
});
