import { createBackendSelector } from '@mister-guiiug/dev-pwa-config/backend';
import { createLogger } from '@mister-guiiug/dev-pwa-config/logger';
import { createLocalBackend } from '../features/arcade/backend/local.ts';
import { createSupabaseBackend } from '../features/arcade/backend/supabase.ts';
import type { ArcadeBackend } from '../features/arcade/backend/ports.ts';

const log = createLogger('backend');

/** Un seul port : l'arcade. Le squelette en avait un pour ses notes d'exemple. */
export interface Backend {
  arcade: ArcadeBackend;
}

/**
 * LE SÉLECTEUR DE BACKEND, DÉCLARÉ EN UNE FOIS.
 *
 * Trois règles, dans cet ordre : un choix explicite (`VITE_BACKEND`) gagne
 * toujours ; sinon la présence de toutes les variables requises décide ; sinon
 * on retombe sur le repli. Un choix explicite INCONNU est ignoré : mieux vaut
 * démarrer en local qu'échouer sur une faute de frappe dans un `.env`.
 *
 * **Le repli local n'est pas un détail.** Une app qui exige sa configuration
 * pour démarrer ne tourne ni hors ligne, ni en test, ni dans une CI sans
 * secrets, ni sur la page publique que quelqu'un ouvre sans compte.
 */
const selectBackend = createBackendSelector<Backend>({
  fallback: () => ({ arcade: createLocalBackend() }),
  backends: {
    supabase: {
      requires: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
      create: () => ({ arcade: createSupabaseBackend() }),
    },
  },
  onFallback: ({ kind, missing, error }) => {
    log.warn('repli sur le backend local', { kind, missing, error });
  },
});

const selected = selectBackend(import.meta.env);

/** Le backend de l'application. */
export const backend = selected.backend;

/** L'arcade, local ou distant : c'est le seul port. */
export const arcade: ArcadeBackend = selected.backend.arcade;

/**
 * Ce que l'écran de réglages affiche : quel backend, et ce qui est distant.
 * Une app qui croirait parler à un serveur alors que tout reste sur l'appareil
 * doit pouvoir le DIRE.
 */
export const coverage = {
  kind: selected.kind,
  remote: selected.remote,
  local: selected.local,
};

export { supabase } from './supabase.ts';
