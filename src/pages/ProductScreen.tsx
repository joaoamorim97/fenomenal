import { ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';
import TopBar from '../components/TopBar';
import type { Product } from '../types';
import { productPlaceholder } from '../utils/placeholder';

interface ProductScreenProps {
  product: Product;
  onBack: () => void;
  onTryOn: (product: Product) => void;
  disabled?: boolean;
}

export default function ProductScreen({ product, onBack, onTryOn, disabled = false }: ProductScreenProps) {
  return (
    <main className="flex min-h-[100dvh] flex-col bg-white">
      <TopBar onBack={onBack} title="3 · Confirmar peça" />
      <div className="relative aspect-[4/5] overflow-hidden border-b border-line bg-fog">
        <img src={product.image} alt={product.name} className="h-full w-full object-cover object-top" onError={(event) => { event.currentTarget.src = productPlaceholder(product); }} />
        <span className="absolute left-4 top-4 rounded-sm bg-brand px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white">{product.category}</span>
      </div>

      <section className="flex flex-1 flex-col gap-5 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6">
        <div>
          <h1 className="text-2xl font-black leading-7 tracking-[-0.02em] text-ink">{product.name}</h1>
          <p className="mt-3 text-xl font-black text-brand">{product.price ?? 'Consulte o preço no site'}</p>
        </div>
        <p className="text-sm leading-6 text-ink/65">{product.description}</p>
        <div className="flex gap-3 rounded-md border border-brand/15 bg-brand-pale p-4 text-xs leading-5 text-brand-dark"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p><strong>Referência real:</strong> esta foto será enviada junto da sua para orientar corte, cor e detalhes da peça.</p></div>

        <div className="mt-auto space-y-3 pt-2">
          <button disabled={disabled} onClick={() => onTryOn(product)} className="btn-action w-full"><Sparkles className="h-4 w-4" /> {disabled ? 'Preparando…' : 'Experimentar este produto'}</button>
          <a href={product.productUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full">Ver produto na Fenomenal <ExternalLink className="h-4 w-4" /></a>
        </div>
      </section>
    </main>
  );
}
