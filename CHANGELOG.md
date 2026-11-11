# Changelog

## 0.3.0 (12/11/2026)

### Ajouté

- Trois jeux d'icônes pour les lots, au choix de l'admin dans « Lots » :
  **Symboles** (l'affichage d'avant), **Dessins** (seize illustrations
  dessinées pour l'arcade, à choisir lot par lot) et **Mes images** (une image
  par lot, envoyée par l'admin). Les bobines, la roue et l'aperçu des lots
  suivent le jeu choisi.
- Les dessins font partie de l'application : une borne hors ligne les affiche.
  Les images sont réduites à 256 px avant l'envoi, et préchargées par la borne
  pour le hors ligne ; une image qui ne vient pas laisse place au symbole.

### Base de données

- Migration 0009 : le jeu d'icônes de chaque client, le dessin et l'image de
  chaque lot. Changer de jeu n'efface rien, et une administration ouverte sur
  l'ancienne version n'efface pas les dessins ni les images en enregistrant.

## 0.2.1 (07/11/2026)

### Corrigé

- La barre du bas dit qu'elle charge quand on ouvre l'administration pour la
  première fois, au lieu d'un clic qui semblait sans effet (socle 6.33.0,
  `navNavigate`).
- La file d'envoi : « Envoyer maintenant » attend que les contacts soient
  vraiment partis, et une file effacée par « Supprimer mes données » ne
  revient plus de la mémoire pour partir vers le serveur (socle 6.33.0).

### Maintenance

- Socle 6.33.0. L'app y a remonté ce qu'elle contournait : la neutralisation
  des formules dans l'export CSV (qui garde aussi un téléphone `+33…` en
  texte), la lecture des codes réseau comme des mots, la graine stable du
  magasin local. Sa propre neutralisation et le refus `nav-attente` du
  contrôle du parc sont retirés.

## 0.2.0 (07/11/2026)

### Corrigé

- Le jeu public lit de nouveau son client : la lecture anonyme répondait 401
  depuis la mise en ligne, le visiteur jouait les lots de démonstration de son
  navigateur, et aucun lead n'atteignait la base.
- L'admin d'un client administre son client, et non plus toujours `demo`.
- L'admin n'écrit plus en base à chaque frappe : brouillon, puis « Enregistrer »,
  en une transaction. Les leads gardent leur lot, les stocks ne sont plus
  recrédités, une modification faite ailleurs n'est plus écrasée.
- Un double appui ne fait plus deux tirages ; deux tirages simultanés ne se
  disputent plus le dernier lot.
- L'e-mail et le téléphone sont validés ; les erreurs s'affichent traduites,
  plus jamais brutes.

### Sécurité et RGPD

- Un lead ne s'écrit plus directement : il se rattache à un tirage réel, un seul
  par tirage, et son lot vient du serveur.
- Limite de parties par minute pour les visiteurs sans borne.
- Case de consentement non cochée, texte du client gardé avec chaque lead, durée
  de conservation appliquée chaque nuit, contact pour les droits.
- Plus de leads gardés en clair sur la tablette ; plus de SVG dans le bucket de
  marque ; formules neutralisées dans l'export CSV.
- L'administration locale se ferme par le code de l'appareil.

### Ajouté

- La borne `/j/<client>` : plein écran sans coquille, écran allumé, retour à
  l'accueil sans geste, menu par appui long et code.
- Le hors ligne en mode serveur : bornes appairées par jeton, tirage local sur
  la dernière config connue, file d'envoi des parties et des contacts.
- Code de retrait pour chaque gain, célébration (confettis, son, vibration).
- Administration en rubriques : jeu, lots (chance affichée, stock bas, ordre),
  formulaire et consentement, contacts (recherche, export CSV, suppression),
  statistiques, bornes (appairage par lien et QR code, révocation), clients
  (création, publication, administrateurs par adresse).
- La roue affiche le nom des lots.

### Ménage

- Les notes d'exemple du squelette sont parties (code, table, tests).
- Icônes et captures propres à l'arcade ; primaire assombri pour tenir l'AA sur
  le fond de page.
- ADR 0013 à 0015, README et AGENTS.md réécrits pour l'application.

## 0.1.0 (31/10/2026)

Première version, née du squelette.
