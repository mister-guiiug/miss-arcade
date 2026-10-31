import { Link } from 'react-router-dom';
import { Card, CardHeader } from '@mister-guiiug/dev-pwa-config/react/card';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { useAuthContext } from '@mister-guiiug/dev-pwa-config/react/auth-provider';
import { useI18n } from '../../i18n/index.ts';
import { useRole } from '../../auth/index.ts';
import { coverage } from '../../backend/index.ts';

/**
 * Porte d'admin : le jeu est public ; ici il faut une session + rôle
 * (super admin ou admin tenant). En local sans Supabase, l'admin reste ouvert
 * pour configurer une borne hors ligne.
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { signedIn, ready: authReady } = useAuthContext();
  const { admin, ready: roleReady } = useRole();

  if (coverage.kind !== 'supabase') {
    return <>{children}</>;
  }

  if (!authReady || !roleReady) return null;

  if (!signedIn) {
    return (
      <Card>
        <CardHeader title={t('admin.gateTitle')} />
        <p className="m-0 mb-4">{t('admin.gateBody')}</p>
        <Link to="/compte">
          <Button variant="primary">{t('admin.gateLogin')}</Button>
        </Link>
      </Card>
    );
  }

  if (!admin) {
    return (
      <Card>
        <CardHeader title={t('admin.forbiddenTitle')} />
        <p className="m-0">{t('admin.forbiddenBody')}</p>
      </Card>
    );
  }

  return <>{children}</>;
}
