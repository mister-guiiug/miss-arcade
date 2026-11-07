import { lazy, Suspense } from 'react';
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { Gamepad2, Home, Info, Settings, UserRound } from 'lucide-react';
import { AppShell } from '@mister-guiiug/dev-pwa-config/react/app-shell';
import { ObservabilityBoundary } from '@mister-guiiug/dev-pwa-config/react/error-boundary';
import { ConnectionBanner } from '@mister-guiiug/dev-pwa-config/react/connection-banner';
import { ConsentBanner } from '@mister-guiiug/dev-pwa-config/react/consent-banner';
import { usePageViews } from '@mister-guiiug/dev-pwa-config/react/use-page-views';
import { AppUpdates } from '@mister-guiiug/dev-pwa-config/react/app-updates';
import { SkeletonGroup } from '@mister-guiiug/dev-pwa-config/react/skeleton';
import { useIdlePrefetch } from '@mister-guiiug/dev-pwa-config/react/use-prefetch';
import { registerSW } from 'virtual:pwa-register';
import { useI18n } from './i18n/index.ts';
import { HomeScreen } from './features/home/HomeScreen.tsx';
import { SettingsScreen } from './features/settings/SettingsScreen.tsx';
import { AboutScreen } from './features/about/AboutScreen.tsx';
import { AccountScreen } from './features/account/AccountScreen.tsx';
import { KioskScreen } from './features/arcade/kiosk/KioskScreen.tsx';

/**
 * L'ADMINISTRATION EN UN SEUL MORCEAU DIFFÉRÉ : le visiteur d'une borne ne la
 * télécharge jamais au premier chargement (QR, statistiques, éditeurs). Un
 * seul `lazy()` pour tout l'écran, pas un par rubrique : découper en dix
 * morceaux fait MONTER le poids total (relevé du parc, budgets de bundle). Le
 * service worker précache le morceau : l'admin locale reste disponible hors
 * ligne.
 */
const loadAdmin = () => import('./features/arcade/admin/AdminScreen.tsx');
const AdminScreen = lazy(() =>
  loadAdmin().then(module => ({ default: module.AdminScreen }))
);

/**
 * LE CADRE : `AppShell` du socle (en-tête, contenu borné, barre basse).
 *
 * PROMU, PAS INVENTÉ. Ce fichier assemblait déjà `AppHeader` + `PageContainer`
 * + `BottomNav` + le lien d'évitement — le socle a remonté la composition.
 *
 * LE PIED DE PAGE N'EST PAS ICI, ET C'EST LA RÈGLE. Rendu dans la coquille,
 * hors des routes, `<AppFooter>` suivait chaque écran — trois liens sortants
 * sous une saisie. La règle famille du 06/09/2026 le veut sur deux écrans, et
 * deux seulement : l'accueil et À propos — c'est là qu'il est rendu, une ligne
 * dans chacun. `pwa-doctor` (`liens-famille`) refuse la coquille depuis.
 *
 * `linkComponent={Link}` avec `hrefProp="to"` : les composants de navigation
 * sont agnostiques de routeur, et c'est ainsi qu'on leur donne celui de l'app.
 * Un `<BottomNav />` sans `items` rend une barre VIDE — c'est le piège que la
 * campagne d'adoption a rencontré, et il ne produit aucune erreur de type.
 *
 * `navCurrentPath={pathname}` : le chemin du ROUTEUR, relatif à la base. Sans
 * lui, la barre lit `location.pathname`, qui vaut `/miss-arcade/` une fois
 * déployé quand l'entrée vaut `/` : aucun onglet n'était actif en ligne, jamais
 * en développement ni en e2e, servis sous `/`. Relevé le 03/10/2026 ; la prop
 * existe depuis le socle 6.23.0.
 *
 * Exporté pour `App.nav.test.tsx`, qui le monte sous un `basename`.
 */
export function Shell() {
  const { t } = useI18n();
  const { pathname } = useLocation();

  /*
   * UNE VUE DE PAGE PAR NAVIGATION — ni zéro, ni deux. PostHog en envoie une
   * au chargement ET à chaque changement d'historique quand on le laisse
   * faire ; les apps du parc étant en `HashRouter`, chaque navigation serait
   * comptée DEUX fois. `initAnalytics` pose donc `capture_pageview: false`
   * pour que toutes passent par ici, la première comprise. Sans ce hook, à
   * l'inverse, la navigation d'une PWA est invisible et la durée de session
   * fausse.
   *
   * Il ne fait rien tant que le consentement n'est pas accordé : il se monte
   * donc sans condition.
   */
  usePageViews(pathname);

  // Le morceau de l'admin, tiré quand le navigateur n'a rien d'autre à faire :
  // le premier clic le trouve déjà là (la barre le tire aussi à l'approche du
  // pointeur, par `load`). LE MÊME thunk que `lazy()`.
  useIdlePrefetch(loadAdmin);

  const nav = [
    {
      href: '/',
      label: t('nav.home'),
      icon: <Home aria-hidden="true" />,
      end: true,
    },
    {
      href: '/admin',
      label: t('nav.admin'),
      icon: <Gamepad2 aria-hidden="true" />,
      load: loadAdmin,
    },
    {
      href: '/reglages',
      label: t('nav.settings'),
      icon: <Settings aria-hidden="true" />,
    },
    {
      href: '/compte',
      label: t('nav.account'),
      icon: <UserRound aria-hidden="true" />,
    },
    {
      href: '/a-propos',
      label: t('nav.about'),
      icon: <Info aria-hidden="true" />,
    },
  ];

  /*
   * L'ACCUEIL PORTE LE NOM DE L'APP, PAS CELUI DE SON PREMIER ÉCRAN. C'est le
   * seul `h1` que lit un moteur, et le premier que voit un visiteur. Relevé du
   * 23/09/2026 dans un navigateur vierge : le squelette y titrait « Notes »,
   * et trois apps du parc avaient hérité du même travers — « Mes espaces »,
   * « Connexion », le nom du dépôt. Le titre de l'écran descend d'un cran,
   * en `h2`, dans `HomeScreen`.
   */
  const titles: Record<string, string> = {
    '/': t('app.name'),
    '/admin': t('admin.title'),
    '/reglages': t('settings.title'),
    '/compte': t('account.title'),
    '/a-propos': t('about.title'),
  };
  const title = pathname.startsWith('/admin')
    ? t('admin.title')
    : (titles[pathname] ?? t('app.name'));

  return (
    <AppShell
      title={title}
      backHref={pathname === '/' ? undefined : '/'}
      linkComponent={Link}
      hrefProp="to"
      navItems={nav}
      navCurrentPath={pathname}
      // L'administration a des tableaux (contacts, statistiques) : la colonne
      // de lecture du reste de l'app les tasserait.
      width={pathname.startsWith('/admin') ? 'lg' : 'md'}
      beforeMain={<ConnectionBanner />}
      afterMain={
        /*
          LE BANDEAU DE CONSENTEMENT, DANS LE FLUX DU CONTENU. Une `region`,
          pas une boîte modale : il ne recouvre rien, ne piège pas le focus, et
          l'application reste utilisable derrière. Obtenir un consentement en
          bloquant l'écran est la figure que le RGPD appelle un « dark
          pattern ».

          IL NE REND RIEN tant que `VITE_POSTHOG_KEY` n'est pas posée sur le
          dépôt : sans clé il n'y a rien à mesurer, donc rien à demander. Une app
          engendrée depuis ce squelette part donc muette, et poser la variable
          est le seul geste qui l'allume.

          LE `loader` N'EST PAS FACULTATIF EN PRATIQUE, et c'est le piège de
          cette prop. Sans lui, le socle retombe sur un spécificateur
          volontairement non analysable (`['posthog','js'].join('-')`) — utile
          pour qu'une app SANS `posthog-js` construise quand même, mais dans un
          bundle servi au navigateur cet import ne se résout pas. Le socle
          l'attrape et se tait : le bandeau s'affiche, l'accord est donné, et
          RIEN NE PART. C'est exactement le défaut « câblé mais muet » que ce
          parc a déjà payé. Le passer rend l'import analysable par Vite, qui
          émet le morceau et le charge à l'accord — pas avant.

          ET C'EST LA BUILD `slim`, PAS L'ENTRÉE PAR DÉFAUT. Mesuré le
          19/09/2026 : 50,1 kB gzip contre 97,6 pour `posthog-js` tout court.
          Ce qu'elle laisse dehors — enregistrement de session, autocapture,
          sondages, barre d'outils, capture d'exceptions — est exactement ce
          que l'ADR 0012 a DÉCIDÉ de couper, et que le socle éteint déjà par
          `OPTIONS_VIE_PRIVEE`. L'éteindre par une option et ne pas l'embarquer
          du tout ne se valent pas : une option se rallume, un code absent non.
          Le chemin passe par `dist/` faute de table `exports` dans le paquet ;
          s'il changeait, le build casserait — bruyamment, ce qui est le bon
          sens de l'échec ici.
        */
        <ConsentBanner
          posthogKey={import.meta.env.VITE_POSTHOG_KEY}
          loader={() => import('posthog-js/dist/module.slim.js')}
        />
      }
    >
      <Suspense
        fallback={<SkeletonGroup label={t('admin.loading')} lines={4} />}
      >
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/admin" element={<AdminScreen />} />
          <Route path="/admin/:section" element={<AdminScreen />} />
          <Route path="/reglages" element={<SettingsScreen />} />
          <Route path="/compte" element={<AccountScreen />} />
          <Route path="/a-propos" element={<AboutScreen />} />
          {/* Le repli de route rend l'accueil ; le repli de SERVEUR est le
            `404.html` posé par `spaFallbackPlugin`. Les deux sont
            nécessaires : sans le second, GitHub Pages sert sa propre page
            d'erreur avant que ce routeur n'existe. */}
          <Route path="*" element={<HomeScreen />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

export function App() {
  return (
    <ObservabilityBoundary>
      {/* `registerType: 'prompt'` : une nouvelle version ne recharge JAMAIS la
          page toute seule. Trois apps du parc étaient en `autoUpdate` et
          pouvaient recharger au milieu d'une saisie. `checkEvery` fait
          découvrir une version à une PWA installée restée ouverte plusieurs
          jours, qui autrement ne verrait rien avant un démarrage à froid. */}
      <AppUpdates registerSW={registerSW} checkEvery="1h">
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          {/* LA BORNE HORS DE LA COQUILLE : plein écran, sans barre du bas ni
              pied de page. Le visiteur d'un stand n'a rien à faire dans
              Admin, Réglages ou Compte, que le cadre lui montrait. */}
          <Routes>
            <Route path="/j/:slug" element={<KioskScreen />} />
            <Route path="*" element={<Shell />} />
          </Routes>
        </BrowserRouter>
      </AppUpdates>
    </ObservabilityBoundary>
  );
}
