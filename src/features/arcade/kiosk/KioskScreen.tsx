import { useEffect, useState, type CSSProperties } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { SkeletonGroup } from '@mister-guiiug/dev-pwa-config/react/skeleton';
import { SyncStatusBadge } from '@mister-guiiug/dev-pwa-config/react/sync-status-badge';
import { useFullscreen } from '@mister-guiiug/dev-pwa-config/react/use-fullscreen';
import { useLongPress } from '@mister-guiiug/dev-pwa-config/react/use-long-press';
import { useWakeLock } from '@mister-guiiug/dev-pwa-config/react/use-wake-lock';
import { useToast } from '@mister-guiiug/dev-pwa-config/react/toast';
import { createLogger } from '@mister-guiiug/dev-pwa-config/logger';
import { useI18n } from '../../../i18n/index.ts';
import { arcade } from '../../../backend/index.ts';
import { errorKey } from '../errors-i18n.ts';
import { toArcadeError } from '../backend/errors.ts';
import { usePlay } from '../play/play-store.ts';
import { readCachedGame } from '../play/cache.ts';
import { GameStage } from '../play/GameStage.tsx';
import { useOutbox } from '../sync/index.ts';
import { pair, readPairingToken, useDevice } from './device.ts';
import { KioskMenu } from './KioskMenu.tsx';

const log = createLogger('borne');

/** Une adresse d'image, prête pour `url(...)` : guillemets échappés par JSON. */
function cssUrl(url: string | null): string | undefined {
  return url ? `url(${JSON.stringify(url)})` : undefined;
}

/**
 * LA BORNE : `/j/<client>`, plein écran, sans la coquille de l'application.
 *
 * Jusqu'au 07/11/2026 le jeu public s'affichait dans le cadre complet : la
 * barre du bas montrait au visiteur Admin, Réglages (« Réinitialiser ») et
 * Compte. Ici, rien d'autre que la marque du client et le jeu ; le menu de la
 * borne s'ouvre par un appui long, puis par le code de l'appareil s'il en a un.
 *
 * Une borne APPAIRÉE (lien `#borne=…` remis par l'admin) garde l'écran allumé,
 * revient à l'accueil sans geste, et continue de jouer hors ligne.
 */
export function KioskScreen() {
  const { t, m, fmt } = useI18n();
  const toast = useToast();
  const { slug = 'demo' } = useParams<{ slug: string }>();
  const location = useLocation();
  const device = useDevice();
  const load = usePlay(s => s.load);
  const status = usePlay(s => s.status);
  const game = usePlay(s => s.game);
  const error = usePlay(s => s.error);
  const fromCache = usePlay(s => s.fromCache);
  const sync = useOutbox();
  const fullscreen = useFullscreen();
  const [menuOpen, setMenuOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [pairing, setPairing] = useState(false);

  const paired = device.pairing?.slug === slug;
  useWakeLock(paired);

  useEffect(() => {
    void load(slug);
  }, [load, slug]);

  // L'appairage arrive dans le FRAGMENT : lu, retiré de l'adresse, vérifié.
  useEffect(() => {
    const token = readPairingToken(location.hash);
    if (!token || arcade.kind !== 'supabase') return;
    window.history.replaceState(null, '', location.pathname);
    void (async () => {
      setPairing(true);
      try {
        const info = await arcade.kioskStatus(token);
        pair({
          slug: info.tenantSlug,
          token,
          kioskId: info.kioskId,
          label: info.label,
          tenantName: info.tenantName,
          pairedAt: new Date().toISOString(),
        });
        toast.success(t('kiosk.pairedOk', { label: info.label }));
      } catch (cause) {
        log.warn('appairage refusé', { code: toArcadeError(cause).code });
        toast.error(t('kiosk.pairFailed'));
      } finally {
        setPairing(false);
      }
    })();
  }, [location.hash, location.pathname, t, toast]);

  const press = useLongPress(() => setMenuOpen(true), {
    delayMs: 800,
    onTap: () => {
      if (!paired) setMenuOpen(true);
      else toast.info(t('kiosk.menuHint'), { id: 'menu-borne' });
    },
  });

  const config = game?.config;
  const wallpaper = {
    '--arcade-wall-desktop': cssUrl(
      config?.wallpaperDesktop ?? config?.wallpaperMobile ?? null
    ),
    '--arcade-wall-mobile': cssUrl(
      config?.wallpaperMobile ?? config?.wallpaperDesktop ?? null
    ),
  } as CSSProperties;
  const hasWallpaper = Boolean(
    config?.wallpaperDesktop || config?.wallpaperMobile
  );
  const cachedAt = fromCache ? readCachedGame(slug)?.cachedAt : null;

  const start = async () => {
    setStarted(true);
    if (fullscreen.supported && !fullscreen.active) await fullscreen.enter();
  };

  return (
    <div
      className={`arcade-kiosk${hasWallpaper ? ' has-wallpaper' : ''}`}
      style={wallpaper}
    >
      <header className="arcade-kiosk-head">
        {config?.logoUrl ? (
          <img
            src={config.logoUrl}
            alt=""
            className="arcade-kiosk-logo"
            decoding="async"
          />
        ) : null}
        <h1 className={config?.logoUrl ? 'sr-only' : 'arcade-kiosk-title'}>
          {game?.tenant.name ?? t('app.name')}
        </h1>
      </header>

      <main id="contenu" className="arcade-kiosk-main">
        {pairing ? <p role="status">{t('kiosk.pairing')}</p> : null}
        {status === 'loading' ? (
          <SkeletonGroup
            label={t('play.loading')}
            lines={4}
            className="w-full max-w-md"
          />
        ) : null}
        {status === 'error' && error ? (
          <div className="arcade-kiosk-error flex flex-col items-center gap-4 text-center">
            <p className="m-0 text-lg">
              {error === 'not-found'
                ? t('kiosk.notFound')
                : error === 'network'
                  ? t('kiosk.firstOpen')
                  : t(errorKey(error))}
            </p>
            <Button variant="primary" onClick={() => void load(slug)}>
              {t('kiosk.retry')}
            </Button>
          </div>
        ) : null}
        {status === 'ready' && game ? (
          <>
            {cachedAt ? (
              <p className="arcade-kiosk-note m-0 text-sm">
                {t('play.cached', {
                  date: fmt.dateTime(cachedAt),
                })}
              </p>
            ) : null}
            <GameStage kiosk={paired} />
          </>
        ) : null}
      </main>

      {paired && arcade.kind === 'supabase' && sync.status !== 'synced' ? (
        <div className="arcade-kiosk-sync">
          <SyncStatusBadge
            status={sync.status}
            pending={sync.pending}
            labels={{
              offline: t('sync.offline'),
              error: t('sync.error'),
              pending: fmt.plural(sync.pending, m.sync.pending, {
                count: sync.pending,
              }),
            }}
          />
        </div>
      ) : null}

      <button
        type="button"
        className="arcade-kiosk-menu"
        aria-label={
          paired
            ? `${t('kiosk.menu')} (${t('kiosk.menuHint')})`
            : t('kiosk.menu')
        }
        {...press.handlers}
      >
        <MoreHorizontal aria-hidden="true" />
      </button>

      {paired && !started && status === 'ready' ? (
        <div
          className="arcade-kiosk-start"
          role="dialog"
          aria-modal="true"
          aria-labelledby="borne-depart"
        >
          <div className="arcade-kiosk-start-panel">
            <p id="borne-depart" className="m-0 text-xl font-semibold">
              {t('kiosk.paired', {
                label: device.pairing?.label ?? '',
                tenant: device.pairing?.tenantName ?? '',
              })}
            </p>
            <p className="m-0">
              {t('kiosk.startHint', { seconds: config?.idleSeconds ?? 45 })}
            </p>
            <Button variant="primary" size="lg" onClick={() => void start()}>
              {t('kiosk.start')}
            </Button>
          </div>
        </div>
      ) : null}

      <KioskMenu
        open={menuOpen}
        slug={slug}
        tenantName={game?.tenant.name ?? slug}
        onClose={() => setMenuOpen(false)}
      />
    </div>
  );
}
