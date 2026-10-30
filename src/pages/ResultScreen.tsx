import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import {
  AlertCircle, Camera, Check, Download, ExternalLink, PaintBucket, Plus,
  RefreshCw, RotateCcw, Share2, Undo2,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import type { Product } from '../types';
import {
  PAINT_PALETTE, bucketFill, createSurface, rangeToAdjust, resetSurface, undoFill,
  type FillStep, type PaintSurface,
} from '../utils/paintBucket';

interface ResultScreenProps {
  image: string | null;
  error: string | null;
  product: Product;
  onTryAnother: () => void;
  onChangePhoto: () => void;
  onRetry: () => void;
  onBack: () => void;
}

interface LastFill { x: number; y: number; hex: string; adjust: number; }

const MAX_UNDO = 20;
/** 50 = automático (o app detecta a peça inteira). */
const DEFAULT_RANGE = 50;

export default function ResultScreen({
  image, error, product, onTryAnother, onChangePhoto, onRetry, onBack,
}: ResultScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<PaintSurface | null>(null);
  const historyRef = useRef<FillStep[]>([]);
  const lastFillRef = useRef<LastFill | null>(null);

  const [ready, setReady] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [undoCount, setUndoCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('1. Escolha uma cor · 2. Toque na roupa da foto.');
  const [shareNote, setShareNote] = useState<string | null>(null);

  // Carrega a imagem gerada no canvas (é ele que exibe e recebe a "tinta").
  useEffect(() => {
    setReady(false);
    surfaceRef.current = null;
    historyRef.current = [];
    lastFillRef.current = null;
    setUndoCount(0);
    if (!image) return;

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      surfaceRef.current = createSurface(ctx.getImageData(0, 0, canvas.width, canvas.height));
      setReady(true);
    };
    img.onerror = () => console.error('[ResultScreen] falha ao carregar a imagem gerada');
    img.src = image;
    return () => { cancelled = true; };
  }, [image]);

  function redraw() {
    const canvas = canvasRef.current;
    const surface = surfaceRef.current;
    if (!canvas || !surface) return;
    const ctx = canvas.getContext('2d');
    ctx?.putImageData(surface.imageData, 0, 0);
  }

  function pushStep(step: FillStep) {
    historyRef.current.push(step);
    if (historyRef.current.length > MAX_UNDO) historyRef.current.shift();
    setUndoCount(historyRef.current.length);
  }

  /** Executa o balde; retorna o motivo da falha ou null se pintou. */
  function fill(fillAt: LastFill): 'leak' | 'outside' | null {
    const surface = surfaceRef.current;
    if (!surface) return 'outside';
    const outcome = bucketFill(surface, fillAt.x, fillAt.y, fillAt.hex, fillAt.adjust);
    if (!outcome.ok) return outcome.reason;
    pushStep(outcome.step);
    lastFillRef.current = fillAt;
    redraw();
    return null;
  }

  function failureNote(reason: 'leak' | 'outside') {
    setNote(reason === 'leak'
      ? 'A tinta vazaria para o fundo, então não pintei. Diminua o alcance ou toque mais no meio da peça.'
      : 'Toque dentro da foto.');
  }

  function handleCanvasClick(event: MouseEvent<HTMLCanvasElement>) {
    const surface = surfaceRef.current;
    if (!surface || busy) return;
    if (!color) {
      setNote('Escolha uma cor primeiro e depois toque na roupa.');
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const fillAt: LastFill = {
      x: ((event.clientX - rect.left) / rect.width) * surface.width,
      y: ((event.clientY - rect.top) / rect.height) * surface.height,
      hex: color,
      adjust: rangeToAdjust(range),
    };
    setBusy(true);
    // Deixa o indicador aparecer antes do processamento.
    window.requestAnimationFrame(() => {
      try {
        const failure = fill(fillAt);
        if (failure) failureNote(failure);
        else setNote('Pronto! Toque em outra peça para pintar. Tocar numa peça já pintada troca só a cor dela.');
      } catch (err) {
        console.error('[ResultScreen] balde de tinta', err);
        setNote('Não foi possível pintar. Tente de novo.');
      } finally {
        setBusy(false);
      }
    });
  }

  function handleUndo() {
    const surface = surfaceRef.current;
    const step = historyRef.current.pop();
    if (!surface || !step) return;
    undoFill(surface, step);
    lastFillRef.current = null;
    setUndoCount(historyRef.current.length);
    redraw();
    setNote('Última pintura desfeita.');
  }

  function handleReset() {
    const surface = surfaceRef.current;
    if (!surface) return;
    resetSurface(surface);
    historyRef.current = [];
    lastFillRef.current = null;
    setUndoCount(0);
    redraw();
    setNote('Cores originais restauradas.');
  }

  /** Ao soltar o controle de alcance, refaz o último toque com o novo valor. */
  function handleRangeCommit(value: number) {
    const surface = surfaceRef.current;
    const last = lastFillRef.current;
    const adjust = rangeToAdjust(value);
    if (!surface || !last || !historyRef.current.length || last.adjust === adjust) return;
    const step = historyRef.current.pop()!;
    undoFill(surface, step);
    const failure = fill({ ...last, adjust });
    if (failure) {
      // Não deu com o novo alcance: devolve exatamente a pintura anterior.
      const restored = bucketFill(surface, last.x, last.y, last.hex, last.adjust);
      if (restored.ok) historyRef.current.push(restored.step);
      lastFillRef.current = last;
      setUndoCount(historyRef.current.length);
      redraw();
      failureNote(failure);
      return;
    }
    setNote('Área refeita com o novo alcance.');
  }

  function pickColor(hex: string) {
    setColor(hex);
    setNote('Agora toque na peça que você quer pintar.');
  }

  async function getImageBlob(): Promise<Blob | null> {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.93));
  }

  async function handleShare() {
    setShareNote(null);
    const blob = await getImageBlob();
    if (!blob) return;
    const file = new File([blob], 'meu-look-fenomenal.jpg', { type: 'image/jpeg' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Meu look Fenomenal', text: `Experimentei ${product.name} no provador Fenomenal.` });
      } else {
        downloadBlob(blob);
        setShareNote('Compartilhamento indisponível aqui; a imagem foi salva.');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      downloadBlob(blob);
      setShareNote('Não foi possível compartilhar; a imagem foi salva.');
    }
  }

  async function handleDownload() {
    const blob = await getImageBlob();
    if (blob) downloadBlob(blob);
  }

  if (error) {
    return (
      <main className="flex min-h-[100dvh] flex-col bg-white">
        <TopBar onBack={onBack} title="Resultado" />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-7 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-action-pale text-action"><AlertCircle className="h-8 w-8" /></span>
          <div>
            <h1 className="page-title">Não deu certo desta vez.</h1>
            <p role="alert" className="mt-3 text-sm leading-6 text-ink/60">{error}</p>
          </div>
          <div className="w-full space-y-3">
            <button onClick={onRetry} className="btn-action w-full"><RotateCcw className="h-4 w-4" /> Tentar novamente</button>
            <button onClick={onTryAnother} className="btn-secondary w-full">Escolher outra peça</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-white">
      <TopBar onBack={onBack} title="Seu resultado" />
      <div className="space-y-5 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5">
        <div className="px-1">
          <p className="eyebrow">Look criado</p>
          <h1 className="page-title mt-2">Você de Fenomenal.</h1>
          <p className="mt-2 text-sm text-ink/55">{product.name}</p>
        </div>

        <div className="relative overflow-hidden rounded-md border border-line bg-fog shadow-card">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            aria-label="Resultado do provador. Toque na roupa para pintar com a cor escolhida."
            className={`block h-auto w-full select-none ${color ? 'cursor-crosshair' : 'cursor-default'}`}
          />
          {!ready && <div className="absolute inset-0 flex min-h-64 items-center justify-center text-sm font-bold text-brand">Carregando imagem…</div>}
          {busy && <div role="status" className="absolute inset-0 flex items-center justify-center bg-white/40 text-xs font-black uppercase tracking-wider text-brand">Pintando…</div>}
          {color && ready && (
            <span className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-black text-ink shadow-card">
              <PaintBucket className="h-3.5 w-3.5 text-brand" />
              <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: color }} />
              Toque para pintar
            </span>
          )}
        </div>

        <section className="rounded-md border border-line bg-fog p-4" aria-labelledby="bucket-title">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <PaintBucket className="h-4 w-4 text-brand" />
              <h2 id="bucket-title" className="text-xs font-black uppercase tracking-[0.14em]">Balde de tinta</h2>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={handleUndo} disabled={!undoCount || busy} className="btn-ghost min-h-9 px-3 py-1.5 text-xs disabled:opacity-35" aria-label="Desfazer última pintura">
                <Undo2 className="h-4 w-4" /> Desfazer
              </button>
              <button type="button" onClick={handleReset} disabled={!undoCount || busy} className="btn-ghost min-h-9 px-3 py-1.5 text-xs disabled:opacity-35">
                Original
              </button>
            </div>
          </div>
          <p aria-live="polite" className="mt-2 text-xs leading-5 text-ink/60">{note}</p>

          <div className="-mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Cor do balde de tinta">
            {PAINT_PALETTE.map((c) => (
              <Swatch key={c.hex} label={c.name} hex={c.hex} active={color === c.hex} onClick={() => pickColor(c.hex)} />
            ))}
            <label className="flex shrink-0 cursor-pointer flex-col items-center gap-1.5">
              <span
                className={`relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 ${color && !PAINT_PALETTE.some((c) => c.hex === color) ? 'border-brand ring-2 ring-brand/20 ring-offset-2' : 'border-white ring-1 ring-line'}`}
                style={{ background: 'conic-gradient(#db1431,#fbb92f,#2f9e5f,#1f5fe0,#ff619b,#db1431)' }}
              >
                <Plus className="h-4 w-4 text-white drop-shadow" />
                <input
                  type="color"
                  aria-label="Escolher qualquer cor"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  value={color ?? '#1f5fe0'}
                  onChange={(e) => pickColor(e.target.value)}
                />
              </span>
              <span className="text-[10px] font-bold text-ink/55">Outra</span>
            </label>
          </div>

          <label className="mt-4 block">
            <span className="flex items-center justify-between text-[11px] font-bold text-ink/60">
              <span>Alcance do balde</span>
              <span className="text-ink/40">{range < 45 ? 'Menor' : range > 55 ? 'Maior' : 'Automático'}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={range}
              onChange={(e) => setRange(Number(e.target.value))}
              onPointerUp={(e) => handleRangeCommit(Number(e.currentTarget.value))}
              onTouchEnd={(e) => handleRangeCommit(Number(e.currentTarget.value))}
              onKeyUp={(e) => handleRangeCommit(Number(e.currentTarget.value))}
              className="mt-2 w-full accent-[#120a8f]"
            />
            <span className="mt-1 block text-[10px] leading-4 text-ink/40">No meio, o app detecta a peça sozinho. Se faltou pintar, arraste para "Maior"; se pintou além da roupa, para "Menor". O último toque é refeito na hora.</span>
          </label>

          <p className="mt-3 text-[10px] leading-4 text-ink/40">Simulação visual feita no aparelho, sem IA. As cores podem não estar disponíveis para compra.</p>
        </section>

        {shareNote && <p role="status" className="text-center text-xs font-bold text-brand">{shareNote}</p>}

        <div className="space-y-3">
          <button onClick={handleShare} disabled={!ready} className="btn-action w-full"><Share2 className="h-4 w-4" /> Compartilhar look</button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={onTryAnother} className="btn-secondary"><RefreshCw className="h-4 w-4" /> Outra peça</button>
            <button onClick={handleDownload} disabled={!ready} className="btn-secondary"><Download className="h-4 w-4" /> Salvar</button>
          </div>
          <button onClick={onChangePhoto} className="btn-ghost w-full"><Camera className="h-4 w-4" /> Trocar minha foto</button>
          <a href={product.productUrl} target="_blank" rel="noopener noreferrer" className="btn-primary w-full">Ver na loja Fenomenal <ExternalLink className="h-4 w-4" /></a>
        </div>
      </div>
    </main>
  );
}

function Swatch({ label, hex, active, onClick }: { label: string; hex: string; active: boolean; onClick: () => void }) {
  const n = parseInt(hex.slice(1), 16);
  const light = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150;
  return (
    <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} className="flex shrink-0 flex-col items-center gap-1.5">
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full border-2 ${active ? 'border-brand ring-2 ring-brand/20 ring-offset-2' : 'border-white ring-1 ring-line'}`}
        style={{ backgroundColor: hex }}
      >
        {active && <Check className={`h-4 w-4 ${light ? 'text-ink' : 'text-white'}`} />}
      </span>
      <span className="max-w-14 truncate text-[10px] font-bold text-ink/55">{label}</span>
    </button>
  );
}

function downloadBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'meu-look-fenomenal.jpg';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
