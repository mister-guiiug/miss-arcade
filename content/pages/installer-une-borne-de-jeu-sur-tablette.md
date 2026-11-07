---
title: Installer une borne de jeu sur tablette pour un salon ou un magasin
description: Installer une borne de jeu sur tablette : appairer l'appareil, plein écran et écran allumé, menu protégé par un code, accès guidé, et jeu qui continue sans réseau.
date: 2026-11-07
answer: Pour installer une borne de jeu sur tablette, appairez l'appareil depuis l'administration avec un lien à usage unique, ouvrez-le une première fois avec une connexion, démarrez la borne en plein écran, laissez la tablette branchée puisque l'écran reste allumé, protégez le menu par un code de 4 à 8 chiffres, puis bloquez la tablette sur le navigateur avec l'Accès guidé de l'iPad ou l'épinglage d'écran d'Android.
---

# Installer une borne de jeu sur tablette

Une borne de jeu, c'est une tablette posée sur un comptoir ou fixée à un support, qui fait jouer les visiteurs l'un après l'autre sans que personne ne la surveille. Elle doit rester allumée, revenir seule à l'accueil, résister aux doigts curieux, et ne pas s'arrêter quand le Wi-Fi du salon sature.

## Préparer le matériel

- **Une tablette chargée, et branchée pendant l'événement.** Une borne garde son écran allumé toute la journée : sur batterie, elle ne tiendra pas.
- **Un support stable**, à hauteur de main, écran incliné vers le visiteur.
- **Une connexion pour la mise en route.** La borne doit être ouverte une première fois en ligne, pour charger le jeu et sa configuration.
- **Un essai la veille**, sur place si possible : luminosité, son, et lisibilité du fond d'écran à deux mètres.

## Appairer la tablette

L'appairage fait d'une tablette quelconque la borne d'un client précis. Dans Miss Arcade :

1. ouvrez l'administration, rubrique **Bornes** ;
2. donnez un nom à la borne, par exemple « Stand hall B », puis **Créer un lien d'appairage** ;
3. ouvrez ce lien sur la tablette, ou scannez le QR code affiché. Il ne s'affiche qu'une fois : en cas de perte, créez-en un autre.

La tablette confirme qu'elle est devenue la borne, et l'administration la liste avec la date de sa dernière visite. Une borne perdue ou volée se révoque au même endroit, en un geste : elle ne peut plus déclarer de parties jouées hors ligne.

## Mettre la borne en route

Sur la tablette, **Démarrer la borne** passe en plein écran, quand le navigateur le permet. Une borne appairée demande au navigateur de garder l'écran allumé. Entre deux joueurs, la borne revient à l'accueil après un délai sans geste, de 15 à 600 secondes (45 par défaut), et vide le formulaire : le visiteur suivant ne lit pas le prénom et l'adresse du précédent.

## Verrouiller la tablette

**Un code pour le menu.** Le menu de la borne s'ouvre par un appui long, puis par le code de l'appareil, de 4 à 8 chiffres. Sans code, n'importe qui peut quitter la borne. Ce code arrête un visiteur, pas quelqu'un qui sait ouvrir les outils du navigateur : les données, elles, sont protégées par le serveur.

**Un verrou du système pour le reste.** Le plein écran se quitte d'un geste du bord de l'écran. Pour empêcher le visiteur de sortir du navigateur, utilisez le verrou de la tablette :

- sur iPad, l'**Accès guidé** limite l'appareil à une seule app, et se quitte par un code ;
- sur Android, l'**épinglage d'écran** garde une app au premier plan jusqu'à ce qu'on la libère.

## Quand le réseau tombe

Une borne appairée continue de jouer sans réseau, sur la dernière configuration qu'elle a lue : lots, messages, fond d'écran et logo. Elle tire le lot elle-même, donne un code de retrait, garde la partie et les coordonnées du joueur, puis envoie tout dès le retour de la connexion, dans l'ordre et sans doublon. Le menu de la borne montre ce qui attend encore d'être envoyé.

Deux limites à connaître :

- **deux bornes hors ligne peuvent donner le même dernier lot.** Le gain promis est honoré, et la survente apparaît dans les statistiques, pour réapprovisionner ;
- **le téléphone d'un visiteur ne joue pas hors ligne.** Seule une borne appairée a le droit de déclarer des gains que le serveur n'a pas vus.

## Comment Miss Arcade vous aide

[Miss Arcade](https://mister-guiiug.github.io/miss-arcade/) est pensée pour la borne :

- **un écran à part** pour chaque client, à son adresse, sans la barre de navigation de l'application : la marque du client et le jeu, rien d'autre ;
- **l'appairage par lien ou par QR code**, une borne révocable à tout moment, et la date de dernière visite de chacune ;
- **plein écran, écran allumé, retour à l'accueil** après le délai choisi ;
- **un menu protégé** par un appui long et un code de 4 à 8 chiffres ;
- **le jeu hors ligne**, avec une file d'envoi qui garde jusqu'à 2 000 éléments et les transmet au retour du réseau ;
- **un son à chaque gain**, si vous l'activez.

## Questions fréquentes

### Faut-il installer une application sur la tablette ?

Non. La borne s'ouvre dans le navigateur, à partir du lien d'appairage. Miss Arcade peut aussi s'installer sur l'écran d'accueil, comme une application.

### La borne fonctionne-t-elle sans Wi-Fi ?

Oui, une fois appairée et ouverte une première fois en ligne. Elle joue sur sa dernière configuration connue et envoie parties et contacts au retour de la connexion.

### Comment empêcher un visiteur de quitter le jeu ?

Protégez le menu de la borne par un code, puis bloquez la tablette sur le navigateur : Accès guidé sur iPad, épinglage d'écran sur Android.

### Peut-on utiliser plusieurs bornes pour le même stand ?

Oui. Appairez chaque tablette avec son propre lien. Elles partagent les lots et leurs stocks. Hors ligne, elles peuvent donner le même dernier lot : la survente est signalée dans les statistiques.

### Que faire si la tablette est perdue ?

Révoquez-la dans l'administration, rubrique Bornes. Elle ne peut plus déclarer de parties jouées hors ligne.

## Sources

- [Apple : utiliser Accès guidé sur iPhone ou iPad](https://support.apple.com/fr-fr/111795)
- [Aide Android : épingler des écrans et les retirer](https://support.google.com/android/answer/9455138?hl=fr)
- [MDN : utiliser le mode plein écran](https://developer.mozilla.org/fr/docs/Web/API/Fullscreen_API)
- [MDN : l'API Screen Wake Lock, en anglais](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
