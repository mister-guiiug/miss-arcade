## Pour qui

Pour les commerçants, les exposants de salon et les équipes d'animation qui veulent un jeu à lots sur leur stand : une tablette posée sur le comptoir, un bandit manchot ou une roue de la fortune à leurs couleurs, et des contacts recueillis avec l'accord des joueurs.

## Comment ça marche

L'organisateur règle son jeu dans l'administration : le type de jeu, les messages d'accueil, de gain et de perte, le fond d'écran et le logo, puis jusqu'à 12 lots. Chaque lot a un poids, qui règle sa fréquence, et un stock, qui borne sa quantité ; la chance de chacun s'affiche avant d'enregistrer. Le jeu s'ouvre ensuite en plein écran sur une tablette, à l'adresse du client, sans la barre de navigation de l'application, et revient à l'accueil après quelques secondes sans geste. Chaque gain donne un code de retrait à présenter au stand. Après la partie, gagnants comme perdants peuvent laisser leurs coordonnées, ou passer.

Une borne appairée garde l'écran allumé et continue de jouer sans réseau, sur sa dernière configuration connue : ses parties et ses contacts partent dès le retour de la connexion, dans l'ordre et sans doublon. Les statistiques comptent parties, gains et contacts, et détaillent les résultats par lot et les parties par jour et par heure ; les contacts s'exportent en CSV.

Pour démarrer, jouez la démonstration de l'accueil, ou ouvrez la borne de démonstration en plein écran. Sur la version publiée, chaque client a son espace, et son administrateur s'y connecte par un lien reçu par e-mail une fois rattaché à ce client. Le code est libre : installée sans serveur, l'application tient sur un seul appareil, et les contacts s'emportent dans un fichier.

## Vos données

Un joueur ne laisse ses coordonnées que s'il coche la case d'accord, jamais cochée d'avance. Il lit sous cette case qui les conserve, combien de temps, et où exercer ses droits ; le texte accepté et l'heure de l'accord sont gardés avec le contact. Chaque client choisit sa durée de conservation, de 30 jours à 5 ans, et les contacts plus anciens sont effacés chaque nuit. Sur la version publiée, ils sont rangés dans la base Supabase de l'application, avec des droits par client : un administrateur ne voit que les siens. Hors ligne, une borne garde les coordonnées sur l'appareil le temps de les envoyer. La version publiée ne mesure pas l'audience et n'envoie pas de rapports d'erreur.

## Prix

Le code est gratuit et open source, sous licence MIT.
