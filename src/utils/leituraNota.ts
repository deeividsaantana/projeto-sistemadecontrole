import type { Empresa, Material, MovimentoMaterial } from '../types';

/**
 * Leitura de nota fiscal (DANFE) a partir do texto já extraído do PDF ou da
 * foto. Tudo roda no aparelho, sem serviço pago: o texto vem do pdf.js ou do
 * leitor de texto da foto, e aqui só se procura o que importa para lançar a
 * entrada. O resultado sempre passa pela conferência da pessoa antes de
 * virar movimento, então errar para "vazio" é melhor que inventar.
 */

export interface ItemNotaLido {
  descricao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface NotaLida {
  numero: string;
  dataEmissao: string; // YYYY-MM-DD, ou vazio
  fornecedorNome: string;
  fornecedorCnpj: string;
  itens: ItemNotaLido[];
}

/** "1.234,56" → 1234.56; "12,5" → 12.5; "1234.5" → 1234.5. */
export const numeroBr = (texto: string): number => {
  const limpo = String(texto || '').replace(/[^\d.,-]/g, '');
  if (!limpo) return 0;
  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo;
  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : 0;
};

const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
const simplificar = (texto: string) => semAcento(String(texto || '')).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const dataIso = (ddmmaaaa: string) => {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmaaaa);
  return partes ? `${partes[3]}-${partes[2]}-${partes[1]}` : '';
};

const lerNumero = (texto: string) => {
  const perto = /N[º°oO.]?\s*[:.]?\s*(\d{1,3}(?:\.\d{3})+|\d{3,9})/.exec(texto.slice(texto.search(/NF-?E|DANFE|NOTA FISCAL/i) >= 0 ? texto.search(/NF-?E|DANFE|NOTA FISCAL/i) : 0));
  return perto ? perto[1].replace(/\./g, '').replace(/^0+(?=\d)/, '') : '';
};

const lerData = (texto: string) => {
  const aposEmissao = /EMISS[AÃ]O[^\d]{0,40}(\d{2}\/\d{2}\/\d{4})/i.exec(texto);
  if (aposEmissao) return dataIso(aposEmissao[1]);
  const qualquer = /(\d{2}\/\d{2}\/\d{4})/.exec(texto);
  return qualquer ? dataIso(qualquer[1]) : '';
};

const lerFornecedor = (texto: string) => {
  // O canhoto da DANFE traz "RECEBEMOS DE <EMITENTE> OS PRODUTOS...".
  const canhoto = /RECEBEMOS\s+DE\s+(.+?)\s+OS\s+(?:PRODUTOS|SERVI)/is.exec(texto);
  if (canhoto) return canhoto[1].replace(/\s+/g, ' ').trim().slice(0, 120);
  return '';
};

const UNIDADES = 'UN|UND|UNID|PC|PCS|PÇ|M|M2|M3|MT|ML|KG|TON|T|TN|L|LT|CX|SC|SACO|BR|BARRA|RL|GL|PAR|JG|CJ|VB|FD|LATA';
// Linha de produto da DANFE: ... descrição  NCM(8)  CST(3)  CFOP(4)  UN  QTD  V.UNIT  V.TOTAL
const LINHA_PRODUTO = new RegExp(
  `^(.*?)\\s+(\\d{8})\\s+(?:\\d{2,4}\\s+)?([5-7]\\d{3})\\s+(${UNIDADES})\\s+([\\d.,]+)\\s+([\\d.,]+)\\s+([\\d.,]+)`,
  'i',
);

const lerItens = (linhas: string[]): ItemNotaLido[] => {
  const itens: ItemNotaLido[] = [];
  for (const linha of linhas) {
    const achou = LINHA_PRODUTO.exec(linha.replace(/\s+/g, ' ').trim());
    if (!achou) continue;
    // O código do produto vem antes da descrição; tira o primeiro "token"
    // quando ele parece código (só dígitos/letras curtas com dígito).
    const partes = achou[1].trim().split(' ');
    if (partes.length > 1 && /\d/.test(partes[0]) && partes[0].length <= 15) partes.shift();
    const quantidade = numeroBr(achou[5]);
    const valorUnitario = numeroBr(achou[6]);
    const valorTotal = numeroBr(achou[7]);
    if (!quantidade) continue;
    itens.push({
      descricao: partes.join(' ').trim(),
      unidade: achou[4].toUpperCase(),
      quantidade,
      valorUnitario,
      valorTotal,
    });
  }
  return itens;
};

export const lerTextoNota = (texto: string): NotaLida => {
  const linhas = String(texto || '').split(/\r?\n/);
  const corrido = linhas.join(' ');
  const cnpj = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/.exec(corrido);
  return {
    numero: lerNumero(corrido),
    dataEmissao: lerData(corrido),
    fornecedorNome: lerFornecedor(corrido),
    fornecedorCnpj: cnpj ? cnpj[0] : '',
    itens: lerItens(linhas),
  };
};

/** Material do cadastro mais parecido com a descrição da nota, ou nenhum. */
export const materialParecido = (descricao: string, materiais: readonly Material[]): Material | undefined => {
  const alvo = new Set(simplificar(descricao).split(' ').filter(parte => parte.length > 1));
  if (!alvo.size) return undefined;
  let melhor: Material | undefined;
  let nota = 0;
  for (const material of materiais) {
    const palavras = simplificar(material.descricao).split(' ').filter(parte => parte.length > 1);
    if (!palavras.length) continue;
    const comuns = palavras.filter(parte => alvo.has(parte)).length;
    const pontos = comuns / Math.max(palavras.length, alvo.size);
    if (pontos > nota) { nota = pontos; melhor = material; }
  }
  return nota >= 0.34 ? melhor : undefined;
};

const soDigitos = (texto: string) => String(texto || '').replace(/\D/g, '');

export const fornecedorDaNota = (nota: Pick<NotaLida, 'fornecedorCnpj' | 'fornecedorNome'>, empresas: readonly Empresa[]): Empresa | undefined => {
  const cnpj = soDigitos(nota.fornecedorCnpj);
  if (cnpj) {
    const porCnpj = empresas.find(item => soDigitos(item.cnpj) === cnpj);
    if (porCnpj) return porCnpj;
  }
  const nome = simplificar(nota.fornecedorNome);
  if (!nome) return undefined;
  return empresas.find(item => {
    const outro = simplificar(item.nome);
    return outro && (nome.includes(outro) || outro.includes(nome));
  });
};

export interface LinhaConferida {
  materialId: string;
  quantidade: number;
  valorUnitario: number;
}

/** Entradas prontas para o estoque, uma por linha conferida com material. */
export const entradasDaNota = (
  nota: Pick<NotaLida, 'numero' | 'dataEmissao'>,
  linhas: readonly LinhaConferida[],
  materiais: readonly Material[],
  fornecedor: Empresa | undefined,
  contexto: { hoje: string; responsavel: string; agora?: Date },
): MovimentoMaterial[] => {
  const agora = contexto.agora ?? new Date();
  return linhas.flatMap((linha, posicao) => {
    const material = materiais.find(item => item.id === linha.materialId);
    if (!material || !(linha.quantidade > 0)) return [];
    const valorUnitario = linha.valorUnitario > 0 ? linha.valorUnitario : undefined;
    return [{
      id: `mov-${agora.getTime()}-nf${posicao}`,
      criadoEm: agora.toISOString(),
      responsavel: contexto.responsavel,
      data: nota.dataEmissao || contexto.hoje,
      tipo: 'Entrada',
      materialId: material.id,
      materialDescricao: material.descricao,
      quantidade: linha.quantidade,
      quantidadeNota: linha.quantidade,
      unidade: material.unidade,
      fornecedorId: fornecedor?.id,
      fornecedorNome: fornecedor?.nome,
      notaFiscal: nota.numero || undefined,
      valorUnitario,
      valorTotal: valorUnitario ? Number((valorUnitario * linha.quantidade).toFixed(2)) : undefined,
      observacao: 'Lançado pelo leitor de notas',
    } satisfies MovimentoMaterial];
  });
};
