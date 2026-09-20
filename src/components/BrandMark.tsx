interface BrandMarkProps {
  className?: string;
}

/** Wordmark da Fenomenal com pequeno detalhe editorial. */
export default function BrandMark({ className = '' }: BrandMarkProps) {
  return (
    <span
      className={`font-display text-lg font-semibold tracking-[0.14em] text-ink ${className}`}
    >
      FENOMENAL
    </span>
  );
}
