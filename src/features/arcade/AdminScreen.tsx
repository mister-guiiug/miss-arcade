import { useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { Card, CardHeader } from '@mister-guiiug/dev-pwa-config/react/card';
import { TextField } from '@mister-guiiug/dev-pwa-config/react/field';
import { SegmentedControl } from '@mister-guiiug/dev-pwa-config/react/segmented-control';
import { createId } from '@mister-guiiug/dev-pwa-config/id';
import { useI18n } from '../../i18n/index.ts';
import { useArcade } from './store.ts';
import type { GameType, LeadField, Prize } from './model.ts';

const ALL_FIELDS: LeadField[] = ['prenom', 'nom', 'email', 'telephone'];
const COLORS = [
  '#1f8a70',
  '#c45c26',
  '#c9a227',
  '#3d4a5c',
  '#2a6f97',
  '#9b2226',
];

/**
 * Administration locale — lots, pondération, messages, formulaire leads.
 * Disponible hors ligne après configuration, comme l'offre de référence.
 */
export function AdminScreen() {
  const { t, m, fmt } = useI18n();
  const ready = useArcade(s => s.ready);
  const load = useArcade(s => s.load);
  const snapshot = useArcade(s => s.snapshot);
  const setActiveGame = useArcade(s => s.setActiveGame);
  const updateConfig = useArcade(s => s.updateConfig);
  const upsertPrize = useArcade(s => s.upsertPrize);
  const removePrize = useArcade(s => s.removePrize);
  const clearLeads = useArcade(s => s.clearLeads);

  useEffect(() => {
    if (!ready) load();
  }, [ready, load]);

  if (!ready) return null;

  const toggleField = (field: LeadField) => {
    const has = snapshot.leadFields.includes(field);
    const leadFields = has
      ? snapshot.leadFields.filter(f => f !== field)
      : [...snapshot.leadFields, field];
    updateConfig({ leadFields });
  };

  const addPrize = () => {
    const prize: Prize = {
      id: createId('lot'),
      label: t('admin.newPrize'),
      weight: 10,
      stock: 10,
      color: COLORS[snapshot.prizes.length % COLORS.length]!,
      symbol: '★',
      lose: false,
    };
    upsertPrize(prize);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0" style={{ color: 'var(--dwc-text-soft)' }}>
        {t('admin.intro')}
      </p>

      <Card>
        <CardHeader title={t('admin.gameType')} />
        <SegmentedControl
          value={snapshot.activeGame}
          onChange={value => setActiveGame(value as GameType)}
          ariaLabel={t('admin.gameType')}
          options={[
            { value: 'bandit', label: t('game.bandit') },
            { value: 'roue', label: t('game.roue') },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title={t('admin.messages')} />
        <div className="flex flex-col gap-3">
          <TextField
            label={t('admin.welcome')}
            value={snapshot.welcomeMessage}
            onChange={e => updateConfig({ welcomeMessage: e.target.value })}
          />
          <TextField
            label={t('admin.win')}
            hint={t('admin.winHint')}
            value={snapshot.winMessage}
            onChange={e => updateConfig({ winMessage: e.target.value })}
          />
          <TextField
            label={t('admin.lose')}
            value={snapshot.loseMessage}
            onChange={e => updateConfig({ loseMessage: e.target.value })}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title={t('admin.prizes')}
          action={
            <Button variant="ghost" size="sm" onClick={addPrize}>
              <Plus size={16} aria-hidden="true" />
              {t('admin.addPrize')}
            </Button>
          }
        />
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {snapshot.prizes.map(prize => (
            <PrizeEditor
              key={prize.id}
              prize={prize}
              canRemove={snapshot.prizes.length > 1}
              onChange={upsertPrize}
              onRemove={() => removePrize(prize.id)}
            />
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title={t('admin.leads')} />
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={snapshot.leadFormEnabled}
              onChange={e =>
                updateConfig({ leadFormEnabled: e.target.checked })
              }
            />
            {t('admin.leadEnabled')}
          </label>
          {snapshot.leadFormEnabled ? (
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-2 text-sm font-medium">
                {t('admin.leadFields')}
              </legend>
              <div className="flex flex-wrap gap-3">
                {ALL_FIELDS.map(field => (
                  <label
                    key={field}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={snapshot.leadFields.includes(field)}
                      onChange={() => toggleField(field)}
                    />
                    {t(`lead.${field}` as 'lead.prenom')}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <p className="m-0 text-sm" style={{ color: 'var(--dwc-text-soft)' }}>
            {fmt.plural(snapshot.leads.length, m.admin.leadCount, {
              count: snapshot.leads.length,
            })}
          </p>
          {snapshot.leads.length > 0 ? (
            <Button variant="outline" onClick={() => clearLeads()}>
              {t('admin.clearLeads')}
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function PrizeEditor({
  prize,
  canRemove,
  onChange,
  onRemove,
}: {
  prize: Prize;
  canRemove: boolean;
  onChange: (prize: Prize) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const patch = (partial: Partial<Prize>) => onChange({ ...prize, ...partial });

  return (
    <li className="arcade-prize-edit flex flex-col gap-2 rounded-lg border border-[color:var(--dwc-border)] p-3">
      <div className="flex items-start justify-between gap-2">
        <TextField
          label={t('admin.prizeLabel')}
          value={prize.label}
          onChange={e => patch({ label: e.target.value })}
          className="flex-1"
        />
        {canRemove ? (
          <Button
            variant="ghost"
            iconOnly
            aria-label={t('admin.removePrize')}
            onClick={onRemove}
            className="mt-6"
          >
            <Trash2 size={18} aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <TextField
          label={t('admin.weight')}
          type="number"
          min={0}
          value={String(prize.weight)}
          onChange={e =>
            patch({ weight: Math.max(0, Number(e.target.value) || 0) })
          }
        />
        <TextField
          label={t('admin.stock')}
          type="number"
          min={0}
          hint={t('admin.stockHint')}
          value={prize.stock === null ? '' : String(prize.stock)}
          onChange={e => {
            const raw = e.target.value.trim();
            patch({
              stock: raw === '' ? null : Math.max(0, Number(raw) || 0),
            });
          }}
        />
        <TextField
          label={t('admin.symbol')}
          value={prize.symbol}
          maxLength={4}
          onChange={e => patch({ symbol: e.target.value.slice(0, 4) || '·' })}
        />
        <TextField
          label={t('admin.color')}
          type="color"
          value={prize.color}
          onChange={e => patch({ color: e.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={prize.lose}
          onChange={e => patch({ lose: e.target.checked })}
        />
        {t('admin.loseFlag')}
      </label>
    </li>
  );
}
