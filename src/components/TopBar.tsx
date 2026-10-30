import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import BrandMark from './BrandMark';

interface TopBarProps {
  onBack?: () => void;
  title?: string;
  right?: ReactNode;
}

export default function TopBar({ onBack, title, right }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="h-1 bg-brand" />
      <div className="flex min-h-14 items-center justify-between px-4">
        <div className="flex w-14 items-center">
          {onBack && (
            <button onClick={onBack} aria-label="Voltar" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-md text-ink hover:bg-fog">
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
        </div>
        <div className="flex flex-1 justify-center text-center">
          {title ? (
            <span className="text-xs font-black uppercase tracking-[0.16em] text-ink">{title}</span>
          ) : (
            <BrandMark className="h-8" />
          )}
        </div>
        <div className="flex w-14 items-center justify-end">{right}</div>
      </div>
    </header>
  );
}
