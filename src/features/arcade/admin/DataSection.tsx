import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { Card, CardHeader } from '@mister-guiiug/dev-pwa-config/react/card';
import { ConfirmDialog } from '@mister-guiiug/dev-pwa-config/react/confirm-dialog';
import { dateSlug, downloadText } from '@mister-guiiug/dev-pwa-config/download';
import { useI18n } from '../../../i18n/index.ts';
import { arcade } from '../../../backend/index.ts';
import { usePlay } from '../play/play-store.ts';
import { useAdmin } from './admin-store.ts';

/**
 * Le fichier de configuration du mode local : exporter (lots, messages ET
 * contacts), importer, réinitialiser. Ces gestes vivaient dans Réglages,
 * ouverts à quiconque passait devant la borne ; ils sont derrière la porte de
 * l'administration désormais.
 */
export function DataSection() {
  const { t, m, fmt } = useI18n();
  const reload = useAdmin(s => s.reload);
  const loadGame = usePlay(s => s.load);
  const slug = usePlay(s => s.slug);
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; count: number } | null>(
    null
  );

  const refresh = async () => {
    await reload();
    if (slug) await loadGame(slug);
  };

  const exportFile = async () => {
    const json = await arcade.exportData();
    if (json)
      downloadText(json, `arcade-${dateSlug()}.json`, 'application/json');
  };

  const runImport = async (json: string) => {
    try {
      const count = await arcade.importData(json);
      setStatus({ ok: true, count });
      await refresh();
    } catch {
      setStatus({ ok: false, count: 0 });
    }
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) setPending(await file.text());
  };

  return (
    <Card>
      <CardHeader
        title={t('adminData.title')}
        subtitle={t('adminData.intro')}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void exportFile()}>
          {t('adminData.export')}
        </Button>
        <Button variant="outline" onClick={() => input.current?.click()}>
          {t('adminData.import')}
        </Button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label={t('adminData.import')}
          onChange={event => void onFile(event)}
        />
        <Button variant="danger" onClick={() => setResetting(true)}>
          {t('adminData.reset')}
        </Button>
      </div>
      {status ? (
        <p role={status.ok ? 'status' : 'alert'} className="m-0 mt-3 text-sm">
          {status.ok
            ? fmt.plural(status.count, m.adminData.imported, {
                count: status.count,
              })
            : t('adminData.importFailed')}
        </p>
      ) : null}
      <ConfirmDialog
        open={pending !== null}
        title={t('adminData.importConfirm')}
        message={t('adminData.importBody')}
        onConfirm={() => {
          const json = pending;
          setPending(null);
          if (json !== null) void runImport(json);
        }}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={resetting}
        destructive
        title={t('adminData.resetConfirm')}
        message={t('adminData.resetBody')}
        onConfirm={() => {
          setResetting(false);
          void arcade.resetData().then(refresh);
        }}
        onCancel={() => setResetting(false)}
      />
    </Card>
  );
}
