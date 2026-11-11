# Instructions pour les agents

Ce dépôt est **miss-arcade**, une application de la famille : jeux de stand
(bandit manchot, roue), bornes appairées qui jouent hors ligne, collecte de
contacts avec consentement, administration multi-client sur Supabase. Les
règles du compte (`../AGENTS.md`) s'appliquent ; celles-ci les précisent.

## Les règles

**1. Le serveur décide, l'interface obéit.** Le tirage en ligne, le lot d'un
lead, le stock et les droits sont décidés par les fonctions de
`supabase/migrations/0008_arcade_pro.sql`, sous RLS. Une règle de sécurité écrite
seulement côté client est une règle absente.

**2. Toute fonction ou politique SQL se prouve en pgTAP.** Le jeu public a été
cassé en production sans qu'aucun test ne rougisse, parce qu'aucune assertion ne
lisait les tables en `anon` (ADR [0013](./docs/adr/0013-tirage-serveur-et-bornes.md)).
`supabase/tests/arcade.test.sql` lit chaque table en anon, en admin d'un autre
client, en super admin. Une fonction exposée à anon s'ajoute à la liste relue de
`structure-securite.test.sql`, jamais sans raison.

**3. Ce qui part vers le serveur passe par la file d'envoi**
(`src/features/arcade/sync/outbox.ts`, ADR [0014](./docs/adr/0014-file-d-envoi-hors-ligne.md)).
Chaque élément porte son identifiant, le serveur est idempotent dessus. Aucune
coordonnée de joueur ne se garde sur l'appareil au-delà de son envoi.

**4. Le visiteur d'une borne ne lit jamais un message technique.** Les échecs
sont des codes (`ArcadeErrorCode`), traduits à l'écran ; le message d'origine
part au journal.

**5. La porte reste passable.** `npm run build` enchaîne le budget de poids et
`pwa-doctor --strict` : zéro défaut, zéro dette. Un refus (`pwaDoctor.refus`)
se motive, et se retire quand sa raison tombe.

## Ce qui vient du socle, et ne se réécrit pas

Avant d'écrire quoi que ce soit, chercher dans
[`@mister-guiiug/dev-pwa-config`](https://github.com/mister-guiiug/dev-pwa-config) :
la file d'envoi (`sync-queue`), le CSV (`csv`), le QR (`qr`), les codes courts
(`pairing`), le plein écran, l'écran allumé, l'appui long, le retour sonore et
haptique (`react/use-*`), les images (`image`), les primitives d'interface.

**`components.css` est le prérequis de toute adoption de `/react`.** Elle est
importée dans `src/index.css` : ne pas la retirer.

## Où vit quoi

| Chemin                           | Rôle                                                  |
| -------------------------------- | ----------------------------------------------------- |
| `src/features/arcade/model.ts`   | Le contrat : schémas Zod, tirage, codes, validation   |
| `src/features/arcade/backend/`   | Le port, l'adaptateur local et l'adaptateur Supabase  |
| `src/features/arcade/sync/`      | La file d'envoi hors ligne et son panneau             |
| `src/features/arcade/play/`      | Le jeu : magasin, scène, bobines, roue, formulaire    |
| `src/features/arcade/icons/`     | Les jeux d'icônes : dessins, face de chaque lot       |
| `src/features/arcade/kiosk/`     | La borne : écran, appairage, code, retour à l'accueil |
| `src/features/arcade/admin/`     | L'administration (morceau différé)                    |
| `supabase/migrations/0008_*.sql` | Tirages, bornes, leads, sauvegarde atomique, purge    |
| `supabase/migrations/0009_*.sql` | Le jeu d'icônes et les dessins et images des lots     |

## Modifier

Une pull request, la CI verte, et un ADR si la modification change une
décision. Le dépôt est protégé : aucun commit n'atterrit sur `main` sans PR.

Les commits suivent [Conventional Commits](https://www.conventionalcommits.org/fr/),
sujet en français, à l'impératif. Le corps explique **pourquoi** : le diff dit
déjà quoi. Aucune signature d'assistant, nulle part.
