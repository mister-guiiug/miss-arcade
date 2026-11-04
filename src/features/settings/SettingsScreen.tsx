import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { Card, CardHeader } from '@mister-guiiug/dev-pwa-config/react/card';
import { ConfirmDialog } from '@mister-guiiug/dev-pwa-config/react/confirm-dialog';
import { ConsentSection } from '@mister-guiiug/dev-pwa-config/react/consent-section';
import { SegmentedControl } from '@mister-guiiug/dev-pwa-config/react/segmented-control';
import { ChromePrefs } from '@mister-guiiug/dev-pwa-config/react/chrome-prefs';
import { dateSlug, downloadText } from '@mister-guiiug/dev-pwa-config/download';
import { useI18n } from '../../i18n/index.ts';
import { coverage } from '../../backend/index.ts';
import { useArcade } from '../arcade/store.ts';
import { configReport } from '../../app/config/env.ts';

/**
 * Réglages : chrome + export/import/reset de la config arcade (lots, leads).
 */
export function SettingsScreen() {
  const { t, m, fmt, locale, setLocale, locales } = useI18n();
  const clearAll = useArcade(state => state.clearAll);
  const importJson = useArcade(state => state.importJson);
  const exportJson = useArcade(state => state.exportJson);
  const leads = useArcade(state => state.snapshot.leads);
  const ready = useArcade(state => state.ready);
  const load = useArcade(state => state.load);
  const error = useArcade(state => state.error);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!ready) load();
  }, [ready, load]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const exportArcade = () => {
    const json = exportJson();
    if (json)
      downloadText(json, `arcade-${dateSlug()}.json`, 'application/json');
  };

  const runImport = (json: string) => {
    const count = importJson(json);
    setImported(count);
    setFailed(count === null);
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const json = await file.text();
    if (leads.length > 0 || ready) setPending(json);
    else runImport(json);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title={t('settings.appearance')} />
        <ChromePrefs label={t('settings.appearance')}>
          <SegmentedControl
            value={locale}
            onChange={value => setLocale(value as typeof locale)}
            ariaLabel={t('settings.language')}
            options={locales.map(code => ({
              value: code,
              label: code.toUpperCase(),
            }))}
          />
        </ChromePrefs>
      </Card>

      <Card>
        <CardHeader
          title={t('settings.backend')}
          subtitle={coverage.kind ?? t('settings.backendLocal')}
        />
        <ul className="m-0 list-none p-0 text-sm">
          {configReport().map(entry => (
            <li key={entry.name} className="flex justify-between gap-3 py-1">
              <code>{entry.name}</code>
              <span style={{ color: 'var(--dwc-text-soft)' }}>
                {entry.present ? '✓' : entry.fallback}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title={t('settings.data')} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportArcade}>
            {t('settings.export')}
          </Button>
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            {t('settings.import')}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label={t('settings.import')}
            onChange={event => void onFile(event)}
          />
          <Button variant="danger" onClick={() => setConfirming(true)}>
            {t('settings.reset')}
          </Button>
        </div>
        {imported !== null && (
          <p role="status" className="m-0 mt-3 text-sm">
            {fmt.plural(imported, m.settings.imported, { count: imported })}
          </p>
        )}
        {failed && error && (
          <p role="alert" className="m-0 mt-3 text-sm">
            {t('settings.importFailed', { error })}
          </p>
        )}
      </Card>

      <Card className="empty:hidden">
        <ConsentSection
          posthogKey={import.meta.env.VITE_POSTHOG_KEY}
          loader={() => import('posthog-js/dist/module.slim.js')}
          headingLevel={3}
          titleClassName="text-fluid-base font-semibold"
        />
      </Card>

      <ConfirmDialog
        open={confirming}
        destructive
        title={t('settings.resetConfirm')}
        message={t('settings.resetBody')}
        onConfirm={() => {
          void clearAll();
          setConfirming(false);
        }}
        onCancel={() => setConfirming(false)}
      />

      <ConfirmDialog
        open={pending !== null}
        title={t('settings.importConfirm')}
        message={t('settings.importBody')}
        onConfirm={() => {
          const json = pending;
          setPending(null);
          if (json !== null) runImport(json);
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
