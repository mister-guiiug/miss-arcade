import { useRef, useState } from 'react';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { Card, CardHeader } from '@mister-guiiug/dev-pwa-config/react/card';
import { useI18n } from '../../i18n/index.ts';
import { useArcade } from './store.ts';
import { uploadBranding } from './tenant-api.ts';

/**
 * 1/ Message d'accueil + fonds PC / téléphone + logo.
 * Prévisualisation côte à côte (desktop 16:9, mobile 9:16).
 */
export function BrandingPanel() {
  const { t } = useI18n();
  const snapshot = useArcade(s => s.snapshot);
  const tenant = useArcade(s => s.tenant);
  const updateConfig = useArcade(s => s.updateConfig);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const desktopRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const onFile = async (
    kind: 'desktop' | 'mobile' | 'logo',
    file: File | undefined
  ) => {
    if (!file || !tenant || tenant.id === 'local') {
      setError(t('branding.needRemote'));
      return;
    }
    setBusy(kind);
    setError(null);
    try {
      const url = await uploadBranding(tenant.id, kind, file);
      if (kind === 'desktop') await updateConfig({ wallpaperDesktop: url });
      else if (kind === 'mobile') await updateConfig({ wallpaperMobile: url });
      else await updateConfig({ logoUrl: url });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title={t('branding.title')}
        subtitle={t('branding.subtitle')}
      />
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm" style={{ color: 'var(--dwc-text-soft)' }}>
          {t('branding.hint')}
        </p>

        <div className="arcade-branding-previews">
          <figure className="arcade-preview arcade-preview--desktop">
            <div
              className="arcade-preview-frame"
              style={{
                backgroundImage: snapshot.wallpaperDesktop
                  ? `url(${snapshot.wallpaperDesktop})`
                  : undefined,
              }}
            >
              {snapshot.logoUrl ? (
                <img
                  src={snapshot.logoUrl}
                  alt=""
                  className="arcade-preview-logo"
                />
              ) : null}
              <span className="arcade-preview-caption">
                {snapshot.welcomeMessage}
              </span>
            </div>
            <figcaption>{t('branding.desktop')}</figcaption>
          </figure>
          <figure className="arcade-preview arcade-preview--mobile">
            <div
              className="arcade-preview-frame"
              style={{
                backgroundImage: snapshot.wallpaperMobile
                  ? `url(${snapshot.wallpaperMobile})`
                  : undefined,
              }}
            >
              {snapshot.logoUrl ? (
                <img
                  src={snapshot.logoUrl}
                  alt=""
                  className="arcade-preview-logo"
                />
              ) : null}
              <span className="arcade-preview-caption">
                {snapshot.welcomeMessage}
              </span>
            </div>
            <figcaption>{t('branding.mobile')}</figcaption>
          </figure>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            loading={busy === 'desktop'}
            onClick={() => desktopRef.current?.click()}
          >
            {t('branding.uploadDesktop')}
          </Button>
          <Button
            variant="outline"
            loading={busy === 'mobile'}
            onClick={() => mobileRef.current?.click()}
          >
            {t('branding.uploadMobile')}
          </Button>
          <Button
            variant="outline"
            loading={busy === 'logo'}
            onClick={() => logoRef.current?.click()}
          >
            {t('branding.uploadLogo')}
          </Button>
          <input
            ref={desktopRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label={t('branding.uploadDesktop')}
            onChange={e => {
              void onFile('desktop', e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <input
            ref={mobileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label={t('branding.uploadMobile')}
            onChange={e => {
              void onFile('mobile', e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <input
            ref={logoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="sr-only"
            aria-label={t('branding.uploadLogo')}
            onChange={e => {
              void onFile('logo', e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        {error ? (
          <p role="alert" className="m-0 text-sm">
            {error}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
