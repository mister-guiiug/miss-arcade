import { useRef, useState } from 'react';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { Card, CardHeader } from '@mister-guiiug/dev-pwa-config/react/card';
import {
  compressImageToMaxBytes,
  validateImageFile,
} from '@mister-guiiug/dev-pwa-config/image';
import { useI18n } from '../../../i18n/index.ts';
import { arcade } from '../../../backend/index.ts';
import { errorKey } from '../errors-i18n.ts';
import { toArcadeError } from '../backend/errors.ts';
import type { BrandingKind } from '../backend/ports.ts';
import { useAdmin } from './admin-store.ts';

/**
 * Le SVG n'est plus accepté : servi tel quel depuis un bucket public, il
 * s'ouvre à son adresse et peut porter du script. Trois formats d'image, et
 * c'est tout.
 */
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
const FIELD = {
  desktop: 'wallpaperDesktop',
  mobile: 'wallpaperMobile',
  logo: 'logoUrl',
} as const;

/**
 * Les fonds sont RECOMPRESSÉS avant l'envoi (≤ 600 ko, 2 560 px) : une photo
 * de 5 Mo mettait la borne en attente à chaque ouverture, et c'est elle que le
 * service worker garde pour le hors ligne. Le logo garde son format, pour sa
 * transparence.
 */
export function BrandingEditor() {
  const { t } = useI18n();
  const draft = useAdmin(s => s.draft);
  const tenantId = useAdmin(s => s.tenantId);
  const setConfig = useAdmin(s => s.setConfig);
  const [busy, setBusy] = useState<BrandingKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = {
    desktop: useRef<HTMLInputElement>(null),
    mobile: useRef<HTMLInputElement>(null),
    logo: useRef<HTMLInputElement>(null),
  };
  if (!draft) return null;
  const { config } = draft;
  const remote = arcade.capabilities.branding;

  const onFile = async (kind: BrandingKind, file: File | undefined) => {
    if (!file || !tenantId) return;
    const refused = validateImageFile(file, {
      acceptedTypes: ACCEPTED,
      maxBytes: kind === 'logo' ? 1_000_000 : 15_000_000,
    });
    if (refused) {
      setError(
        refused === 'type' ? t('adminGame.imageType') : t('adminGame.imageSize')
      );
      return;
    }
    setBusy(kind);
    setError(null);
    try {
      const ready =
        kind === 'logo'
          ? file
          : await compressImageToMaxBytes(file, 600_000, {
              maxDimension: 2560,
            });
      const url = await arcade.uploadBranding(tenantId, kind, ready);
      setConfig({ [FIELD[kind]]: url });
    } catch (cause) {
      setError(t(errorKey(toArcadeError(cause).code)));
    } finally {
      setBusy(null);
    }
  };

  const preview = (url: string | null) =>
    url ? { backgroundImage: `url(${JSON.stringify(url)})` } : undefined;

  return (
    <Card>
      <CardHeader title={t('adminGame.branding')} />
      <div className="flex flex-col gap-4">
        <p className="text-soft m-0 text-sm">
          {remote ? t('adminGame.brandingHint') : t('adminGame.needServer')}
        </p>

        <div className="arcade-branding-previews">
          <figure className="arcade-preview arcade-preview--desktop">
            <div
              className="arcade-preview-frame"
              style={preview(config.wallpaperDesktop ?? config.wallpaperMobile)}
            >
              {config.logoUrl ? (
                <img
                  src={config.logoUrl}
                  alt=""
                  className="arcade-preview-logo"
                />
              ) : null}
              <span className="arcade-preview-caption">
                {config.welcomeMessage}
              </span>
            </div>
            <figcaption>{t('adminGame.previewDesktop')}</figcaption>
          </figure>
          <figure className="arcade-preview arcade-preview--mobile">
            <div
              className="arcade-preview-frame"
              style={preview(config.wallpaperMobile ?? config.wallpaperDesktop)}
            >
              {config.logoUrl ? (
                <img
                  src={config.logoUrl}
                  alt=""
                  className="arcade-preview-logo"
                />
              ) : null}
              <span className="arcade-preview-caption">
                {config.welcomeMessage}
              </span>
            </div>
            <figcaption>{t('adminGame.previewMobile')}</figcaption>
          </figure>
        </div>

        {remote ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {(['desktop', 'mobile', 'logo'] as const).map(kind => (
              <div key={kind} className="flex flex-col gap-2">
                <span className="text-sm font-medium">
                  {t(`adminGame.${kind}`)}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    loading={busy === kind}
                    onClick={() => inputs[kind].current?.click()}
                  >
                    {t('adminGame.upload')}
                  </Button>
                  {config[FIELD[kind]] ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfig({ [FIELD[kind]]: null })}
                    >
                      {t('adminGame.remove')}
                    </Button>
                  ) : null}
                </div>
                <input
                  ref={inputs[kind]}
                  type="file"
                  accept={ACCEPTED.join(',')}
                  className="sr-only"
                  aria-label={t(`adminGame.${kind}`)}
                  onChange={e => {
                    void onFile(kind, e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-danger m-0 text-sm">
            {error}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
