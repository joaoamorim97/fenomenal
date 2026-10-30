import { ArrowUpRight } from 'lucide-react';
import type { Product } from '../types';
import { productPlaceholder } from '../utils/placeholder';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export default function ProductCard({ product, onSelect }: ProductCardProps) {
  return (
    <article className="group min-w-0 bg-white">
      <button onClick={() => onSelect(product)} className="block w-full text-left" aria-label={`Ver ${product.name}`}>
        <div className="relative aspect-[3/4] overflow-hidden rounded-sm border border-line bg-white">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.025]"
            onError={(event) => { event.currentTarget.src = productPlaceholder(product); }}
          />
          <span className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-brand shadow-card">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
        <div className="space-y-1.5 pb-5 pt-3">
          <p className="eyebrow">{product.category}</p>
          <h3 className="line-clamp-2 min-h-10 text-[15px] font-bold leading-5 text-ink">{product.name}</h3>
          <p className="text-sm font-black text-brand">{product.price ?? 'Preço no site'}</p>
        </div>
      </button>
    </article>
  );
}
