/**
 * Dados da ficha de um material: saldo ao longo do tempo e fornecedores.
 * O histórico de movimentos em si já existe em ListaMovimentos; a ficha só
 * filtra o que já é lido em Materiais, sem guardar nada novo.
 */
import type { MovimentoMaterial } from '../../types';
import { efeitoNoSaldo } from '../../utils/estoque';
import { inicioDaSemana } from './avisosMateriais';

export interface PontoSaldo {
  inicio: string;
  rotulo: string;
  saldo: number;
}

const DIA_MS = 86_400_000;
const somarDias = (dia: string, dias: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10);
const dataCurta = (dia: string) => dia.split('-').reverse().slice(0, 2).join('/');

/**
 * Saldo do material no fim de cada uma das últimas `semanas` semanas
 * (segunda a segunda). Parte do saldo anterior a essa janela e vai somando
 * cada movimento vigente, então cada ponto já é o saldo acumulado até ali.
 */
export const saldoPorSemana = (movimentos: readonly MovimentoMaterial[], materialId: string, hoje: string, semanas = 12): PontoSaldo[] => {
  const doMaterial = movimentos
    .filter(item => item.materialId === materialId && !item.canceladoEm && item.data <= hoje)
    .sort((a, b) => a.data.localeCompare(b.data));
  const atual = inicioDaSemana(hoje);
  const primeiraSemana = somarDias(atual, -7 * (semanas - 1));
  let saldo = 0;
  let indice = 0;
  while (indice < doMaterial.length && doMaterial[indice].data < primeiraSemana) {
    saldo += efeitoNoSaldo(doMaterial[indice]);
    indice += 1;
  }
  const pontos: PontoSaldo[] = [];
  for (let semana = 0; semana < semanas; semana += 1) {
    const inicio = somarDias(primeiraSemana, 7 * semana);
    const fimDaSemana = somarDias(inicio, 6);
    while (indice < doMaterial.length && doMaterial[indice].data <= fimDaSemana) {
      saldo += efeitoNoSaldo(doMaterial[indice]);
      indice += 1;
    }
    pontos.push({ inicio, rotulo: dataCurta(inicio), saldo: Number(saldo.toFixed(3)) });
  }
  return pontos;
};

export interface LinhaFornecedorMaterial {
  nome: string;
  recebimentos: number;
  quantidade: number;
  ultimoRecebimento: string;
}

/**
 * Quem forneceu este material, do que mais entregou para o que menos, com a
 * quantidade recebida e a data do último recebimento.
 */
export const fornecedoresDoMaterial = (movimentos: readonly MovimentoMaterial[], materialId: string): LinhaFornecedorMaterial[] => {
  const grupos = new Map<string, { recebimentos: number; quantidade: number; ultimoRecebimento: string }>();
  for (const item of movimentos) {
    if (item.canceladoEm || item.materialId !== materialId || item.tipo !== 'Entrada') continue;
    const nome = (item.fornecedorNome || '').trim();
    if (!nome) continue;
    const grupo = grupos.get(nome) ?? { recebimentos: 0, quantidade: 0, ultimoRecebimento: '' };
    grupo.recebimentos += 1;
    grupo.quantidade += Math.abs(Number(item.quantidade) || 0);
    if (item.data > grupo.ultimoRecebimento) grupo.ultimoRecebimento = item.data;
    grupos.set(nome, grupo);
  }
  return [...grupos.entries()]
    .map(([nome, grupo]) => ({ nome, recebimentos: grupo.recebimentos, quantidade: Number(grupo.quantidade.toFixed(3)), ultimoRecebimento: grupo.ultimoRecebimento }))
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR'));
};
