import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import TopBar from '../components/TopBar';
import ProductCard from '../components/ProductCard';
import { filterProducts, getCategories } from '../services/catalog';
import type { Product } from '../types';

interface CatalogScreenProps {
  onBack: () => void;
  onSelectProduct: (product: Product) => void;
}

export default function CatalogScreen({ onBack, onSelectProduct }: CatalogScreenProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const categories = useMemo(() => getCategories(), []);
  const results = useMemo(
    () => filterProducts({ query, category }),
    [query, category],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar onBack={onBack} title="Catálogo" />

      <div className="flex flex-col gap-4 px-4 pb-4 pt-4">
        <div>
          <h2 className="px-1 font-display text-2xl font-semibold text-ink">
            Escolha uma peça
          </h2>
          <p className="px-1 text-sm text-ink/60">
            Toque em um produto para experimentar.
          </p>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produtos…"
            className="w-full rounded-full border border-ink/10 bg-white py-3 pl-10 pr-10 text-sm outline-none placeholder:text-ink/40 focus:border-ink/30"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Categorias com rolagem horizontal */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CategoryChip
            label="Todos"
            active={category === null}
            onClick={() => setCategory(null)}
          />
          {categories.map((cat) => (
            <CategoryChip
              key={cat}
              label={cat}
              active={category === cat}
              onClick={() => setCategory(cat)}
            />
          ))}
        </div>
      </div>

      {/* Grade de produtos */}
      <div className="flex-1 px-4 pb-10">
        {results.length === 0 ? (
          <p className="mt-10 text-center text-sm text-ink/50">
            Nenhum produto encontrado.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {results.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={onSelectProduct}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`chip ${
        active
          ? 'border-ink bg-ink text-white'
          : 'border-ink/15 bg-white text-ink/70'
      }`}
    >
      {label}
    </button>
  );
}
