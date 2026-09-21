# Fenomenal · Provador Virtual com IA

MVP de um **provador virtual** para a loja [Fenomenal](https://www.fenomenal.com.br/).
A pessoa envia uma foto (câmera ou galeria), escolhe uma peça do catálogo e a
IA gera uma imagem dela **usando o produto**, preservando rosto, corpo, pose,
cenário e iluminação.

Fluxo: **Foto → Produto → OpenAI → Imagem**

```
CELULAR → React + TS
   │
   ├─(1) POST imagens → submit-tryon (síncrona)  → grava no Netlify Blobs
   │
   ├─(2) POST { jobId } → generate-image-background (Background, até 15 min)
   │                     ├─ lê imagens do Blobs
   │                     ├─ OpenAI (gpt-image-1, input_fidelity high)
   │                     └─ grava resultado no Blobs
   │
   └─(3) polling → generate-status ← lê o resultado no Blobs
```

Por que essa divisão? A geração leva ~12s e as Netlify Functions **síncronas**
têm limite de **10s no plano gratuito** — daí a Background Function (roda até
15 min). Mas a Background é invocada de forma **assíncrona**, cujo corpo de
requisição é pequeno (~256 KB), o que não comporta as imagens. Por isso as
imagens vão primeiro para a função **síncrona** `submit-tryon` (limite ~4,5 MB),
que as grava no **Netlify Blobs**; a Background é disparada só com o `jobId`
(corpo minúsculo), lê as imagens do Blobs, gera e grava o resultado; e o app faz
*polling* em `generate-status`. Tudo serverless, sem banco de dados.

- **Frontend:** React + TypeScript + Vite + Tailwind CSS + lucide-react
- **Backend:** função síncrona de submit + Background Function + função de status (a chave da OpenAI vive só no servidor)
- **Armazenamento temporário do resultado:** Netlify Blobs (nativo, sem config)
- **Modelo de imagem:** `gpt-image-1` com `input_fidelity: high` (endpoint `images/edits`) — preserva o rosto/identidade da pessoa. Configurável por env (o `gpt-image-1-mini` é mais barato, mas **não** preserva o rosto).
- Sem banco de dados, sem login, sem Firebase/Supabase/AWS. Mobile-first (~390×844).

---

## 1. Como instalar

Pré-requisitos: **Node.js 18+** e npm.

```bash
npm install
```

## 2. Como executar localmente

### Opção A — Fluxo completo (com geração de imagem)

As Background Functions e o Netlify Blobs só rodam com a **Netlify CLI**. Ela não
faz parte das dependências do projeto (para manter os deploys leves); use via
`npx`, sem instalar nada global:

```bash
# com a OPENAI_API_KEY no .env (veja a seção 3):
npx netlify dev
```

Acesse a URL indicada (normalmente `http://localhost:8888`). A CLI sobe o Vite,
as functions e um Blobs local — o fluxo de geração funciona de ponta a ponta.

### Opção B — Só o frontend (sem geração de imagem)

```bash
npm run dev
```

Abre em `http://localhost:5173`. Navegação, catálogo e foto funcionam, mas a
geração falha (não há Function/Blobs rodando) — útil só para ajustar a interface.

## 3. Como configurar a `OPENAI_API_KEY`

A chave **nunca** vai para o frontend. Ela é lida apenas dentro da Function.

1. Copie o exemplo:

   ```bash
   cp .env.example .env
   ```

2. Edite o `.env` e preencha:

   ```
   OPENAI_API_KEY=sk-...
   ```

O arquivo `.env` está no `.gitignore` e **não deve ser versionado**.

> O `npx netlify dev` carrega automaticamente o `.env`.

Variáveis opcionais (têm padrões sensatos para o MVP):

| Variável                | Padrão         | Descrição                                                                 |
| ----------------------- | -------------- | ------------------------------------------------------------------------- |
| `OPENAI_API_KEY`        | —              | **Obrigatória.** Chave da OpenAI.                                         |
| `TRYON_MODEL`           | `gpt-image-1`  | Modelo de imagem. Use `gpt-image-1-mini` para economizar (não preserva o rosto). |
| `TRYON_INPUT_FIDELITY`  | `high`         | `high` preserva rosto/detalhes (só nos modelos completos; ignorado no `mini`). |
| `TRYON_IMAGE_QUALITY`   | `low`          | Qualidade da geração (`low` para gastar pouco; `medium`/`high` para mais detalhe). |
| `TRYON_IMAGE_SIZE`      | `1024x1536`    | Resolução (retrato).                                                      |

> **Fidelidade do rosto x custo:** `gpt-image-1` + `input_fidelity: high` mantém a
> mesma pessoa, mas custa mais que o `mini`. O `gpt-image-1-mini` **não** suporta
> `input_fidelity: high` (a API retorna 400) e tende a alterar o rosto — por isso
> o padrão é o `gpt-image-1`.

## 4. Como testar a geração

1. Rode `npx netlify dev` com a `OPENAI_API_KEY` configurada.
2. Abra a URL no navegador (ou no celular na mesma rede — a CLI mostra a URL de rede).
3. **Experimentar agora → Minha foto:** tire uma foto ou escolha da galeria.
4. **Continuar → Catálogo:** busque/filtre e toque em um produto.
5. Na tela do produto, toque em **Experimentar este produto**.
6. A tela "Preparando seu look…" fica em polling enquanto a IA gera (~10–20s).
7. Teste os botões: **Compartilhar**, **Outro produto**, **Trocar minha foto**,
   **Ver produto**.

Dica: para testar no celular via HTTPS (necessário para câmera em alguns
navegadores), use `npx netlify dev --live` ou publique um deploy de preview.

## 5. Como fazer deploy no Netlify

> **Importante:** as Background Functions e o Netlify Blobs só existem em um
> deploy real do Netlify. **Arrastar a pasta `dist` (deploy manual) NÃO publica
> as functions** — use deploy por Git (ou `npx netlify deploy`).

O projeto já vem com `netlify.toml` configurado (build, publish `dist`,
functions em `netlify/functions`).

**Via Git (recomendado):**

1. Suba o repositório para o GitHub/GitLab.
2. No painel do Netlify: *Add new site → Import from Git*.
3. O Netlify lê o `netlify.toml`. Confirme:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
4. Configure a variável de ambiente (seção 6) e refaça o deploy.

O Netlify Blobs é provisionado automaticamente para o site — não precisa criar
nem configurar nada.

**Via CLI (sem Git):**

```bash
npx netlify deploy --build --prod
```

## 6. Como configurar a variável de ambiente no Netlify

No painel do site: **Site configuration → Environment variables → Add a variable**

- Key: `OPENAI_API_KEY`
- Value: sua chave `sk-...`
- Scopes: marque *Functions* (e *Builds* se quiser).

Depois, faça um novo deploy para a Function passar a enxergar a variável.
Também dá para setar pela CLI: `npx netlify env:set OPENAI_API_KEY sk-...`.

---

## Estrutura do projeto

```
src/
  components/    AppShell, TopBar, BrandMark, ProductCard
  pages/         Home, Photo, Catalog, Product, Generating, Result
  data/          products.json (catálogo local)
  services/      catalog.ts (busca/filtro), generate.ts (dispara + polling)
  utils/         image.ts (validação/resize), placeholder.ts (ilustração de marca)
  types/         tipagens compartilhadas
netlify/
  functions/
    submit-tryon.mts               (síncrona: grava as imagens no Blobs)
    generate-image-background.mts  (Background: lê Blobs → OpenAI → grava resultado)
    generate-status.mts            (lê o resultado no Blobs; usado no polling)
public/
  products/      imagens reais dos produtos (*.webp)
.env.example
netlify.toml
```

## Segurança e custo

- A `OPENAI_API_KEY` **só** existe na Function (variável de ambiente). Nunca é
  enviada ao navegador nem versionada.
- A Function valida tipo/tamanho das imagens e limita o payload.
- A foto do usuário é redimensionada no navegador (máx. 1280px, JPEG) e a imagem
  do produto é reduzida (máx. 1024px, JPEG) antes do envio, reduzindo custo e latência.
- A geração só acontece ao tocar em **Experimentar este produto** — navegar no
  catálogo não consome nada.
- `gpt-image-1` + `input_fidelity: high` para preservar o rosto; `quality: low`
  para segurar o custo. Para economizar mais (abrindo mão da fidelidade do rosto),
  defina `TRYON_MODEL=gpt-image-1-mini`.
- O resultado é gravado no Netlify Blobs e **apagado** assim que o app o lê
  (o `generate-status` remove o blob ao entregar `done`/`error`), evitando acúmulo.

> **Por que Background Function:** funções síncronas do Netlify têm limite de
> **10s no plano gratuito** (só até 26s no Pro), e a geração leva ~12s. A
> Background Function roda até 15 min, então não esbarra nesse limite. O custo é
> contado como invocação de função (o plano gratuito inclui 125 mil/mês).

---

## Sobre o catálogo (dados da Fenomenal)

Os produtos em `src/data/products.json` foram **coletados de informações
públicas** da Fenomenal (nomes, códigos `PRD-`, categorias, preços exibidos,
alguns tamanhos/descrições e as URLs reais dos produtos). Nada foi inventado.

### Imagens dos produtos

As **imagens oficiais** de 14 produtos (blusas, baby look e conjuntos) foram
baixadas do site e salvas em `public/products/*.webp`, e já estão vinculadas no
`products.json` (campo `image`). Esses produtos aparecem com a **foto real** e a
IA usa essa foto como **referência visual** na geração.

> Como foram obtidas: o site responde **HTTP 403** às ferramentas de servidor,
> mas a partir de uma máquina comum (com User-Agent de navegador) as páginas
> abrem normalmente. O script `scripts/fetch-images.ps1` abre cada página de
> produto, lê a `og:image` (que aponta para o CDN CloudFront da loja) e baixa a
> versão em alta resolução (`_z`), com uma pausa entre as requisições. Para
> rodar de novo / adicionar mais: `powershell -ExecutionPolicy Bypass -File scripts/fetch-images.ps1`.

O catálogo agora inclui **apenas produtos com foto real** — os itens que só
tinham ilustração (sem imagem extraída) foram removidos. Para adicionar mais,
rode o script de imagens e inclua o item no `products.json`.

### Cores (recolorização, sem IA)

Na tela de resultado há uma **paleta de cores** abaixo da imagem gerada. Ao
tocar numa cor, a **roupa é recolorida no próprio navegador** (sem chamar a IA e
sem custo): isolamos a peça na faixa do torso (o rosto/cabelo nunca são
afetados) e aplicamos a cor preservando dobras e sombras. É uma **visualização**
para experimentar cores — não representa os SKUs de cor vendidos (o site não
expõe a paleta real por produto). A paleta some automaticamente se não for
possível isolar a peça na imagem. Código em `src/utils/recolor.ts`.

- **Cores e a maioria dos tamanhos.** Não estavam disponíveis de forma
  estruturada na coleta; foram deixados vazios em vez de inventados. Onde os
  tamanhos apareciam publicamente (ex.: kits e conjuntos), eles foram incluídos.
- **Preço total de alguns itens.** Quando só a parcela ("3x de R$ …") aparecia,
  o campo `price` foi deixado como `null` (a UI mostra "Consulte na loja") em vez
  de calcular/inventar um valor.

### Como deixar 100% fiel (opcional)

Assim que você tiver acesso às imagens dos produtos (por exemplo, exportando do
painel da loja ou copiando as URLs do CDN), basta preencher o campo `image` de
cada item em `src/data/products.json` com a URL pública. A partir daí, a IA passa
a usar a **imagem real do produto** como referência visual e o resultado fica
fiel à peça. O mesmo vale para `colors` e `sizes`.

Exemplo de item do catálogo:

```json
{
  "id": "069510-p17073",
  "name": "Blusa medieval fenomenal",
  "category": "Blusas",
  "description": "Blusa medieval da Fenomenal.",
  "price": "R$ 44,00",
  "image": "",
  "productUrl": "https://www.fenomenal.com.br/blusa-medieval-fenomenal-069510-p17073",
  "colors": [],
  "sizes": []
}
```
```json
{
  "id": "produto-com-imagem",
  "name": "...",
  "image": "https://.../imagem-real-do-produto.jpg",
  "colors": [{ "name": "Preto", "hex": "#111111" }],
  "sizes": ["P", "M", "G", "GG"]
}
```

## Prompt da IA

O prompt (em `netlify/functions/generate-image.ts`) instrui o modelo a **preservar
a pessoa** — rosto/identidade, cabelo, tom de pele, proporções, pose, cenário e
iluminação — e a **alterar apenas a roupa**, mantendo fidelidade à peça de
referência (cor, corte, estampa, detalhes), sem adicionar logos/estampas
inexistentes. A intenção é: *a mesma pessoa da foto, usando o produto Fenomenal.*
