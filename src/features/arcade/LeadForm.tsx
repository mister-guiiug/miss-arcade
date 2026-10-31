import { useState, type FormEvent } from 'react';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { TextField } from '@mister-guiiug/dev-pwa-config/react/field';
import { useI18n } from '../../i18n/index.ts';
import { useArcade, type LeadField } from './store.ts';

/**
 * Formulaire leads post-partie — optionnel, champs choisis en admin.
 * Pas de carte : c'est une saisie, pas un widget décoratif.
 */
export function LeadForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const fields = useArcade(s => s.snapshot.leadFields);
  const enabled = useArcade(s => s.snapshot.leadFormEnabled);
  const addLead = useArcade(s => s.addLead);
  const [values, setValues] = useState<Record<string, string>>({});

  if (!enabled || fields.length === 0) {
    return (
      <Button variant="primary" onClick={onDone}>
        {t('play.continue')}
      </Button>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    addLead(values);
    setValues({});
    onDone();
  };

  const labelFor = (field: LeadField) => t(`lead.${field}` as 'lead.prenom');

  return (
    <form onSubmit={submit} className="arcade-lead flex flex-col gap-3">
      <p className="m-0 text-sm" style={{ color: 'var(--dwc-text-soft)' }}>
        {t('lead.intro')}
      </p>
      {fields.map(field => (
        <TextField
          key={field}
          label={labelFor(field)}
          name={field}
          type={
            field === 'email' ? 'email' : field === 'telephone' ? 'tel' : 'text'
          }
          autoComplete={
            field === 'email'
              ? 'email'
              : field === 'telephone'
                ? 'tel'
                : field === 'prenom'
                  ? 'given-name'
                  : 'family-name'
          }
          value={values[field] ?? ''}
          onChange={event =>
            setValues(prev => ({ ...prev, [field]: event.target.value }))
          }
        />
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary">
          {t('lead.submit')}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t('lead.skip')}
        </Button>
      </div>
    </form>
  );
}
