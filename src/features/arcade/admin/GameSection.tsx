import { Card, CardHeader } from '@mister-guiiug/dev-pwa-config/react/card';
import { TextField } from '@mister-guiiug/dev-pwa-config/react/field';
import { SegmentedControl } from '@mister-guiiug/dev-pwa-config/react/segmented-control';
import { useI18n } from '../../../i18n/index.ts';
import type { GameType } from '../model.ts';
import { useAdmin } from './admin-store.ts';
import { BrandingEditor } from './BrandingEditor.tsx';

export function GameSection() {
  const { t } = useI18n();
  const draft = useAdmin(s => s.draft);
  const setConfig = useAdmin(s => s.setConfig);
  if (!draft) return null;
  const { config } = draft;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title={t('adminGame.gameType')} />
        <SegmentedControl
          value={config.activeGame}
          onChange={value => setConfig({ activeGame: value as GameType })}
          ariaLabel={t('adminGame.gameType')}
          options={[
            { value: 'bandit', label: t('game.bandit') },
            { value: 'roue', label: t('game.roue') },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title={t('adminGame.messages')} />
        <div className="flex flex-col gap-3">
          <TextField
            label={t('adminGame.welcome')}
            maxLength={500}
            value={config.welcomeMessage}
            onChange={e => setConfig({ welcomeMessage: e.target.value })}
          />
          <TextField
            label={t('adminGame.win')}
            hint={t('adminGame.winHint')}
            maxLength={500}
            value={config.winMessage}
            onChange={e => setConfig({ winMessage: e.target.value })}
          />
          <TextField
            label={t('adminGame.lose')}
            maxLength={500}
            value={config.loseMessage}
            onChange={e => setConfig({ loseMessage: e.target.value })}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title={t('adminGame.kiosk')} />
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.soundEnabled}
              onChange={e => setConfig({ soundEnabled: e.target.checked })}
            />
            {t('adminGame.sound')}
          </label>
          <TextField
            label={t('adminGame.idle')}
            type="number"
            min={15}
            max={600}
            value={String(config.idleSeconds)}
            error={
              config.idleSeconds < 15 || config.idleSeconds > 600
                ? t('adminGame.idleRange')
                : undefined
            }
            onChange={e =>
              setConfig({
                idleSeconds: Math.trunc(Number(e.target.value)) || 0,
              })
            }
          />
        </div>
      </Card>

      <BrandingEditor />
    </div>
  );
}
