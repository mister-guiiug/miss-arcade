import { z } from 'zod';
import { createId } from '@mister-guiiug/dev-pwa-config/id';

/**
 * Deux types de jeu, un contrat de lots commun. Le bandit manchot et la roue
 * tirent dans la même liste pondérée : changer de type ne réécrit pas les
 * lots — c'est ce que demande un stand qui alterne le matin et l'après-midi.
 *
 * Mesuré contre l'offre digitale-instore (lots + pondération + formulaire +
 * hors ligne) : sans stock et sans poids, le « jeu » n'est qu'une animation.
 */
export const gameTypeSchema = z.enum(['bandit', 'roue']);
export type GameType = z.infer<typeof gameTypeSchema>;

export const prizeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  /** Poids relatif dans le tirage (≥ 0). Zéro = jamais tiré, utile pour un lot épuisé affiché. */
  weight: z.number().int().min(0).max(10_000),
  /** `null` = stock illimité. */
  stock: z.number().int().min(0).nullable(),
  /** Teinte CSS pour la roue / les bobines. */
  color: z.string().min(1).max(32),
  /** Symbole court affiché sur les bobines (emoji ou 1–2 caractères). */
  symbol: z.string().min(1).max(4),
  /** `true` = case « perdant » : message d'échec, pas de décrément de stock utile. */
  lose: z.boolean().default(false),
});
export type Prize = z.infer<typeof prizeSchema>;

export const leadFieldSchema = z.enum(['prenom', 'nom', 'email', 'telephone']);
export type LeadField = z.infer<typeof leadFieldSchema>;

export const leadSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  prizeId: z.string().nullable(),
  prizeLabel: z.string(),
  game: gameTypeSchema,
  fields: z.record(z.string(), z.string()),
});
export type Lead = z.infer<typeof leadSchema>;

export const arcadeSchema = z.object({
  activeGame: gameTypeSchema,
  welcomeMessage: z.string().max(500),
  winMessage: z.string().max(500),
  loseMessage: z.string().max(500),
  leadFormEnabled: z.boolean(),
  leadFields: z.array(leadFieldSchema),
  prizes: z.array(prizeSchema).min(1).max(12),
  leads: z.array(leadSchema),
});
export type ArcadeSnapshot = z.infer<typeof arcadeSchema>;

/** Lots de démonstration : un perdant majoritaire, trois lots rares. */
export function defaultArcade(): ArcadeSnapshot {
  return {
    activeGame: 'bandit',
    welcomeMessage: 'Tentez votre chance !',
    winMessage: 'Bravo — vous gagnez {lot} !',
    loseMessage: 'Pas de chance cette fois… Retentez plus tard !',
    leadFormEnabled: true,
    leadFields: ['prenom', 'email'],
    prizes: [
      {
        id: createId('lot'),
        label: 'Perdu',
        weight: 50,
        stock: null,
        color: '#3d4a5c',
        symbol: '·',
        lose: true,
      },
      {
        id: createId('lot'),
        label: 'Goodies',
        weight: 30,
        stock: 40,
        color: '#1f8a70',
        symbol: '★',
        lose: false,
      },
      {
        id: createId('lot'),
        label: 'Bon -10 %',
        weight: 15,
        stock: 20,
        color: '#c45c26',
        symbol: '%',
        lose: false,
      },
      {
        id: createId('lot'),
        label: 'Grand lot',
        weight: 5,
        stock: 3,
        color: '#c9a227',
        symbol: '◆',
        lose: false,
      },
    ],
    leads: [],
  };
}

/**
 * Tirage pondéré parmi les lots encore en stock. Un lot à stock 0 ou poids 0
 * est ignoré. Rend `null` si plus rien n'est tirable.
 */
export function drawPrize(
  prizes: Prize[],
  random: () => number = Math.random
): Prize | null {
  const pool = prizes.filter(
    p => p.weight > 0 && (p.stock === null || p.stock > 0)
  );
  const total = pool.reduce((sum, p) => sum + p.weight, 0);
  if (total <= 0) return null;
  let cursor = random() * total;
  for (const prize of pool) {
    cursor -= prize.weight;
    if (cursor <= 0) return prize;
  }
  return pool.at(-1) ?? null;
}

/** Remplace `{lot}` dans un message de gain. */
export function formatPrizeMessage(template: string, label: string): string {
  return template.replaceAll('{lot}', label);
}
