import { useId } from 'react';
import { useI18n } from '../../../i18n/index.ts';

export interface Bar {
  /** Libellé complet, lu dans l'infobulle et le tableau. */
  label: string;
  /** Libellé court, sous la barre (vide pour l'omettre). */
  tick: string;
  value: number;
}

/**
 * Une série de barres verticales, une seule teinte (la primaire) : une
 * magnitude, pas une identité, donc ni légende ni palette (le titre nomme la
 * série). Chaque barre se survole pour lire sa valeur exacte ; le tableau
 * replié en dessous donne toutes les valeurs au clavier et aux lecteurs
 * d'écran, sans dépendre de la couleur ni de la souris.
 */
export function BarSeries({
  title,
  bars,
  valueLabel,
}: {
  title: string;
  bars: readonly Bar[];
  valueLabel: string;
}) {
  const { fmt } = useI18n();
  const id = useId();
  const max = Math.max(1, ...bars.map(b => b.value));

  return (
    <figure className="arcade-bars m-0" aria-labelledby={`${id}-titre`}>
      <figcaption id={`${id}-titre`} className="mb-2 text-sm font-semibold">
        {title}
      </figcaption>
      {/* Le tracé est un doublon visuel du tableau : masqué aux lecteurs
          d'écran, qui lisent le tableau (ni couleur ni souris requises). */}
      <div className="arcade-bars-plot" aria-hidden="true">
        {bars.map(bar => (
          <div key={bar.label} className="arcade-bars-col">
            <span className="arcade-bars-tip">
              {bar.label} · {fmt.number(bar.value)}
            </span>
            <span
              className="arcade-bars-bar"
              style={{ height: `${(bar.value / max) * 100}%` }}
            />
            <span className="arcade-bars-tick">{bar.tick}</span>
          </div>
        ))}
      </div>
      <details className="mt-2 text-sm">
        <summary>{title}</summary>
        <table className="arcade-table">
          <thead>
            <tr>
              <th scope="col">{title}</th>
              <th scope="col">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {bars.map(bar => (
              <tr key={bar.label}>
                <td>{bar.label}</td>
                <td>{fmt.number(bar.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
