import { useEffect, useState } from 'react';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { useI18n } from '../../i18n/index.ts';
import { useArcade } from './store.ts';
import type { Prize } from './model.ts';
import { LeadForm } from './LeadForm.tsx';
import { formatPrizeMessage } from './model.ts';

const SPIN_MS = 2200;

/**
 * Bandit manchot à trois bobines. Le tirage est décidé AU CLIC (pondération
 * réelle) ; l'animation ne fait qu'atterrir sur le symbole du lot gagné —
 * l'inverse (animer puis « choisir ») mentirait sur les probabilités.
 */
export function BanditMachine() {
  const { t } = useI18n();
  const prizes = useArcade(s => s.snapshot.prizes);
  const welcome = useArcade(s => s.snapshot.welcomeMessage);
  const winMessage = useArcade(s => s.snapshot.winMessage);
  const loseMessage = useArcade(s => s.snapshot.loseMessage);
  const spin = useArcade(s => s.spin);
  const lastPrize = useArcade(s => s.lastPrize);
  const clearLastPrize = useArcade(s => s.clearLastPrize);

  const [spinning, setSpinning] = useState(false);
  const [faces, setFaces] = useState<[string, string, string]>(['★', '★', '★']);
  const [phase, setPhase] = useState<'idle' | 'spin' | 'result'>('idle');

  useEffect(() => {
    clearLastPrize();
  }, [clearLastPrize]);

  const play = () => {
    if (spinning) return;
    void (async () => {
      const prize = await spin();
      if (!prize) return;
      setSpinning(true);
      setPhase('spin');

      const tick = window.setInterval(() => {
        setFaces([
          randomSymbol(prizes),
          randomSymbol(prizes),
          randomSymbol(prizes),
        ]);
      }, 80);

      window.setTimeout(() => {
        window.clearInterval(tick);
        const sym = prize.symbol;
        setFaces(
          prize.lose
            ? [randomSymbol(prizes, sym), sym, randomSymbol(prizes, sym)]
            : [sym, sym, sym]
        );
        setSpinning(false);
        setPhase('result');
      }, SPIN_MS);
    })();
  };

  const reset = () => {
    clearLastPrize();
    setPhase('idle');
  };

  return (
    <div className="arcade-bandit">
      {phase !== 'result' ? (
        <p className="arcade-welcome m-0 mb-4 text-center text-lg font-medium">
          {welcome}
        </p>
      ) : null}

      <div
        className={`arcade-reels${spinning ? ' is-spinning' : ''}`}
        aria-live="polite"
        aria-label={t('bandit.reels')}
      >
        {faces.map((face, index) => (
          <div key={index} className="arcade-reel" data-index={index}>
            <span className="arcade-reel-face">{face}</span>
          </div>
        ))}
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
            className="arcade-spin-btn"
          >
            {spinning ? t('bandit.spinning') : t('bandit.spin')}
          </Button>
        </div>
      )}
    </div>
  );
}

function randomSymbol(prizes: Prize[], exclude?: string): string {
  const pool = prizes.filter(p => p.symbol !== exclude);
  const list = pool.length > 0 ? pool : prizes;
  return list[Math.floor(Math.random() * list.length)]!.symbol;
}
