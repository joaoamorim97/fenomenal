import { useRef, useState } from 'react';
import { ArrowRight, Camera, ImageUp, Info, RefreshCw, ShieldCheck } from 'lucide-react';
import TopBar from '../components/TopBar';
import { AppImageError, processImageFile } from '../utils/image';

interface PhotoScreenProps {
  photo: string | null;
  onPhoto: (dataUrl: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

export default function PhotoScreen({ photo, onPhoto, onBack, onContinue }: PhotoScreenProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file || loading) return;
    const selectionId = ++selectionRef.current;
    setError(null);
    setLoading(true);
    try {
      const { dataUrl } = await processImageFile(file);
      if (selectionId === selectionRef.current) onPhoto(dataUrl);
    } catch (err) {
      if (selectionId !== selectionRef.current) return;
      if (err instanceof AppImageError) setError(err.message);
      else {
        console.error('[PhotoScreen] erro ao processar imagem', err);
        setError('Não foi possível usar essa imagem. Tente outra foto.');
      }
    } finally {
      if (selectionId === selectionRef.current) setLoading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-white">
      <TopBar onBack={onBack} title="1 · Sua foto" />
      <div className="flex flex-1 flex-col gap-5 px-5 pb-6 pt-6">
        <div>
          <p className="eyebrow">Primeiro passo</p>
          <h1 className="page-title mt-2">Mostre quem vai vestir.</h1>
          <p className="mt-3 text-sm leading-6 text-ink/60">Uma foto clara e de frente ajuda a preservar seu rosto, corpo e cenário.</p>
        </div>

        <div className="relative aspect-[3/4] overflow-hidden rounded-md border-2 border-dashed border-line bg-fog">
          {photo ? <img src={photo} alt="Foto escolhida para o provador" className="h-full w-full object-cover" /> : (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-white"><Camera className="h-7 w-7" /></span>
              <div><p className="font-black">Adicione sua foto</p><p className="mt-1 text-sm text-ink/55">JPG, PNG ou WEBP · até 12 MB</p></div>
            </div>
          )}
          {loading && <div role="status" aria-live="polite" className="absolute inset-0 flex items-center justify-center bg-white/85 text-sm font-bold text-brand">Preparando sua foto…</div>}
        </div>

        <div className="flex items-start gap-3 rounded-md border border-brand/15 bg-brand-pale px-4 py-3 text-[13px] leading-5 text-brand-dark">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Prefira corpo visível, boa iluminação e mãos sem cobrir a roupa. Fotos no espelho funcionam melhor com o celular afastado do rosto.</span>
        </div>

        {error && <p role="alert" className="rounded-md border border-action/20 bg-action-pale px-4 py-3 text-sm font-bold text-action-dark">{error}</p>}

        <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden" disabled={loading} onChange={(e) => handleFile(e.target.files?.[0])} />
        <input ref={galleryInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" disabled={loading} onChange={(e) => handleFile(e.target.files?.[0])} />

        <div className="mt-auto space-y-3 pt-1">
          {!photo ? (
            <div className="grid grid-cols-2 gap-3">
              <button disabled={loading} onClick={() => cameraInputRef.current?.click()} className="btn-primary flex-col gap-1.5 py-4"><Camera className="h-5 w-5" /> Tirar foto</button>
              <button disabled={loading} onClick={() => galleryInputRef.current?.click()} className="btn-secondary flex-col gap-1.5 py-4"><ImageUp className="h-5 w-5" /> Galeria</button>
            </div>
          ) : (
            <>
              <button disabled={loading} onClick={onContinue} className="btn-action w-full">Escolher uma peça <ArrowRight className="h-4 w-4" /></button>
              <button disabled={loading} onClick={() => galleryInputRef.current?.click()} className="btn-ghost w-full"><RefreshCw className="h-4 w-4" /> Trocar foto</button>
            </>
          )}
          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-ink/45"><ShieldCheck className="h-3.5 w-3.5" /> Sua imagem é usada temporariamente para criar o look.</p>
        </div>
      </div>
    </main>
  );
}
