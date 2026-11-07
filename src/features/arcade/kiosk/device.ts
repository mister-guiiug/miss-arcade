import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import { createStore } from '@mister-guiiug/dev-pwa-config/storage';

/**
 * L'APPAREIL : est-il une borne, de quel client, et quel code protège sa
 * sortie ? Gardé sur l'appareil seul (`localStorage`, préfixe de l'app), jamais
 * envoyé.
 *
 * Le jeton d'appairage autorise une chose : déclarer des tirages faits hors
 * ligne pour SON client. Il se révoque depuis l'admin (onglet Bornes).
 *
 * Le code PIN n'est pas une frontière de sécurité, c'est une porte : il
 * empêche le visiteur du stand de sortir du mode borne ou d'ouvrir
 * l'administration locale. Il est gardé haché et salé, pour qu'un coup d'œil
 * aux outils du navigateur ne le donne pas.
 */
const pairingSchema = z.object({
  slug: z.string().min(1),
  /** `null` en mode local : aucun serveur à qui présenter un jeton. */
  token: z.string().nullable(),
  kioskId: z.string().nullable(),
  label: z.string(),
  tenantName: z.string(),
  pairedAt: z.string(),
});
export type Pairing = z.infer<typeof pairingSchema>;

const deviceSchema = z.object({
  pairing: pairingSchema.nullable(),
  pinHash: z.string().nullable(),
  pinSalt: z.string().nullable(),
});
export type DeviceState = z.infer<typeof deviceSchema>;

const EMPTY: DeviceState = { pairing: null, pinHash: null, pinSalt: null };

const store = createStore('miss-arcade-borne-');
const listeners = new Set<() => void>();
let cache: DeviceState | null = null;

export function getDevice(): DeviceState {
  if (cache) return cache;
  const parsed = deviceSchema.safeParse(store.get('appareil', EMPTY));
  cache = parsed.success ? parsed.data : EMPTY;
  return cache;
}

function setDevice(next: DeviceState) {
  cache = next;
  store.set('appareil', next);
  for (const listener of listeners) listener();
}

export function subscribeDevice(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDevice(): DeviceState {
  return useSyncExternalStore(subscribeDevice, getDevice, getDevice);
}

/** Le jeton de la borne SI elle est appairée à ce client. */
export function kioskTokenFor(slug: string | null): string | null {
  const { pairing } = getDevice();
  if (!pairing || !slug || pairing.slug !== slug) return null;
  return pairing.token;
}

/** Le jeton courant, quel que soit l'écran : c'est ce que lit la file d'envoi. */
export function currentKioskToken(): string | null {
  return getDevice().pairing?.token ?? null;
}

export function pair(pairing: Pairing): void {
  setDevice({ ...getDevice(), pairing });
}

export function unpair(): void {
  setDevice({ ...getDevice(), pairing: null });
}

async function digest(pin: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), b =>
    b.toString(16).padStart(2, '0')
  ).join('');
}

export const PIN_PATTERN = /^\d{4,8}$/;

export async function setPin(pin: string): Promise<void> {
  if (!PIN_PATTERN.test(pin)) throw new Error('code de 4 à 8 chiffres');
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), b =>
    b.toString(16).padStart(2, '0')
  ).join('');
  setDevice({
    ...getDevice(),
    pinSalt: salt,
    pinHash: await digest(pin, salt),
  });
}

export function clearPin(): void {
  setDevice({ ...getDevice(), pinSalt: null, pinHash: null });
}

export async function verifyPin(pin: string): Promise<boolean> {
  const { pinHash, pinSalt } = getDevice();
  if (!pinHash || !pinSalt) return true;
  return (await digest(pin, pinSalt)) === pinHash;
}

/** Pour les tests : oublier l'appareil. */
export function resetDevice(): void {
  store.remove('appareil');
  cache = null;
  for (const listener of listeners) listener();
}

/**
 * Lit un jeton d'appairage dans le FRAGMENT (`#borne=k_…`) : jamais dans la
 * query, qui part dans les journaux du serveur et dans l'en-tête Referer.
 */
export function readPairingToken(hash: string): string | null {
  const match = /(?:^#|&)borne=(k_[0-9a-f]{64})(?:&|$)/.exec(hash);
  return match?.[1] ?? null;
}
