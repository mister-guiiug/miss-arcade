import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../../../i18n/index.ts';
import { defaultConfig, type GameConfig } from '../model.ts';
import { LeadForm } from './LeadForm.tsx';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('dwc_locale', 'fr');
});

function monter(config: Partial<GameConfig> = {}) {
  const onSubmit = vi.fn();
  const onSkip = vi.fn();
  render(
    <I18nProvider>
      <LeadForm
        config={{
          ...defaultConfig(),
          privacyContact: 'dpo@exemple.test',
          ...config,
        }}
        organizer="Alpha"
        lose={false}
        onSubmit={onSubmit}
        onSkip={onSkip}
      />
    </I18nProvider>
  );
  return { onSubmit, onSkip };
}

describe('le formulaire de contact', () => {
  it('ne part pas sans la case de consentement, NON cochée par défaut', async () => {
    const user = userEvent.setup();
    const { onSubmit } = monter();
    const consent = screen.getByRole('checkbox');
    expect(consent).not.toBeChecked();
    await user.type(screen.getByLabelText('E-mail'), 'ada@exemple.test');
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'Votre accord est nécessaire pour enregistrer vos coordonnées.'
      )
    ).toBeVisible();
  });

  it('refuse une adresse illisible et un champ obligatoire vide', async () => {
    const user = userEvent.setup();
    const { onSubmit } = monter({
      leadFields: ['prenom', 'email'],
      leadRequired: ['prenom', 'email'],
    });
    await user.type(screen.getByLabelText('E-mail'), 'ada@exemple');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Adresse e-mail invalide')).toBeVisible();
    expect(screen.getByText('Champ obligatoire')).toBeVisible();
  });

  it('envoie les coordonnées avec l’accord, et dit qui conserve et combien de temps', async () => {
    const user = userEvent.setup();
    const { onSubmit } = monter();
    expect(screen.getByText(/Conservées 365 jours par Alpha/)).toBeVisible();
    expect(screen.getByText(/dpo@exemple\.test/)).toBeVisible();
    await user.type(screen.getByLabelText('Prénom (facultatif)'), 'Ada');
    await user.type(screen.getByLabelText('E-mail'), 'ada@exemple.test');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(onSubmit).toHaveBeenCalledWith({
      prenom: 'Ada',
      email: 'ada@exemple.test',
    });
  });

  it('se refuse poliment', async () => {
    const user = userEvent.setup();
    const { onSkip, onSubmit } = monter();
    await user.click(screen.getByRole('button', { name: 'Non merci' }));
    expect(onSkip).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
