interface PromptProduct {
  name: string;
  category: string;
  description: string;
}

/**
 * Prompt da versão aprovada em produção (gpt-image-1.5 + input_fidelity high).
 * A primeira imagem é a pessoa; a segunda, a referência real da peça.
 */
export function buildTryOnPrompt(product: PromptProduct): string {
  return [
    'Edite a PRIMEIRA imagem, que é a foto real de uma pessoa. A ÚNICA coisa que você pode mudar é a ROUPA. Todo o resto deve permanecer idêntico à foto original. Este é um provador virtual de moda.',
    'REGRA ABSOLUTA E INEGOCIÁVEL — NÃO MEXA NO ROSTO: é PROIBIDO alterar, redesenhar, mover, suavizar, estilizar, "melhorar", distorcer ou substituir o rosto. Trate a área do rosto e da cabeça como uma zona travada/congelada: mantenha exatamente os mesmos pixels do rosto original. Preserve com fidelidade absoluta a identidade e todos os traços: formato do rosto, olhos, sobrancelhas, nariz, boca, lábios, queixo, mandíbula, bochechas, orelhas, expressão, rugas, barba e pelos faciais, sinais, pintas, cicatrizes e maquiagem. O rosto do resultado tem que ser reconhecível como EXATAMENTE a MESMA pessoa. NUNCA gere um rosto novo, "parecido", "inspirado", mais bonito, mais jovem ou mais simétrico.',
    'É proibido deformar ou distorcer o rosto, a cabeça, o pescoço, as mãos e o corpo. Se houver qualquer conflito, priorize manter o rosto intacto acima de qualquer ajuste na roupa.',
    'ANATOMIA CORRETA — MÃOS: preserve as mãos e os dedos EXATAMENTE como na foto original, com o número correto de dedos (cinco por mão). É terminantemente proibido adicionar dedos, remover dedos, fundir dedos, criar dedos extras ou membros extras, ou distorcer mãos, dedos, braços e pernas. Nada de deformidades anatômicas.',
    'NÃO alucine: não invente objetos, acessórios, textos ou elementos que não existam na foto original; não altere o que a pessoa segura nas mãos. O resultado deve ser fotorrealista, natural e sem artefatos.',
    'PRESERVE também, sem alterar: o cabelo (cor, corte, textura e comprimento), o tom e a textura da pele, as proporções e o tipo do corpo, as mãos e os dedos, a pose, o ângulo da cabeça, o enquadramento, o fundo/cenário, os reflexos e a iluminação da foto original.',
    'NÃO troque a pessoa por outra, NÃO rejuvenesça nem envelheça, NÃO afine nem engorde o rosto ou o corpo, NÃO altere etnia, gênero ou idade. Altere APENAS a região do corpo onde fica a roupa, deixando o rosto e a cabeça exatamente como estão.',
    'Use a SEGUNDA imagem como referência visual exata da roupa. Reproduza com fidelidade a cor, o corte, o caimento, as estampas e os detalhes dessa peça. Não adicione logos, textos ou estampas que não existam na peça de referência e não remova detalhes importantes dela.',
    `Peça: ${product.name}. Categoria: ${product.category}. Detalhes: ${product.description}`,
    'Resultado fotorrealista, de alta qualidade, adequado para e-commerce de moda. Enquadre a roupa de forma natural sobre o corpo.',
  ].join('\n');
}
