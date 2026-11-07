import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { ConfirmDialog } from '@mister-guiiug/dev-pwa-config/react/confirm-dialog';
import { Sheet } from '@mister-guiiug/dev-pwa-config/react/sheet';
import { useFullscreen } from '@mister-guiiug/dev-pwa-config/react/use-fullscreen';
import { useI18n } from '../../../i18n/index.ts';
import { arcade } from '../../../backend/index.ts';
import { SyncPanel } from '../sync/SyncPanel.tsx';
import { pair, unpair, useDevice } from './device.ts';
import { PinForm } from './PinForm.tsx';
import { PinSettings } from './PinSettings.tsx';

/**
 * Le menu de la borne : synchronisation, plein écran, code, sortie. Fermé par
 * un code quand l'appareil en a un : c'est ce qui empêche le visiteur du stand
 * de quitter la borne ou d'en changer les réglages.
 */
export function KioskMenu({
  open,
  slug,
  tenantName,
  onClose,
}: {
  open: boolean;
  slug: string;
  tenantName: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const device = useDevice();
  const fullscreen = useFullscreen();
  const [unlocked, setUnlocked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const paired = device.pairing?.slug === slug;
  const locked = Boolean(device.pinHash) && !unlocked;

  const close = () => {
    setUnlocked(false);
    onClose();
  };

  return (
    <>
      <Sheet
        open={open}
        title={locked ? t('kiosk.pinTitle') : t('kiosk.menu')}
        closeLabel={t('kiosk.close')}
        onClose={close}
      >
        {locked ? (
          <PinForm
            mode="unlock"
            submitLabel={t('kiosk.unlock')}
            onDone={() => setUnlocked(true)}
          />
        ) : (
          <div className="flex flex-col gap-5">
            {paired && device.pairing ? (
              <p className="m-0 font-medium">
                {t('kiosk.paired', {
                  label: device.pairing.label,
                  tenant: device.pairing.tenantName,
                })}
              </p>
            ) : null}

            {arcade.kind === 'supabase' ? <SyncPanel /> : null}

            <div className="flex flex-wrap gap-2">
              {fullscreen.supported ? (
                <Button
                  variant="outline"
                  onClick={() => void fullscreen.toggle()}
                >
                  {fullscreen.active
                    ? t('kiosk.exitFullscreen')
                    : t('kiosk.fullscreen')}
                </Button>
              ) : null}
              {!paired && arcade.kind === 'local' ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    pair({
                      slug,
                      token: null,
                      kioskId: null,
                      label: t('kiosk.localLabel'),
                      tenantName,
                      pairedAt: new Date().toISOString(),
                    })
                  }
                >
                  {t('kiosk.enableLocal')}
                </Button>
              ) : null}
            </div>

            {paired ? (
              <section className="flex flex-col gap-2">
                <h3 className="m-0 text-base font-semibold">
                  {t('kiosk.pinTitle')}
                </h3>
                <PinSettings />
              </section>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  close();
                  if (fullscreen.active) void fullscreen.exit();
                  navigate('/');
                }}
              >
                {t('kiosk.leave')}
              </Button>
              {paired ? (
                <Button variant="danger" onClick={() => setConfirming(true)}>
                  {t('kiosk.unpair')}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </Sheet>
      <ConfirmDialog
        open={confirming}
        destructive
        title={t('kiosk.unpairConfirm')}
        message={t('kiosk.unpairBody')}
        onConfirm={() => {
          unpair();
          setConfirming(false);
          close();
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
