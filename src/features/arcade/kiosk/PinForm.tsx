import { useState, type FormEvent } from 'react';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { TextField } from '@mister-guiiug/dev-pwa-config/react/field';
import { useI18n } from '../../../i18n/index.ts';
import { PIN_PATTERN, verifyPin } from './device.ts';

/**
 * Saisie du code de l'appareil. `mode="unlock"` le vérifie ; `mode="set"` le
 * rend à l'appelant, qui l'enregistre.
 */
export function PinForm({
  mode,
  submitLabel,
  onDone,
}: {
  mode: 'unlock' | 'set';
  submitLabel: string;
  onDone: (pin: string) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!PIN_PATTERN.test(pin)) {
      setError(t('kiosk.pinInvalid'));
      return;
    }
    setBusy(true);
    try {
      if (mode === 'unlock' && !(await verifyPin(pin))) {
        setError(t('kiosk.pinWrong'));
        setPin('');
        return;
      }
      setError(undefined);
      await onDone(pin);
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={event => void submit(event)}
      className="flex flex-wrap items-end gap-2"
    >
      <TextField
        label={t('kiosk.pinLabel')}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={8}
        value={pin}
        error={error}
        onChange={event => setPin(event.target.value.replace(/\D/g, ''))}
        className="flex-1"
      />
      <Button type="submit" variant="primary" loading={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}
