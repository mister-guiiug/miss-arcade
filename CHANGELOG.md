# Changelog

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
