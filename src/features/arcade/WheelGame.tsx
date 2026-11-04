import { useEffect, useState } from 'react';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { useI18n } from '../../i18n/index.ts';
import { useArcade } from './store.ts';
import { formatPrizeMessage } from './model.ts';
import { LeadForm } from './LeadForm.tsx';

const SPIN_MS = 4000;

/**
 * Roue de la fortune — second type de jeu, mêmes lots que le bandit.
 * L'angle final est dérivé de l'index du lot tiré, pas l'inverse.
 */
export function WheelGame() {
  const { t } = useI18n();
  const prizes = useArcade(s => s.snapshot.prizes);
  const welcome = useArcade(s => s.snapshot.welcomeMessage);
  const winMessage = useArcade(s => s.snapshot.winMessage);
  const loseMessage = useArcade(s => s.snapshot.loseMessage);
  const spin = useArcade(s => s.spin);
  const lastPrize = useArcade(s => s.lastPrize);
  const clearLastPrize = useArcade(s => s.clearLastPrize);

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'spin' | 'result'>('idle');

  useEffect(() => {
    clearLastPrize();
  }, [clearLastPrize]);

  const play = () => {
    if (spinning || prizes.length === 0) return;
    void (async () => {
      const prize = await spin();
      if (!prize) return;
      const index = prizes.findIndex(p => p.id === prize.id);
      const slice = 360 / prizes.length;
      const target =
        360 * 5 +
        (360 - (index * slice + slice / 2)) +
        (Math.random() * slice * 0.3 - slice * 0.15);
      setSpinning(true);
      setPhase('spin');
      setRotation(prev => prev + target);
      window.setTimeout(() => {
        setSpinning(false);
        setPhase('result');
      }, SPIN_MS);
    })();
  };

  const reset = () => {
    clearLastPrize();
    setPhase('idle');
  };

  const gradient = prizes
    .map((p, i) => {
      const start = (i / prizes.length) * 360;
      const end = ((i + 1) / prizes.length) * 360;
      return `${p.color} ${start}deg ${end}deg`;
    })
    .join(', ');

  return (
    <div className="arcade-wheel">
      {phase !== 'result' ? (
        <p className="arcade-welcome m-0 mb-4 text-center text-lg font-medium">
          {welcome}
        </p>
      ) : null}

      <div className="arcade-wheel-stage">
        <div className="arcade-wheel-pointer" aria-hidden="true" />
        <div
          className="arcade-wheel-disc"
          style={{
            background: `conic-gradient(from -90deg, ${gradient})`,
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.75, 0.12, 1)`
              : undefined,
          }}
          role="img"
          aria-label={t('wheel.aria')}
        >
          {prizes.map((prize, i) => {
            const angle = (i + 0.5) * (360 / prizes.length) - 90;
            return (
              <span
                key={prize.id}
                className="arcade-wheel-label"
                style={{
                  transform: `rotate(${angle}deg) translateY(-38%)`,
                }}
              >
                {prize.symbol}
              </span>
            );
          })}
        </div>
      </div>

      {phase === 'result' && lastPrize ? (
        <div className="arcade-result mt-6 flex flex-col items-center gap-4 text-center">
          <p className="m-0 text-xl font-semibold">
            {lastPrize.lose
              ? loseMessage
              : formatPrizeMessage(winMessage, lastPrize.label)}
          </p>
          <LeadForm onDone={reset} />
        </div>
      ) : (
        <div className="mt-6 flex justify-center">
          <Button
            variant="primary"
            size="lg"
            disabled={spinning}
            onClick={play}
          >
            {spinning ? t('wheel.spinning') : t('wheel.spin')}
          </Button>
        </div>
      )}
    </div>
  );
}
