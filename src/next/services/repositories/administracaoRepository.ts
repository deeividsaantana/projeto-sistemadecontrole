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
 * Fornecedor = empresa cujo `tipos` inclui 'FORNECEDOR'. `categoriaFornecedor`
 * separa locação de equipamentos de materiais; sem essa classificação, a
 * empresa aparece em "Não classificados" — nunca vira uma das duas por
 * suposição, pra não inventar dado que o cadastro não confirma.
 */
export type CategoriaFornecedor = 'Locação de equipamentos' | 'Materiais' | 'Não classificado';

export interface FornecedorPorCategoria {
  categoria: CategoriaFornecedor;
  empresas: Empresa[];
}

export const getFornecedoresPorCategoria = (): FornecedorPorCategoria[] => {
  const empresas = readCollection<Empresa>(STORAGE_KEYS.empresas);
  const fornecedores = empresas.filter(item => item.tipos?.includes('FORNECEDOR'));

  const grupos: Record<CategoriaFornecedor, Empresa[]> = {
    'Locação de equipamentos': [],
    Materiais: [],
    'Não classificado': [],
  };
  for (const fornecedor of fornecedores) {
    const chave: CategoriaFornecedor = fornecedor.categoriaFornecedor || 'Não classificado';
    grupos[chave].push(fornecedor);
  }

  return (['Locação de equipamentos', 'Materiais', 'Não classificado'] as const).map(categoria => ({
    categoria,
    empresas: grupos[categoria],
  }));
};
