import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArcadeError } from './errors.ts';
import {
  arcadeStore,
  computeStats,
  createLocalBackend,
  migrateV2,
} from './local.ts';

/**
 * Le mode local tire comme le serveur, garde un lead par tirage, et refuse
 * d'écraser une modification faite ailleurs. C'est la moitié locale de ce que
 * `supabase/tests/arcade.test.sql` prouve côté base.
 */
beforeEach(() => {
  localStorage.clear();
  arcadeStore.clear();
});

describe('le backend local', () => {
  it('tire, décompte le stock et journalise le tirage', async () => {
    const backend = createLocalBackend();
    const before = arcadeStore.load();
    const outcome = await backend.spin({
      slug: 'demo',
      spinId: 'spin_local_0001',
      game: 'bandit',
      kioskToken: null,
    });
    const after = arcadeStore.load();
    expect(after.spins).toHaveLength(1);
    const prize = before.prizes.find(p => p.id === outcome.prize.id)!;
    const now = after.prizes.find(p => p.id === outcome.prize.id)!;
    if (!prize.lose && prize.stock !== null)
      expect(now.stock).toBe(prize.stock - 1);
    expect(outcome.redeemCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it('rend le même résultat pour le même identifiant, sans retirer deux fois', async () => {
    const backend = createLocalBackend();
    const request = {
      slug: 'demo',
      spinId: 'spin_local_0002',
      game: 'bandit' as const,
      kioskToken: null,
    };
    const first = await backend.spin(request);
    const second = await backend.spin(request);
    expect(second.redeemCode).toBe(first.redeemCode);
    expect(arcadeStore.load().spins).toHaveLength(1);
  });

  it('annonce l’épuisement plutôt que de tirer dans le vide', async () => {
    const backend = createLocalBackend();
    const state = arcadeStore.load();
    arcadeStore.save({
      ...state,
      prizes: state.prizes.map(p => ({ ...p, stock: 0, lose: false })),
    });
    await expect(
      backend.spin({
        slug: 'demo',
        spinId: 'spin_local_0003',
        game: 'roue',
        kioskToken: null,
      })
    ).rejects.toMatchObject({ code: 'sold-out' });
  });

  it('rattache un lead à son tirage, un seul, et reprend le lot du tirage', async () => {
    const backend = createLocalBackend();
    const outcome = await backend.spin({
      slug: 'demo',
      spinId: 'spin_local_0004',
      game: 'bandit',
      kioskToken: null,
    });
    const lead = {
      id: 'lead_local_0001',
      spinId: outcome.spinId,
      fields: { prenom: 'Ada', email: 'ada@exemple.test' },
      consentText: 'J’accepte.',
      consentedAt: '2026-11-07T10:00:00.000Z',
    };
    await backend.submitLead(lead, null);
    await backend.submitLead(lead, null); // rejeu : sans doublon
    await expect(
      backend.submitLead({ ...lead, id: 'lead_local_0002' }, null)
    ).rejects.toMatchObject({ code: 'conflict' });
    const [saved] = arcadeStore.load().leads;
    expect(arcadeStore.load().leads).toHaveLength(1);
    expect(saved).toMatchObject({
      prizeLabel: outcome.prize.label,
      lose: outcome.prize.lose,
      redeemCode: outcome.redeemCode,
      consentText: 'J’accepte.',
    });
  });

  it('refuse un lead sans tirage réel', async () => {
    await expect(
      createLocalBackend().submitLead(
        {
          id: 'lead_local_0003',
          spinId: 'spin_inconnu_00',
          fields: { email: 'x@exemple.test' },
          consentText: 'J’accepte.',
          consentedAt: '2026-11-07T10:00:00.000Z',
        },
        null
      )
    ).rejects.toBeInstanceOf(ArcadeError);
  });

  it('enregistre en une fois, sans réécrire un stock que l’admin n’a pas touché', async () => {
    const backend = createLocalBackend();
    const snapshot = await backend.adminLoad('local');
    const target = snapshot.prizes.find(p => p.stock !== null)!;
    // La borne joue entre l'ouverture de l'admin et son enregistrement.
    const live = arcadeStore.load();
    arcadeStore.save({
      ...live,
      prizes: live.prizes.map(p =>
        p.id === target.id ? { ...p, stock: 1 } : p
      ),
    });
    const { stock: _ignored, ...withoutStock } = target;
    const saved = await backend.adminSave('local', {
      config: { welcomeMessage: 'Salut' },
      prizes: snapshot.prizes.map(p =>
        p.id === target.id ? { ...withoutStock, label: 'Renommé' } : p
      ),
      expectedUpdatedAt: snapshot.updatedAt,
    });
    const after = saved.prizes.find(p => p.id === target.id)!;
    expect(after).toMatchObject({ label: 'Renommé', stock: 1 });
    expect(saved.config.welcomeMessage).toBe('Salut');
  });

  it('refuse d’écraser une version plus récente', async () => {
    const backend = createLocalBackend();
    const snapshot = await backend.adminLoad('local');
    await backend.adminSave('local', {
      config: { welcomeMessage: 'Premier onglet' },
      prizes: null,
      expectedUpdatedAt: snapshot.updatedAt,
    });
    await expect(
      backend.adminSave('local', {
        config: { welcomeMessage: 'Second onglet' },
        prizes: null,
        expectedUpdatedAt: snapshot.updatedAt,
      })
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('cherche et pagine les contacts, du plus récent au plus ancien', async () => {
    const backend = createLocalBackend();
    const state = arcadeStore.load();
    arcadeStore.save({
      ...state,
      leads: ['2026-11-01', '2026-11-03', '2026-11-02'].map((day, i) => ({
        id: `lead_${i}`,
        spinId: null,
        createdAt: `${day}T10:00:00.000Z`,
        prizeLabel: 'Goodies',
        lose: false,
        game: 'bandit' as const,
        redeemCode: `CODE${i}`,
        fields: { prenom: i === 1 ? 'Hélène' : 'Ada' },
        consentAt: null,
        consentText: null,
        source: 'online' as const,
      })),
    });
    const page = await backend.listLeads('local', {
      page: 0,
      pageSize: 2,
      search: '',
    });
    expect(page.total).toBe(3);
    expect(page.rows.map(r => r.id)).toEqual(['lead_1', 'lead_2']);
    const found = await backend.listLeads('local', {
      page: 0,
      pageSize: 10,
      search: 'hél',
    });
    expect(found.rows.map(r => r.id)).toEqual(['lead_1']);
  });
});

describe('migrateV2', () => {
  it('relit l’instantané plat d’avant 0008 sans rien perdre', () => {
    const state = migrateV2({
      activeGame: 'roue',
      welcomeMessage: 'Bonjour',
      winMessage: 'Gagné {lot}',
      loseMessage: 'Perdu',
      leadFormEnabled: true,
      leadFields: ['prenom', 'inconnu'],
      prizes: [
        {
          id: 'lot_1',
          label: 'Lot',
          weight: 3,
          stock: 2,
          color: 'rouge',
          symbol: 'L',
          lose: false,
        },
      ],
      leads: [
        {
          id: 'lead_1',
          createdAt: '2026-10-31T08:00:00.000Z',
          prizeId: 'lot_1',
          prizeLabel: 'Lot',
          game: 'roue',
          fields: { prenom: 'Ada' },
        },
      ],
      wallpaperDesktop: 'http://non-chiffre.test/fond.jpg',
      wallpaperMobile: null,
      logoUrl: 'https://exemple.test/logo.png',
    });
    expect(state.config).toMatchObject({
      activeGame: 'roue',
      welcomeMessage: 'Bonjour',
      leadFields: ['prenom'],
      wallpaperDesktop: null,
      logoUrl: 'https://exemple.test/logo.png',
    });
    expect(state.prizes[0]!.color).toBe('#1f8a70');
    expect(state.leads[0]).toMatchObject({
      id: 'lead_1',
      spinId: null,
      consentAt: null,
    });
  });
});

describe('computeStats', () => {
  it('compte parties, gains, contacts et répartit par jour et par heure', () => {
    const now = new Date('2026-11-07T15:00:00.000Z');
    const stats = computeStats(
      {
        spins: [
          {
            id: 's1',
            prizeId: 'a',
            prizeLabel: 'Goodies',
            lose: false,
            game: 'bandit',
            redeemCode: 'AAAAAA',
            source: 'online',
            playedAt: '2026-11-07T09:30:00.000Z',
          },
          {
            id: 's2',
            prizeId: 'b',
            prizeLabel: 'Perdu',
            lose: true,
            game: 'bandit',
            redeemCode: 'BBBBBB',
            source: 'offline',
            playedAt: '2026-11-06T09:30:00.000Z',
          },
          {
            id: 's3',
            prizeId: 'b',
            prizeLabel: 'Perdu',
            lose: true,
            game: 'bandit',
            redeemCode: 'CCCCCC',
            source: 'online',
            playedAt: '2026-09-01T09:30:00.000Z',
          },
        ],
        leads: [],
      },
      7,
      'UTC',
      now
    );
    expect(stats.totals).toEqual({
      spins: 2,
      wins: 1,
      leads: 0,
      offline: 1,
      oversold: 0,
    });
    expect(stats.byDay).toHaveLength(7);
    expect(stats.byDay.at(-1)).toMatchObject({
      day: '2026-11-07',
      spins: 1,
      wins: 1,
    });
    expect(stats.byHour[9]).toBe(2);
  });
});

describe('la première lecture', () => {
  it('écrit la graine : deux lectures parlent des mêmes lots et du même jeton', async () => {
    // Relevé du 07/11/2026 en e2e : chaque `load()` d'un stockage vide rendait
    // une graine neuve, horodatée à la milliseconde ; l'admin ouverte puis
    // enregistrée se voyait refuser pour « modifiée ailleurs ».
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-07T10:00:00.000Z'));
      const backend = createLocalBackend();
      const first = await backend.adminLoad('local');
      vi.setSystemTime(new Date('2026-11-07T10:00:05.000Z'));
      const second = await backend.adminLoad('local');
      expect(second.updatedAt).toBe(first.updatedAt);
      expect(second.prizes.map(p => p.id)).toEqual(first.prizes.map(p => p.id));
    } finally {
      vi.useRealTimers();
    }
  });
});
