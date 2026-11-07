import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@mister-guiiug/dev-pwa-config/react/badge';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { Card, CardHeader } from '@mister-guiiug/dev-pwa-config/react/card';
import { ConfirmDialog } from '@mister-guiiug/dev-pwa-config/react/confirm-dialog';
import { ErrorBanner } from '@mister-guiiug/dev-pwa-config/react/error-banner';
import { TextField } from '@mister-guiiug/dev-pwa-config/react/field';
import { useToast } from '@mister-guiiug/dev-pwa-config/react/toast';
import { useI18n } from '../../../i18n/index.ts';
import { arcade } from '../../../backend/index.ts';
import type { KioskRow } from '../model.ts';
import { toArcadeError, type ArcadeErrorCode } from '../backend/errors.ts';
import { errorKey } from '../errors-i18n.ts';
import { pair, useDevice } from '../kiosk/device.ts';
import { PinSettings } from '../kiosk/PinSettings.tsx';
import { SyncPanel } from '../sync/SyncPanel.tsx';
import { QrCode } from '../ui/QrCode.tsx';
import { useAdmin } from './admin-store.ts';

/** L'adresse absolue d'une borne, appairage dans le FRAGMENT (jamais envoyé au serveur). */
function pairingLink(slug: string, token: string): string {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL(`j/${slug}#borne=${token}`, base).toString();
}

/**
 * Les bornes du client. Appairer donne à un appareil un jeton qui l'autorise
 * à jouer HORS LIGNE et à déclarer ses parties au retour du réseau ; le
 * révoquer le lui retire. Le lien ne s'affiche qu'une fois : la base ne garde
 * que le haché du jeton.
 */
export function KiosksSection() {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const snapshot = useAdmin(s => s.snapshot);
  const tenantId = useAdmin(s => s.tenantId);
  const device = useDevice();
  const [rows, setRows] = useState<KioskRow[]>([]);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ArcadeErrorCode | null>(null);
  const [link, setLink] = useState<{ label: string; url: string } | null>(null);
  const [revoking, setRevoking] = useState<KioskRow | null>(null);
  const remote = arcade.capabilities.kiosks;

  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    if (!tenantId || !remote) return undefined;
    let alive = true;
    arcade
      .listKiosks(tenantId)
      .then(next => {
        if (alive) setRows(next);
      })
      .catch(cause => {
        if (alive) setError(toArcadeError(cause).code);
      });
    return () => {
      alive = false;
    };
  }, [tenantId, remote, version]);

  if (!snapshot || !tenantId) return null;
  const slug = snapshot.tenant.slug;

  const create = async (thisDevice: boolean) => {
    const name = label.trim();
    if (!name) {
      setError('invalid');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await arcade.createKiosk(tenantId, name);
      setLabel('');
      if (thisDevice) {
        pair({
          slug,
          token: created.token,
          kioskId: created.id,
          label: created.label,
          tenantName: snapshot.tenant.name,
          pairedAt: new Date().toISOString(),
        });
        toast.success(t('kiosk.pairedOk', { label: created.label }));
        navigate(`/j/${slug}`);
      } else {
        setLink({
          label: created.label,
          url: pairingLink(slug, created.token),
        });
      }
      refresh();
    } catch (cause) {
      setError(toArcadeError(cause).code);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void create(false);
  };

  const devicePaired = device.pairing
    ? t('adminKiosks.devicePaired', {
        label: device.pairing.label,
        tenant: device.pairing.tenantName,
      })
    : t('adminKiosks.deviceFree');

  return (
    <div className="flex flex-col gap-4">
      {remote ? (
        <Card>
          <CardHeader
            title={t('adminKiosks.title')}
            subtitle={t('adminKiosks.intro')}
          />
          <div className="flex flex-col gap-4">
            <form
              onSubmit={onSubmit}
              className="flex flex-wrap items-end gap-2"
            >
              <TextField
                label={t('adminKiosks.label')}
                hint={t('adminKiosks.labelHint')}
                maxLength={60}
                value={label}
                onChange={e => setLabel(e.target.value)}
                className="min-w-56 flex-1"
              />
              <Button type="submit" variant="primary" loading={busy}>
                {t('adminKiosks.add')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void create(true)}
              >
                {t('adminKiosks.thisDevice')}
              </Button>
            </form>
            {error ? <ErrorBanner message={t(errorKey(error))} /> : null}

            {link ? (
              <div className="arcade-pairing flex flex-wrap items-center gap-4">
                <QrCode
                  text={link.url}
                  label={t('adminKiosks.qr', { label: link.label })}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="m-0 font-semibold">
                    {t('adminKiosks.linkTitle', { label: link.label })}
                  </p>
                  <p className="text-soft m-0 text-sm">
                    {t('adminKiosks.linkHint')}
                  </p>
                  <code className="arcade-link">{link.url}</code>
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void navigator.clipboard
                          ?.writeText(link.url)
                          .then(() => toast.success(t('adminKiosks.copied')))
                      }
                    >
                      {t('adminKiosks.copy')}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {rows.length === 0 ? (
              <p className="text-soft m-0 text-sm">{t('adminKiosks.empty')}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {rows.map(row => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--dwc-border)] py-2"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{row.label}</span>
                      <span className="text-soft text-sm">
                        {row.lastSeenAt
                          ? t('adminKiosks.lastSeen', {
                              date: fmt.dateTime(row.lastSeenAt),
                            })
                          : t('adminKiosks.never')}
                      </span>
                    </div>
                    {row.revokedAt ? (
                      <Badge tone="muted">{t('adminKiosks.revoked')}</Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRevoking(row)}
                      >
                        {t('adminKiosks.revoke', { label: row.label })}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title={t('adminKiosks.device')} subtitle={devicePaired} />
        <div className="flex flex-col gap-4">
          {!remote && !device.pairing ? (
            <div>
              <Button
                variant="outline"
                onClick={() =>
                  pair({
                    slug,
                    token: null,
                    kioskId: null,
                    label: t('kiosk.localLabel'),
                    tenantName: snapshot.tenant.name,
                    pairedAt: new Date().toISOString(),
                  })
                }
              >
                {t('kiosk.enableLocal')}
              </Button>
            </div>
          ) : null}
          {remote ? <SyncPanel /> : null}
          <section className="flex flex-col gap-2">
            <h3 className="m-0 text-base font-semibold">
              {t('kiosk.pinTitle')}
            </h3>
            <PinSettings />
          </section>
        </div>
      </Card>

      <ConfirmDialog
        open={revoking !== null}
        destructive
        title={t('adminKiosks.revokeConfirm', { label: revoking?.label ?? '' })}
        message={t('adminKiosks.revokeBody')}
        onConfirm={() => {
          const target = revoking;
          setRevoking(null);
          if (!target) return;
          void arcade
            .revokeKiosk(tenantId, target.id)
            .then(() => refresh())
            .catch(cause => setError(toArcadeError(cause).code));
        }}
        onCancel={() => setRevoking(null)}
      />
    </div>
  );
}
