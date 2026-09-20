import { useCallback, useState } from 'react';
import AppShell from './components/AppShell';
import HomeScreen from './pages/HomeScreen';
import PhotoScreen from './pages/PhotoScreen';
import CatalogScreen from './pages/CatalogScreen';
import ProductScreen from './pages/ProductScreen';
import GeneratingScreen from './pages/GeneratingScreen';
import ResultScreen from './pages/ResultScreen';
import { generateTryOn } from './services/generate';
import { hasRealImage } from './utils/placeholder';
import type { Product, ScreenName } from './types';

export default function App() {
  const [screen, setScreen] = useState<ScreenName>('home');
  const [photo, setPhoto] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [color, setColor] = useState<string | null>(null);

  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = useCallback((s: ScreenName) => setScreen(s), []);

  const runGeneration = useCallback(
    async (p: Product, selectedColor: string | null) => {
      if (!photo) {
        go('photo');
        return;
      }
      setError(null);
      setResult(null);
      setProduct(p);
      setColor(selectedColor);
      go('generating');

      // Só enviamos imagem do produto quando ela é REAL. A ilustração de marca
      // não representa a peça, então nesse caso a IA gera a partir da descrição.
      const productImage = hasRealImage(p)
        ? await toDataUrl(p.image)
        : undefined;

      const response = await generateTryOn({
        userImage: photo,
        productImage,
        product: {
          name: p.name,
          category: p.category,
          description: p.description,
          color: selectedColor ?? undefined,
        },
      });

      if (response.image) {
        setResult(response.image);
        setError(null);
      } else {
        setError(response.error ?? 'Não foi possível gerar seu look.');
      }
      go('result');
    },
    [photo, go],
  );

  const handleTryOn = useCallback(
    (p: Product, selectedColor: string | null) => {
      void runGeneration(p, selectedColor);
    },
    [runGeneration],
  );

  return (
    <AppShell>
      {screen === 'home' && <HomeScreen onStart={() => go('photo')} />}

      {screen === 'photo' && (
        <PhotoScreen
          photo={photo}
          onPhoto={(d) => setPhoto(d)}
          onBack={() => go('home')}
          onContinue={() => go('catalog')}
        />
      )}

      {screen === 'catalog' && (
        <CatalogScreen
          onBack={() => go(photo ? 'photo' : 'home')}
          onSelectProduct={(p) => {
            setProduct(p);
            go('product');
          }}
        />
      )}

      {screen === 'product' && product && (
        <ProductScreen
          product={product}
          onBack={() => go('catalog')}
          onTryOn={handleTryOn}
        />
      )}

      {screen === 'generating' && product && <GeneratingScreen product={product} />}

      {screen === 'result' && product && (
        <ResultScreen
          image={result}
          error={error}
          product={product}
          onTryAnother={() => go('catalog')}
          onChooseColor={() => go('product')}
          onChangePhoto={() => go('photo')}
          onRetry={() => handleTryOn(product, color)}
          onBack={() => go('catalog')}
        />
      )}
    </AppShell>
  );
}

/**
 * Converte qualquer imagem (URL http/https, dataURL ou SVG dataURL) em um
 * dataURL raster (PNG), para enviar como referência à Function.
 * Se falhar (ex.: imagem remota sem CORS), retorna undefined e o backend
 * gera apenas a partir da descrição textual.
 */
async function toDataUrl(src: string): Promise<string | undefined> {
  try {
    const img = await loadImage(src);
    // Limita a dimensão e exporta em JPEG para manter o payload pequeno.
    const maxDim = 1024;
    let w = img.naturalWidth || 768;
    let h = img.naturalHeight || 1024;
    if (w > maxDim || h > maxDim) {
      const scale = Math.min(maxDim / w, maxDim / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    // Fundo branco para achatar eventual transparência ao converter em JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch (err) {
    console.warn('[App] não foi possível rasterizar a imagem do produto', err);
    return undefined;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
