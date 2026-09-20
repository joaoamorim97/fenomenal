import { ChevronLeft } from 'lucide-react';
import BrandMark from './BrandMark';

interface TopBarProps {
  onBack?: () => void;
  title?: string;
  right?: React.ReactNode;
}

export default function TopBar({ onBack, title, right }: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink/5 bg-bone/85 px-4 py-3 backdrop-blur">
      <div className="flex w-16 items-center">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Voltar"
            className="btn-ghost -ml-2 px-2"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="flex-1 text-center">
        {title ? (
          <span className="text-sm font-medium uppercase tracking-[0.14em] text-ink/70">
            {title}
          </span>
        ) : (
          <BrandMark />
        )}
      </div>
      <div className="flex w-16 items-center justify-end">{right}</div>
    </header>
  );
}
