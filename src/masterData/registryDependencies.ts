import type { Abastecimento, ApontamentoOperacional, Equipamento, Lubrificacao } from '../types';

type RegistryKind = 'comboio' | 'combustivel' | 'lubrificante' | 'etapa';

interface RegistryUsage {
  abastecimentos: readonly Abastecimento[];
  equipamentos: readonly Equipamento[];
  lubrificacoes: readonly Lubrificacao[];
  apontamentos: readonly ApontamentoOperacional[];
}

interface DependencyCount {
  collection: string;
  count: number;
}

/** Checks typed local references before legacy physical deletion. Server commands need the same rule transactionally. */
export const registryDependencies = (kind: RegistryKind, id: string, usage: RegistryUsage): DependencyCount[] => {
  const counts: DependencyCount[] = [];
  const include = (collection: string, count: number) => {
    if (count > 0) counts.push({ collection, count });
  };
  if (kind === 'comboio') include('Abastecimentos', usage.abastecimentos.filter(item => item.comboioId === id).length);
  if (kind === 'combustivel') {
    include('Abastecimentos', usage.abastecimentos.filter(item => item.tipoCombustivelId === id).length);
    include('Equipamentos', usage.equipamentos.filter(item => item.combustivelId === id).length);
  }
  if (kind === 'lubrificante') include('Lubrificações', usage.lubrificacoes.filter(item => item.produtoLubrificacaoId === id).length);
  if (kind === 'etapa') include('Apontamentos', usage.apontamentos.filter(item => item.etapaServicoId === id).length);
  return counts;
};

/** Counts every explicitly scoped work collection in the current local snapshot. */
export const obraDependencies = (
  id: string,
  usage: {
    equipamentos: readonly Pick<Equipamento, 'localAtualId'>[];
    collections: Record<string, readonly { obraId?: string }[]>;
  },
): DependencyCount[] => {
  const dependencies: DependencyCount[] = [];
  const equipmentCount = usage.equipamentos.filter(item => item.localAtualId === id).length;
  if (equipmentCount > 0) dependencies.push({ collection: 'Equipamentos', count: equipmentCount });
  for (const [collection, records] of Object.entries(usage.collections)) {
    const count = records.filter(item => item.obraId === id).length;
    if (count > 0) dependencies.push({ collection, count });
  }
  return dependencies;
};
