import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { Card, CardHeader } from '@mister-guiiug/dev-pwa-config/react/card';
import { ErrorBanner } from '@mister-guiiug/dev-pwa-config/react/error-banner';
import { SegmentedControl } from '@mister-guiiug/dev-pwa-config/react/segmented-control';
import { SelectField } from '@mister-guiiug/dev-pwa-config/react/field';
import { SkeletonGroup } from '@mister-guiiug/dev-pwa-config/react/skeleton';
import { useAuthContext } from '@mister-guiiug/dev-pwa-config/react/auth-provider';
import { useToast } from '@mister-guiiug/dev-pwa-config/react/toast';
import { useI18n } from '../../../i18n/index.ts';
import { arcade } from '../../../backend/index.ts';
import { errorKey } from '../errors-i18n.ts';
import { ButtonLink } from '../ui/ButtonLink.tsx';
import { useAdmin } from './admin-store.ts';
import { RequireAdmin } from './RequireAdmin.tsx';
import { GameSection } from './GameSection.tsx';
import { PrizesSection } from './PrizesSection.tsx';
import { FormSection } from './FormSection.tsx';
import { LeadsSection } from './LeadsSection.tsx';
import { StatsSection } from './StatsSection.tsx';
import { KiosksSection } from './KiosksSection.tsx';
import { TenantsSection } from './TenantsSection.tsx';
import { DataSection } from './DataSection.tsx';

/** Les rubriques, par leur segment d'adresse (`/admin/lots`…). */
const SECTIONS = {
  jeu: 'game',
  lots: 'prizes',
  formulaire: 'form',
  contacts: 'leads',
  statistiques: 'stats',
  bornes: 'kiosks',
  clients: 'tenants',
  donnees: 'data',
} as const;
type Route = keyof typeof SECTIONS;
type Section = (typeof SECTIONS)[Route];

/** Celles dont les modifications passent par le brouillon et « Enregistrer ». */
const DRAFTED: readonly Section[] = ['game', 'prizes', 'form'];

export function AdminScreen() {
  return (
    <RequireAdmin>
      <AdminContent />
    </RequireAdmin>
  );
}

function AdminContent() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { section: param } = useParams<{ section?: string }>();
  const { user } = useAuthContext<unknown, { id?: string }>();
  const access = useAdmin(s => s.access);
  const tenantId = useAdmin(s => s.tenantId);
  const snapshot = useAdmin(s => s.snapshot);
  const loading = useAdmin(s => s.loading);
  const error = useAdmin(s => s.error);
  const conflict = useAdmin(s => s.conflict);
  const dirty = useAdmin(s => s.dirty);
  const saving = useAdmin(s => s.saving);
  const init = useAdmin(s => s.init);
  const selectTenant = useAdmin(s => s.selectTenant);
  const save = useAdmin(s => s.save);
  const discard = useAdmin(s => s.discard);
  const reload = useAdmin(s => s.reload);
  const userId = user?.id ?? null;

  useEffect(() => {
    void init();
  }, [init, userId]);

  // Quitter la page avec un brouillon : le navigateur demande confirmation.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!access && loading) {
    return <SkeletonGroup label={t('admin.loading')} lines={4} />;
  }
  if (!access) {
    return error ? <ErrorBanner message={t(errorKey(error))} /> : null;
  }
  if (access.tenants.length === 0 && !access.superAdmin) {
    return (
      <Card>
        <CardHeader title={t('admin.forbiddenTitle')} />
        <p className="m-0">{t('admin.forbiddenBody')}</p>
      </Card>
    );
  }

  const available: Section[] = [
    ...(snapshot
      ? (['game', 'prizes', 'form', 'leads', 'stats', 'kiosks'] as const)
      : []),
    ...(access.superAdmin && arcade.capabilities.tenants
      ? (['tenants'] as const)
      : []),
    ...(arcade.capabilities.dataFile ? (['data'] as const) : []),
  ];
  const requested =
    param && param in SECTIONS ? SECTIONS[param as Route] : null;
  const section: Section =
    requested && available.includes(requested)
      ? requested
      : (available[0] ?? 'tenants');
  const routeOf = (wanted: Section) =>
    (Object.keys(SECTIONS) as Route[]).find(key => SECTIONS[key] === wanted) ??
    'jeu';

  const onSave = async () => {
    if (await save()) toast.success(t('admin.saved'));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {access.tenants.length > 1 ? (
          <SelectField
            label={t('admin.tenant')}
            value={tenantId ?? ''}
            onChange={event => void selectTenant(event.target.value)}
            disabled={dirty}
            className="min-w-56"
          >
            {access.tenants.map(tenant => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </SelectField>
        ) : snapshot ? (
          <p className="m-0 text-lg font-semibold">{snapshot.tenant.name}</p>
        ) : (
          <span />
        )}
        {snapshot ? (
          <ButtonLink to={`/j/${snapshot.tenant.slug}`} variant="outline">
            {t('admin.openKiosk')}
          </ButtonLink>
        ) : null}
      </div>

      <SegmentedControl
        value={section}
        onChange={value => navigate(`/admin/${routeOf(value as Section)}`)}
        ariaLabel={t('admin.sectionsLabel')}
        options={available.map(value => ({
          value,
          label: t(`admin.sections.${value}`),
        }))}
        className="arcade-admin-tabs"
      />

      {loading && !snapshot ? (
        <SkeletonGroup label={t('admin.loading')} lines={4} />
      ) : null}

      {section === 'game' && snapshot ? <GameSection /> : null}
      {section === 'prizes' && snapshot ? <PrizesSection /> : null}
      {section === 'form' && snapshot ? <FormSection /> : null}
      {section === 'leads' && tenantId ? (
        <LeadsSection tenantId={tenantId} />
      ) : null}
      {section === 'stats' && tenantId ? (
        <StatsSection tenantId={tenantId} />
      ) : null}
      {section === 'kiosks' && snapshot ? <KiosksSection /> : null}
      {section === 'tenants' ? <TenantsSection /> : null}
      {section === 'data' ? <DataSection /> : null}

      {DRAFTED.includes(section) && (dirty || error) ? (
        <div
          className="arcade-savebar"
          role="region"
          aria-label={t('admin.dirty')}
        >
          {conflict ? (
            <>
              <p className="m-0 text-sm">{t('admin.conflict')}</p>
              <Button variant="primary" onClick={() => void reload()}>
                {t('admin.reload')}
              </Button>
            </>
          ) : (
            <>
              <p className="m-0 text-sm font-medium">
                {error ? t(errorKey(error)) : t('admin.dirty')}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  onClick={discard}
                  disabled={saving || !dirty}
                >
                  {t('admin.discard')}
                </Button>
                <Button
                  variant="primary"
                  loading={saving}
                  disabled={!dirty}
                  onClick={() => void onSave()}
                >
                  {t('admin.save')}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
