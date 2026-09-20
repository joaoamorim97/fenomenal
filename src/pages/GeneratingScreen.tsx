import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Product } from '../types';
import { resolveProductImage } from '../utils/placeholder';

interface GeneratingScreenProps {
  product: Product;
}

const MESSAGES = [
  'Preparando seu look…',
  'Ajustando o caimento da peça…',
  'Cuidando dos detalhes…',
  'Quase lá…',
];

export default function GeneratingScreen({ product }: GeneratingScreenProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const img = resolveProductImage(product);

  useEffect(() => {
    const id = setInterval(() => {
      setMessageIndex((i) => (i + 1) % MESSAGES.length);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-ink px-8 text-center text-white">
      <div className="relative">
        <div className="h-40 w-32 overflow-hidden rounded-2xl border border-white/10">
          <img src={img} alt={product.name} className="h-full w-full object-cover opacity-80" />
        </div>
        {/* shimmer */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute inset-y-0 -left-full w-full animate-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        </div>
        <div className="absolute -bottom-3 -right-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-ink">
          <Sparkles className="h-5 w-5" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-2xl font-semibold">{MESSAGES[messageIndex]}</h2>
        <p className="text-sm text-white/60">
          Estamos criando sua experiência Fenomenal.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 animate-pulse rounded-full bg-white/70"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>

      <p className="max-w-xs text-xs text-white/40">
        Isso pode levar alguns segundos. Não feche esta tela.
      </p>
    </div>
  );
}
