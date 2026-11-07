import { Card, CardHeader } from '@mister-guiiug/dev-pwa-config/react/card';
import { ConsentSection } from '@mister-guiiug/dev-pwa-config/react/consent-section';
import { PrivacyNotice } from '@mister-guiiug/dev-pwa-config/react/privacy-notice';
import { SegmentedControl } from '@mister-guiiug/dev-pwa-config/react/segmented-control';
import { ChromePrefs } from '@mister-guiiug/dev-pwa-config/react/chrome-prefs';
import { useI18n } from '../../i18n/index.ts';
import { coverage } from '../../backend/index.ts';
import { configReport } from '../../app/config/env.ts';

/**
 * Réglages : apparence, langue, source de données, confidentialité.
 *
 * L'export, l'import et la réinitialisation du jeu en sont partis le
 * 07/11/2026 : ouverts à quiconque passait devant une borne en mode local, ils
 * vivent désormais derrière la porte de l'administration (rubrique Données).
 */
export function SettingsScreen() {
  const { t, locale, setLocale, locales } = useI18n();

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
              <span className="text-soft">
                {entry.present ? '✓' : entry.fallback}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="empty:hidden">
        <PrivacyNotice
          env={import.meta.env}
          headingLevel={3}
          titleClassName="text-fluid-base font-semibold"
        />
        <ConsentSection
          posthogKey={import.meta.env.VITE_POSTHOG_KEY}
          loader={() => import('posthog-js/dist/module.slim.js')}
          headingLevel={3}
          titleClassName="text-fluid-base font-semibold"
        />
      </Card>
    </div>
  );
}
