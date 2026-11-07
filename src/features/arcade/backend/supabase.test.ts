import { afterEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../../../backend/supabase.ts';
import { fromPostgrest, isRetryable } from './errors.ts';
import { createSupabaseBackend, searchFilter } from './supabase.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Un client de comptoir : `rpc` rend ce qu'on lui dit, `abortSignal` compris. */
function clientRpc(result: {
  data?: unknown;
  error?: unknown;
  status?: number;
}) {
  const call = {
    abortSignal: () => call,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null, status: 200, ...result }).then(
        resolve
      ),
  };
  const rpc = vi.fn(() => call);
  vi.spyOn(supabase, 'getClient').mockResolvedValue({ rpc } as never);
  return rpc;
}

describe('fromPostgrest', () => {
  it('décide sur le code PTxxx des fonctions de 0008, pas sur le texte', () => {
    expect(
      fromPostgrest({ message: 'aucun lot disponible', code: 'PT410' }).code
    ).toBe('sold-out');
    expect(
      fromPostgrest({ message: 'trop de tirages', code: 'PT429' }).code
    ).toBe('rate-limited');
    expect(
      fromPostgrest({ message: 'borne non reconnue', code: 'PT403' }).code
    ).toBe('forbidden');
    expect(
      fromPostgrest({ message: 'modifiée ailleurs', code: 'PT409' }).code
    ).toBe('conflict');
    expect(fromPostgrest({ message: 'x', code: '42501' }).code).toBe(
      'forbidden'
    );
    expect(
      fromPostgrest({ message: 'TypeError: Failed to fetch', code: '' }, 0).code
    ).toBe('network');
  });

  it('rejoue le réseau et le débit, met de côté les refus', () => {
    expect(isRetryable(new TypeError('Failed to fetch'))).toBe(true);
    expect(isRetryable(fromPostgrest({ message: 'x', code: 'PT429' }))).toBe(
      true
    );
    expect(isRetryable(fromPostgrest({ message: 'x', code: 'PT400' }))).toBe(
      false
    );
    expect(isRetryable(fromPostgrest({ message: 'x', code: 'PT403' }))).toBe(
      false
    );
    expect(
      isRetryable(fromPostgrest({ message: 'boum', code: 'XX000' }, 503))
    ).toBe(true);
  });
});

describe('searchFilter', () => {
  it('retire de la recherche la syntaxe du filtre PostgREST', () => {
    expect(searchFilter('  ')).toBeNull();
    const filter = searchFilter('ada),id.eq.1,(x');
    expect(filter).not.toContain('),');
    expect(filter).toContain('fields->>email.ilike.*ada');
  });
});

describe('l’adaptateur Supabase', () => {
  it('relit le tirage rendu par `arcade_spin`', async () => {
    const rpc = clientRpc({
      data: {
        spinId: 'spin_test_0001',
        redeemCode: 'ABCDEF',
        source: 'online',
        playedAt: '2026-11-07T10:00:00+00:00',
        prize: {
          id: 'lot_a',
          label: 'Lot A',
          lose: false,
          weight: 5,
          stock: 2,
          color: '#1f8a70',
          symbol: '★',
        },
      },
    });
    const outcome = await createSupabaseBackend().spin({
      slug: 'alpha',
      spinId: 'spin_test_0001',
      game: 'roue',
      kioskToken: 'k_jeton',
    });
    expect(outcome.prize.label).toBe('Lot A');
    expect(rpc).toHaveBeenCalledWith('arcade_spin', {
      p_slug: 'alpha',
      p_spin_id: 'spin_test_0001',
      p_game: 'roue',
      p_kiosk_token: 'k_jeton',
    });
  });

  it('traduit un refus en code, statut compris (lu par la file d’envoi)', async () => {
    clientRpc({
      error: { message: 'aucun lot disponible', code: 'PT410' },
      status: 410,
    });
    await expect(
      createSupabaseBackend().spin({
        slug: 'alpha',
        spinId: 'spin_test_0002',
        game: 'bandit',
        kioskToken: null,
      })
    ).rejects.toMatchObject({ code: 'sold-out', status: 410 });
  });

  it('refuse une réponse illisible plutôt que d’afficher undefined', async () => {
    clientRpc({ data: { spinId: 'x' } });
    await expect(
      createSupabaseBackend().spin({
        slug: 'alpha',
        spinId: 'spin_test_0003',
        game: 'bandit',
        kioskToken: null,
      })
    ).rejects.toMatchObject({ code: 'unknown' });
  });

  it('envoie le consentement avec le lead', async () => {
    const rpc = clientRpc({ data: { status: 'ok' } });
    await createSupabaseBackend().submitLead(
      {
        id: 'lead_test_0001',
        spinId: 'spin_test_0001',
        fields: { email: 'ada@exemple.test' },
        consentText: 'J’accepte.',
        consentedAt: '2026-11-07T10:00:00.000Z',
      },
      null
    );
    expect(rpc).toHaveBeenCalledWith(
      'arcade_submit_lead',
      expect.objectContaining({
        p_consent_text: 'J’accepte.',
        p_consented_at: '2026-11-07T10:00:00.000Z',
      })
    );
  });
});
