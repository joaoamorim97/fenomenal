import { useState } from 'react';
import {
  Share2,
  RefreshCw,
  Palette,
  Camera,
  ExternalLink,
  RotateCcw,
  Download,
  AlertCircle,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import type { Product } from '../types';
import { dataUrlToBlob } from '../utils/image';

interface ResultScreenProps {
  image: string | null;
  error: string | null;
  product: Product;
  onTryAnother: () => void;
  onChooseColor: () => void;
  onChangePhoto: () => void;
  onRetry: () => void;
  onBack: () => void;
}

export default function ResultScreen({
  image,
  error,
  product,
  onTryAnother,
  onChooseColor,
  onChangePhoto,
  onRetry,
  onBack,
}: ResultScreenProps) {
  const [shareNote, setShareNote] = useState<string | null>(null);

  async function handleShare() {
    if (!image) return;
    setShareNote(null);
    try {
      const blob = dataUrlToBlob(image);
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

      // Fallback: download da imagem
      triggerDownload(image);
      setShareNote('Compartilhamento não suportado. A imagem foi baixada.');
    } catch (err) {
      // AbortError = usuário cancelou o share; ignorar silenciosamente
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('[ResultScreen] erro ao compartilhar', err);
      triggerDownload(image);
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

        <div className="overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-soft animate-fade-in">
          {image && (
            <img src={image} alt="Seu look gerado" className="w-full object-cover" />
          )}
        </div>

        {shareNote && (
          <p className="text-center text-xs text-ink/50">{shareNote}</p>
        )}

        <div className="mt-2 flex flex-col gap-3">
          <button onClick={handleShare} className="btn-primary w-full">
            <Share2 className="h-4 w-4" />
            Compartilhar
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={onTryAnother} className="btn-secondary">
              <RefreshCw className="h-4 w-4" />
              Outro produto
            </button>
            {product.colors.length > 0 ? (
              <button onClick={onChooseColor} className="btn-secondary">
                <Palette className="h-4 w-4" />
                Outra cor
              </button>
            ) : (
              <button onClick={() => image && triggerDownload(image)} className="btn-secondary">
                <Download className="h-4 w-4" />
                Salvar
              </button>
            )}
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

function triggerDownload(dataUrl: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'meu-look-fenomenal.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
