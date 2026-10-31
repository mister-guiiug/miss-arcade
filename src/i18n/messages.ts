/**
 * Les dictionnaires de l'application, une entrée par locale et TOUTES DE MÊME
 * FORME : `createI18n` dérive le type des clés du dictionnaire de repli, et le
 * compilateur refuse ensuite `t('cle.qui.nexiste.pas')`.
 */
const fr = {
  app: {
    name: 'Miss Arcade',
    tagline:
      'Jeux tactiles pour stand et point de vente : bandit manchot et roue, lots pondérés, messages personnalisés, formulaire leads, utilisable hors ligne.',
  },
  nav: {
    home: 'Jouer',
    admin: 'Admin',
    settings: 'Réglages',
    account: 'Compte',
    about: 'À propos',
  },
  game: {
    bandit: 'Bandit manchot',
    roue: 'Roue de la fortune',
  },
  play: {
    loading: 'Chargement du jeu',
    continue: 'Rejouer',
  },
  bandit: {
    reels: 'Bobines du bandit manchot',
    spin: 'Lancer',
    spinning: '…',
  },
  wheel: {
    aria: 'Roue de la fortune',
    spin: 'Tourner la roue',
    spinning: '…',
  },
  lead: {
    intro: 'Laissez vos coordonnées pour recevoir votre lot.',
    prenom: 'Prénom',
    nom: 'Nom',
    email: 'E-mail',
    telephone: 'Téléphone',
    submit: 'Envoyer',
    skip: 'Passer',
  },
  admin: {
    title: 'Administration',
    intro:
      'Paramétrez le jeu actif, les lots (stock et pondération), les messages et le formulaire leads. Tout reste sur cet appareil — utilisable hors ligne.',
    gameType: 'Type de jeu',
    messages: 'Messages',
    welcome: 'Message d’accueil',
    win: 'Message de gain',
    winHint: 'Utilisez {lot} pour afficher le nom du lot.',
    lose: 'Message de perte',
    prizes: 'Lots',
    addPrize: 'Ajouter',
    newPrize: 'Nouveau lot',
    removePrize: 'Supprimer le lot',
    prizeLabel: 'Libellé',
    weight: 'Poids',
    stock: 'Stock',
    stockHint: 'Vide = illimité',
    symbol: 'Symbole',
    color: 'Couleur',
    loseFlag: 'Case perdante (pas de lot)',
    leads: 'Formulaire leads',
    leadEnabled: 'Afficher le formulaire après une partie',
    leadFields: 'Champs à collecter',
    leadCount: {
      one: '{count} lead enregistré',
      other: '{count} leads enregistrés',
    },
    clearLeads: 'Effacer les leads',
  },
  settings: {
    title: 'Réglages',
    appearance: 'Apparence',
    language: 'Langue',
    data: 'Données du jeu',
    export: 'Exporter la config et les leads',
    import: 'Importer',
    importConfirm: 'Remplacer la configuration actuelle ?',
    importBody:
      'Le fichier remplacera lots, messages et leads sur cet appareil. Exportez d’abord si vous voulez garder l’état actuel.',
    imported: {
      one: 'Import réussi ({count} lead).',
      other: 'Import réussi ({count} leads).',
    },
    importFailed: 'Fichier refusé : {error}',
    reset: 'Tout réinitialiser',
    resetConfirm: 'Réinitialiser le jeu ?',
    resetBody:
      'Lots, messages et leads reviendront aux valeurs d’exemple. Cette action est définitive.',
    backend: 'Source de données',
    backendLocal: 'Cet appareil seulement',
  },
  account: {
    title: 'Compte',
    localMode: 'Mode local',
    localModeBody:
      "Aucun backend n'est configuré : tout reste sur cet appareil. L'écran est là quand même — un écran masqué par une condition finit par diverger de celui qui s'affiche.",
    signOut: 'Se déconnecter',
    admin: 'Administration',
    linkIntro:
      'Un lien à usage unique arrive dans votre boîte : aucun mot de passe à retenir, ni à voler.',
    linkSentTitle: 'Lien envoyé',
    linkSentBody:
      "Un lien vient d'être envoyé à {email}. Ouvrez-le depuis cet appareil : il vous ramènera ici, connecté·e. Il n'est valable qu'une fois.",
    linkAgain: 'Recevoir un autre lien',
    usePassword: 'Se connecter avec un mot de passe',
    useLink: 'Recevoir un lien plutôt',
    danger: {
      title: 'Zone dangereuse',
      body: 'Supprimer votre compte efface vos données distantes, votre profil et le compte lui-même. Rien n’est conservé, et cette action ne s’annule pas.',
      action: 'Supprimer mon compte',
      confirmLabel: 'Retapez votre adresse pour confirmer',
      confirmHint: 'L’adresse du compte est {email}.',
      confirm: 'Supprimer définitivement',
      cancel: 'Annuler',
      mismatch: 'L’adresse saisie ne correspond pas : rien n’a été supprimé.',
      failed: 'La suppression a échoué : {error}',
    },
  },
  about: {
    title: 'À propos',
    what: 'Jeux tactiles pour stand et point de vente : bandit manchot et roue, lots pondérés, messages personnalisés, formulaire leads, utilisable hors ligne.',
  },
};

const en: typeof fr = {
  app: {
    name: 'Miss Arcade',
    tagline:
      'Touch games for booths and stores: slot machine and prize wheel, weighted prizes, custom messages, lead form, works offline.',
  },
  nav: {
    home: 'Play',
    admin: 'Admin',
    settings: 'Settings',
    account: 'Account',
    about: 'About',
  },
  game: {
    bandit: 'Slot machine',
    roue: 'Prize wheel',
  },
  play: {
    loading: 'Loading game',
    continue: 'Play again',
  },
  bandit: {
    reels: 'Slot machine reels',
    spin: 'Spin',
    spinning: '…',
  },
  wheel: {
    aria: 'Prize wheel',
    spin: 'Spin the wheel',
    spinning: '…',
  },
  lead: {
    intro: 'Leave your details to claim your prize.',
    prenom: 'First name',
    nom: 'Last name',
    email: 'Email',
    telephone: 'Phone',
    submit: 'Send',
    skip: 'Skip',
  },
  admin: {
    title: 'Administration',
    intro:
      'Configure the active game, prizes (stock and odds), messages and the lead form. Everything stays on this device — works offline.',
    gameType: 'Game type',
    messages: 'Messages',
    welcome: 'Welcome message',
    win: 'Win message',
    winHint: 'Use {lot} to show the prize name.',
    lose: 'Lose message',
    prizes: 'Prizes',
    addPrize: 'Add',
    newPrize: 'New prize',
    removePrize: 'Remove prize',
    prizeLabel: 'Label',
    weight: 'Weight',
    stock: 'Stock',
    stockHint: 'Empty = unlimited',
    symbol: 'Symbol',
    color: 'Color',
    loseFlag: 'Losing slot (no prize)',
    leads: 'Lead form',
    leadEnabled: 'Show the form after a round',
    leadFields: 'Fields to collect',
    leadCount: {
      one: '{count} lead saved',
      other: '{count} leads saved',
    },
    clearLeads: 'Clear leads',
  },
  settings: {
    title: 'Settings',
    appearance: 'Appearance',
    language: 'Language',
    data: 'Game data',
    export: 'Export config and leads',
    import: 'Import',
    importConfirm: 'Replace the current configuration?',
    importBody:
      'The file will replace prizes, messages and leads on this device. Export first if you want to keep the current state.',
    imported: {
      one: 'Import OK ({count} lead).',
      other: 'Import OK ({count} leads).',
    },
    importFailed: 'File rejected: {error}',
    reset: 'Reset everything',
    resetConfirm: 'Reset the game?',
    resetBody:
      'Prizes, messages and leads will return to the demo defaults. This cannot be undone.',
    backend: 'Data source',
    backendLocal: 'This device only',
  },
  account: {
    title: 'Account',
    localMode: 'Local mode',
    localModeBody:
      'No backend is configured: everything stays on this device. The screen is still here — a screen hidden behind a condition drifts away from the one that shows.',
    signOut: 'Sign out',
    admin: 'Admin',
    linkIntro:
      'A one-time link lands in your inbox: no password to remember, none to steal.',
    linkSentTitle: 'Link sent',
    linkSentBody:
      'A link was just sent to {email}. Open it from this device: it brings you back here, signed in. It only works once.',
    linkAgain: 'Send another link',
    usePassword: 'Sign in with a password',
    useLink: 'Send me a link instead',
    danger: {
      title: 'Danger zone',
      body: 'Deleting your account erases your remote data, your profile and the account itself. Nothing is kept, and this cannot be undone.',
      action: 'Delete my account',
      confirmLabel: 'Type your address again to confirm',
      confirmHint: 'The account address is {email}.',
      confirm: 'Delete permanently',
      cancel: 'Cancel',
      mismatch: 'The address does not match: nothing was deleted.',
      failed: 'Deletion failed: {error}',
    },
  },
  about: {
    title: 'About',
    what: 'Touch games for booths and stores: slot machine and prize wheel, weighted prizes, custom messages, lead form, works offline.',
  },
};

export const messages = { fr, en };
export type Messages = typeof fr;
