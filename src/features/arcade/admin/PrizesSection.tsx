import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@mister-guiiug/dev-pwa-config/react/badge';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { Card, CardHeader } from '@mister-guiiug/dev-pwa-config/react/card';
import { TextField } from '@mister-guiiug/dev-pwa-config/react/field';
import { useToast } from '@mister-guiiug/dev-pwa-config/react/toast';
import { useI18n } from '../../../i18n/index.ts';
import { chances, isDrawable, type Prize } from '../model.ts';
import { useAdmin } from './admin-store.ts';

/** Sous ce seuil, le stock est signalé. */
const LOW_STOCK = 5;

/**
 * Les lots. La chance de chaque lot au prochain tirage est affichée à côté de
 * son poids : un poids est un nombre relatif, et l'admin n'a pas à faire la
 * somme de tête pour savoir que « 5 » veut dire « 5 % ».
 *
 * Retirer un lot n'est pas confirmé mais ANNULABLE (ADR 0008) : le retrait
 * n'existe que dans le brouillon jusqu'à « Enregistrer », et la notification
 * propose de le défaire.
 */
export function PrizesSection() {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const draft = useAdmin(s => s.draft);
  const setPrize = useAdmin(s => s.setPrize);
  const addPrize = useAdmin(s => s.addPrize);
  const removePrize = useAdmin(s => s.removePrize);
  const restorePrize = useAdmin(s => s.restorePrize);
  const movePrize = useAdmin(s => s.movePrize);
  if (!draft) return null;
  const odds = chances(draft.prizes);
  const full = draft.prizes.length >= 12;

  const remove = (prize: Prize) => {
    const index = draft.prizes.findIndex(p => p.id === prize.id);
    const removed = removePrize(prize.id);
    if (!removed) return;
    toast.show(t('adminPrizes.removed', { label: removed.label }), {
      action: { onAction: () => restorePrize(removed, index) },
    });
  };

  return (
    <Card>
      <CardHeader
        title={t('adminPrizes.title')}
        subtitle={t('adminPrizes.intro')}
        action={
          <Button
            variant="outline"
            size="sm"
            disabled={full}
            onClick={() => addPrize(t('adminPrizes.newPrize'))}
          >
            <Plus size={16} aria-hidden="true" />
            {t('adminPrizes.add')}
          </Button>
        }
      />
      {!draft.prizes.some(isDrawable) ? (
        <p role="alert" className="text-danger m-0 mb-3 text-sm">
          {t('adminPrizes.noneDrawable')}
        </p>
      ) : null}
      {full ? (
        <p className="text-soft m-0 mb-3 text-sm">{t('adminPrizes.max')}</p>
      ) : null}
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {draft.prizes.map((prize, index) => {
          const chance = odds.get(prize.id) ?? 0;
          const labelBad = !prize.label.trim() || prize.label.length > 80;
          const weightBad = prize.weight < 0 || prize.weight > 10_000;
          return (
            <li
              key={prize.id}
              className="arcade-prize-edit flex flex-col gap-2 rounded-lg border border-[color:var(--dwc-border)] p-3"
            >
              <div className="flex flex-wrap items-start gap-2">
                <span
                  className="arcade-prize-swatch"
                  style={{ background: prize.color }}
                  aria-hidden="true"
                >
                  {prize.symbol}
                </span>
                <TextField
                  label={t('adminPrizes.label')}
                  value={prize.label}
                  maxLength={80}
                  error={labelBad ? t('adminPrizes.labelRequired') : undefined}
                  onChange={e => setPrize(prize.id, { label: e.target.value })}
                  className="min-w-40 flex-1"
                />
                <div className="mt-6 flex gap-1">
                  <Button
                    variant="ghost"
                    iconOnly
                    aria-label={t('adminPrizes.moveUp', { label: prize.label })}
                    disabled={index === 0}
                    onClick={() => movePrize(prize.id, -1)}
                  >
                    <ArrowUp size={18} aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    iconOnly
                    aria-label={t('adminPrizes.moveDown', {
                      label: prize.label,
                    })}
                    disabled={index === draft.prizes.length - 1}
                    onClick={() => movePrize(prize.id, 1)}
                  >
                    <ArrowDown size={18} aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    iconOnly
                    aria-label={t('adminPrizes.remove', { label: prize.label })}
                    disabled={draft.prizes.length <= 1}
                    onClick={() => remove(prize)}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <TextField
                  label={t('adminPrizes.weight')}
                  type="number"
                  min={0}
                  max={10_000}
                  value={String(prize.weight)}
                  hint={t('adminPrizes.chance', {
                    value: fmt.percent(chance, 1),
                  })}
                  error={weightBad ? t('adminPrizes.weightRange') : undefined}
                  onChange={e =>
                    setPrize(prize.id, {
                      weight: Math.trunc(Number(e.target.value)) || 0,
                    })
                  }
                />
                <TextField
                  label={t('adminPrizes.stock')}
                  type="number"
                  min={0}
                  hint={t('adminPrizes.stockHint')}
                  value={prize.stock === null ? '' : String(prize.stock)}
                  onChange={e => {
                    const raw = e.target.value.trim();
                    setPrize(prize.id, {
                      stock:
                        raw === ''
                          ? null
                          : Math.max(0, Math.trunc(Number(raw)) || 0),
                    });
                  }}
                />
                <TextField
                  label={t('adminPrizes.symbol')}
                  value={prize.symbol}
                  maxLength={4}
                  onChange={e =>
                    setPrize(prize.id, {
                      symbol: e.target.value.slice(0, 4) || '·',
                    })
                  }
                />
                <TextField
                  label={t('adminPrizes.color')}
                  type="color"
                  value={prize.color}
                  onChange={e => setPrize(prize.id, { color: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={prize.lose}
                    onChange={e =>
                      setPrize(prize.id, { lose: e.target.checked })
                    }
                  />
                  {t('adminPrizes.lose')}
                </label>
                {!prize.lose && prize.stock === 0 ? (
                  <Badge tone="danger">{t('adminPrizes.soldOut')}</Badge>
                ) : !prize.lose &&
                  prize.stock !== null &&
                  prize.stock <= LOW_STOCK ? (
                  <Badge tone="warning">{t('adminPrizes.lowStock')}</Badge>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
