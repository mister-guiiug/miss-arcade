import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicGame, SpinOutcome } from '../model.ts';
import { defaultConfig } from '../model.ts';

/**
 * Les trois chemins d'un tirage en mode serveur : en ligne (le serveur
 * décide), hors ligne sur une borne appairée (tirage local mis en file), hors
 * ligne sans borne (le jeu le dit). Le backend est un double ; la file d'envoi
 * et le cache sont les vrais.
 */
const fake = vi.hoisted(() => ({
  spin: vi.fn(),
  loadGame: vi.fn(),
  recordOfflineSpin: vi.fn(async () => ({ oversold: false })),
  submitLead: vi.fn(async () => undefined),
}));

vi.mock('../../../backend/index.ts', () => ({
  arcade: { kind: 'supabase', capabilities: {}, ...fake },
  coverage: { kind: 'supabase', remote: ['arcade'], local: [] },
}));

const { usePlay } = await import('./play-store.ts');
const { pair, resetDevice } = await import('../kiosk/device.ts');
const { outbox } = await import('../sync/index.ts');
const { readCachedGame, writeCachedGame } = await import('./cache.ts');

const game: PublicGame = {
  tenant: { id: 't1', slug: 'alpha', name: 'Alpha' },
  config: defaultConfig(),
  prizes: [
    {
      id: 'lot_g',
      label: 'Goodies',
      weight: 100,
      stock: 3,
      color: '#1f8a70',
      symbol: '★',
      drawing: null,
      image: null,
      lose: false,
    },
  ],
};

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

beforeEach(async () => {
  localStorage.clear();
  resetDevice();
  outbox.clear();
  setOnline(true);
  vi.clearAllMocks();
  fake.loadGame.mockResolvedValue(game);
  usePlay.setState({
    slug: null,
    game: null,
    status: 'idle',
    outcome: null,
    busy: false,
  });
  await usePlay.getState().load('alpha');
});

afterEach(() => {
  setOnline(true);
});

describe('le jeu en mode serveur', () => {
  it('en ligne, le serveur décide, et le stock rendu met le cache à jour', async () => {
    const outcome: SpinOutcome = {
      spinId: 'spin_x_000000',
      redeemCode: 'ABCDEF',
      source: 'online',
      playedAt: '2026-11-07T10:00:00Z',
      prize: { ...game.prizes[0]!, stock: 2 },
    };
    fake.spin.mockResolvedValue(outcome);
    const result = await usePlay.getState().spin();
    expect(result).toEqual(outcome);
    expect(readCachedGame('alpha')?.game.prizes[0]!.stock).toBe(2);
  });

  it('un échec réseau est retenté avec le MÊME identifiant (le serveur rend le même tirage)', async () => {
    fake.spin
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        spinId: 'ignoré',
        redeemCode: 'ABCDEF',
        source: 'online',
        playedAt: '2026-11-07T10:00:00Z',
        prize: game.prizes[0],
      });
    await usePlay.getState().spin();
    const ids = fake.spin.mock.calls.map(
      ([request]) => (request as { spinId: string }).spinId
    );
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it('hors ligne, une borne appairée tire sur sa config et met le tirage en file', async () => {
    pair({
      slug: 'alpha',
      token: 'k_jeton',
      kioskId: 'kiosk-1',
      label: 'Stand',
      tenantName: 'Alpha',
      pairedAt: '2026-11-07T09:00:00Z',
    });
    setOnline(false);
    const result = await usePlay.getState().spin();
    expect(typeof result).toBe('object');
    const outcome = result as SpinOutcome;
    expect(outcome.source).toBe('offline');
    expect(outcome.prize.id).toBe('lot_g');
    expect(fake.spin).not.toHaveBeenCalled();
    expect(outbox.pendingItems().map(e => e.payload.kind)).toEqual(['spin']);
    expect(readCachedGame('alpha')?.game.prizes[0]!.stock).toBe(2);

    // Le lead suit son tirage dans la même file, consentement compris.
    expect(usePlay.getState().submitLead({ email: ' ada@exemple.test ' })).toBe(
      'queued'
    );
    const [, queued] = outbox.pendingItems();
    expect(queued!.payload).toMatchObject({
      kind: 'lead',
      lead: {
        spinId: outcome.spinId,
        fields: { email: 'ada@exemple.test' },
        consentText: game.config.consentText,
      },
    });
  });

  it('hors ligne, sans borne appairée, le jeu demande une connexion', async () => {
    setOnline(false);
    expect(await usePlay.getState().spin()).toBe('offline-required');
    expect(outbox.pendingItems()).toEqual([]);
  });

  it('un tirage refusé par le serveur rend son code, sans basculer hors ligne', async () => {
    pair({
      slug: 'alpha',
      token: 'k_jeton',
      kioskId: 'kiosk-1',
      label: 'Stand',
      tenantName: 'Alpha',
      pairedAt: '2026-11-07T09:00:00Z',
    });
    const { ArcadeError } = await import('../backend/errors.ts');
    fake.spin.mockRejectedValue(new ArcadeError('sold-out', 'aucun lot', 410));
    expect(await usePlay.getState().spin()).toBe('sold-out');
    expect(outbox.pendingItems()).toEqual([]);
  });

  it('sans réseau au chargement, la borne joue sur sa dernière config connue', async () => {
    writeCachedGame('beta', {
      ...game,
      tenant: { ...game.tenant, slug: 'beta' },
    });
    fake.loadGame.mockRejectedValue(new TypeError('Failed to fetch'));
    await usePlay.getState().load('beta');
    expect(usePlay.getState()).toMatchObject({
      status: 'ready',
      fromCache: true,
    });
  });

  it('une borne introuvable le dit, sans cache à servir', async () => {
    const { ArcadeError } = await import('../backend/errors.ts');
    fake.loadGame.mockRejectedValue(
      new ArcadeError('not-found', 'borne inconnue', 404)
    );
    await usePlay.getState().load('gamma');
    expect(usePlay.getState()).toMatchObject({
      status: 'error',
      error: 'not-found',
    });
  });
});
