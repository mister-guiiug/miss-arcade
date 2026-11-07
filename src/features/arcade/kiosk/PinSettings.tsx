import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { useToast } from '@mister-guiiug/dev-pwa-config/react/toast';
import { useI18n } from '../../../i18n/index.ts';
import { clearPin, setPin, useDevice } from './device.ts';
import { PinForm } from './PinForm.tsx';

/** Définir, changer ou retirer le code qui protège la sortie de la borne. */
export function PinSettings() {
  const { t } = useI18n();
  const toast = useToast();
  const { pinHash } = useDevice();

  return (
    <div className="flex flex-col gap-2">
      {pinHash ? null : (
        <p className="text-soft m-0 text-sm">{t('kiosk.pinNone')}</p>
      )}
      <PinForm
        mode="set"
        submitLabel={pinHash ? t('kiosk.pinChange') : t('kiosk.pinSet')}
        onDone={async pin => {
          await setPin(pin);
          toast.success(t('kiosk.pinSaved'));
        }}
      />
      {pinHash ? (
        <div>
          <Button variant="ghost" size="sm" onClick={clearPin}>
            {t('kiosk.pinClear')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
