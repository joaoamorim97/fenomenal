export interface ProductColor {
  /** Nome da cor exibido ao usuário (ex.: "Preto") */
  name: string;
  /** Cor CSS aproximada apenas para o "swatch" visual (ex.: "#111") */
  hex?: string;
}

export interface Product {
  id: string;
  /** Código público do produto na Fenomenal (ex.: PRD-014571), quando disponível */
  code?: string;
  name: string;
  category: string;
  description: string;
  /** Preço formatado em BRL, ou null quando não disponível publicamente */
  price: string | null;
  /** URL pública/local da imagem real do produto. */
  image: string;
  /** URL da página real do produto (ou da categoria real) na Fenomenal */
  productUrl: string;
  colors: ProductColor[];
  sizes: string[];
}

export type ScreenName =
  | 'home'
  | 'photo'
  | 'catalog'
  | 'product'
  | 'generating'
  | 'result';

/** Payload enviado para a Netlify Function */
export interface GenerateRequest {
  /** Foto do usuário em dataURL (base64). */
  userImage: string;
  /** Imagem real do produto usada como referência visual. */
  productImage: string;
  product: {
    id: string;
    name: string;
    category: string;
    description: string;
  };
}

export interface GenerateResponse {
  /** Imagem gerada em dataURL (base64 png) */
  image?: string;
  error?: string;
  /** Código interno de erro para tratamento amigável no frontend */
  code?: string;
}
