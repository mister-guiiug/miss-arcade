import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { Card, CardHeader } from '@mister-guiiug/dev-pwa-config/react/card';
import { ConfirmDialog } from '@mister-guiiug/dev-pwa-config/react/confirm-dialog';
import { ErrorBanner } from '@mister-guiiug/dev-pwa-config/react/error-banner';
import { TextField } from '@mister-guiiug/dev-pwa-config/react/field';
import { useToast } from '@mister-guiiug/dev-pwa-config/react/toast';
import { useI18n } from '../../../i18n/index.ts';
import { arcade } from '../../../backend/index.ts';
import type { AdminRow, TenantSummary } from '../model.ts';
import { toArcadeError, type ArcadeErrorCode } from '../backend/errors.ts';
import { errorKey } from '../errors-i18n.ts';
import { QrCode } from '../ui/QrCode.tsx';
import { useAdmin } from './admin-store.ts';

const SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

function publicLink(slug: string): string {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL(`j/${slug}`, base).toString();
}

/**
 * Les clients, pour le super admin : créer, publier, renommer, supprimer, et
 * rattacher les administrateurs PAR LEUR ADRESSE. Jusqu'au 07/11/2026 il
 * fallait retrouver un `user_id` et l'insérer en SQL dans `tenant_admins`.
 */
export function TenantsSection() {
  const { t } = useI18n();
  const toast = useToast();
  const access = useAdmin(s => s.access);
  const init = useAdmin(s => s.init);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ArcadeErrorCode | null>(null);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const wanted = slug.trim().toLowerCase();
    if (!SLUG.test(wanted) || !name.trim()) {
      setError('invalid');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await arcade.createTenant(wanted, name.trim());
      setSlug('');
      setName('');
      toast.success(t('adminTenants.saved'));
      await init();
    } catch (cause) {
      setError(toArcadeError(cause).code);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title={t('adminTenants.create')} />
        <form
          onSubmit={event => void create(event)}
          className="flex flex-col gap-3"
        >
          <TextField
            label={t('adminTenants.slug')}
            hint={t('adminTenants.slugHint')}
            value={slug}
            maxLength={40}
            onChange={e => setSlug(e.target.value)}
            required
          />
          <TextField
            label={t('adminTenants.name')}
            value={name}
            maxLength={80}
            onChange={e => setName(e.target.value)}
            required
          />
          <div>
            <Button type="submit" variant="primary" loading={busy}>
              {t('adminTenants.create')}
            </Button>
          </div>
          {error ? <ErrorBanner message={t(errorKey(error))} /> : null}
        </form>
      </Card>

      {access?.tenants.map(tenant => (
        <TenantCard
          key={tenant.id}
          tenant={tenant}
          onChanged={() => void init()}
        />
      ))}
    </div>
  );
}

function TenantCard({
  tenant,
  onChanged,
}: {
  tenant: TenantSummary;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [name, setName] = useState(tenant.name);
  const [email, setEmail] = useState('');
  const [admins, setAdmins] = useState<AdminRow[] | null>(null);
  const [error, setError] = useState<ArcadeErrorCode | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    arcade
      .listAdmins(tenant.id)
      .then(rows => {
        if (alive) setAdmins(rows);
      })
      .catch(cause => {
        if (alive) setError(toArcadeError(cause).code);
      });
    return () => {
      alive = false;
    };
  }, [open, tenant.id]);

  const act = async (run: () => Promise<unknown>, refresh = true) => {
    setError(null);
    try {
      await run();
      toast.success(t('adminTenants.saved'));
      if (refresh) onChanged();
    } catch (cause) {
      setError(toArcadeError(cause).code);
    }
  };

  const reloadAdmins = async () =>
    setAdmins(await arcade.listAdmins(tenant.id));
  const link = publicLink(tenant.slug);

  return (
    <Card>
      <CardHeader title={tenant.name} subtitle={`/j/${tenant.slug}`} />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <TextField
            label={t('adminTenants.name')}
            value={name}
            maxLength={80}
            onChange={e => setName(e.target.value)}
            className="min-w-56 flex-1"
          />
          <Button
            variant="outline"
            disabled={!name.trim() || name.trim() === tenant.name}
            onClick={() =>
              void act(() =>
                arcade.updateTenant(tenant.id, { name: name.trim() })
              )
            }
          >
            {t('adminTenants.rename')}
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={tenant.published}
            onChange={e =>
              void act(() =>
                arcade.updateTenant(tenant.id, { published: e.target.checked })
              )
            }
          />
          {t('adminTenants.published')}
        </label>

        <details onToggle={event => setOpen(event.currentTarget.open)}>
          <summary className="cursor-pointer font-medium">
            {t('adminTenants.admins')} · {t('adminTenants.link')}
          </summary>
          <div className="mt-3 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4">
              {open ? (
                <QrCode
                  text={link}
                  label={t('adminTenants.qr', { name: tenant.name })}
                  size={144}
                />
              ) : null}
              <code className="arcade-link">{link}</code>
            </div>
            {admins === null ? null : admins.length === 0 ? (
              <p className="text-soft m-0 text-sm">
                {t('adminTenants.noAdmins')}
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {admins.map(admin => (
                  <li
                    key={admin.userId}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span>{admin.email}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void act(async () => {
                          await arcade.removeAdmin(tenant.id, admin.userId);
                          await reloadAdmins();
                        }, false)
                      }
                    >
                      {t('adminTenants.removeAdmin', { email: admin.email })}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={event => {
                event.preventDefault();
                void act(async () => {
                  await arcade.assignAdmin(tenant.id, email.trim());
                  setEmail('');
                  await reloadAdmins();
                }, false);
              }}
            >
              <TextField
                label={t('adminTenants.adminEmail')}
                hint={t('adminTenants.assignHint')}
                type="email"
                autoComplete="off"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="min-w-56 flex-1"
              />
              <Button type="submit" variant="outline" disabled={!email.trim()}>
                {t('adminTenants.assign')}
              </Button>
            </form>
          </div>
        </details>

        {error ? <ErrorBanner message={t(errorKey(error))} /> : null}
        <div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirming(true)}
          >
            {t('adminTenants.delete', { name: tenant.name })}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        destructive
        title={t('adminTenants.deleteConfirm', { name: tenant.name })}
        message={t('adminTenants.deleteBody')}
        onConfirm={() => {
          setConfirming(false);
          void act(() => arcade.deleteTenant(tenant.id));
        }}
        onCancel={() => setConfirming(false)}
      />
    </Card>
  );
}
