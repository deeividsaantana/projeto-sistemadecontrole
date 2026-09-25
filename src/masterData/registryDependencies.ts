import type {
  Abastecimento,
  ApontamentoOperacional,
  ControleEquipamentoDiario,
  Empresa,
  Equipamento,
  Funcionario,
  GrupoEquipe,
  ListaPresenca,
  Lubrificacao,
  MovimentoMaterial,
  OrdemServico,
  PresencaApontamento,
} from '../types';

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

/** Tudo que a aba Cadastros consulta para dizer onde um cadastro é usado. */
export interface CadastroUsage extends RegistryUsage {
  empresas: readonly Pick<Empresa, 'id' | 'fornecedorPrincipalId'>[];
  funcionarios: readonly Pick<Funcionario, 'id' | 'empresaId' | 'matricula' | 'liderMatricula'>[];
  ordensServico: readonly Pick<OrdemServico, 'equipamentoId' | 'motoristaId'>[];
  listasPresenca: readonly Pick<ListaPresenca, 'funcionarios'>[];
  presencasLink: readonly Pick<PresencaApontamento, 'funcionarioId'>[];
  gruposEquipe: readonly Pick<GrupoEquipe, 'funcionarioIds'>[];
  controleEquipamentosDiario: readonly Pick<ControleEquipamentoDiario, 'equipamentoId' | 'funcionarioId'>[];
  materiaisMovimentos: readonly Pick<MovimentoMaterial, 'etapaServicoId'>[];
  /** Coleções da obra que guardam `obraId` (presenças, diários, produção...). */
  colecoesDaObra: Record<string, readonly { obraId?: string }[]>;
}

/**
 * Onde um cadastro aparece. Lista vazia quer dizer que ele pode ser excluído
 * de verdade; qualquer uso trava a exclusão e a tela oferece inativar, para o
 * histórico não perder o nome.
 */
export const usosDoCadastro = (tabela: string, id: string, uso: CadastroUsage): DependencyCount[] => {
  const usos: DependencyCount[] = [];
  const incluir = (collection: string, count: number) => {
    if (count > 0) usos.push({ collection, count });
  };
  if (tabela === 'empresas') {
    incluir('Colaboradores', uso.funcionarios.filter(item => item.empresaId === id).length);
    incluir('Equipamentos', uso.equipamentos.filter(item => item.empresaId === id).length);
    incluir('Subfornecedores', uso.empresas.filter(item => item.fornecedorPrincipalId === id).length);
  } else if (tabela === 'funcionarios') {
    const matricula = uso.funcionarios.find(item => item.id === id)?.matricula;
    incluir('Presenças', uso.listasPresenca.filter(lista => lista.funcionarios.some(item => item.funcionarioId === id)).length
      + uso.presencasLink.filter(item => item.funcionarioId === id).length);
    incluir('Equipes', uso.gruposEquipe.filter(item => item.funcionarioIds.includes(id)).length);
    incluir('Equipamentos', uso.equipamentos.filter(item => item.operadorResponsavelId === id).length);
    incluir('Controle diário da frota', uso.controleEquipamentosDiario.filter(item => item.funcionarioId === id).length);
    incluir('Ordens de serviço', uso.ordensServico.filter(item => item.motoristaId === id).length);
    incluir('Apontamentos', uso.apontamentos.filter(item => item.funcionarioId === id).length);
    if (matricula) incluir('Liderados', uso.funcionarios.filter(item => item.liderMatricula === matricula).length);
  } else if (tabela === 'equipamentos') {
    incluir('Abastecimentos', uso.abastecimentos.filter(item => item.equipamentoId === id).length);
    incluir('Lubrificações', uso.lubrificacoes.filter(item => item.equipamentoId === id).length);
    incluir('Ordens de serviço', uso.ordensServico.filter(item => item.equipamentoId === id).length);
    incluir('Controle diário da frota', uso.controleEquipamentosDiario.filter(item => item.equipamentoId === id).length);
    incluir('Equipamentos vinculados', uso.equipamentos.filter(item => item.equipamentoVinculadoId === id).length);
  } else if (tabela === 'obras') {
    usos.push(...obraDependencies(id, { equipamentos: uso.equipamentos, collections: uso.colecoesDaObra }));
  } else if (tabela === 'comboios') {
    usos.push(...registryDependencies('comboio', id, uso));
  } else if (tabela === 'combustiveis') {
    usos.push(...registryDependencies('combustivel', id, uso));
  } else if (tabela === 'lubrificantes') {
    usos.push(...registryDependencies('lubrificante', id, uso));
  } else if (tabela === 'etapas') {
    usos.push(...registryDependencies('etapa', id, uso));
    incluir('Movimentos de material', uso.materiaisMovimentos.filter(item => item.etapaServicoId === id).length);
  }
  return usos;
};
