import { useCallback, useEffect, useRef, useState } from 'react';
import AppShell from './components/AppShell';
import CatalogScreen from './pages/CatalogScreen';
import GeneratingScreen from './pages/GeneratingScreen';
import HomeScreen from './pages/HomeScreen';
import PhotoScreen from './pages/PhotoScreen';
import ProductScreen from './pages/ProductScreen';
import ResultScreen from './pages/ResultScreen';
import { generateTryOn } from './services/generate';
import type { Product, ScreenName } from './types';

export default function App() {
  const [screen, setScreen] = useState<ScreenName>('home');
  const [photo, setPhoto] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const attemptRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const go = useCallback((next: ScreenName) => setScreen(next), []);

  const runGeneration = useCallback(async (selected: Product) => {
    if (!photo || controllerRef.current) {
      if (!photo) go('photo');
      return;
    }

    const attempt = ++attemptRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsGenerating(true);
    setError(null);
    setResult(null);
    setProduct(selected);
    go('generating');

    try {
      const productImage = await productToDataUrl(selected.image);
      if (!productImage) throw new Error('Imagem real do produto indisponível.');

      const response = await generateTryOn({
        userImage: photo,
        productImage,
        product: {
          id: selected.id,
          name: selected.name,
          category: selected.category,
          description: selected.description,
        },
      }, controller.signal);

      if (attempt !== attemptRef.current || response.code === 'ABORTED') return;
      if (response.image) {
        setResult(response.image);
      } else {
        setError(response.error || 'Não foi possível gerar seu look.');
      }
      go('result');
    } catch (generationError) {
      if (attempt !== attemptRef.current || controller.signal.aborted) return;
      console.error('[App] falha ao preparar a geração', generationError);
      setError('Não foi possível preparar a foto e a peça. Tente novamente.');
      go('result');
    } finally {
      if (attempt === attemptRef.current) {
        setIsGenerating(false);
        controllerRef.current = null;
      }
    }
  }, [go, photo]);

  const restartWithPhoto = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    attemptRef.current++;
    setIsGenerating(false);
    setResult(null);
    setError(null);
    go('photo');
  }, [go]);

  return (
    <AppShell>
      {screen === 'home' && <HomeScreen onStart={() => go('photo')} />}
      {screen === 'photo' && (
        <PhotoScreen
          photo={photo}
          onPhoto={(data) => { setPhoto(data); setResult(null); }}
          onBack={() => go('home')}
          onContinue={() => go('catalog')}
        />
      )}
      {screen === 'catalog' && (
        <CatalogScreen
          onBack={() => go(photo ? 'photo' : 'home')}
          onSelectProduct={(selected) => { setProduct(selected); go('product'); }}
        />
      )}
      {screen === 'product' && product && (
        <ProductScreen
          product={product}
          disabled={isGenerating}
          onBack={() => go('catalog')}
          onTryOn={(selected) => { void runGeneration(selected); }}
        />
      )}
      {screen === 'generating' && product && <GeneratingScreen product={product} />}
      {screen === 'result' && product && (
        <ResultScreen
          image={result}
          error={error}
          product={product}
          onTryAnother={() => go('catalog')}
          onChangePhoto={restartWithPhoto}
          onRetry={() => { void runGeneration(product); }}
          onBack={() => go('catalog')}
        />
      )}
    </AppShell>
  );
}

/** Prepara uma referência limpa e leve da peça para a API. */
async function productToDataUrl(src: string): Promise<string | undefined> {
  try {
    const img = await loadImage(src);
    const maxDimension = 1024;
    let width = img.naturalWidth || 768;
    let height = img.naturalHeight || 1024;
    const scale = Math.min(1, maxDimension / width, maxDimension / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.88);
  } catch (imageError) {
    console.error('[App] referência do produto inválida', imageError);
    return undefined;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
