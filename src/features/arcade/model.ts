import { z } from 'zod';
import { createUuid } from '@mister-guiiug/dev-pwa-config/id';
import { generateCode } from '@mister-guiiug/dev-pwa-config/pairing';

/**
 * LE CONTRAT DE L'ARCADE, décrit une fois par des schémas dont les types sont
 * DÉRIVÉS. Ils servent trois fois : ils typent le code, ils valident ce que
 * rend le serveur (un `jsonb` n'a pas de type côté client), et ils relisent ce
 * qui remonte du stockage local.
 *
 * Deux jeux, une liste de lots commune : changer de jeu ne réécrit pas les
 * lots, c'est ce que demande un stand qui alterne le matin et l'après-midi.
 */

export const GAME_TYPES = ['bandit', 'roue'] as const;
export const gameTypeSchema = z.enum(GAME_TYPES);
export type GameType = z.infer<typeof gameTypeSchema>;

/**
 * LES JEUX D'ICÔNES : comment un lot se montre sur les bobines et la roue.
 * `symboles`, le texte libre de chaque lot (l'affichage d'avant 0009) ;
 * `dessin`, une illustration du catalogue embarqué dans l'application ;
 * `perso`, une image envoyée par l'admin. Chaque lot garde ses trois valeurs :
 * changer de jeu d'icônes n'efface rien (ADR 0016).
 */
export const ICON_SETS = ['symboles', 'dessin', 'perso'] as const;
export const iconSetSchema = z.enum(ICON_SETS);
export type IconSet = z.infer<typeof iconSetSchema>;

export const LEAD_FIELDS = ['prenom', 'nom', 'email', 'telephone'] as const;
export const leadFieldSchema = z.enum(LEAD_FIELDS);
export type LeadField = z.infer<typeof leadFieldSchema>;

/** Six chiffres hexa : la teinte finit dans un `conic-gradient`. */
export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Une image de marque finit dans un `url(...)` CSS : https, rien d'autre. */
const imageUrlSchema = z
  .string()
  .max(2000)
  .regex(/^https:\/\//)
  .nullable();

export const prizeSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(80),
  /** Poids relatif dans le tirage. Zéro : jamais tiré, mais affiché. */
  weight: z.number().int().min(0).max(10_000),
  /** `null` : stock illimité. */
  stock: z.number().int().min(0).nullable(),
  color: colorSchema,
  /** Symbole des bobines et des parts de la roue (emoji ou 1 à 4 caractères). */
  symbol: z.string().min(1).max(4),
  /**
   * L'illustration du jeu `dessin`, par son nom. Le nom n'est pas une liste
   * fermée ici : un nom inconnu de cette version retombe sur une illustration
   * par défaut, au lieu de refuser toute la configuration.
   *
   * Les deux champs qui suivent ont une valeur par défaut : un serveur d'avant
   * 0009, ou un jeu gardé en cache par une borne, ne les rend pas.
   */
  drawing: z
    .string()
    .regex(/^[a-z0-9-]{1,32}$/)
    .nullable()
    .default(null),
  /** L'image du jeu `perso` ; `null` : le symbole la remplace. */
  image: imageUrlSchema.default(null),
  /** Case perdante : message d'échec, aucun stock à décompter. */
  lose: z.boolean(),
});
export type Prize = z.infer<typeof prizeSchema>;

export const gameConfigSchema = z.object({
  activeGame: gameTypeSchema,
  iconSet: iconSetSchema.default('symboles'),
  welcomeMessage: z.string().max(500),
  winMessage: z.string().max(500),
  loseMessage: z.string().max(500),
  leadFormEnabled: z.boolean(),
  leadFields: z.array(leadFieldSchema),
  leadRequired: z.array(leadFieldSchema),
  /** Le texte auquel le joueur consent ; gardé avec son lead. */
  consentText: z.string().min(1).max(1000),
  /** Où exercer ses droits : une adresse ou un lien. */
  privacyContact: z.string().max(200).nullable(),
  retentionDays: z.number().int().min(30).max(1825),
  /** Retour à l'accueil d'une borne laissée sans geste. */
  idleSeconds: z.number().int().min(15).max(600),
  soundEnabled: z.boolean(),
  /** Absent de la vue publique : le serveur ne le rend qu'à l'admin. */
  maxSpinsPerMinute: z.number().int().min(1).max(600).default(30),
  wallpaperDesktop: imageUrlSchema,
  wallpaperMobile: imageUrlSchema,
  logoUrl: imageUrlSchema,
});
export type GameConfig = z.infer<typeof gameConfigSchema>;

export const tenantSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
});
export type Tenant = z.infer<typeof tenantSchema>;

export const tenantSummarySchema = tenantSchema.extend({
  published: z.boolean(),
});
export type TenantSummary = z.infer<typeof tenantSummarySchema>;

/** Tout ce qu'une borne doit savoir pour jouer, en un seul objet. */
export const publicGameSchema = z.object({
  tenant: tenantSchema,
  config: gameConfigSchema,
  prizes: z.array(prizeSchema),
});
export type PublicGame = z.infer<typeof publicGameSchema>;

/** L'alphabet `antiConfusion` du socle : ni 0/O ni 1/I. */
export const REDEEM_CODE = /^[A-HJ-NP-Z2-9]{6}$/;

export const spinSourceSchema = z.enum(['online', 'offline']);
export type SpinSource = z.infer<typeof spinSourceSchema>;

export const spinOutcomeSchema = z.object({
  spinId: z.string().min(8).max(64),
  redeemCode: z.string().regex(REDEEM_CODE),
  source: spinSourceSchema,
  playedAt: z.string(),
  /** Le lot tel que le serveur l'a tiré ; `id` vide s'il a été supprimé depuis. */
  prize: prizeSchema.extend({ id: z.string().max(64) }),
});
export type SpinOutcome = z.infer<typeof spinOutcomeSchema>;

/** Un tirage fait hors ligne par une borne, à déclarer au retour du réseau. */
export const offlineSpinSchema = z.object({
  spinId: z.string().min(8).max(64),
  prizeId: z.string().nullable(),
  prizeLabel: z.string().min(1).max(80),
  lose: z.boolean(),
  game: gameTypeSchema,
  redeemCode: z.string().regex(REDEEM_CODE),
  playedAt: z.string(),
});
export type OfflineSpin = z.infer<typeof offlineSpinSchema>;

/** Les coordonnées d'un joueur, gagnant ou perdant, et son consentement. */
export const leadSubmissionSchema = z.object({
  id: z.string().min(8).max(64),
  spinId: z.string().min(8).max(64),
  fields: z.partialRecord(leadFieldSchema, z.string().max(120)),
  consentText: z.string().min(1).max(1000),
  consentedAt: z.string(),
});
export type LeadSubmission = z.infer<typeof leadSubmissionSchema>;

/** Un lead tel que l'admin le lit (et tel que le mode local le garde). */
export const leadRecordSchema = z.object({
  id: z.string().min(1),
  spinId: z.string().nullable(),
  createdAt: z.string(),
  prizeLabel: z.string(),
  lose: z.boolean().nullable(),
  game: gameTypeSchema,
  redeemCode: z.string().nullable(),
  fields: z.record(z.string(), z.string()),
  consentAt: z.string().nullable(),
  consentText: z.string().nullable(),
  source: spinSourceSchema,
});
export type LeadRecord = z.infer<typeof leadRecordSchema>;

export const statsSchema = z.object({
  since: z.string(),
  totals: z.object({
    spins: z.number(),
    wins: z.number(),
    leads: z.number(),
    offline: z.number(),
    oversold: z.number(),
  }),
  byPrize: z.array(
    z.object({ label: z.string(), lose: z.boolean(), count: z.number() })
  ),
  byDay: z.array(
    z.object({
      day: z.string(),
      spins: z.number(),
      wins: z.number(),
      leads: z.number(),
    })
  ),
  byHour: z.array(z.number()).length(24),
});
export type Stats = z.infer<typeof statsSchema>;

export const adminSnapshotSchema = z.object({
  tenant: tenantSummarySchema,
  config: gameConfigSchema,
  prizes: z.array(prizeSchema),
  /**
   * Le jeton de concurrence, gardé TEL QUEL : le reformater par `Date`
   * perdrait les microsecondes de Postgres, et la sauvegarde suivante serait
   * refusée comme « modifiée ailleurs ».
   */
  updatedAt: z.string(),
});
export type AdminSnapshot = z.infer<typeof adminSnapshotSchema>;

export const accessSchema = z.object({
  superAdmin: z.boolean(),
  tenants: z.array(tenantSummarySchema),
});
export type Access = z.infer<typeof accessSchema>;

export const kioskInfoSchema = z.object({
  kioskId: z.string(),
  label: z.string(),
  tenantSlug: z.string(),
  tenantName: z.string(),
});
export type KioskInfo = z.infer<typeof kioskInfoSchema>;

export const kioskRowSchema = z.object({
  id: z.string(),
  label: z.string(),
  createdAt: z.string(),
  lastSeenAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
});
export type KioskRow = z.infer<typeof kioskRowSchema>;

export const adminRowSchema = z.object({
  userId: z.string(),
  email: z.string(),
  since: z.string(),
});
export type AdminRow = z.infer<typeof adminRowSchema>;

/** Un lot tel que l'admin l'enregistre : sans `stock`, le stock n'est pas touché. */
export type PrizeInput = Omit<Prize, 'stock'> & { stock?: number | null };

export const DEFAULT_CONSENT =
  'J’accepte que l’organisateur utilise ces coordonnées pour me remettre mon lot et me recontacter au sujet de ses offres. Je peux retirer mon accord à tout moment en le contactant.';

export function defaultConfig(): GameConfig {
  return {
    activeGame: 'bandit',
    iconSet: 'symboles',
    welcomeMessage: 'Tentez votre chance !',
    winMessage: 'Bravo, vous gagnez {lot} !',
    loseMessage: 'Pas de chance cette fois… Retentez plus tard !',
    leadFormEnabled: true,
    leadFields: ['prenom', 'email'],
    leadRequired: ['email'],
    consentText: DEFAULT_CONSENT,
    privacyContact: null,
    retentionDays: 365,
    idleSeconds: 45,
    soundEnabled: false,
    maxSpinsPerMinute: 30,
    wallpaperDesktop: null,
    wallpaperMobile: null,
    logoUrl: null,
  };
}

/**
 * Lots de démonstration : un perdant majoritaire, trois lots rares. Les mêmes
 * identifiants que le client `demo` de 0007 : stables d'une graine à l'autre.
 */
export function defaultPrizes(): Prize[] {
  return [
    {
      id: 'lot_perdu',
      label: 'Perdu',
      weight: 50,
      stock: null,
      color: '#3d4a5c',
      symbol: '·',
      drawing: 'nuage',
      image: null,
      lose: true,
    },
    {
      id: 'lot_goodies',
      label: 'Goodies',
      weight: 30,
      stock: 40,
      color: '#1f8a70',
      symbol: '★',
      drawing: 'cadeau',
      image: null,
      lose: false,
    },
    {
      id: 'lot_bon',
      label: 'Bon -10 %',
      weight: 15,
      stock: 20,
      color: '#c45c26',
      symbol: '%',
      drawing: 'etiquette',
      image: null,
      lose: false,
    },
    {
      id: 'lot_grand',
      label: 'Grand lot',
      weight: 5,
      stock: 3,
      color: '#c9a227',
      symbol: '◆',
      drawing: 'diamant',
      image: null,
      lose: false,
    },
  ];
}

/** Un lot est tirable s'il pèse et s'il en reste. */
export function isDrawable(prize: Prize): boolean {
  return prize.weight > 0 && (prize.stock === null || prize.stock > 0);
}

/**
 * Tirage pondéré parmi les lots tirables, `null` si plus rien ne l'est. Le même
 * algorithme que `arcade_spin` côté serveur : le mode local et le repli hors
 * ligne tirent comme la base.
 */
export function drawPrize(
  prizes: readonly Prize[],
  random: () => number = Math.random
): Prize | null {
  const pool = prizes.filter(isDrawable);
  const total = pool.reduce((sum, p) => sum + p.weight, 0);
  if (total <= 0) return null;
  let remaining = random() * total;
  for (const prize of pool) {
    remaining -= prize.weight;
    if (remaining < 0) return prize;
  }
  return pool.at(-1) ?? null;
}

/**
 * La chance de chaque lot au prochain tirage, en fraction (0 à 1). Un lot
 * épuisé ou sans poids vaut 0 : c'est ce que l'admin doit voir à côté du poids,
 * plutôt qu'un nombre dont il faut faire la somme de tête.
 */
export function chances(prizes: readonly Prize[]): Map<string, number> {
  const total = prizes.filter(isDrawable).reduce((sum, p) => sum + p.weight, 0);
  return new Map(
    prizes.map(p => [p.id, total > 0 && isDrawable(p) ? p.weight / total : 0])
  );
}

/** Le même lot, une unité de moins (un perdant ou un illimité ne bouge pas). */
export function decrementStock(prizes: readonly Prize[], id: string): Prize[] {
  return prizes.map(p =>
    p.id === id && !p.lose && p.stock !== null
      ? { ...p, stock: Math.max(0, p.stock - 1) }
      : p
  );
}

/** Remplace `{lot}` dans un message de gain. */
export function formatPrizeMessage(template: string, label: string): string {
  return template.replaceAll('{lot}', label);
}

/**
 * Identifiants tirés de `crypto.randomUUID` : un tirage ou un lead se
 * retrouve par son identifiant, qui ne doit donc pas se deviner (`createId`
 * n'en garde que huit caractères).
 */
export function newSpinId(): string {
  return `spin_${createUuid()}`;
}

export function newLeadId(): string {
  return `lead_${createUuid()}`;
}

export function newPrizeId(): string {
  return `lot_${createUuid().replaceAll('-', '')}`;
}

/** Code de retrait d'un tirage hors ligne, du même alphabet que le serveur. */
export function newRedeemCode(): string {
  return generateCode(6, { alphabet: 'antiConfusion' });
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^[0-9 +().-]{6,20}$/;

/** Les mêmes règles que `arcade_submit_lead` : refuser ici ce que la base refuserait. */
export function validateLeadValue(
  field: LeadField,
  value: string
): 'invalid' | 'too-long' | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed.length > 120) return 'too-long';
  if (field === 'email' && !EMAIL.test(trimmed)) return 'invalid';
  if (field === 'telephone' && !PHONE.test(trimmed)) return 'invalid';
  return null;
}
