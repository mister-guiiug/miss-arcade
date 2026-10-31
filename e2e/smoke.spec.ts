import { expect, test } from '@playwright/test';

/**
 * Smoke Miss Arcade : bornes de jeu, admin, navigation, export.
 * Tag `@critical` : exécuté en CI (`playwright test --grep @critical`).
 */
test.describe('@critical le cadre', () => {
  test("l'accueil s'ouvre et porte le nom de l'app", async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Miss Arcade'
    );
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(
      'Bandit manchot'
    );
    await expect(page.getByRole('button', { name: 'Lancer' })).toBeVisible();
  });

  test('un tirage affiche un résultat', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Lancer' }).click();
    await expect(
      page.getByText(/Bravo|Pas de chance|Retentez|gagne/i)
    ).toBeVisible({ timeout: 8_000 });
  });

  test('l’admin change le type de jeu vers la roue', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Administration'
    );
    await page.getByRole('tab', { name: 'Roue de la fortune' }).click();
    await page.getByRole('link', { name: 'Jouer' }).click();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(
      'Roue de la fortune'
    );
    await expect(
      page.getByRole('button', { name: 'Tourner la roue' })
    ).toBeVisible();
  });

  test('la navigation atteint les destinations', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Admin' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Administration'
    );

    await page.getByRole('link', { name: 'Réglages' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Réglages'
    );

    await page.getByRole('link', { name: 'Compte' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Compte');

    await page.getByRole('link', { name: 'À propos' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'À propos'
    );
  });

  test('sans backend, l’écran de compte le DIT au lieu de disparaître', async ({
    page,
  }) => {
    await page.goto('/compte');
    await expect(page.getByText('Mode local')).toBeVisible();
    await expect(page.getByTestId('zone-dangereuse')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Supprimer mon compte' })
    ).toHaveCount(0);
  });

  test('un lien profond rafraîchi sert l’app, pas la page d’erreur', async ({
    page,
  }) => {
    await page.goto('/reglages');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Réglages'
    );
  });

  test('un fichier arcade s’importe et survit au rechargement', async ({
    page,
  }) => {
    await page.goto('/reglages');
    await page.getByLabel('Importer').setInputFiles({
      name: 'arcade.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          v: 1,
          data: {
            activeGame: 'bandit',
            welcomeMessage: 'Bienvenue e2e',
            winMessage: 'Gagné {lot}',
            loseMessage: 'Perdu e2e',
            leadFormEnabled: false,
            leadFields: ['prenom'],
            prizes: [
              {
                id: 'lot_e2e',
                label: 'Lot e2e',
                weight: 100,
                stock: 5,
                color: '#1f8a70',
                symbol: 'E',
                lose: false,
              },
            ],
            leads: [
              {
                id: 'lead_e2e',
                createdAt: '2026-10-31T08:00:00.000Z',
                prizeId: 'lot_e2e',
                prizeLabel: 'Lot e2e',
                game: 'bandit',
                fields: { prenom: 'Ada' },
              },
            ],
          },
        })
      ),
    });
    await page.getByRole('button', { name: 'Confirmer' }).click();
    await expect(page.getByText(/Import réussi/)).toBeVisible();

    await page.goto('/');
    await expect(page.getByText('Bienvenue e2e')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Bienvenue e2e')).toBeVisible();
  });

  test('hors ligne, le jeu reste jouable', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Lancer' })).toBeVisible();

    await context.setOffline(true);
    await page.getByRole('button', { name: 'Lancer' }).click();
    await expect(
      page.getByText(/Bravo|Pas de chance|Retentez|gagne/i)
    ).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('[data-dwc="connection-banner"]')).toBeVisible({
      timeout: 10_000,
    });

    await context.setOffline(false);
  });

  test('la fiche d’installation se propose quand le navigateur le permet', async ({
    page,
  }) => {
    await page.goto('/a-propos');
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.assign(event, {
        prompt: () => Promise.resolve(),
        userChoice: Promise.resolve({ outcome: 'dismissed' }),
      });
      window.dispatchEvent(event);
    });
    await expect(
      page.getByRole('region', { name: 'Installer l’application' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Installer' })).toBeVisible();
  });

  test('« Signaler un problème » part avec la version et l’écran', async ({
    page,
  }) => {
    await page.goto('/a-propos');
    const lien = page.getByRole('link', { name: 'Signaler un problème' });
    await expect(lien).toHaveAttribute(
      'href',
      /\/issues\/new\?template=bug\.yml/
    );
    const url = new URL((await lien.getAttribute('href')) ?? '');
    expect(url.searchParams.get('version')).toMatch(/^v\d+\.\d+\.\d+/);
    expect(url.searchParams.get('environnement')).toContain('écran ');
    expect(url.searchParams.get('environnement')).toContain('/a-propos');
  });

  test('les trois liens de la famille : sur l’accueil et « À propos », nulle part ailleurs', async ({
    page,
  }) => {
    const pied = page.locator('[data-dwc="app-footer"]');
    const liens = ['Code source', 'M’offrir un café', 'Signaler un problème'];

    for (const route of ['/', '/a-propos']) {
      await page.goto(route);
      await expect(pied, `pied de page attendu sur ${route}`).toBeVisible();
      for (const nom of liens) {
        await expect(
          pied.getByRole('link', { name: nom, exact: true }),
          `${nom} attendu une fois sur ${route}`
        ).toHaveCount(1);
      }
    }

    for (const route of ['/reglages', '/compte', '/admin']) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(pied, `pied de page interdit sur ${route}`).toHaveCount(0);
      for (const nom of liens) {
        await expect(
          page.getByRole('link', { name: nom, exact: true }),
          `${nom} ne doit pas être sur ${route}`
        ).toHaveCount(0);
      }
    }
  });

  test('la langue bascule, et le cadre suit', async ({ page }) => {
    await page.goto('/reglages');

    await page.getByRole('tab', { name: 'EN' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Settings'
    );
    await expect(page.getByRole('link', { name: 'Play' })).toBeVisible();
  });
});
