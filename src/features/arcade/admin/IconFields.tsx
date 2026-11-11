import { useRef, useState } from 'react';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { SegmentedControl } from '@mister-guiiug/dev-pwa-config/react/segmented-control';
import {
  stripImageMetadata,
  validateImageFile,
} from '@mister-guiiug/dev-pwa-config/image';
import { useI18n } from '../../../i18n/index.ts';
import { arcade } from '../../../backend/index.ts';
import { errorKey } from '../errors-i18n.ts';
import { toArcadeError } from '../backend/errors.ts';
import type { IconSet, Prize } from '../model.ts';
import { Drawing } from '../icons/Drawing.tsx';
import { DRAWING_NAMES, type DrawingName } from '../icons/drawing-names.ts';
import { useAdmin } from './admin-store.ts';

/** Les formats de `BrandingEditor` : le SVG, qui peut porter du script, non. */
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
/** Une icône n'a pas besoin de plus : 256 px couvrent une bobine sur écran dense. */
const ICON_PX = 256;

/** Le choix du jeu d'icônes, et ce qu'il demande à l'admin. */
export function IconSetPicker({ value }: { value: IconSet }) {
  const { t } = useI18n();
  const setIconSet = useAdmin(s => s.setIconSet);
  const hint = {
    symboles: t('adminPrizes.iconSetHintSymboles'),
    dessin: t('adminPrizes.iconSetHintDessin'),
    perso: arcade.capabilities.branding
      ? t('adminPrizes.iconSetHintPerso')
      : t('adminPrizes.iconSetNeedServer'),
  }[value];
  return (
    <div className="mb-4 flex flex-col gap-2">
      <span className="text-sm font-medium">{t('adminPrizes.iconSet')}</span>
      <SegmentedControl
        value={value}
        onChange={next => setIconSet(next as IconSet)}
        ariaLabel={t('adminPrizes.iconSet')}
        options={[
          { value: 'symboles', label: t('adminPrizes.iconSetSymboles') },
          { value: 'dessin', label: t('adminPrizes.iconSetDessin') },
          { value: 'perso', label: t('adminPrizes.iconSetPerso') },
        ]}
      />
      <p className="text-soft m-0 text-sm">{hint}</p>
    </div>
  );
}

/**
 * Le catalogue en vignettes, replié par défaut : douze lots dépliés feraient
 * cent quatre-vingt-douze vignettes. Des boutons radio natifs, un groupe par
 * lot : les flèches du clavier passent d'un dessin à l'autre.
 */
export function DrawingPicker({
  prize,
  current,
}: {
  prize: Prize;
  current: DrawingName;
}) {
  const { t } = useI18n();
  const setPrize = useAdmin(s => s.setPrize);
  return (
    <details className="arcade-drawing-picker">
      <summary className="text-sm">
        {t('adminPrizes.drawingSummary', {
          name: t(`drawings.${current}`),
        })}
      </summary>
      <fieldset className="arcade-drawing-grid">
        <legend className="sr-only">
          {t('adminPrizes.drawingOf', { label: prize.label })}
        </legend>
        {DRAWING_NAMES.map(name => (
          <label
            key={name}
            className="arcade-drawing-tile"
            title={t(`drawings.${name}`)}
          >
            <input
              type="radio"
              className="sr-only"
              name={`dessin-${prize.id}`}
              value={name}
              checked={name === current}
              onChange={() => setPrize(prize.id, { drawing: name })}
            />
            <Drawing name={name} className="arcade-icon" />
            <span className="sr-only">{t(`drawings.${name}`)}</span>
          </label>
        ))}
      </fieldset>
    </details>
  );
}

/**
 * L'image d'un lot. Réduite à 256 px et réencodée AVANT l'envoi (WebP, qui
 * garde la transparence d'un logo détouré ; PNG si le navigateur ne sait pas
 * l'écrire), sans ses métadonnées : une photo de téléphone de 4 Mo serait
 * sinon téléchargée par chaque borne, à chaque tirage qui la montre.
 *
 * Comme pour les fonds, le fichier part tout de suite, mais le lot ne le
 * désigne qu'à « Enregistrer ».
 */
export function ImagePicker({ prize }: { prize: Prize }) {
  const { t } = useI18n();
  const tenantId = useAdmin(s => s.tenantId);
  const setPrize = useAdmin(s => s.setPrize);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!arcade.capabilities.branding) return null;

  const onFile = async (file: File | undefined) => {
    if (!file || !tenantId) return;
    const refused = validateImageFile(file, {
      acceptedTypes: ACCEPTED,
      maxBytes: 15_000_000,
    });
    if (refused) {
      setError(
        refused === 'type' ? t('adminGame.imageType') : t('adminGame.imageSize')
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ready = await stripImageMetadata(file, {
        maxDimension: ICON_PX,
        type: 'image/webp',
        quality: 0.9,
      });
      const url = await arcade.uploadIcon(tenantId, prize.id, ready);
      setPrize(prize.id, { image: url });
    } catch (cause) {
      setError(t(errorKey(toArcadeError(cause).code)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          loading={busy}
          onClick={() => input.current?.click()}
        >
          {prize.image
            ? t('adminPrizes.imageReplace')
            : t('adminPrizes.imageUpload')}
        </Button>
        {prize.image ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPrize(prize.id, { image: null })}
          >
            {t('adminPrizes.imageRemove')}
          </Button>
        ) : (
          <span className="text-soft text-sm">
            {t('adminPrizes.imageMissing', { symbol: prize.symbol })}
          </span>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED.join(',')}
        className="sr-only"
        aria-label={t('adminPrizes.imageOf', { label: prize.label })}
        onChange={e => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {error ? (
        <p role="alert" className="text-danger m-0 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
