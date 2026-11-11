import { beforeEach, describe, expect, it } from 'vitest';
import { defaultConfig, defaultPrizes, type Prize } from '../model.ts';
import { useAdmin } from './admin-store.ts';

function draftWith(prizes: Prize[]) {
  useAdmin.setState({
    tenantId: 'local',
    draft: { config: defaultConfig(), prizes, stockTouched: [] },
    dirty: false,
  });
}

beforeEach(() => {
  useAdmin.getState().forget();
});

describe('le jeu d’icônes dans le brouillon', () => {
  it('passer aux dessins écrit un dessin pour chaque lot qui n’en a pas', () => {
    draftWith(
      defaultPrizes().map((p, i) => ({
        ...p,
        drawing: i === 0 ? 'sept' : null,
        image: i === 1 ? 'https://x.test/b.webp' : null,
      }))
    );
    useAdmin.getState().setIconSet('dessin');
    const { draft, dirty } = useAdmin.getState();
    expect(dirty).toBe(true);
    expect(draft?.config.iconSet).toBe('dessin');
    expect(draft?.prizes.map(p => p.drawing)).toEqual([
      'sept',
      'etoile',
      'etiquette',
      'diamant',
    ]);
    // Rien n'est perdu : revenir aux symboles ou aux images les retrouve.
    expect(draft?.prizes.map(p => p.symbol)).toEqual(['·', '★', '%', '◆']);
    expect(draft?.prizes[1]?.image).toBe('https://x.test/b.webp');
  });

  it('un lot ajouté reçoit un dessin que les autres n’ont pas', () => {
    draftWith(defaultPrizes());
    useAdmin.getState().addPrize('Nouveau');
    const prizes = useAdmin.getState().draft!.prizes;
    const added = prizes.at(-1)!;
    expect(added.drawing).not.toBeNull();
    expect(prizes.slice(0, -1).map(p => p.drawing)).not.toContain(
      added.drawing
    );
  });
});
