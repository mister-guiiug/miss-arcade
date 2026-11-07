# 0015 : Un lead se rattache à un tirage, avec un consentement daté ; la borne est un écran à part

## Contexte

Relevé du 07/11/2026 :

- l'insertion d'un lead était ouverte à anon sans contrôle : n'importe qui
  pouvait déclarer avoir gagné le « Grand lot », en nombre illimité, avec un
  `jsonb` de taille libre ;
- le formulaire collectait e-mail et téléphone sans case de consentement, sans
  finalité, sans responsable ni durée de conservation ;
- le jeu public s'affichait dans la coquille complète de l'application : le
  visiteur d'un stand voyait Admin, Réglages (« Réinitialiser ») et Compte, et,
  en mode local, l'administration était ouverte à tous ;
- un visiteur qui quittait la borne au milieu du formulaire laissait son
  prénom et son adresse au suivant.

## Décision

**Les leads.**

- Un lead ne s'écrit que par `arcade_submit_lead`, qui exige un tirage réel
  (`spin_id`), un seul lead par tirage, et reprend le lot DU TIRAGE : le client
  n'envoie plus de lot du tout. L'insertion directe est retirée.
- Les champs sont filtrés (prénom, nom, e-mail, téléphone), bornés à 120
  caractères, l'e-mail et le téléphone validés côté serveur ; l'interface
  applique les mêmes règles avant d'envoyer.
- **Gagnants ET perdants** se voient proposer le formulaire ; le résultat
  (gagné/perdu) et le code de retrait suivent le lead.

**Le consentement (RGPD).** Le client est responsable du traitement ;
l'application lui donne de quoi l'être sans décider à sa place :

- une case **non cochée**, sans laquelle rien ne part, avec le texte du client
  (modifiable dans l'admin) ;
- ce texte et l'instant de l'accord sont **gardés avec chaque lead** : c'est la
  preuve ;
- sous la case : qui conserve, combien de temps, où exercer ses droits ;
- une **durée de conservation** par client (30 jours à 5 ans), appliquée chaque
  nuit par `pg_cron` (`arcade_purge_expired_leads`) ;
- l'admin recherche, exporte (CSV pour Excel français, formules neutralisées)
  et supprime les contacts, un par un ou en bloc.

**La borne.** `/j/<client>` s'affiche **sans la coquille** : la marque du
client, le jeu, rien d'autre. Une borne appairée garde l'écran allumé (Wake
Lock), propose le plein écran au démarrage, et **revient à l'accueil** après
`idle_seconds` sans geste, formulaire vidé. Son menu s'ouvre par un appui long,
puis par le code de l'appareil (4 à 8 chiffres, haché et salé, gardé sur
l'appareil). Ce même code ferme l'administration en mode local.

## Conséquences

- Un contact saisi hors ligne arrive avec l'heure de son accord, pas celle de
  sa réception ; le serveur borne cette heure (jamais dans le futur).
- Le code de la borne n'est pas une frontière de sécurité : il arrête un
  visiteur, pas quelqu'un qui ouvre les outils du navigateur. Les données, elles,
  sont protégées par le serveur (RLS, RPC), pas par ce code.
- Le texte de consentement par défaut est un point de départ : le client doit
  l'adapter à sa finalité réelle.

## Ce qui est écarté

- **Deux cases** (remise du lot / prospection) : plus juste juridiquement,
  mais c'est au client de choisir sa base légale ; le texte unique et modifiable
  le lui permet sans figer un modèle.
- **Envoyer les e-mails d'invitation des admins** depuis l'application : il
  faudrait la clé de service dans une fonction serveur. Le super admin rattache
  par adresse un compte qui s'est déjà connecté une fois (`arcade_assign_admin`).
