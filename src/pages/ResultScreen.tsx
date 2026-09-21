import { useEffect, useRef, useState } from 'react';
import {
  Share2,
  RefreshCw,
  Camera,
  ExternalLink,
  RotateCcw,
  Download,
  AlertCircle,
  Check,
  Palette,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import type { Product } from '../types';
import { dataUrlToBlob } from '../utils/image';
import {
  TRYON_PALETTE,
  loadImageData,
  computeGarmentMask,
  recolor,
  maskIsUsable,
  type LoadedImage,
} from '../utils/recolor';

interface ResultScreenProps {
  image: string | null;
  error: string | null;
  product: Product;
  onTryAnother: () => void;
  onChangePhoto: () => void;
  onRetry: () => void;
  onBack: () => void;
}

export default function ResultScreen({
  image,
  error,
  product,
  onTryAnother,
  onChangePhoto,
  onRetry,
  onBack,
}: ResultScreenProps) {
  const [shareNote, setShareNote] = useState<string | null>(null);

  // Recolorização da roupa (client-side, sem IA)
  const [displayImage, setDisplayImage] = useState<string | null>(image);
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [recolorReady, setRecolorReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const baseRef = useRef<LoadedImage | null>(null);
  const maskRef = useRef<Uint8Array | null>(null);

  // Prepara a máscara da roupa quando uma nova imagem é gerada.
  useEffect(() => {
    setDisplayImage(image);
    setActiveColor(null);
    setRecolorReady(false);
    baseRef.current = null;
    maskRef.current = null;
    if (!image) return;

    let cancelled = false;
    (async () => {
      try {
        const base = await loadImageData(image);
        const mask = computeGarmentMask(base);
        if (cancelled) return;
        if (maskIsUsable(mask)) {
          baseRef.current = base;
          maskRef.current = mask;
          setRecolorReady(true);
        } else {
          console.warn('[ResultScreen] máscara da roupa insuficiente; paleta oculta.');
          setRecolorReady(false);
        }
      } catch (err) {
        console.error('[ResultScreen] falha ao preparar recolorização', err);
        setRecolorReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [image]);

  function applyColor(hex: string | null) {
    if (hex === null) {
      setActiveColor(null);
      setDisplayImage(image);
      return;
    }
    if (!baseRef.current || !maskRef.current) return;
    setBusy(true);
    setActiveColor(hex);
    // pequeno defer para o spinner aparecer antes do trabalho síncrono
    setTimeout(() => {
      try {
        const out = recolor(baseRef.current!, maskRef.current!, hex);
        setDisplayImage(out);
      } catch (err) {
        console.error('[ResultScreen] erro ao recolorir', err);
      } finally {
        setBusy(false);
      }
    }, 20);
  }

  async function handleShare() {
    const img = displayImage;
    if (!img) return;
    setShareNote(null);
    try {
      const blob = dataUrlToBlob(img);
      const file = new File([blob], 'meu-look-fenomenal.png', { type: blob.type });
      if (
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: 'Meu look Fenomenal',
          text: `Experimentei ${product.name} no provador virtual da Fenomenal!`,
        });
        return;
      }
      triggerDownload(img);
      setShareNote('Compartilhamento não suportado. A imagem foi baixada.');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('[ResultScreen] erro ao compartilhar', err);
      triggerDownload(img);
      setShareNote('Não foi possível compartilhar. A imagem foi baixada.');
    }
  }

  // ----- Estado de erro -----
  if (error) {
    return (
      <div className="flex min-h-screen flex-col">
        <TopBar onBack={onBack} title="Ops" />
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
            <AlertCircle className="h-8 w-8" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">
              Não deu certo desta vez
            </h2>
            <p className="mt-2 text-sm text-ink/60">{error}</p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-3">
            <button onClick={onRetry} className="btn-primary w-full">
              <RotateCcw className="h-4 w-4" />
              Tentar novamente
            </button>
            <button onClick={onTryAnother} className="btn-ghost w-full">
              Escolher outro produto
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----- Estado de sucesso -----
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar onBack={onBack} title="Resultado" />

      <div className="flex flex-1 flex-col gap-5 px-6 py-6">
        <div className="text-center">
          <h2 className="font-display text-3xl font-semibold text-ink">
            Seu look Fenomenal
          </h2>
          <p className="mt-1 text-sm text-ink/60">{product.name}</p>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-soft animate-fade-in">
          {displayImage && (
            <img src={displayImage} alt="Seu look gerado" className="w-full object-cover" />
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/40 text-xs text-ink/70">
              Aplicando cor…
            </div>
          )}
        </div>

        {/* Paleta de cores — recolore a roupa no cliente, sem IA */}
        {recolorReady && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-ink/50">
              <Palette className="h-3.5 w-3.5" />
              Experimente em outras cores
            </div>
            <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {/* Original */}
              <Swatch
                label="Original"
                active={activeColor === null}
                onClick={() => applyColor(null)}
                original
              />
              {TRYON_PALETTE.map((c) => (
                <Swatch
                  key={c.hex}
                  label={c.name}
                  hex={c.hex}
                  active={activeColor === c.hex}
                  onClick={() => applyColor(c.hex)}
                />
              ))}
            </div>
          </div>
        )}

        {shareNote && <p className="text-center text-xs text-ink/50">{shareNote}</p>}

        <div className="mt-1 flex flex-col gap-3">
          <button onClick={handleShare} className="btn-primary w-full">
            <Share2 className="h-4 w-4" />
            Compartilhar
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={onTryAnother} className="btn-secondary">
              <RefreshCw className="h-4 w-4" />
              Outro produto
            </button>
            <button
              onClick={() => displayImage && triggerDownload(displayImage)}
              className="btn-secondary"
            >
              <Download className="h-4 w-4" />
              Salvar
            </button>
          </div>

          <button onClick={onChangePhoto} className="btn-ghost w-full">
            <Camera className="h-4 w-4" />
            Trocar minha foto
          </button>

          <a
            href={product.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost w-full"
          >
            Ver produto
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

interface SwatchProps {
  label: string;
  hex?: string;
  active: boolean;
  original?: boolean;
  onClick: () => void;
}

function Swatch({ label, hex, active, original, onClick }: SwatchProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex shrink-0 flex-col items-center gap-1"
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
          active ? 'border-ink ring-2 ring-ink ring-offset-2' : 'border-ink/15'
        }`}
        style={
          original
            ? {
                background:
                  'conic-gradient(#f87171,#fbbf24,#34d399,#60a5fa,#a78bfa,#f87171)',
              }
            : { backgroundColor: hex }
        }
      >
        {active && (
          <Check
            className="h-4 w-4"
            style={{ color: isLight(hex) ? '#111' : '#fff' }}
          />
        )}
      </span>
      <span className="max-w-[3.5rem] truncate text-[10px] text-ink/60">{label}</span>
    </button>
  );
}

function isLight(hex?: string): boolean {
  if (!hex) return true;
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

function triggerDownload(dataUrl: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'meu-look-fenomenal.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
