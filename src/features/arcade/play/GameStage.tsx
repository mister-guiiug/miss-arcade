import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { ErrorBanner } from '@mister-guiiug/dev-pwa-config/react/error-banner';
import { useReducedMotion } from '@mister-guiiug/dev-pwa-config/react/use-media-query';
import { useFeedback } from '@mister-guiiug/dev-pwa-config/react/use-feedback';
import { useI18n } from '../../../i18n/index.ts';
import { formatPrizeMessage, type Prize, type SpinOutcome } from '../model.ts';
import type { ArcadeErrorCode } from '../backend/errors.ts';
import { errorKey } from '../errors-i18n.ts';
import { useIdle } from '../kiosk/use-idle.ts';
import { usePlay, type LeadResult } from './play-store.ts';
import { BanditReels } from './BanditReels.tsx';
import { Wheel } from './Wheel.tsx';
import { finalRotation, landingFaces, type Faces } from './animation.ts';
import { LeadForm } from './LeadForm.tsx';
import { Celebration } from './Celebration.tsx';

type Phase = 'idle' | 'spinning' | 'result' | 'thanks';

const BANDIT_MS = 2200;
const WHEEL_MS = 4000;
const CALM_MS = 400;
const THANKS_MS = 4500;

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * LA SCÈNE DU JEU, partagée par l'accueil (démonstration) et la borne.
 *
 * Le bouton se verrouille DÈS L'APPUI, avant l'appel au serveur : jusqu'au
 * 07/11/2026 il ne passait à « en cours » qu'après la réponse, et un double
 * appui faisait deux tirages, deux décréments de stock. La phase est tenue ici
 * (`spinning` posé synchroniquement) ET dans le magasin (`busy`).
 *
 * Sur une borne (`kiosk`), toute partie laissée sans geste revient à l'accueil
 * après `idleSeconds` : le formulaire est vidé, le visiteur suivant ne voit
 * rien du précédent.
 */
export function GameStage({ kiosk }: { kiosk: boolean }) {
  const { t } = useI18n();
  const game = usePlay(s => s.game);
  const spin = usePlay(s => s.spin);
  const submitLead = usePlay(s => s.submitLead);
  const clearOutcome = usePlay(s => s.clearOutcome);
  const reduced = useReducedMotion();

  const [phase, setPhase] = useState<Phase>('idle');
  const [outcome, setOutcome] = useState<SpinOutcome | null>(null);
  const [error, setError] = useState<ArcadeErrorCode | null>(null);
  const [leadResult, setLeadResult] = useState<LeadResult | null>(null);
  const [slices, setSlices] = useState<readonly Prize[]>([]);
  const [faces, setFaces] = useState<Faces | null>(null);
  const [rotation, setRotation] = useState(0);
  const [transition, setTransition] = useState<string | undefined>();
  const rotationRef = useRef(0);
  const run = useRef(0);

  const feedback = useFeedback(
    {
      win: { vibration: 'victory', sound: 'success' },
      lose: { vibration: 'tap' },
    },
    { sound: game?.config.soundEnabled ?? false }
  );

  const reset = useCallback(() => {
    run.current += 1;
    clearOutcome();
    setOutcome(null);
    setLeadResult(null);
    setPhase('idle');
  }, [clearOutcome]);

  useIdle(
    (game?.config.idleSeconds ?? 45) * 1000,
    reset,
    kiosk && phase !== 'idle' && phase !== 'spinning'
  );

  useEffect(() => {
    if (phase !== 'thanks') return undefined;
    const timer = window.setTimeout(reset, THANKS_MS);
    return () => window.clearTimeout(timer);
  }, [phase, reset]);

  if (!game) return null;
  const { config } = game;
  const isWheel = config.activeGame === 'roue';
  const duration = reduced ? CALM_MS : isWheel ? WHEEL_MS : BANDIT_MS;
  const shownSlices = phase === 'idle' ? game.prizes : slices;

  const play = async () => {
    if (phase !== 'idle') return;
    const token = ++run.current;
    setPhase('spinning');
    setError(null);
    setFaces(null);
    setSlices(game.prizes);
    if (isWheel && !reduced) {
      rotationRef.current += 360;
      setTransition('transform 900ms linear');
      setRotation(rotationRef.current);
    }
    const started = Date.now();
    const result = await spin();
    if (run.current !== token) return;
    if (typeof result === 'string') {
      setError(result);
      setPhase('idle');
      return;
    }
    if (isWheel) {
      rotationRef.current = finalRotation(
        rotationRef.current,
        game.prizes,
        result
      );
      setTransition(
        `transform ${duration}ms cubic-bezier(0.12, 0.75, 0.12, 1)`
      );
      setRotation(rotationRef.current);
      await wait(duration);
    } else {
      await wait(Math.max(0, duration - (Date.now() - started)));
      setFaces(landingFaces(game.prizes, result));
    }
    if (run.current !== token) return;
    setOutcome(result);
    setPhase('result');
    feedback(result.prize.lose ? 'lose' : 'win');
  };

  const onLead = (values: Parameters<typeof submitLead>[0]) => {
    const sent = submitLead(values);
    if (sent === 'full') {
      setError('queue-full');
      reset();
      return;
    }
    setLeadResult(sent);
    setPhase('thanks');
  };

  const won = outcome !== null && !outcome.prize.lose;
  const message = outcome
    ? outcome.prize.lose
      ? config.loseMessage
      : formatPrizeMessage(config.winMessage, outcome.prize.label)
    : '';
  const showForm =
    config.leadFormEnabled && config.leadFields.length > 0 && outcome !== null;

  return (
    <div className="arcade-stage">
      <p role="status" className="sr-only">
        {phase === 'result' ? message : ''}
      </p>

      {phase === 'idle' || phase === 'spinning' ? (
        <p className="arcade-welcome m-0 text-center text-lg font-medium">
          {config.welcomeMessage}
        </p>
      ) : null}

      {isWheel ? (
        <Wheel
          slices={shownSlices}
          rotation={rotation}
          transition={reduced ? undefined : transition}
          label={t('play.wheel', {
            prizes: shownSlices.map(p => p.label).join(', '),
          })}
        />
      ) : (
        <BanditReels
          prizes={game.prizes}
          spinning={phase === 'spinning'}
          landing={faces}
        />
      )}

      {error ? (
        <ErrorBanner message={t(errorKey(error))} className="w-full max-w-md" />
      ) : null}

      {phase === 'idle' || phase === 'spinning' ? (
        <Button
          variant="primary"
          size="lg"
          className="arcade-spin-btn"
          loading={phase === 'spinning'}
          disabled={phase === 'spinning'}
          onClick={() => void play()}
        >
          {phase === 'spinning'
            ? t('play.spinning')
            : isWheel
              ? t('play.wheelSpin')
              : t('play.spin')}
        </Button>
      ) : null}

      {phase === 'result' && outcome ? (
        <div className="arcade-result flex w-full flex-col items-center gap-4 text-center">
          {won && !reduced ? (
            <Celebration colors={game.prizes.map(p => p.color)} />
          ) : null}
          <p className="arcade-result-message m-0 text-2xl font-semibold">
            {message}
          </p>
          {won ? (
            <div className="arcade-redeem">
              <p className="m-0 text-lg font-semibold">
                {t('play.redeem', { code: outcome.redeemCode })}
              </p>
              <p className="text-soft m-0 text-sm">{t('play.redeemHint')}</p>
            </div>
          ) : null}
          {outcome.source === 'offline' ? (
            <p className="text-soft m-0 text-sm">{t('play.offlineSaved')}</p>
          ) : null}
          {showForm ? (
            <LeadForm
              key={outcome.spinId}
              config={config}
              organizer={game.tenant.name}
              lose={outcome.prize.lose}
              onSubmit={onLead}
              onSkip={reset}
            />
          ) : (
            <Button variant="primary" size="lg" onClick={reset}>
              {t('play.again')}
            </Button>
          )}
        </div>
      ) : null}

      {phase === 'thanks' ? (
        <div className="arcade-result flex flex-col items-center gap-4 text-center">
          <p role="status" className="m-0 text-xl font-semibold">
            {leadResult === 'queued'
              ? t('play.thanksQueued')
              : t('play.thanks')}
          </p>
          <Button variant="primary" size="lg" onClick={reset}>
            {t('play.again')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
