import { STORAGE_KEYS } from '../../../data/storageKeys';
import { readStoredJson } from '../../../data/localStore';
import type { Equipamento, Funcionario, ListaPresenca, MovimentoMaterial } from '../../../types';

/**
 * Camada de repositório: a única ponte entre os módulos do novo frontend e
 * os dados reais. Hoje lê o cache local resiliente (mesma fonte que o app
 * atual usa — AGENTS.md chama isso de "cache local resiliente e
 * sincronização Firebase"); a assinatura de cada função não muda quando um
 * módulo passar a ler do Supabase. Nenhum componente de tela importa
 * STORAGE_KEYS ou localStorage diretamente.
 */

const readCollection = <T,>(storageKey: string): T[] => readStoredJson<T[]>(window.localStorage, storageKey, []);

const todayIso = () => new Date().toISOString().slice(0, 10);

export interface DashboardSummary {
  equipamentosAtivos: number;
  equipamentosEmManutencao: number;
  equipamentosTotal: number;
  colaboradoresAtivos: number;
  presencaHoje: { presentes: number; ausentes: number; total: number };
  materiaisHoje: { recebido: number; utilizado: number };
  pendencias: number;
}

export const getDashboardSummary = (): DashboardSummary => {
  const equipamentos = readCollection<Equipamento>(STORAGE_KEYS.equipamentos);
  const funcionarios = readCollection<Funcionario>(STORAGE_KEYS.funcionarios);
  const listasPresenca = readCollection<ListaPresenca>(STORAGE_KEYS.listasPresenca);
  const movimentosMateriais = readCollection<MovimentoMaterial>(STORAGE_KEYS.materiaisMovimentos);
  const reviewQueue = readCollection<unknown>(STORAGE_KEYS.masterDataReviewQueue);

  const hoje = todayIso();

  const equipamentosAtivos = equipamentos.filter(item => item.status === 'Ativo' || item.status === 'Mobilizado').length;
  const equipamentosEmManutencao = equipamentos.filter(item => item.status === 'Manutenção').length;

  const colaboradoresAtivos = funcionarios.filter(item => item.ativo).length;

  const listaHoje = listasPresenca.filter(lista => lista.data === hoje);
  const presentesHoje = listaHoje.reduce(
    (total, lista) => total + lista.funcionarios.filter(item => item.presente).length,
    0,
  );
  const totalHoje = listaHoje.reduce((total, lista) => total + lista.funcionarios.length, 0);

  const movimentosHoje = movimentosMateriais.filter(item => item.data === hoje);
  const materiaisHoje = movimentosHoje.reduce(
    (acc, item) => {
      if (item.tipo === 'Entrada') acc.recebido += item.quantidade;
      if (item.tipo === 'Saída') acc.utilizado += item.quantidade;
      return acc;
    },
    { recebido: 0, utilizado: 0 },
  );

  return {
    equipamentosAtivos,
    equipamentosEmManutencao,
    equipamentosTotal: equipamentos.length,
    colaboradoresAtivos,
    presencaHoje: { presentes: presentesHoje, ausentes: Math.max(0, totalHoje - presentesHoje), total: totalHoje },
    materiaisHoje,
    pendencias: reviewQueue.length,
  };
};
