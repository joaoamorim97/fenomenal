import { useState } from 'react';
import { Sparkles, ExternalLink } from 'lucide-react';
import TopBar from '../components/TopBar';
import type { Product } from '../types';
import { resolveProductImage } from '../utils/placeholder';

interface ProductScreenProps {
  product: Product;
  onBack: () => void;
  onTryOn: (product: Product, color: string | null) => void;
}

export default function ProductScreen({ product, onBack, onTryOn }: ProductScreenProps) {
  const [selectedColor, setSelectedColor] = useState<string | null>(
    product.colors[0]?.name ?? null,
  );
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const img = resolveProductImage(product);

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar onBack={onBack} title="Produto" />

      <div className="flex flex-1 flex-col">
        {/* Imagem grande */}
        <div className="aspect-[3/4] w-full overflow-hidden bg-sand">
          <img src={img} alt={product.name} className="h-full w-full object-cover" />
        </div>

        <div className="flex flex-1 flex-col gap-5 px-6 py-6">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-accent-dark">
              {product.category}
            </span>
            <h1 className="mt-1 font-display text-2xl font-semibold leading-snug text-ink">
              {product.name}
            </h1>
            <p className="mt-2 text-lg text-ink">
              {product.price ?? (
                <span className="text-base text-ink/60">Consulte o preço na loja</span>
              )}
            </p>
          </div>

          {product.description && (
            <p className="text-sm leading-relaxed text-ink/70">{product.description}</p>
          )}

          {/* Cores (quando disponíveis) */}
          {product.colors.length > 0 && (
            <div>
              <span className="text-xs uppercase tracking-wider text-ink/50">Cor</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.colors.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setSelectedColor(c.name)}
                    className={`chip ${
                      selectedColor === c.name
                        ? 'border-ink bg-ink text-white'
                        : 'border-ink/15 bg-white text-ink/70'
                    }`}
                  >
                    {c.hex && (
                      <span
                        className="mr-2 inline-block h-3 w-3 rounded-full border border-black/10 align-middle"
                        style={{ backgroundColor: c.hex }}
                      />
                    )}
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tamanhos (quando disponíveis) */}
          {product.sizes.length > 0 && (
            <div>
              <span className="text-xs uppercase tracking-wider text-ink/50">
                Tamanho
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s === selectedSize ? null : s)}
                    className={`chip min-w-[3rem] justify-center ${
                      selectedSize === s
                        ? 'border-ink bg-ink text-white'
                        : 'border-ink/15 bg-white text-ink/70'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-auto flex flex-col gap-3 pt-2">
            <button
              onClick={() => onTryOn(product, selectedColor)}
              className="btn-primary w-full"
            >
              <Sparkles className="h-4 w-4" />
              Experimentar este produto
            </button>
            <a
              href={product.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost w-full"
            >
              Ver na loja Fenomenal
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
