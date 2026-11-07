import { expect, test, type Page } from '@playwright/test';

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
    await expect(
      page.getByRole('heading', { level: 2, name: 'Bandit manchot' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lancer' })).toBeVisible();
  });

  test('un tirage affiche un résultat', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Lancer' }).click();
    await expect(page.locator('.arcade-result-message')).toHaveText(
      /Bravo|Pas de chance/,
      { timeout: 8_000 }
    );
  });

  test('un double appui ne fait qu’UN tirage', async ({ page }) => {
    // Jusqu'au 07/11/2026, le bouton ne se verrouillait qu'après la réponse
    // du serveur : deux appuis rapides, deux tirages, deux lots décomptés.
    await page.goto('/');
    await page.getByRole('button', { name: 'Lancer' }).dblclick();
    await expect(page.locator('.arcade-result-message')).toBeVisible({
      timeout: 8_000,
    });
    const tirages = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('miss-arcadearcade') ?? '{}').data
          ?.spins?.length
    );
    expect(tirages).toBe(1);
  });

  test('l’admin change le type de jeu, et rien ne part avant « Enregistrer »', async ({
    page,
  }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Administration'
    );
    await page.getByRole('tab', { name: 'Roue de la fortune' }).click();
    await expect(
      page.getByText('Modifications non enregistrées')
    ).toBeVisible();
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Modifications enregistrées.')).toBeVisible();
    await page.getByRole('link', { name: 'Jouer' }).click();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Roue de la fortune' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Tourner la roue' })
    ).toBeVisible();
  });

  test('un joueur laisse ses coordonnées avec son accord ; l’admin les retrouve et les exporte', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Lancer' }).click();
    const email = page.getByLabel('E-mail');
    await expect(email).toBeVisible({ timeout: 8_000 });
    await email.fill('ada@exemple.test');
    await page.getByRole('button', { name: 'Envoyer' }).click();
    await expect(
      page.getByText(
        'Votre accord est nécessaire pour enregistrer vos coordonnées.'
      )
    ).toBeVisible();
    await page.getByRole('checkbox', { name: /J’accepte/ }).check();
    await page.getByRole('button', { name: 'Envoyer' }).click();
    await expect(
      page.getByText('Merci ! Vos coordonnées sont enregistrées.')
    ).toBeVisible();

    await page.goto('/admin/contacts');
    await expect(page.getByText('ada@exemple.test')).toBeVisible();
    const [telechargement] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exporter en CSV' }).click(),
    ]);
    const chemin = await telechargement.path();
    const { readFileSync } = await import('node:fs');
    const csv = readFileSync(chemin, 'utf8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('ada@exemple.test');
    expect(csv).toContain(';');
  });

  test('la borne s’ouvre plein écran, sans la coquille de l’application', async ({
    page,
  }) => {
    await page.goto('/j/demo');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lancer' })).toBeVisible();
    await expect(page.locator('[data-dwc="bottom-nav"]')).toHaveCount(0);
    await expect(page.locator('[data-dwc="app-footer"]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
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
    await page.goto('/admin/donnees');
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
    await expect(page.locator('.arcade-result-message')).toBeVisible({
      timeout: 8_000,
    });
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

/*
 * LA CSP LAISSE PASSER SUPABASE — éprouvé par le navigateur, pas relu.
 *
 * Relevé en production le 05/11/2026 : `connect-src` ne nommait que PostHog,
 * et les six appels du premier chargement vers le projet Supabase étaient
 * refusés. Rien ne le disait, hors une ligne de console : l'app retombait sur
 * ses valeurs de démonstration, même en ligne. La suite e2e tourne en mode
 * local, sans projet : elle ne pouvait pas le voir.
 *
 * Le projet est ici un hôte FACTICE, servi par `page.route` : la CSP tranche
 * dans la page, AVANT que la requête parte — un appel refusé n'atteint jamais
 * la route et rejette en `TypeError`. Le service worker est écarté pour que
 * rien d'autre que la page ne réponde.
 *
 * LE PROJET NOMMÉ, ET LUI SEUL. Depuis le socle 6.32 (#12), la politique
 * n'ouvre plus `*.supabase.co`, qui laissait passer TOUS les projets du
 * monde : `cspPlugin` lit `VITE_SUPABASE_URL` et n'ouvre que cette origine.
 * Le build e2e la pose sur `PROJET` (playwright.config.ts), comme le
 * déploiement pose le vrai. Le second test tient l'autre moitié : un projet
 * qui n'est pas le nôtre est refusé, et un retour du joker le ferait tomber.
 */
test.describe('@critical la CSP et Supabase', () => {
  test.use({ serviceWorkers: 'block' });

  // La même valeur que `VITE_SUPABASE_URL` dans playwright.config.ts.
  const PROJET = 'https://exemple-e2e.supabase.co';
  const AUTRE_PROJET = 'https://autre-projet-e2e.supabase.co';

  /** Les refus que la page signale en ouvrant une socket vers `url`. */
  const refusDeSocket = (page: Page, url: string) =>
    page.evaluate(
      cible =>
        new Promise<string[]>(resolve => {
          const refus: string[] = [];
          document.addEventListener('securitypolicyviolation', e => {
            refus.push(`${e.violatedDirective} ${e.blockedURI}`);
          });
          try {
            const socket = new WebSocket(cible);
            setTimeout(() => socket.close(), 500);
          } catch (erreur) {
            refus.push(String(erreur));
          }
          setTimeout(() => resolve(refus), 600);
        }),
      url
    );
  // Un PNG d'un pixel : le plus petit fichier qu'un `<img>` accepte.
  const PIXEL = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
  );

  test('un appel au projet, son temps réel et une image de son Storage passent', async ({
    page,
  }) => {
    await page.route(`${PROJET}/rest/v1/**`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: '[]',
      })
    );
    await page.route(`${PROJET}/storage/v1/**`, route =>
      route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL })
    );
    await page.goto('/');

    // Le temps réel n'a pas de route à servir : on lit le refus lui-même,
    // tel que la page le signale. L'hôte n'existe pas, la socket échoue —
    // ce qui compte, c'est qu'elle ait le droit de partir.
    const refusSocket = await refusDeSocket(
      page,
      `${PROJET.replace('https:', 'wss:')}/realtime/v1/websocket`
    );
    expect(refusSocket).toEqual([]);

    const appel = await page.evaluate(async url => {
      try {
        return (await fetch(url)).status;
      } catch (erreur) {
        return String(erreur);
      }
    }, `${PROJET}/rest/v1/tenants`);
    expect(appel).toBe(200);

    const image = await page.evaluate(
      url =>
        new Promise<string>(resolve => {
          const img = new Image();
          img.onload = () => resolve('chargée');
          img.onerror = () => resolve('refusée');
          img.src = url;
        }),
      `${PROJET}/storage/v1/object/public/branding/logo.png`
    );
    expect(image).toBe('chargée');
  });

  test('un autre projet Supabase est refusé', async ({ page }) => {
    // Servi s'il passait : un refus ne peut donc venir que de la CSP.
    await page.route(`${AUTRE_PROJET}/**`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: '[]',
      })
    );
    await page.goto('/');

    const refusSocket = await refusDeSocket(
      page,
      `${AUTRE_PROJET.replace('https:', 'wss:')}/realtime/v1/websocket`
    );
    expect(refusSocket.join(' ')).toContain('connect-src');

    const appel = await page.evaluate(async url => {
      try {
        return (await fetch(url)).status;
      } catch (erreur) {
        return String(erreur);
      }
    }, `${AUTRE_PROJET}/rest/v1/tenants`);
    expect(appel).toMatch(/TypeError/);
  });
});
