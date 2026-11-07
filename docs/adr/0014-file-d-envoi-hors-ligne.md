# 0014 : Une file d'envoi, pas une pile ; les coordonnées n'y font que passer

## Contexte

Le besoin, tel qu'exprimé le 07/11/2026 : autoriser le hors ligne, et
transmettre au serveur central les informations des joueurs, gagnants comme
perdants, avec un système de « pile » si c'est la meilleure solution.

Avant 0008, un lead écrit en mode serveur partait une fois ; s'il échouait
(réseau), il restait dans le `localStorage` de la tablette, avec TOUS les leads
précédents, et n'était jamais renvoyé. Les coordonnées de tout un salon
s'accumulaient sur l'appareil, sur une origine partagée par toute la famille
d'applications.

## Décision

**Une file (premier entré, premier sorti), pas une pile.** L'ordre est le
contrat : un tirage hors ligne doit arriver AVANT le lead qui le cite, sinon le
serveur refuse le lead (« tirage inconnu »). Une pile (dernier entré, premier
sorti) inverserait exactement cet ordre.

C'est la file du socle, `createSyncQueue` (ADR [0010](./0010-ecrire-hors-ligne.md)),
branchée sur le port de l'arcade dans `src/features/arcade/sync/outbox.ts` :

- **persistante** (préfixe `miss-arcade-envoi-`) : une borne éteinte puis
  rallumée renvoie ce qu'elle gardait, dès le démarrage ;
- **drainée en série**, dans l'ordre, au retour du réseau et après chaque ajout ;
- **retrait exponentiel** (2 s à 60 s) sur un échec réseau ou un débit refusé ;
  un échec réseau n'épuise jamais un élément ;
- **lettres mortes** pour ce que le serveur refuse durablement (droits,
  validation) : la file continue avec la suite, et l'élément refusé reste
  visible, relançable, exportable, ou abandonnable sur confirmation, dans le
  menu de la borne et l'onglet Bornes ;
- **idempotente** : chaque tirage et chaque lead porte son identifiant
  (`crypto.randomUUID`), et le serveur rend « déjà reçu » au lieu de doubler ;
- **plafonnée** à 2 000 éléments : pleine, elle le dit (la borne refuse de jouer
  hors ligne) plutôt que de jeter.

Tous les leads passent par elle, en ligne compris : l'écran remercie tout de
suite, et l'envoi suit. **Une coordonnée n'y reste que le temps de partir** :
retirée à l'accusé de réception, jamais gardée en historique sur la borne.

## Conséquences

- Tant qu'elle n'est pas partie, une coordonnée est sur l'appareil, dans le
  `localStorage` (environ 5 Mo pour toute l'origine de la famille : 2 000
  éléments en prennent moins d'un). C'est le minimum qu'un hors ligne exige.
- Le service worker ne draine pas la file quand la page est fermée
  (Background Sync) : une borne reste ouverte par construction, et la file
  repart au prochain démarrage.

## Ce qui est écarté

- **IndexedDB** : plus de place, mais la file du socle est écrite sur `Store`
  (synchrone), et 2 000 leads tiennent largement dans `localStorage`.
- **Garder un historique local des leads** en mode serveur : c'était la fuite.
