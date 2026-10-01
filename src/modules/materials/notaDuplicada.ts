/**
 * Nota fiscal ou ticket repetido no mesmo material é o mesmo papel lançado
 * duas vezes. Vale o primeiro lançamento; os repetidos são desfeitos (ficam no
 * histórico com quem e quando, mas saem do saldo), nunca apagados.
 *
 * - Nota: mesmo número, mesmo fornecedor, mesmo material e mesmo tipo. Uma
 *   nota com vários materiais diferentes fica com todos.
 * - Ticket: mesmo número, mesmo material e mesmo tipo.
 */
import type { MovimentoMaterial } from '../../types';

export const CANCELADO_POR_DUPLICIDADE = 'Sistema · nota ou ticket repetido';

const normalizarTexto = (valor?: string) => (valor || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/\s+/g, ' ').trim();

/** "000.123-4" e "1234" são o mesmo número: só dígitos e letras, sem zero à esquerda. */
const normalizarNumero = (valor?: string) => normalizarTexto(valor).replace(/[^0-9A-Z]/g, '').replace(/^0+(?=.)/, '');

export const chavesDeDuplicidade = (item: MovimentoMaterial): string[] => {
  const chaves: string[] = [];
  const nota = normalizarNumero(item.notaFiscal);
  if (nota) chaves.push(['nota', item.tipo, item.materialId, normalizarTexto(item.fornecedorId || item.fornecedorNome), nota].join('|'));
  const ticket = normalizarNumero(item.ticket);
  if (ticket) chaves.push(['ticket', item.tipo, item.materialId, ticket].join('|'));
  return chaves;
};

/** O que veio antes vale: primeiro o criado mais cedo, depois a data, depois o id (para dar sempre o mesmo resultado). */
const ordemDeChegada = (a: MovimentoMaterial, b: MovimentoMaterial) =>
  (a.criadoEm || '').localeCompare(b.criadoEm || '') || a.data.localeCompare(b.data) || a.id.localeCompare(b.id);

export interface ResultadoDuplicidade {
  /** Lista completa, com os repetidos marcados como desfeitos. */
  movimentos: MovimentoMaterial[];
  /** Só os que foram desfeitos agora. */
  desfeitos: MovimentoMaterial[];
}

export const desfazerNotasRepetidas = (movimentos: readonly MovimentoMaterial[], agora: string): ResultadoDuplicidade => {
  const vistas = new Map<string, MovimentoMaterial>();
  const repetidos = new Map<string, MovimentoMaterial>();
  for (const item of movimentos.filter(mov => !mov.canceladoEm).sort(ordemDeChegada)) {
    const chaves = chavesDeDuplicidade(item);
    const original = chaves.map(chave => vistas.get(chave)).find(Boolean);
    if (original) {
      repetidos.set(item.id, original);
      continue;
    }
    chaves.forEach(chave => vistas.set(chave, item));
  }
  if (!repetidos.size) return { movimentos: [...movimentos], desfeitos: [] };
  const desfeitos: MovimentoMaterial[] = [];
  const atualizados = movimentos.map(item => {
    const original = repetidos.get(item.id);
    if (!original) return item;
    const papel = item.notaFiscal ? `nota ${item.notaFiscal}` : `ticket ${item.ticket}`;
    const desfeito: MovimentoMaterial = {
      ...item,
      canceladoEm: agora,
      canceladoPor: CANCELADO_POR_DUPLICIDADE,
      observacao: [item.observacao, `Desfeito automaticamente: ${papel} já lançada em ${original.data} (lançamento ${original.id}).`].filter(Boolean).join(' · '),
    };
    desfeitos.push(desfeito);
    return desfeito;
  });
  return { movimentos: atualizados, desfeitos };
};

/**
 * Trava da importação: tira do lote o que repete uma nota ou ticket já
 * lançado no app ou numa linha anterior do mesmo arquivo.
 */
export const separarRepetidosDaImportacao = (atuais: readonly MovimentoMaterial[], novos: readonly MovimentoMaterial[]) => {
  const vistas = new Set(atuais.filter(item => !item.canceladoEm).flatMap(chavesDeDuplicidade));
  const aceitos: MovimentoMaterial[] = [];
  let repetidos = 0;
  for (const item of novos) {
    const chaves = chavesDeDuplicidade(item);
    if (chaves.some(chave => vistas.has(chave))) {
      repetidos += 1;
      continue;
    }
    chaves.forEach(chave => vistas.add(chave));
    aceitos.push(item);
  }
  return { aceitos, repetidos };
};
