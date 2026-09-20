import { useRef, useState } from 'react';
import { Camera, ImageUp, RefreshCw, ArrowRight, Info } from 'lucide-react';
import TopBar from '../components/TopBar';
import { processImageFile, AppImageError } from '../utils/image';

interface PhotoScreenProps {
  photo: string | null;
  onPhoto: (dataUrl: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

export default function PhotoScreen({
  photo,
  onPhoto,
  onBack,
  onContinue,
}: PhotoScreenProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const { dataUrl } = await processImageFile(file);
      onPhoto(dataUrl);
    } catch (err) {
      if (err instanceof AppImageError) {
        setError(err.message);
      } else {
        console.error('[PhotoScreen] erro ao processar imagem', err);
        setError('Não foi possível usar essa imagem. Tente outra.');
      }
    } finally {
      setLoading(false);
      // permite reselecionar o mesmo arquivo
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar onBack={onBack} title="Minha foto" />

      <div className="flex flex-1 flex-col gap-6 px-6 py-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">
            Sua foto
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Vamos usar sua foto para vestir você com as peças da Fenomenal.
          </p>
        </div>

        {/* Preview / placeholder */}
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl border border-ink/10 bg-white">
          {photo ? (
            <img src={photo} alt="Sua foto" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-ink/40">
              <Camera className="h-10 w-10" strokeWidth={1.2} />
              <span className="text-sm">Nenhuma foto selecionada</span>
            </div>
          )}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-ink/70">
              Processando…
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-2xl bg-accent/10 px-4 py-3 text-[13px] leading-relaxed text-ink/70">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-dark" />
          <span>
            Para obter um resultado melhor, use uma foto de frente e com boa
            iluminação.
          </span>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* inputs ocultos */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        <div className="mt-auto flex flex-col gap-3">
          {!photo ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="btn-secondary flex-col gap-2 py-5"
              >
                <Camera className="h-5 w-5" />
                Tirar foto
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="btn-secondary flex-col gap-2 py-5"
              >
                <ImageUp className="h-5 w-5" />
                Galeria
              </button>
            </div>
          ) : (
            <>
              <button onClick={onContinue} className="btn-primary w-full">
                Continuar
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="btn-ghost w-full"
              >
                <RefreshCw className="h-4 w-4" />
                Trocar foto
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
