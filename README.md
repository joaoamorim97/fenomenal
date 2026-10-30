# Fenomenal · Provador Virtual

MVP mobile-first de provador virtual para a [Fenomenal](https://www.fenomenal.com.br/). A pessoa envia uma foto, escolhe uma peça real do catálogo e recebe uma imagem dela usando a peça, gerada por IA. Depois pode trocar a cor de cada peça com um balde de tinta, sem IA.

## Arquitetura

```text
React/Vite
  └─ submit-tryon (síncrona)
       ├─ valida produto, imagens, tamanho e limite básico por IP
       ├─ cria jobId + token no servidor
       ├─ grava foto e referência da peça no Netlify Blobs
       └─ dispara generate-image-background só com jobId/token
             ├─ OpenAI gpt-image-1.5 / images/edits, input_fidelity=high
             └─ grava o PNG separado do status

Frontend → generate-status (polling com token) → tryon-result (PNG binário)
```

A função de background evita o limite de 10 segundos do plano gratuito. As imagens nunca vão no corpo da background function (o limite dela é pequeno); passam primeiro pela função síncrona e pelo Blobs.

## Geração

Configuração padrão:

- `gpt-image-1.5`
- `input_fidelity: high`
- `quality: medium`
- `size: 1024x1536`
- prompt em `netlify/lib/tryon-prompt.ts` (o mesmo da versão aprovada em produção)

Nenhum modelo generativo elimina 100% dos artefatos. Fotos de frente, com corpo visível e mãos afastadas da roupa dão os melhores resultados.

## Catálogo

O catálogo local fica em `src/data/products.json`, com 14 produtos e as fotos públicas em `public/products/`. O script `scripts/fetch-images.ps1` atualiza as imagens com um intervalo entre requisições.

## Balde de tinta (troca de cor sem IA)

Na tela de resultado:

1. escolha uma cor (paleta ou "Outra", que abre o seletor livre);
2. toque na peça da foto;
3. só a peça tocada é pintada, mantendo dobras e sombras.

Como funciona (`src/utils/paintBucket.ts`):

- flood fill a partir do pixel tocado, só por vizinhos conectados;
- a semelhança combina tom da cor, luminosidade, textura e bordas finas, então a tinta para na costura entre peças de mesma cor (ex.: blusa preta e legging preta) e não vaza para cabelo, pele ou fundo;
- o app calcula a área para todas as tolerâncias de uma vez e escolhe automaticamente o ponto em que a peça inteira está preenchida, antes de a tinta atravessar para outra peça;
- a borda é suavizada e buracos pequenos (botões, brilhos) são preenchidos;
- uma peça já pintada vira barreira para os próximos toques, e tocar nela de novo troca só a cor dela;
- o controle **Alcance** fica no automático no meio; arrastar para "Maior" ou "Menor" refaz o último toque na hora;
- **Desfazer** (até 20 passos) e **Original** restauram a imagem;
- se um toque fosse pintar mais de 45% da foto, nada é alterado e o app pede outro toque.

Compartilhar e salvar usam a imagem já pintada. A paleta é uma simulação visual e não representa estoque.

## Segurança e privacidade do MVP

- `OPENAI_API_KEY` existe somente nas Netlify Functions.
- Produto é validado no servidor contra o catálogo local.
- Job ID e token de acesso são gerados no servidor.
- Status e resultado exigem o token do job.
- Limites de MIME, base64, imagem e payload total são validados.
- Há limite básico por IP na instância da função.
- Input é removido em `finally`; resultado e estado são removidos após consumo.
- `cleanup-tryons` roda de hora em hora e remove blobs órfãos após 15 minutos.
- Headers de CSP, frame protection, MIME e Permissions Policy estão no `netlify.toml`.

O rate limit em memória é adequado apenas ao MVP; para tráfego maior, adote um contador distribuído e orçamento/alertas na OpenAI.

## Instalação e desenvolvimento

Requisitos: Node.js 18+ e npm.

```bash
npm install
cp .env.example .env
```

Preencha apenas o `.env` local:

```env
OPENAI_API_KEY=sk-...
TRYON_MODEL=gpt-image-1.5
TRYON_IMAGE_QUALITY=medium
TRYON_IMAGE_SIZE=1024x1536
```

Fluxo completo (frontend + Functions + Blobs local):

```bash
npx netlify dev
```

Somente frontend:

```bash
npm run dev
```

Build e validação:

```bash
npm run build
npx tsc --noEmit --skipLibCheck --moduleResolution bundler --module ESNext --target ES2022 --types node --lib ES2023,DOM --resolveJsonModule --allowSyntheticDefaultImports netlify/functions/*.mts netlify/lib/*.ts
```

## Deploy no Netlify

O repositório está preparado pelo `netlify.toml`:

- build: `npm run build`
- publish: `dist`
- functions: `netlify/functions`

Use deploy conectado ao GitHub; arrastar apenas `dist/` não publica Functions. No painel do Netlify, cadastre `OPENAI_API_KEY` em **Environment variables** com escopo de Functions e faça um novo deploy.

## Estrutura principal

```text
src/
  components/        identidade e cards
  pages/             Home, Foto, Catálogo, Produto, Geração, Resultado
  data/products.json catálogo aprovado
  services/          catálogo e job/polling
  utils/             preparo da foto (image.ts) e balde de tinta (paintBucket.ts)
netlify/
  lib/tryon-prompt.ts
  functions/
    submit-tryon.mts
    generate-image-background.mts
    generate-status.mts
    tryon-result.mts
    cleanup-tryons.ts
public/products/
netlify.toml
```

## Fontes técnicas

- [Site público da Fenomenal](https://www.fenomenal.com.br/)
- [OpenAI — GPT Image 1.5](https://developers.openai.com/api/docs/models/gpt-image-1.5)
- [Netlify — Background Functions](https://docs.netlify.com/build/functions/background-functions/)
- [Netlify — Blobs](https://docs.netlify.com/storage/blobs/)
