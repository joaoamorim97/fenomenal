import { ArrowRight, Camera, ShieldCheck, Sparkles } from 'lucide-react';
import BrandMark from '../components/BrandMark';

interface HomeScreenProps { onStart: () => void; }

export default function HomeScreen({ onStart }: HomeScreenProps) {
  return (
    <main className="flex min-h-[100dvh] flex-col bg-white">
      <div className="bg-brand px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.18em] text-white">
        Fenomenal agora também no provador virtual
      </div>
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <BrandMark />
        <span className="rounded-full bg-action-pale px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-action">Experiência IA</span>
      </header>

      <section className="relative min-h-[510px] flex-1 overflow-hidden bg-fog">
        <img src="/products/069510-p17073.webp" alt="Moda Fenomenal" className="absolute inset-0 h-full w-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 space-y-5 px-6 pb-8 text-white animate-fade-in">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/85">
            <Sparkles className="h-4 w-4 text-[#ff619b]" />
            Moda + tecnologia
          </div>
          <h1 className="max-w-sm text-[42px] font-black leading-[0.98] tracking-[-0.045em]">Vista seu próximo look.</h1>
          <p className="max-w-sm text-[15px] leading-6 text-white/85">Envie uma foto e veja como as peças Fenomenal ficam em você antes de escolher.</p>
          <button onClick={onStart} className="btn-action w-full">
            Experimentar agora <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 border-t border-line bg-white">
        <div className="flex items-center gap-2 border-r border-line px-4 py-4 text-xs font-bold text-ink/70"><Camera className="h-4 w-4 text-brand" /> Foto ou câmera</div>
        <div className="flex items-center gap-2 px-4 py-4 text-xs font-bold text-ink/70"><ShieldCheck className="h-4 w-4 text-brand" /> Sem cadastro</div>
      </section>
    </main>
  );
}
