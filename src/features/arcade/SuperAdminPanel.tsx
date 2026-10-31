import { useEffect, useState } from 'react';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { Card, CardHeader } from '@mister-guiiug/dev-pwa-config/react/card';
import { TextField } from '@mister-guiiug/dev-pwa-config/react/field';
import { useI18n } from '../../i18n/index.ts';
import { useRole } from '../../auth/index.ts';
import {
  createTenant,
  listTenants,
  type TenantInfo,
} from './tenant-api.ts';

/**
 * Super admin plateforme : créer un tenant client.
 * L'assignation d'admin se fait ensuite (user_id après inscription).
 */
export function SuperAdminPanel() {
  const { t } = useI18n();
  const { superAdmin } = useRole();
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!superAdmin) return;
    void listTenants()
      .then(setTenants)
      .catch(cause =>
        setError(cause instanceof Error ? cause.message : String(cause))
      );
  }, [superAdmin]);

  if (!superAdmin) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createTenant(
        slug.trim().toLowerCase(),
        name.trim()
      );
      setTenants(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSlug('');
      setName('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title={t('super.title')}
        subtitle={t('super.subtitle')}
      />
      <form onSubmit={event => void submit(event)} className="flex flex-col gap-3">
        <TextField
          label={t('super.slug')}
          hint={t('super.slugHint')}
          value={slug}
          onChange={e => setSlug(e.target.value)}
          required
          pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
        />
        <TextField
          label={t('super.name')}
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
        <Button type="submit" variant="primary" loading={busy}>
          {t('super.create')}
        </Button>
        {error ? (
          <p role="alert" className="m-0 text-sm">
            {error}
          </p>
        ) : null}
      </form>
      <ul className="mt-4 list-none p-0 text-sm">
        {tenants.map(tenant => (
          <li key={tenant.id} className="flex justify-between gap-2 py-1">
            <span>{tenant.name}</span>
            <code>/j/{tenant.slug}</code>
          </li>
        ))}
      </ul>
      <p className="m-0 mt-3 text-sm" style={{ color: 'var(--dwc-text-soft)' }}>
        {t('super.assignHint')}
      </p>
    </Card>
  );
}
