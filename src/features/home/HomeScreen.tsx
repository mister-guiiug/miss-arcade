import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AppFooter } from '@mister-guiiug/dev-pwa-config/react/app-footer';
import { ErrorBanner } from '@mister-guiiug/dev-pwa-config/react/error-banner';
import { SkeletonGroup } from '@mister-guiiug/dev-pwa-config/react/skeleton';
import { useI18n } from '../../i18n/index.ts';
import { REPO_URL } from '../../app/links.ts';
import { useArcade } from '../arcade/store.ts';
import { BanditMachine } from '../arcade/BanditMachine.tsx';
import { WheelGame } from '../arcade/WheelGame.tsx';

/**
 * Accueil public = borne de jeu. Pas d'auth. Branding (fond + logo) par tenant.
 * `/` → demo ; `/j/:slug` → tenant publié.
 */
export function HomeScreen() {
  const { t } = useI18n();
  const { slug } = useParams<{ slug?: string }>();
  const ready = useArcade(s => s.ready);
  const error = useArcade(s => s.error);
  const load = useArcade(s => s.load);
  const activeGame = useArcade(s => s.snapshot.activeGame);
  const snapshot = useArcade(s => s.snapshot);
  const tenant = useArcade(s => s.tenant);

  useEffect(() => {
    void load(slug ?? 'demo');
  }, [load, slug]);

  const wallpaper =
    typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
      ? snapshot.wallpaperMobile || snapshot.wallpaperDesktop
      : snapshot.wallpaperDesktop || snapshot.wallpaperMobile;

  return (
    <div
      className="arcade-play-surface"
      style={
        wallpaper
          ? {
              backgroundImage: `linear-gradient(rgb(20 32 28 / 55%), rgb(20 32 28 / 70%)), url(${wallpaper})`,
            }
          : undefined
      }
    >
      {snapshot.logoUrl ? (
        <img
          src={snapshot.logoUrl}
          alt=""
          className="arcade-play-logo"
        />
      ) : null}

      <p className="mt-0 mb-2" style={{ color: 'var(--dwc-text-soft)' }}>
        {t('app.tagline')}
      </p>
      {tenant ? (
        <p className="mt-0 mb-4 text-sm" style={{ color: 'var(--dwc-text-soft)' }}>
          {tenant.name}
        </p>
      ) : null}

      <h2 className="mt-0 mb-4 text-lg font-semibold">
        {activeGame === 'roue' ? t('game.roue') : t('game.bandit')}
      </h2>

      {error ? <ErrorBanner message={error} className="mb-4" /> : null}

      {!ready ? (
        <SkeletonGroup label={t('play.loading')} lines={4} className="mt-4" />
      ) : activeGame === 'roue' ? (
        <WheelGame />
      ) : (
        <BanditMachine />
      )}

      <AppFooter repoUrl={REPO_URL} issues className="mt-8" />
    </div>
  );
}
