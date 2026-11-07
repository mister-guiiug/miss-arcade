import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArcadeError } from '../backend/errors.ts';
import type { ArcadeBackend } from '../backend/ports.ts';
import type { LeadSubmission, OfflineSpin } from '../model.ts';
import { createOutbox } from './outbox.ts';

/**
 * Ce que ces tests figent : l'ORDRE (le tirage hors ligne part avant le lead
 * qui s'y rattache), la persistance (une file rechargée renvoie ce qu'elle
 * gardait), et le tri entre ce qu'on rejoue (réseau) et ce qu'on met de côté
 * (refus du serveur), sans jamais rien perdre en silence.
 */

const spin = (id: string): OfflineSpin => ({
  spinId: `spin_${id}_000000`,
  prizeId: 'lot_a',
  prizeLabel: 'Lot A',
  lose: false,
  game: 'bandit',
  redeemCode: 'ABCDEF',
  playedAt: '2026-11-07T10:00:00.000Z',
});

const lead = (id: string, spinId: string): LeadSubmission => ({
  id: `lead_${id}_000000`,
  spinId,
  fields: { email: 'ada@exemple.test' },
  consentText: 'J’accepte.',
  consentedAt: '2026-11-07T10:00:05.000Z',
});

function fakeBackend(overrides: Partial<ArcadeBackend> = {}) {
  const calls: string[] = [];
  const backend = {
    kind: 'supabase',
    recordOfflineSpin: vi.fn(async (s: OfflineSpin) => {
      calls.push(`spin:${s.spinId}`);
      return { oversold: false };
    }),
    submitLead: vi.fn(async (l: LeadSubmission) => {
      calls.push(`lead:${l.id}`);
    }),
    ...overrides,
  } as unknown as ArcadeBackend;
  return { backend, calls };
}

let online = true;
const env = { addEventListener: vi.fn(), removeEventListener: vi.fn() };

function outboxFor(backend: ArcadeBackend, token: string | null = 'k_jeton') {
  return createOutbox({
    backend,
    kioskToken: () => token,
    prefix: 'test-envoi-',
    isOnline: () => online,
    env,
    // Le rejeu programmé n'a rien à faire dans un test : on draine à la main.
    setTimeout: (() => 0) as unknown as typeof setTimeout,
    clearTimeout: (() => undefined) as unknown as typeof clearTimeout,
  });
}

beforeEach(() => {
  localStorage.clear();
  online = true;
});

describe('la file d’envoi', () => {
  it('envoie dans l’ordre : le tirage hors ligne, puis son lead', async () => {
    const { backend, calls } = fakeBackend();
    const outbox = outboxFor(backend);
    online = false;
    outbox.push({ kind: 'spin', spin: spin('a') });
    outbox.push({ kind: 'lead', lead: lead('a', 'spin_a_000000') });
    expect(outbox.getSnapshot()).toMatchObject({
      status: 'offline',
      pending: 2,
    });

    online = true;
    await outbox.flush();
    expect(calls).toEqual(['spin:spin_a_000000', 'lead:lead_a_000000']);
    expect(outbox.getSnapshot()).toMatchObject({
      status: 'synced',
      pending: 0,
    });
  });

  it('garde ses éléments d’une ouverture à l’autre (la borne redémarrée)', async () => {
    const { backend, calls } = fakeBackend();
    online = false;
    outboxFor(backend).push({ kind: 'spin', spin: spin('b') });

    online = true;
    const reopened = outboxFor(backend);
    expect(reopened.getSnapshot().pending).toBe(1);
    await reopened.flush();
    expect(calls).toEqual(['spin:spin_b_000000']);
  });

  it('rejoue un échec réseau sans le perdre, ni passer devant', async () => {
    let fail = true;
    const { backend, calls } = fakeBackend({
      recordOfflineSpin: vi.fn(async (s: OfflineSpin) => {
        if (fail) throw new TypeError('Failed to fetch');
        calls.push(`spin:${s.spinId}`);
        return { oversold: false };
      }),
    });
    const outbox = outboxFor(backend);
    online = false;
    outbox.push({ kind: 'spin', spin: spin('c') });
    outbox.push({ kind: 'lead', lead: lead('c', 'spin_c_000000') });
    online = true;
    await outbox.flush();
    expect(outbox.getSnapshot()).toMatchObject({ pending: 2, dead: 0 });
    expect(calls).toEqual([]);

    fail = false;
    await outbox.flush();
    expect(calls).toEqual(['spin:spin_c_000000', 'lead:lead_c_000000']);
  });

  it('met de côté un refus du serveur et continue avec la suite', async () => {
    const { backend, calls } = fakeBackend({
      submitLead: vi.fn(async (l: LeadSubmission) => {
        if (l.id.startsWith('lead_refuse')) {
          throw new ArcadeError('invalid', 'adresse e-mail invalide', 400);
        }
        calls.push(`lead:${l.id}`);
      }),
    });
    const outbox = outboxFor(backend);
    online = false;
    outbox.push({ kind: 'lead', lead: lead('refuse', 'spin_x_000000') });
    outbox.push({ kind: 'lead', lead: lead('ok', 'spin_y_000000') });
    online = true;
    await outbox.flush();

    expect(calls).toEqual(['lead:lead_ok_000000']);
    expect(outbox.getSnapshot()).toMatchObject({
      status: 'error',
      dead: 1,
      lastError: 'invalid',
    });
    expect(outbox.deadLetters()[0]!.payload).toMatchObject({ kind: 'lead' });
  });

  it('refuse d’envoyer un tirage hors ligne sans jeton de borne', async () => {
    const { backend } = fakeBackend();
    const outbox = outboxFor(backend, null);
    online = false;
    outbox.push({ kind: 'spin', spin: spin('d') });
    online = true;
    await outbox.flush();
    expect(backend.recordOfflineSpin).not.toHaveBeenCalled();
    expect(outbox.getSnapshot()).toMatchObject({
      dead: 1,
      lastError: 'forbidden',
    });
  });

  it('relance les envois refusés à la demande', async () => {
    let refuse = true;
    const { backend, calls } = fakeBackend({
      submitLead: vi.fn(async (l: LeadSubmission) => {
        if (refuse) throw new ArcadeError('forbidden', 'borne révoquée', 403);
        calls.push(`lead:${l.id}`);
      }),
    });
    const outbox = outboxFor(backend);
    online = false;
    outbox.push({ kind: 'lead', lead: lead('e', 'spin_e_000000') });
    online = true;
    await outbox.flush();
    expect(outbox.getSnapshot().dead).toBe(1);

    refuse = false;
    online = false;
    expect(outbox.retryDead()).toBe(1);
    online = true;
    await outbox.flush();
    expect(calls).toEqual(['lead:lead_e_000000']);
    expect(outbox.getSnapshot()).toMatchObject({ status: 'synced', dead: 0 });
  });

  it('dit quand elle est pleine au lieu de jeter', () => {
    const { backend } = fakeBackend();
    const outbox = createOutbox({
      backend,
      kioskToken: () => 'k',
      prefix: 'test-plein-',
      isOnline: () => false,
      env,
      maxQueueSize: 1,
    });
    expect(outbox.push({ kind: 'spin', spin: spin('f') })).toBe(true);
    expect(outbox.push({ kind: 'spin', spin: spin('g') })).toBe(false);
  });
});
