import { useId, useState, type FormEvent } from 'react';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { TextField } from '@mister-guiiug/dev-pwa-config/react/field';
import { useI18n } from '../../../i18n/index.ts';
import {
  validateLeadValue,
  type GameConfig,
  type LeadField,
} from '../model.ts';

const INPUT: Record<
  LeadField,
  { type: string; autoComplete: string; inputMode?: 'email' | 'tel' }
> = {
  prenom: { type: 'text', autoComplete: 'given-name' },
  nom: { type: 'text', autoComplete: 'family-name' },
  email: { type: 'email', autoComplete: 'email', inputMode: 'email' },
  telephone: { type: 'tel', autoComplete: 'tel', inputMode: 'tel' },
};

type Values = Partial<Record<LeadField, string>>;
type Errors = Partial<Record<LeadField | 'consent', string>>;

/**
 * Le formulaire de contact, proposé aux gagnants ET aux perdants.
 *
 * Le consentement est une case NON cochée, sans laquelle rien ne part : le
 * texte vient du client (c'est lui le responsable du traitement), il est
 * envoyé avec le lead et gardé avec lui. Sous la case : qui conserve, combien
 * de temps, et où exercer ses droits.
 *
 * Les règles de validation sont celles du serveur (`validateLeadValue`) :
 * refuser ici ce que `arcade_submit_lead` refuserait, plutôt que d'envoyer une
 * saisie qui partirait en lettre morte.
 */
export function LeadForm({
  config,
  organizer,
  lose,
  onSubmit,
  onSkip,
}: {
  config: GameConfig;
  organizer: string;
  lose: boolean;
  onSubmit: (values: Values) => void;
  onSkip: () => void;
}) {
  const { t } = useI18n();
  const consentId = useId();
  const [values, setValues] = useState<Values>({});
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const required = new Set(
    config.leadRequired.filter(field => config.leadFields.includes(field))
  );

  const validate = (): Errors => {
    const found: Errors = {};
    for (const field of config.leadFields) {
      const value = values[field] ?? '';
      if (required.has(field) && !value.trim()) {
        found[field] = t('lead.required');
        continue;
      }
      const problem = validateLeadValue(field, value);
      if (problem === 'too-long') found[field] = t('lead.tooLong');
      else if (problem === 'invalid') {
        found[field] =
          field === 'email' ? t('lead.invalidEmail') : t('lead.invalidPhone');
      }
    }
    const anything = config.leadFields.some(f => (values[f] ?? '').trim());
    if (!anything && config.leadFields[0]) {
      found[config.leadFields[0]] = t('lead.required');
    }
    if (!consent) found.consent = t('lead.consentRequired');
    return found;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit(values);
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="arcade-lead flex w-full max-w-md flex-col gap-3 text-left"
    >
      <p className="text-soft m-0 text-sm">
        {lose ? t('lead.introLose') : t('lead.introWin')}
      </p>
      {config.leadFields.map(field => {
        const label = t(`lead.${field}`);
        return (
          <TextField
            key={field}
            label={required.has(field) ? label : t('lead.optional', { label })}
            name={field}
            type={INPUT[field].type}
            autoComplete={INPUT[field].autoComplete}
            inputMode={INPUT[field].inputMode}
            required={required.has(field)}
            maxLength={120}
            value={values[field] ?? ''}
            error={errors[field]}
            onChange={event =>
              setValues(prev => ({ ...prev, [field]: event.target.value }))
            }
          />
        );
      })}

      <div className="arcade-consent">
        <input
          id={consentId}
          type="checkbox"
          checked={consent}
          aria-invalid={errors.consent ? true : undefined}
          aria-describedby={errors.consent ? `${consentId}-erreur` : undefined}
          onChange={event => setConsent(event.target.checked)}
        />
        <label htmlFor={consentId} className="text-sm">
          {config.consentText}
        </label>
      </div>
      {errors.consent ? (
        <p
          id={`${consentId}-erreur`}
          role="alert"
          className="text-danger m-0 text-sm"
        >
          {errors.consent}
        </p>
      ) : null}
      <p className="text-soft m-0 text-xs">
        {t('lead.retention', { days: config.retentionDays, organizer })}
        {config.privacyContact
          ? ` ${t('lead.contact', { contact: config.privacyContact })}`
          : null}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" size="lg">
          {t('lead.submit')}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={onSkip}>
          {t('lead.skip')}
        </Button>
      </div>
    </form>
  );
}
