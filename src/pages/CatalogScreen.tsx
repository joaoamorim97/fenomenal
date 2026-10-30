import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import TopBar from '../components/TopBar';
import { filterProducts, getCategories } from '../services/catalog';
import type { Product } from '../types';

interface CatalogScreenProps { onBack: () => void; onSelectProduct: (product: Product) => void; }

export default function CatalogScreen({ onBack, onSelectProduct }: CatalogScreenProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const categories = useMemo(() => getCategories(), []);
  const results = useMemo(() => filterProducts({ query, category }), [query, category]);

  return (
    <main className="flex min-h-[100dvh] flex-col bg-white">
      <TopBar onBack={onBack} title="2 · Escolha a peça" />
      <section className="border-b border-line px-4 pb-4 pt-5">
        <div className="px-1">
          <p className="eyebrow">Catálogo Fenomenal</p>
          <h1 className="page-title mt-2">Qual look é a sua cara?</h1>
          <p className="mt-2 text-sm text-ink/55">Selecionamos referências com a peça bem visível para gerar resultados melhores.</p>
        </div>

        <label className="relative mt-5 block">
          <span className="sr-only">Buscar produto</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
          <input aria-label="Buscar produto" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Busque por blusa, gola, modelo…" className="h-12 w-full rounded-md border border-line bg-fog pl-11 pr-11 text-sm text-ink placeholder:text-ink/40 focus:border-brand focus:bg-white focus:outline-none" />
          {query && <button onClick={() => setQuery('')} aria-label="Limpar busca" className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-ink/50 hover:bg-white"><X className="h-4 w-4" /></button>}
        </label>

        <div className="mt-3 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-brand" />
          <div className="-mr-4 flex gap-2 overflow-x-auto pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtrar por categoria">
            <CategoryChip label="Todos" active={category === null} onClick={() => setCategory(null)} />
            {categories.map((cat) => <CategoryChip key={cat} label={cat} active={category === cat} onClick={() => setCategory(cat)} />)}
          </div>
        </div>
      </section>

      <section className="flex-1 px-4 pb-10 pt-4">
        <div className="mb-4 flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-ink/45">{results.length} {results.length === 1 ? 'produto' : 'produtos'}</p><span className="text-[11px] font-bold text-brand">Fotos reais do catálogo</span></div>
        {results.length === 0 ? <div className="rounded-md bg-fog px-5 py-12 text-center"><p className="font-black">Nenhum produto encontrado</p><button onClick={() => { setQuery(''); setCategory(null); }} className="btn-ghost mt-3">Limpar filtros</button></div> : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">{results.map((product) => <ProductCard key={product.id} product={product} onSelect={onSelectProduct} />)}</div>
        )}
      </section>
    </main>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`chip ${active ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink/65 hover:border-brand hover:text-brand'}`}>{label}</button>;
}
