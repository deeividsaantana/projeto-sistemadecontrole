import {
  ApontamentoQuantidadeItem,
  ClimaApontamento,
  CondicaoApontamento,
  TurnoApontamento
} from '../types';
import { generateSecurePublicToken } from './publicLinkSecurity';

export const APONTAMENTO_LINK_TOKEN = generateSecurePublicToken('apontamento');
export const APONTAMENTO_EMPRESA_PADRAO = 'RENEA';

export const APONTAMENTO_FUNCOES = [
  'Ajudante',
  'Apontador',
  'Auxiliar de Topografia',
  'Carpinteiro',
  'Eletricista',
  'Encarregado',
  'Engenheiro',
  'Estagiário',
  'Pedreiro',
  'Segurança',
  'Segurança do Trabalho',
  'Soldador',
  'Topógrafo'
];

export const APONTAMENTO_EQUIPAMENTOS = [
  'Caminhão Basculante',
  'Caminhão Munck',
  'Caminhão Pipa',
  'Cavalo + Carreta',
  'Compressor',
  'Escavadeira',
  'Gerador',
  'Guindaste',
  'Patrol',
  'Perfuratriz de Estaca Raiz',
  'Retroescavadeira',
  'Trator de Esteira'
];

export const APONTAMENTO_TURNOS: TurnoApontamento[] = ['Manhã', 'Tarde', 'Noite'];
export const APONTAMENTO_CLIMAS: ClimaApontamento[] = ['Chuvoso', 'Nublado', 'Ensolarado'];
export const APONTAMENTO_CONDICOES: CondicaoApontamento[] = ['Praticável', 'Impraticável'];

export const createQuantidadeItems = (nomes: string[]): ApontamentoQuantidadeItem[] =>
  nomes.map(nome => ({ nome, quantidade: 0 }));

export const createDefaultClima = (): Record<TurnoApontamento, ClimaApontamento> => ({
  Manhã: 'Ensolarado',
  Tarde: 'Ensolarado',
  Noite: 'Ensolarado'
});

export const createDefaultCondicao = (): Record<TurnoApontamento, CondicaoApontamento> => ({
  Manhã: 'Praticável',
  Tarde: 'Praticável',
  Noite: 'Praticável'
});

export const totalQuantidade = (items: ApontamentoQuantidadeItem[]) =>
  items.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0);
