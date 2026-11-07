import { Card, CardHeader } from '@mister-guiiug/dev-pwa-config/react/card';
import {
  TextAreaField,
  TextField,
} from '@mister-guiiug/dev-pwa-config/react/field';
import { useI18n } from '../../../i18n/index.ts';
import { arcade } from '../../../backend/index.ts';
import { LEAD_FIELDS, type LeadField } from '../model.ts';
import { useAdmin } from './admin-store.ts';

/**
 * Le formulaire de contact et ce qui l'encadre : consentement, durée de
 * conservation, contact pour les droits. Le client est responsable du
 * traitement ; l'application lui donne de quoi l'être (texte gardé avec chaque
 * lead, purge automatique) sans décider à sa place.
 */
export function FormSection() {
  const { t } = useI18n();
  const draft = useAdmin(s => s.draft);
  const setConfig = useAdmin(s => s.setConfig);
  if (!draft) return null;
  const { config } = draft;

  const toggle = (list: readonly LeadField[], field: LeadField) =>
    list.includes(field) ? list.filter(f => f !== field) : [...list, field];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title={t('adminForm.title')} />
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.leadFormEnabled}
              onChange={e => setConfig({ leadFormEnabled: e.target.checked })}
            />
            {t('adminForm.enabled')}
          </label>
          {config.leadFormEnabled ? (
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-2 text-sm font-medium">
                {t('adminForm.fields')}
              </legend>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {LEAD_FIELDS.map(field => {
                  const label = t(`lead.${field}`);
                  const collected = config.leadFields.includes(field);
                  return (
                    <li
                      key={field}
                      className="flex flex-wrap items-center gap-4"
                    >
                      <label className="flex min-w-36 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={collected}
                          onChange={() =>
                            setConfig({
                              leadFields: toggle(config.leadFields, field),
                              leadRequired: collected
                                ? config.leadRequired.filter(f => f !== field)
                                : config.leadRequired,
                            })
                          }
                        />
                        {label}
                      </label>
                      {collected ? (
                        <label className="text-soft flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={config.leadRequired.includes(field)}
                            onChange={() =>
                              setConfig({
                                leadRequired: toggle(
                                  config.leadRequired,
                                  field
                                ),
                              })
                            }
                          />
                          {t('adminForm.required', { label })}
                        </label>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader title={t('adminForm.privacy')} />
        <div className="flex flex-col gap-3">
          <TextAreaField
            label={t('adminForm.consent')}
            hint={t('adminForm.consentHint')}
            rows={4}
            maxLength={1000}
            value={config.consentText}
            error={config.consentText.trim() ? undefined : t('lead.required')}
            onChange={e => setConfig({ consentText: e.target.value })}
          />
          <TextField
            label={t('adminForm.contact')}
            hint={t('adminForm.contactHint')}
            maxLength={200}
            value={config.privacyContact ?? ''}
            onChange={e =>
              setConfig({ privacyContact: e.target.value || null })
            }
          />
          <TextField
            label={t('adminForm.retention')}
            hint={t('adminForm.retentionHint')}
            type="number"
            min={30}
            max={1825}
            value={String(config.retentionDays)}
            error={
              config.retentionDays < 30 || config.retentionDays > 1825
                ? t('adminForm.retentionRange')
                : undefined
            }
            onChange={e =>
              setConfig({
                retentionDays: Math.trunc(Number(e.target.value)) || 0,
              })
            }
          />
        </div>
      </Card>

      {arcade.kind === 'supabase' ? (
        <Card>
          <CardHeader title={t('adminForm.protection')} />
          <TextField
            label={t('adminForm.rate')}
            hint={t('adminForm.rateHint')}
            type="number"
            min={1}
            max={600}
            value={String(config.maxSpinsPerMinute)}
            error={
              config.maxSpinsPerMinute < 1 || config.maxSpinsPerMinute > 600
                ? t('adminForm.rateRange')
                : undefined
            }
            onChange={e =>
              setConfig({
                maxSpinsPerMinute: Math.trunc(Number(e.target.value)) || 0,
              })
            }
          />
        </Card>
      ) : null}
    </div>
  );
}
