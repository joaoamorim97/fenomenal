import type { Product } from '../types';
import { resolveProductImage } from '../utils/placeholder';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export default function ProductCard({ product, onSelect }: ProductCardProps) {
  const img = resolveProductImage(product);
  return (
    <button
      onClick={() => onSelect(product)}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm transition active:scale-[0.99]"
    >
      <div className="aspect-[3/4] w-full overflow-hidden bg-sand">
        <img
          src={img}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 px-3 py-3">
        <span className="text-[11px] uppercase tracking-wider text-accent-dark">
          {product.category}
        </span>
        <span className="line-clamp-2 text-sm font-medium leading-snug text-ink">
          {product.name}
        </span>
        <span className="mt-auto pt-1 text-sm text-ink/80">
          {product.price ?? 'Consulte na loja'}
        </span>
      </div>
    </button>
  );
}
