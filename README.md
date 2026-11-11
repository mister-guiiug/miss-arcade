# miss-arcade

Jeux tactiles pour stand et point de vente : bandit manchot et roue, lots
pondérés, messages personnalisés, formulaire leads, utilisable hors ligne.

Application PWA de la famille `miss-*` / `mister-*`, née du squelette
[`pwa-starter-kit`](https://github.com/mister-guiiug/pwa-starter-kit) et bâtie
sur [`@mister-guiiug/dev-pwa-config`](https://github.com/mister-guiiug/dev-pwa-config).

## Ce que fait l'application

- **La borne** (`/j/<client>`) : plein écran, sans la coquille de
  l'application, à la marque du client (fond grand écran et téléphone, logo).
  Une partie de bandit manchot ou de roue, un code de retrait pour chaque gain,
  puis le formulaire de contact, proposé aux gagnants comme aux perdants.
- **Le hors ligne** : une borne APPAIRÉE continue de jouer sans réseau, sur sa
  dernière configuration connue. Ses parties et les coordonnées des joueurs
  partent vers le serveur dès le retour de la connexion, dans l'ordre, sans
  doublon (ADR [0014](./docs/adr/0014-file-d-envoi-hors-ligne.md)).
- **L'administration** (`/admin`) : jeu et messages, marque, lots (poids, stock,
  chance affichée), formulaire et consentement, contacts (recherche, export CSV,
  suppression), statistiques, bornes appairées, et, pour le super admin, les
  clients et leurs administrateurs.

## Démarrer

```bash
npm install
```

```bash
npm run dev
```

L'installation lit le socle sur GitHub Packages : exporter `NODE_AUTH_TOKEN`
(un jeton avec `read:packages`) avant `npm install`.

**L'application démarre sans configuration**, sur son stockage local : un seul
client, celui de l'appareil, et l'export de fichier (rubrique Données) pour
emporter les contacts. C'est une propriété à conserver : elle rend possibles les
tests sans secrets, la démonstration, et une borne sans serveur du tout.

## Avec le serveur (Supabase)

Poser `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` en **variables** du dépôt
(elles sont copiées dans le bundle). Les migrations de `supabase/migrations`
partent en production à la fusion sur `main` (workflow « Supabase migrations »),
et pgTAP les éprouve sur chaque PR (`supabase/tests`).

- **Les adresses de retour de la connexion**, à poser une fois dans
  Authentication → URL Configuration. Un projet neuf n'autorise que
  `http://localhost:3000` : le lien reçu par e-mail ramène alors là, et la
  connexion échoue sans message. L'app demande pourtant le bon retour
  (`emailRedirectTo`) ; Supabase l'écarte s'il n'est pas dans la liste.
  - Site URL : `https://mister-guiiug.github.io/miss-arcade/`
  - Redirect URLs : `https://mister-guiiug.github.io/miss-arcade/**` et,
    pour le développement, `http://localhost:5220/**`

  Le lien se valide dans le navigateur où il a été demandé : la connexion
  passe par PKCE, dont la clé ne quitte pas cet appareil.

- **Les droits** viennent de la base (`arcade_whoami`) : le hook
  `custom_access_token_hook` n'est plus nécessaire pour ouvrir l'administration.
  Il recopie toujours les rôles dans le jeton, pour la pastille « Admin » de
  l'écran Compte : l'activer dans Authentication → Hooks si on la veut.
- **Rattacher un administrateur** : la personne se connecte une fois (lien reçu
  par e-mail), puis le super admin la rattache à un client par son adresse
  (Administration → Clients).
- **Appairer une borne** : Administration → Bornes, « Créer un lien
  d'appairage », puis ouvrir le lien (ou scanner le QR code) sur la tablette.
  Le lien ne s'affiche qu'une fois ; une borne se révoque au même endroit.
- **Conservation des contacts** : `pg_cron` purge chaque nuit les contacts plus
  anciens que la durée choisie par le client. Vérifier la tâche :
  `select jobname, schedule from cron.job;` (elle s'appelle
  `arcade-purge-leads`).

## Vérifier

```bash
npm run build
```

Le build enchaîne `tsc -b`, Vite, le budget de poids et `pwa-doctor --strict` :
il échoue à la moindre dette de conformité au parc.

```bash
npm test
```

```bash
npm run test:e2e
```

## Les décisions

Héritées du squelette, et propres à l'arcade (0013 à 0015) :
[`docs/adr/`](./docs/adr/README.md). Une application qui s'en écarte le fait, et
l'écrit.

## Licence

MIT, voir [LICENSE](./LICENSE).
