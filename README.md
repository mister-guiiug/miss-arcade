# miss-arcade

Jeux tactiles pour stand et point de vente : bandit manchot et roue, lots ponderes, messages personnalises, formulaire leads, utilisable hors ligne.

Application PWA de la famille `miss-*` / `mister-*`, née du squelette
[`pwa-starter-kit`](https://github.com/mister-guiiug/pwa-starter-kit) et bâtie
sur [`@mister-guiiug/dev-pwa-config`](https://github.com/mister-guiiug/dev-pwa-config).

## Démarrer

```bash
npm install
```

```bash
npm run dev
```

L'installation lit le socle sur GitHub Packages : exporter `NODE_AUTH_TOKEN`
(un jeton avec `read:packages`) avant `npm install`.

**L'application démarre sans configuration**, sur son stockage local. C'est une
propriété à conserver : elle rend possibles le hors-ligne, les tests sans
secrets, et la page publique qu'on ouvre sans compte.

## Vérifier

```bash
npm run build
```

Le build enchaîne `tsc -b`, Vite, le budget de poids et `pwa-doctor --strict` :
il échoue à la moindre dette de conformité au parc.

## Ce qui reste à faire

1. remplacer `public/favicon.svg`, puis `npm run icons` ;
2. régénérer les captures du manifeste : `npm run screenshots` ;
3. écrire le métier dans `src/features/`, et **remplacer l'exemple de
   `src/features/home/`** — il est là pour ça. L'accueil, lui, garde :
   - sa première ligne, l'accroche `app.tagline` : la seule phrase que les
     moteurs associent à la page ;
   - sa dernière, le pied de page de la famille, que la règle veut sur
     l'accueil et que `pwa-doctor --strict` contrôle ;
4. ajuster la palette dans `src/index.css` et les couleurs de `vite.config.ts` ;
5. si l'application a un backend : poser `VITE_SUPABASE_URL` et
   `VITE_SUPABASE_ANON_KEY` en **variables** du dépôt, et appliquer
   `supabase/` — sinon supprimer ce dossier et les deux workflows Supabase ;
6. relire le titre de la page (`<title>` et `og:title` d'`index.html`, que
   le socle sert en h1 aux robots) et la description — la meta
   d'`index.html`, `app.tagline` et `about.what` de `src/i18n/messages.ts` —
   et traduire l'anglais, marqué `TODO traduire`.

## Les décisions

Héritées du squelette et valables ici : [`docs/adr/`](./docs/adr/README.md).
Une application qui s'en écarte le fait, et l'écrit.

## Licence

MIT — voir [LICENSE](./LICENSE).
