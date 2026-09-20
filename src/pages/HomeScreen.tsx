import { Sparkles, ArrowRight } from 'lucide-react';
import BrandMark from '../components/BrandMark';

interface HomeScreenProps {
  onStart: () => void;
}

export default function HomeScreen({ onStart }: HomeScreenProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-center px-4 py-5">
        <BrandMark />
      </div>

      {/* Hero */}
      <div className="relative flex flex-1 flex-col justify-end overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink-soft to-[#1a1a1a]" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 30% 20%, rgba(200,161,90,0.35), transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.08), transparent 40%)',
          }}
        />

        <div className="relative z-10 flex flex-col gap-6 px-6 pb-10 pt-24 text-white animate-fade-in">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/80">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Provador virtual com IA
          </span>

          <h1 className="font-display text-5xl font-semibold leading-[1.05]">
            Vista seu
            <br />
            próximo look.
          </h1>

          <p className="max-w-xs text-[15px] leading-relaxed text-white/70">
            Envie uma foto sua e experimente virtualmente as peças da Fenomenal.
            Nossa inteligência artificial cria a imagem de você usando o produto
            escolhido.
          </p>

          <button onClick={onStart} className="btn-primary mt-2 w-full bg-white text-ink">
            Experimentar agora
            <ArrowRight className="h-4 w-4" />
          </button>

          <p className="text-center text-xs text-white/40">
            Sem cadastro. Sua foto é usada apenas para gerar o look.
          </p>
        </div>
      </div>
    </div>
  );
}
