# 0016 — Trois jeux d'icônes ; chaque lot garde ses trois valeurs

## Contexte

Jusqu'à la 0.3.0, un lot se montrait sur les bobines et la roue par un symbole
de un à quatre caractères (`·`, `★`, `%`, `◆`), saisi par l'admin. Il fallait
aussi pouvoir choisir des icônes dessinées, et qu'un client puisse montrer ses
propres images : son produit, son logo, un bon d'achat à ses couleurs.

Deux contraintes viennent des décisions d'avant : une borne joue hors ligne
(ADR [0013](./0013-tirage-serveur-et-bornes.md)), et l'admin travaille en
brouillon, enregistré en une transaction (`arcade_save_config`).

## Décision

1. **Un réglage par client, `iconSet`** : `symboles` (l'affichage d'avant, par
   défaut), `dessin` ou `perso`. Un client existant ne voit rien changer.
2. **Chaque lot garde ses trois valeurs** : `symbol`, `drawing`, `image`.
   Changer de jeu d'icônes ne réécrit aucun lot, et revenir au jeu d'avant le
   retrouve intact. Le symbole reste la valeur de secours : un lot sans image,
   ou une image qui ne charge pas, montre son symbole.
3. **Les dessins sont dans l'application** (`icons/Drawing.tsx`, seize SVG,
   environ 4,5 kB gzip), pas sur un serveur : une borne hors ligne les affiche
   sans les avoir jamais téléchargés. La base garde un **nom**, contrôlé par sa
   forme et non par une liste : enrichir le catalogue ne demande pas de
   migration, et un nom que l'application ne connaît pas est remplacé par un
   dessin par défaut.
4. **Les images vont dans le bucket `branding`**, à `<client>/icones/<lot>` :
   même politique que les fonds, même règle de cache hors ligne du service
   worker. Elles sont réduites à 256 px et réencodées sans métadonnées avant
   l'envoi (WebP, qui garde la transparence). Le SVG est refusé, comme pour la
   marque. `warmImages` les demande toutes au chargement du jeu : une borne
   n'affiche l'image d'un lot rare qu'à son premier tirage, peut-être hors
   ligne.
5. **Une seule fonction lit le jeu d'icônes** (`faceResolver`, `icons/faces.ts`).
   Bobines, roue et administration affichent une `Face`, jamais un champ du lot.
   Le bandit compare ce qui se voit (`key`) : deux lots au même dessin ne
   doivent pas faire un faux alignement sur un tirage perdant.

## Conséquences

- Passer aux dessins écrit le dessin de chaque lot qui n'en a pas : ce que
  l'admin voit à l'aperçu est ce qui part à l'enregistrement. Un lot ajouté
  reçoit un dessin que les autres n'ont pas.
- `arcade_save_config` ne touche le dessin et l'image d'un lot que si la clé
  est envoyée : une admin restée ouverte sur l'ancien bundle ne les efface pas
  en enregistrant.
- Le jeu `perso` demande le serveur, comme les fonds : en mode local, chaque
  lot montre son symbole, et l'écran le dit.
- Un lot supprimé laisse son image dans le bucket, comme un fond remplacé
  laissait l'ancien jusqu'à l'envoi suivant. Le ménage du bucket n'est pas fait.

## Écarté

- **Un champ unique par lot** (texte, dessin ou image) : changer de jeu
  d'icônes aurait effacé les valeurs de l'autre jeu.
- **Les dessins servis depuis le Storage** : ils dépendraient du réseau à la
  première ouverture d'une borne, pour un poids que le bundle porte sans peine.
- **Les images dans la base, en `data:`** : jusqu'à douze images dans chaque
  réponse du jeu public, et dans le cache local de chaque borne.
- **Un jeu « emoji » à part** : le symbole est déjà un texte libre, qui accepte
  un emoji, et un emoji se dessine différemment d'un appareil à l'autre.
