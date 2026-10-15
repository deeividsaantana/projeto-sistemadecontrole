import type { Empresa, Funcionario, GrupoEquipe } from '../types';

export interface LinhaEquipe {
  equipe: string;
  situacaoEquipe: string;
  frente: string;
  encarregado: string;
  matricula: string;
  colaborador: string;
  funcao: string;
  empresa: string;
  situacao: string;
}

export const SEM_EQUIPE = 'Sem equipe';

const situacaoDaPessoa = (funcionario: Funcionario) => funcionario.status || (funcionario.ativo ? 'ATIVO' : 'INATIVO');

/**
 * Uma linha por pessoa de cada equipe, na ordem das equipes e do nome. Quem
 * está ativo e fora de toda equipe entra no fim, como "Sem equipe", para a
 * planilha mostrar o efetivo inteiro.
 */
export const linhasDasEquipes = (
  grupos: GrupoEquipe[],
  funcionarios: Funcionario[],
  empresas: Empresa[],
): LinhaEquipe[] => {
  const porId = new Map(funcionarios.map(funcionario => [funcionario.id, funcionario]));
  const nomeEmpresa = new Map(empresas.map(empresa => [empresa.id, empresa.nome]));
  const linha = (grupo: GrupoEquipe | null, funcionario: Funcionario): LinhaEquipe => ({
    equipe: grupo ? grupo.nome || 'Equipe sem nome' : SEM_EQUIPE,
    situacaoEquipe: grupo ? (grupo.status === 'ativo' && grupo.linkAtivo ? 'Ativa' : 'Inativa') : '',
    frente: grupo?.frenteServico || funcionario.area || '',
    encarregado: grupo?.responsavel || funcionario.liderNome || '',
    matricula: funcionario.matricula || '',
    colaborador: funcionario.nome,
    funcao: funcionario.cargo || '',
    empresa: nomeEmpresa.get(funcionario.empresaId) || '',
    situacao: situacaoDaPessoa(funcionario),
  });
  const porNome = (a: Funcionario, b: Funcionario) => a.nome.localeCompare(b.nome, 'pt-BR');

  const naEquipe = new Set<string>();
  const linhas = [...grupos]
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
    .flatMap(grupo => {
      const membros = grupo.funcionarioIds.map(id => porId.get(id)).filter((item): item is Funcionario => Boolean(item));
      membros.forEach(membro => naEquipe.add(membro.id));
      return membros.sort(porNome).map(membro => linha(grupo, membro));
    });

  const semEquipe = funcionarios
    .filter(funcionario => funcionario.ativo && !naEquipe.has(funcionario.id))
    .sort(porNome)
    .map(funcionario => linha(null, funcionario));

  return [...linhas, ...semEquipe];
};
