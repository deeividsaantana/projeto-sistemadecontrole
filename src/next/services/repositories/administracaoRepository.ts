import { STORAGE_KEYS } from '../../../data/storageKeys';
import { readStoredJson } from '../../../data/localStore';
import type { Empresa, EtapaServico, Funcionario } from '../../../types';

/**
 * Mesma estratégia do dashboardRepository: lê o cache local resiliente que
 * o app atual já usa. Quando os cadastros migrarem para o Supabase, só a
 * implementação destas funções muda — a assinatura fica igual.
 */
const readCollection = <T,>(storageKey: string): T[] => readStoredJson<T[]>(window.localStorage, storageKey, []);

export const getPessoas = (): Funcionario[] =>
  readCollection<Funcionario>(STORAGE_KEYS.funcionarios).filter(item => item.ativo);

export const getRamos = (): EtapaServico[] => readCollection<EtapaServico>(STORAGE_KEYS.etapas);

/**
 * Fornecedor = empresa cujo `tipos` inclui 'FORNECEDOR'. As subclasses
 * (LOCACAO_EQUIPAMENTOS, MATERIAIS) também vivem em `tipos` — uma empresa
 * pode acumular as duas. Sem nenhuma das duas, o fornecedor aparece em
 * "Não classificados": nunca vira uma categoria por suposição.
 */
export type CategoriaFornecedor = 'Locação de equipamentos' | 'Materiais' | 'Não classificado';

export interface FornecedorPorCategoria {
  categoria: CategoriaFornecedor;
  empresas: Empresa[];
}

export const getFornecedoresPorCategoria = (): FornecedorPorCategoria[] => {
  const empresas = readCollection<Empresa>(STORAGE_KEYS.empresas);
  const fornecedores = empresas.filter(item => item.tipos?.includes('FORNECEDOR'));

  const locacao = fornecedores.filter(item => item.tipos?.includes('LOCACAO_EQUIPAMENTOS'));
  const materiais = fornecedores.filter(item => item.tipos?.includes('MATERIAIS'));
  const naoClassificado = fornecedores.filter(item => !item.tipos?.includes('LOCACAO_EQUIPAMENTOS') && !item.tipos?.includes('MATERIAIS'));

  return [
    { categoria: 'Locação de equipamentos', empresas: locacao },
    { categoria: 'Materiais', empresas: materiais },
    { categoria: 'Não classificado', empresas: naoClassificado },
  ];
};
