import { useEffect } from 'react';
import { AppFooter } from '@mister-guiiug/dev-pwa-config/react/app-footer';
import { ErrorBanner } from '@mister-guiiug/dev-pwa-config/react/error-banner';
import { SkeletonGroup } from '@mister-guiiug/dev-pwa-config/react/skeleton';
import { useI18n } from '../../i18n/index.ts';
import { REPO_URL } from '../../app/links.ts';
import { useArcade } from '../arcade/store.ts';
import { BanditMachine } from '../arcade/BanditMachine.tsx';
import { WheelGame } from '../arcade/WheelGame.tsx';

/**
 * Accueil = borne de jeu. Le type actif (bandit / roue) vient de l'admin ;
 * la tagline et le pied de page restent — règle famille du 06/09/2026.
 */
export function HomeScreen() {
  const { t } = useI18n();
  const ready = useArcade(s => s.ready);
  const error = useArcade(s => s.error);
  const load = useArcade(s => s.load);
  const activeGame = useArcade(s => s.snapshot.activeGame);

  useEffect(() => {
    if (!ready) load();
  }, [ready, load]);

  return (
    <>
      <p className="mt-0 mb-6" style={{ color: 'var(--dwc-text-soft)' }}>
        {t('app.tagline')}
      </p>

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
    </>
  );
}
