import { useState } from 'react';

const OFFICIAL_LOGO =
  'https://d1cbrteqb4r5tu.cloudfront.net/custom/content/themes/Base/Imagens/logo_feno.png';

interface BrandMarkProps {
  className?: string;
  inverse?: boolean;
}

/** Logo público oficial da Fenomenal com fallback textual resiliente. */
export default function BrandMark({ className = '', inverse = false }: BrandMarkProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={`text-xl font-black uppercase tracking-[-0.03em] ${inverse ? 'text-white' : 'text-ink'} ${className}`}>
        Fenomenal
      </span>
    );
  }

  return (
    <img
      src={OFFICIAL_LOGO}
      alt="Fenomenal"
      className={`h-9 w-auto max-w-[180px] object-contain ${inverse ? 'brightness-0 invert' : ''} ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
