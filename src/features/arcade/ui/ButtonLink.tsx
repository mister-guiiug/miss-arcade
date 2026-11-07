import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * Un LIEN habillé en bouton. Un `<Button>` dans un `<Link>` (ce que faisait la
 * porte de l'admin) imbrique deux éléments interactifs : HTML invalide, et un
 * lecteur d'écran annonce deux cibles pour un geste. `components.css` habille
 * tout élément `[data-dwc='button']`, lien compris.
 */
export function ButtonLink({
  to,
  variant = 'outline',
  size = 'md',
  className,
  children,
}: {
  to: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      data-dwc="button"
      data-variant={variant}
      data-size={size}
      className={className}
    >
      {children}
    </Link>
  );
}
