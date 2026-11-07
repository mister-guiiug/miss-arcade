import { useState, type ReactNode } from 'react';
import { Card, CardHeader } from '@mister-guiiug/dev-pwa-config/react/card';
import { SkeletonGroup } from '@mister-guiiug/dev-pwa-config/react/skeleton';
import { useAuthContext } from '@mister-guiiug/dev-pwa-config/react/auth-provider';
import { useI18n } from '../../../i18n/index.ts';
import { arcade } from '../../../backend/index.ts';
import { useDevice } from '../kiosk/device.ts';
import { PinForm } from '../kiosk/PinForm.tsx';
import { ButtonLink } from '../ui/ButtonLink.tsx';

/** L'administration locale déverrouillée, pour la durée de l'onglet. */
const UNLOCK_KEY = 'miss-arcade-admin-ouvert';

function wasUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * LA PORTE DE L'ADMINISTRATION.
 *
 * Avec le serveur : une session. Les DROITS, eux, viennent du serveur
 * (`arcade_whoami`, lu par l'écran) : la RLS les applique de toute façon, et le
 * hook qui les recopiait dans le jeton s'active à la main sur Supabase.
 *
 * Sans serveur : jusqu'au 07/11/2026 la porte était grande ouverte, et
 * n'importe qui au stand changeait les lots. Le code de l'appareil la ferme
 * dès qu'il est défini (onglet Bornes).
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { signedIn, ready } = useAuthContext();
  const { pinHash } = useDevice();
  const [unlocked, setUnlocked] = useState(wasUnlocked);

  if (arcade.kind === 'local') {
    if (pinHash && !unlocked) {
      return (
        <Card>
          <CardHeader title={t('admin.lockedTitle')} />
          <p className="m-0 mb-4">{t('admin.lockedBody')}</p>
          <PinForm
            mode="unlock"
            submitLabel={t('kiosk.unlock')}
            onDone={() => {
              try {
                sessionStorage.setItem(UNLOCK_KEY, '1');
              } catch {
                // Stockage de session refusé : déverrouillé pour cet écran seulement.
              }
              setUnlocked(true);
            }}
          />
        </Card>
      );
    }
    return <>{children}</>;
  }

  if (!ready) return <SkeletonGroup label={t('admin.loading')} lines={3} />;

  if (!signedIn) {
    return (
      <Card>
        <CardHeader title={t('admin.gateTitle')} />
        <p className="m-0 mb-4">{t('admin.gateBody')}</p>
        <ButtonLink to="/compte" variant="primary">
          {t('admin.gateLogin')}
        </ButtonLink>
      </Card>
    );
  }

  return <>{children}</>;
}
