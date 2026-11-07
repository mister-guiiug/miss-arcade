import { useEffect } from 'react';
import { AppFooter } from '@mister-guiiug/dev-pwa-config/react/app-footer';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { ErrorBanner } from '@mister-guiiug/dev-pwa-config/react/error-banner';
import { SkeletonGroup } from '@mister-guiiug/dev-pwa-config/react/skeleton';
import { useI18n } from '../../i18n/index.ts';
import { REPO_URL } from '../../app/links.ts';
import { usePlay } from '../arcade/play/play-store.ts';
import { GameStage } from '../arcade/play/GameStage.tsx';
import { errorKey } from '../arcade/errors-i18n.ts';
import { ButtonLink } from '../arcade/ui/ButtonLink.tsx';

/** Le client de démonstration : publié par 0007, servi aussi en mode local. */
const DEMO = 'demo';

/**
 * L'ACCUEIL, VITRINE DE L'APPLICATION : ce qu'elle fait, une partie de
 * démonstration, et les deux portes (la borne plein écran, l'administration).
 * La borne d'un client vit à `/j/<client>`, sans cette coquille.
 *
 * Il garde sa première ligne, l'accroche (la phrase que les moteurs associent à
 * la page), et sa dernière, le pied de page de la famille, que `pwa-doctor
 * --strict` contrôle.
 */
export function HomeScreen() {
  const { t } = useI18n();
  const load = usePlay(s => s.load);
  const status = usePlay(s => s.status);
  const game = usePlay(s => s.game);
  const error = usePlay(s => s.error);

  useEffect(() => {
    void load(DEMO);
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-soft m-0">{t('app.tagline')}</p>

      <section className="arcade-demo" aria-labelledby="demo-titre">
        <h2 id="demo-titre" className="mt-0 mb-4 text-lg font-semibold">
          {game?.config.activeGame === 'roue'
            ? t('game.roue')
            : t('game.bandit')}
        </h2>
        {status === 'loading' ? (
          <SkeletonGroup label={t('play.loading')} lines={4} />
        ) : null}
        {status === 'error' && error ? (
          <div className="flex flex-col items-start gap-3">
            <ErrorBanner message={t(errorKey(error))} />
            <Button variant="outline" onClick={() => void load(DEMO)}>
              {t('kiosk.retry')}
            </Button>
          </div>
        ) : null}
        {status === 'ready' ? <GameStage kiosk={false} /> : null}
      </section>

      <div className="flex flex-wrap gap-2">
        <ButtonLink to={`/j/${DEMO}`} variant="primary">
          {t('home.openKiosk')}
        </ButtonLink>
        <ButtonLink to="/admin" variant="outline">
          {t('home.admin')}
        </ButtonLink>
      </div>

      <section aria-labelledby="comment-titre">
        <h2 id="comment-titre" className="mt-0 mb-3 text-lg font-semibold">
          {t('home.how')}
        </h2>
        <ol className="arcade-steps m-0 flex flex-col gap-2 pl-5">
          <li>{t('home.step1')}</li>
          <li>{t('home.step2')}</li>
          <li>{t('home.step3')}</li>
        </ol>
      </section>

      <AppFooter repoUrl={REPO_URL} issues className="mt-4" />
    </div>
  );
}
