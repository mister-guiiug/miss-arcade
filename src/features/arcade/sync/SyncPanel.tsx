import { useState } from 'react';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { ConfirmDialog } from '@mister-guiiug/dev-pwa-config/react/confirm-dialog';
import { SyncStatusBadge } from '@mister-guiiug/dev-pwa-config/react/sync-status-badge';
import { dateSlug, downloadText } from '@mister-guiiug/dev-pwa-config/download';
import { useI18n } from '../../../i18n/index.ts';
import { outbox, useOutbox } from './index.ts';

/**
 * L'état de la file d'envoi de CET appareil, et ce qu'on peut y faire. Les
 * envois refusés par le serveur ne disparaissent jamais en silence : on les
 * relance, on les exporte, ou on les abandonne en le confirmant.
 */
export function SyncPanel() {
  const { t, m, fmt } = useI18n();
  const snapshot = useOutbox();
  const [confirming, setConfirming] = useState(false);

  const exportDead = () => {
    const entries = outbox.deadLetters().map(entry => ({
      ...entry.payload,
      lastError: entry.lastError ?? null,
      enqueuedAt: entry.enqueuedAt,
    }));
    downloadText(
      JSON.stringify(entries, null, 2),
      `arcade-envois-refuses-${dateSlug()}.json`,
      'application/json'
    );
  };

  return (
    <section className="flex flex-col gap-3" aria-label={t('sync.title')}>
      <div className="flex flex-wrap items-center gap-3">
        <SyncStatusBadge
          status={snapshot.status}
          pending={snapshot.pending}
          labels={{
            synced: t('sync.synced'),
            offline: t('sync.offline'),
            error: t('sync.error'),
            pending: fmt.plural(snapshot.pending, m.sync.pending, {
              count: snapshot.pending,
            }),
          }}
        />
        {snapshot.dead > 0 ? (
          <span className="text-danger text-sm">
            {fmt.plural(snapshot.dead, m.sync.dead, { count: snapshot.dead })}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={snapshot.pending === 0}
          onClick={() => void outbox.flush()}
        >
          {t('sync.now')}
        </Button>
        {snapshot.dead > 0 ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => outbox.retryDead()}
            >
              {t('sync.retry')}
            </Button>
            <Button variant="outline" size="sm" onClick={exportDead}>
              {t('sync.exportDead')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirming(true)}
            >
              {t('sync.clearDead')}
            </Button>
          </>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirming}
        destructive
        title={t('sync.clearDeadConfirm')}
        message={t('sync.clearDeadBody')}
        onConfirm={() => {
          outbox.clearDead();
          setConfirming(false);
        }}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
