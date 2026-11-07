import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPin,
  getDevice,
  kioskTokenFor,
  pair,
  readPairingToken,
  resetDevice,
  setPin,
  verifyPin,
} from './device.ts';

const TOKEN = `k_${'a1'.repeat(32)}`;

beforeEach(() => {
  localStorage.clear();
  resetDevice();
});

describe('l’appareil', () => {
  it('lit le jeton d’appairage dans le fragment, et nulle part ailleurs', () => {
    expect(readPairingToken(`#borne=${TOKEN}`)).toBe(TOKEN);
    expect(readPairingToken(`#autre=1&borne=${TOKEN}`)).toBe(TOKEN);
    expect(readPairingToken('#borne=k_court')).toBeNull();
    expect(readPairingToken('')).toBeNull();
  });

  it('ne présente son jeton qu’au client auquel il est appairé', () => {
    pair({
      slug: 'alpha',
      token: TOKEN,
      kioskId: 'kiosk-1',
      label: 'Stand',
      tenantName: 'Alpha',
      pairedAt: '2026-11-07T09:00:00Z',
    });
    expect(kioskTokenFor('alpha')).toBe(TOKEN);
    expect(kioskTokenFor('beta')).toBeNull();
    expect(getDevice().pairing?.label).toBe('Stand');
  });

  it('garde le code haché et salé, et le vérifie', async () => {
    expect(await verifyPin('1234')).toBe(true); // pas de code : porte ouverte
    await setPin('2468');
    const { pinHash, pinSalt } = getDevice();
    expect(pinHash).toMatch(/^[0-9a-f]{64}$/);
    expect(pinSalt).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(getDevice())).not.toContain('2468');
    expect(await verifyPin('2468')).toBe(true);
    expect(await verifyPin('1357')).toBe(false);
    clearPin();
    expect(await verifyPin('1357')).toBe(true);
  });

  it('refuse un code qui n’a pas 4 à 8 chiffres', async () => {
    await expect(setPin('12')).rejects.toThrow();
    await expect(setPin('12ab')).rejects.toThrow();
  });
});
