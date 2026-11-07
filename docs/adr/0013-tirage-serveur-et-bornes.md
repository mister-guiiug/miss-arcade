# 0013 : Le serveur décide du tirage ; la borne appairée tire hors ligne

## Contexte

Relevé du 07/11/2026 en production : le jeu public ne pouvait pas lire son
client (401, « permission denied for function is_super_admin »). Le visiteur
jouait donc les lots de démonstration de son propre navigateur, et rien ne
partait vers la base. La même relecture a trouvé quatre autres défauts du
tirage et de l'administration :

- `arcade_public_spin` ne posait aucun verrou : deux tirages simultanés sur un
  stock de 1 rendaient tous deux « gagné » ;
- il ne journalisait rien : pas de statistiques, pas de limite de débit, et un
  `curl` en boucle vidait les stocks ;
- le bouton ne se verrouillait qu'après la réponse : un double appui faisait
  deux tirages ;
- l'admin réécrivait config ET lots à chaque frappe (upsert, DELETE de tous les
  lots, INSERT) : le DELETE effaçait `prize_id` de tous les leads
  (`on delete set null`), et les stocks lus à l'ouverture de l'écran
  recréditaient ceux que la borne avait décomptés.

Le hors ligne était annoncé (« utilisable hors ligne ») mais ne valait qu'en
mode local : en mode serveur, la config du client n'était gardée nulle part.

## Décision

1. **Le serveur décide du tirage en ligne** (`arcade_spin`) : verrou `for
update` sur les lots du client, journal `arcade_spins`, code de retrait,
   limite de débit pour les visiteurs anonymes. L'identifiant du tirage vient
   du client : rejouer l'appel après une coupure rend le MÊME tirage
   (idempotence), et le client retente une fois avec ce même identifiant avant
   de conclure à une coupure.
2. **Une borne est un appareil appairé par un jeton** (`arcade_kiosks`, haché en
   base, rendu une seule fois à l'admin, révocable). Seule une borne appairée
   peut tirer hors ligne : sur sa dernière config connue, avec un code de
   retrait du même alphabet que le serveur, et déclarer ses tirages au retour du
   réseau (`arcade_record_offline_spin`). Le lot promis est HONORÉ même si le
   stock central est épuisé entre-temps ; la survente est notée (`oversold`) et
   montrée au tableau de bord.
3. **Un téléphone de visiteur hors ligne ne joue pas** : il n'a aucun titre à
   déclarer des gains que personne n'a vus. Il le dit (« connexion
   nécessaire »).
4. **L'admin enregistre en une transaction** (`arcade_save_config`) : lots mis à
   jour par identifiant, jamais supprimés puis recréés ; stock écrit seulement
   si l'admin l'a touché ; jeton de concurrence `updated_at` qui refuse
   d'écraser une modification faite ailleurs.
5. **Les droits viennent du serveur** (`arcade_whoami`), plus du jeton : le hook
   qui recopiait les rôles dans le jeton s'active à la main sur un projet
   hébergé, et l'administration ne doit plus dépendre de ce geste.
6. **Une politique RLS par rôle** pour la lecture publique : anon ne voit que ce
   qui est publié, sans appeler aucune fonction. pgTAP lit désormais chaque
   table en anon (`supabase/tests/arcade.test.sql`).

## Conséquences

- Hors ligne, deux bornes d'un même client peuvent donner le même dernier lot :
  c'est le prix du hors ligne, rendu visible (survente) plutôt que caché. Un
  client qui ne l'accepte pas n'appaire pas ses bornes, et elles demandent le
  réseau.
- Le jeton d'une borne vit dans le `localStorage` de l'appareil, sur l'origine
  partagée par toute la famille d'applications. Il n'autorise qu'une chose
  (déclarer des tirages hors ligne pour SON client) et se révoque en un clic.
- La limite de débit est approximative (comptée sous verrou, par minute) : elle
  arrête un script, pas un réseau de robots. Une vraie protection anti-abus
  passerait par une passerelle (Cloudflare), hors de ce dépôt.

## Ce qui est écarté

- **Ouvrir `is_super_admin()` à anon** pour réparer la politique : la liste
  relue des fonctions exécutables par anon (`structure-securite.test.sql`)
  aurait grandi pour une mauvaise raison.
- **Une réserve de lots par borne** (allocation hors ligne) : juste en théorie,
  lourde à administrer, et un stand ne sait pas d'avance quelle borne gagnera.
- **Tirer hors ligne sur n'importe quel appareil** : ce serait laisser
  quiconque déclarer des gains.
