import { useEffect, useState } from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import type { Product } from '../types';

interface GeneratingScreenProps { product: Product; }

const MESSAGES = ['Preparando seu look…', 'Aplicando a peça ao seu corpo…', 'Preservando seus detalhes…', 'Finalizando a experiência…'];

export default function GeneratingScreen({ product }: GeneratingScreenProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setMessageIndex((i) => (i + 1) % MESSAGES.length), 3800);
    return () => window.clearInterval(id);
  }, []);

  return (
    <main className="flex min-h-[100dvh] flex-col bg-white">
      <div className="bg-brand px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.18em] text-white">Provador virtual Fenomenal</div>
      <div className="flex justify-center border-b border-line px-5 py-4"><BrandMark /></div>
      <div className="flex flex-1 flex-col items-center justify-center gap-7 px-7 py-10 text-center">
        <div className="relative h-56 w-44 animate-breathe overflow-hidden rounded-sm border border-line bg-fog shadow-card">
          <img src={product.image} alt="" className="h-full w-full object-cover object-top" />
          <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute inset-y-0 -left-full w-full animate-shimmer bg-gradient-to-r from-transparent via-white/55 to-transparent" /></div>
          <span className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-action text-white"><Sparkles className="h-5 w-5" /></span>
        </div>
        <div aria-live="polite" role="status">
          <h1 className="page-title text-2xl">{MESSAGES[messageIndex]}</h1>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-ink/60">A IA está criando uma única imagem com a peça escolhida. Isso costuma levar de 20 a 40 segundos.</p>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-brand-pale px-4 py-3 text-xs font-bold text-brand"><ShieldCheck className="h-4 w-4" /> Não feche esta tela durante a geração</div>
      </div>
    </main>
  );
}
