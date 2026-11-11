import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { PrizeIcon } from './PrizeIcon.tsx';

describe('PrizeIcon', () => {
  it('un symbole reste du texte nu', () => {
    const { container } = render(
      <PrizeIcon face={{ kind: 'text', key: 't:★', text: '★' }} />
    );
    expect(container.innerHTML).toBe('★');
  });

  it('un dessin est un SVG décoratif', () => {
    const { container } = render(
      <PrizeIcon face={{ kind: 'drawing', key: 'd:cerise', name: 'cerise' }} />
    );
    const svg = container.querySelector('svg.arcade-icon');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('une image qui ne vient pas laisse place au symbole du lot', () => {
    const { container } = render(
      <PrizeIcon
        face={{
          kind: 'image',
          key: 'i:https://x.test/a.webp',
          src: 'https://x.test/a.webp',
          fallback: '%',
        }}
      />
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('alt')).toBe('');
    fireEvent.error(img!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('%');
  });
});
