import { z } from 'zod';
import { createStore } from '@mister-guiiug/dev-pwa-config/storage';
import { publicGameSchema, type PublicGame } from '../model.ts';

/**
 * LE DERNIER JEU CONNU DE CHAQUE BORNE. Avant 0008, une borne en mode serveur
 * qui perdait le réseau jouait les lots de DÉMONSTRATION, avec la mauvaise
 * marque : la config distante n'était gardée nulle part. Elle l'est ici, par
 * client, à chaque chargement réussi, et sert de repli hors ligne.
 *
 * Rien de personnel : lots, messages, adresses d'images. Les leads n'y entrent
 * jamais.
 */
const cacheSchema = z.object({
  game: publicGameSchema,
  cachedAt: z.string(),
});
export type CachedGame = z.infer<typeof cacheSchema>;

const store = createStore('miss-arcade-jeu-');

export function readCachedGame(slug: string): CachedGame | null {
  const parsed = cacheSchema.safeParse(store.get(slug, null));
  return parsed.success ? parsed.data : null;
}

export function writeCachedGame(slug: string, game: PublicGame): void {
  store.set(slug, { game, cachedAt: new Date().toISOString() });
}

export function clearCachedGames(): void {
  store.clear();
}

/**
 * Demande les images de marque une fois en ligne : le service worker les met
 * en cache à ce moment-là (règle `runtimeCaching` de `vite.config.ts`), et la
 * borne les retrouve hors ligne. L'image du format qu'on n'affiche pas (fond
 * téléphone sur un écran large) ne serait sinon jamais chargée.
 */
export function warmImages(game: PublicGame): void {
  if (typeof Image === 'undefined') return;
  const { wallpaperDesktop, wallpaperMobile, logoUrl } = game.config;
  for (const url of [wallpaperDesktop, wallpaperMobile, logoUrl]) {
    if (url) new Image().src = url;
  }
}
