import type { Empresa, Funcionario, PresencaApontamento, PresencaStatus } from '../types';
import { COR_OUTROS, montarPizza, porcentagensInteiras, type Pizza } from '../modules/materials/graficosMateriais';

/**
 * Números da seção Relatórios da Presença. Leem um período inteiro, não um dia:
 * cada pessoa conta uma vez por dia (pessoa-dia), mesmo que o registro tenha
 * sido corrigido e gravado de novo, para o relatório nunca inflar.
 */

/** Como a situação de cada pessoa-dia entra nos gráficos. */
export type GrupoSituacao = 'presente' | 'atraso' | 'falta' | 'justificada' | 'afastamento' | 'outro';

export const GRUPO_DA_SITUACAO: Record<PresencaStatus, GrupoSituacao> = {
  Presente: 'presente',
  Atraso: 'atraso',
  'Saída antecipada': 'atraso',
  Ausente: 'falta',
  'Falta justificada': 'justificada',
  Atestado: 'justificada',
  Férias: 'afastamento',
  Baixada: 'afastamento',
  Recesso: 'afastamento',
  Afastado: 'afastamento',
  Desligado: 'outro',
  Outro: 'outro',
};

/**
 * Nome e cor de cada grupo. A cor diz o sentido (verde é gente em campo,
 * laranja é falta) e é a mesma na pizza, nas linhas e na tabela. A ordem
 * separa as cores vizinhas na pizza (laranja nunca encosta no amarelo nem no
 * rosa), conferida no validador de paleta.
 */
export const GRUPOS: ReadonlyArray<{ chave: GrupoSituacao; nome: string; cor: string }> = [
  { chave: 'presente', nome: 'Presentes', cor: '#1baf7a' },
  { chave: 'falta', nome: 'Faltas', cor: '#eb6834' },
  { chave: 'justificada', nome: 'Justificadas', cor: '#2a78d6' },
  { chave: 'atraso', nome: 'Atrasos', cor: '#eda100' },
  { chave: 'afastamento', nome: 'Afastados', cor: '#e87ba4' },
  { chave: 'outro', nome: 'Outros', cor: COR_OUTROS },
];

/** Em campo é quem trabalhou, mesmo chegando tarde ou saindo cedo. */
const EM_CAMPO: ReadonlySet<GrupoSituacao> = new Set(['presente', 'atraso']);
/** Quem devia estar e não veio. Férias e afastamento não entram: são sabidos antes. */
const DEVIA_ESTAR: ReadonlySet<GrupoSituacao> = new Set(['presente', 'atraso', 'falta', 'justificada']);

const taxa = (emCampo: number, deviaEstar: number) => (deviaEstar > 0 ? Math.round((emCampo / deviaEstar) * 100) : null);

/** Dias de um período, do primeiro ao último, em YYYY-MM-DD (sem passar por UTC). */
export const diasDoPeriodo = (de: string, ate: string, limite = 400): string[] => {
  const inicio = new Date(`${de}T12:00:00`);
  const fim = new Date(`${ate}T12:00:00`);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || inicio > fim) return [];
  const dias: string[] = [];
  for (const dia = new Date(inicio); dia <= fim && dias.length < limite; dia.setDate(dia.getDate() + 1)) {
    dias.push(`${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`);
  }
  return dias;
};

/**
 * Uma linha por pessoa por dia, dentro do período. Se a mesma pessoa foi
 * apontada duas vezes no dia, vale o envio mais recente.
 */
export const pessoasDia = (registros: readonly PresencaApontamento[], de: string, ate: string): PresencaApontamento[] => {
  const porChave = new Map<string, PresencaApontamento>();
  (Array.isArray(registros) ? registros : []).forEach(registro => {
    if (!registro || registro.inativoEm || !registro.data) return;
    if (registro.data < de || registro.data > ate) return;
    const chave = `${registro.funcionarioId || registro.funcionarioNome}|${registro.data}`;
    const atual = porChave.get(chave);
    const marca = (item: PresencaApontamento) => item.updatedAt || `${item.data} ${item.horaEnvio}`;
    if (!atual || marca(registro) >= marca(atual)) porChave.set(chave, registro);
  });
  return [...porChave.values()];
};

export interface ResumoPeriodo {
  pessoasDia: number;
  presentes: number;
  atrasos: number;
  faltas: number;
  justificadas: number;
  afastamentos: number;
  /** Pessoas diferentes apontadas no período. */
  pessoas: number;
  diasComEnvio: number;
  diasNoPeriodo: number;
  /** Em campo sobre quem devia estar, de 0 a 100. Sem ninguém, não há taxa. */
  taxa: number | null;
  /** Média de gente em campo por dia com envio. */
  mediaEmCampo: number;
}

export const resumoDoPeriodo = (linhas: readonly PresencaApontamento[], de: string, ate: string): ResumoPeriodo => {
  const conta: Record<GrupoSituacao, number> = { presente: 0, atraso: 0, falta: 0, justificada: 0, afastamento: 0, outro: 0 };
  linhas.forEach(linha => { conta[GRUPO_DA_SITUACAO[linha.status] ?? 'outro'] += 1; });
  const emCampo = conta.presente + conta.atraso;
  const diasComEnvio = new Set(linhas.map(linha => linha.data)).size;
  return {
    pessoasDia: linhas.length,
    presentes: conta.presente,
    atrasos: conta.atraso,
    faltas: conta.falta,
    justificadas: conta.justificada,
    afastamentos: conta.afastamento,
    pessoas: new Set(linhas.map(linha => linha.funcionarioId || linha.funcionarioNome)).size,
    diasComEnvio,
    diasNoPeriodo: diasDoPeriodo(de, ate).length,
    taxa: taxa(emCampo, emCampo + conta.falta + conta.justificada),
    mediaEmCampo: diasComEnvio ? Math.round(emCampo / diasComEnvio) : 0,
  };
};

export interface PontoDia {
  iso: string;
  rotulo: string;
  emCampo: number;
  faltas: number;
  justificadas: number;
  total: number;
  taxa: number | null;
}

/** Uma linha do gráfico por dia do período, inclusive os dias sem envio (zerados, mas marcados sem total). */
export const serieDiaria = (linhas: readonly PresencaApontamento[], de: string, ate: string): PontoDia[] => {
  const porDia = new Map<string, PresencaApontamento[]>();
  linhas.forEach(linha => porDia.set(linha.data, [...(porDia.get(linha.data) || []), linha]));
  return diasDoPeriodo(de, ate).map(iso => {
    const doDia = porDia.get(iso) || [];
    const grupos = doDia.map(linha => GRUPO_DA_SITUACAO[linha.status] ?? 'outro');
    const emCampo = grupos.filter(grupo => EM_CAMPO.has(grupo)).length;
    const faltas = grupos.filter(grupo => grupo === 'falta').length;
    const justificadas = grupos.filter(grupo => grupo === 'justificada').length;
    return {
      iso,
      rotulo: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
      emCampo,
      faltas,
      justificadas,
      total: doDia.length,
      taxa: taxa(emCampo, grupos.filter(grupo => DEVIA_ESTAR.has(grupo)).length),
    };
  });
};

/** Pizza das situações, com a cor fixa de cada grupo (nunca pela posição). */
export const pizzaDasSituacoes = (linhas: readonly PresencaApontamento[]): Pizza => {
  const conta = new Map<GrupoSituacao, number>();
  linhas.forEach(linha => {
    const grupo = GRUPO_DA_SITUACAO[linha.status] ?? 'outro';
    conta.set(grupo, (conta.get(grupo) || 0) + 1);
  });
  const partes = GRUPOS
    .map(grupo => ({ ...grupo, valor: conta.get(grupo.chave) || 0 }))
    .filter(parte => parte.valor > 0);
  const percentuais = porcentagensInteiras(partes.map(parte => parte.valor));
  const fatias = partes.map((parte, indice) => ({
    chave: parte.chave,
    nome: parte.nome,
    valor: parte.valor,
    lancamentos: parte.valor,
    percentual: percentuais[indice],
    cor: parte.cor,
  }));
  return { total: linhas.length, fatias, todas: fatias, deFora: 0 };
};

/** Pizza de quem esteve em campo, por empresa: as 5 maiores e o resto em "Outros". */
export const pizzaEmCampoPorEmpresa = (
  linhas: readonly PresencaApontamento[],
  funcionarios: readonly Funcionario[],
  empresas: readonly Empresa[],
): Pizza => {
  const empresaDe = new Map(funcionarios.map(item => [item.id, item.empresaId]));
  const nomeEmpresa = new Map(empresas.map(item => [item.id, item.nome]));
  const conta = new Map<string, { nome: string; valor: number }>();
  let semEmpresa = 0;
  linhas.forEach(linha => {
    if (!EM_CAMPO.has(GRUPO_DA_SITUACAO[linha.status] ?? 'outro')) return;
    const id = empresaDe.get(linha.funcionarioId);
    const nome = id ? nomeEmpresa.get(id) : '';
    if (!id || !nome) { semEmpresa += 1; return; }
    const atual = conta.get(id) || { nome, valor: 0 };
    conta.set(id, { nome, valor: atual.valor + 1 });
  });
  return montarPizza([...conta.entries()].map(([chave, item]) => ({ chave, nome: item.nome, valor: item.valor, lancamentos: item.valor })), semEmpresa);
};

export interface LinhaEquipe {
  chave: string;
  nome: string;
  frente: string;
  dias: number;
  emCampo: number;
  faltas: number;
  justificadas: number;
  taxa: number | null;
}

/** Cada equipe no período, com quem tem a pior presença primeiro. */
export const relatorioPorEquipe = (linhas: readonly PresencaApontamento[]): LinhaEquipe[] => {
  const porEquipe = new Map<string, { nome: string; frente: string; dias: Set<string>; grupos: GrupoSituacao[] }>();
  linhas.forEach(linha => {
    const chave = linha.grupoId || linha.grupoNome || 'sem-equipe';
    const atual = porEquipe.get(chave) || { nome: linha.grupoNome || 'Equipe não informada', frente: linha.frenteServico, dias: new Set<string>(), grupos: [] };
    atual.dias.add(linha.data);
    atual.grupos.push(GRUPO_DA_SITUACAO[linha.status] ?? 'outro');
    porEquipe.set(chave, atual);
  });
  return [...porEquipe.entries()].map(([chave, item]) => {
    const emCampo = item.grupos.filter(grupo => EM_CAMPO.has(grupo)).length;
    return {
      chave,
      nome: item.nome,
      frente: item.frente,
      dias: item.dias.size,
      emCampo,
      faltas: item.grupos.filter(grupo => grupo === 'falta').length,
      justificadas: item.grupos.filter(grupo => grupo === 'justificada').length,
      taxa: taxa(emCampo, item.grupos.filter(grupo => DEVIA_ESTAR.has(grupo)).length),
    };
  }).sort((a, b) => (a.taxa ?? 101) - (b.taxa ?? 101) || b.faltas - a.faltas || a.nome.localeCompare(b.nome, 'pt-BR'));
};

export interface LinhaColaborador {
  chave: string;
  nome: string;
  matricula: string;
  funcao: string;
  equipe: string;
  dias: number;
  emCampo: number;
  atrasos: number;
  faltas: number;
  justificadas: number;
  afastamentos: number;
  taxa: number | null;
  ultimoDia: string;
  ultimaSituacao: PresencaStatus;
}

/** Uma linha por pessoa: quantos dias veio, faltou, justificou. Mais faltas primeiro. */
export const relatorioPorColaborador = (
  linhas: readonly PresencaApontamento[],
  funcionarios: readonly Funcionario[] = [],
): LinhaColaborador[] => {
  const matriculaDe = new Map(funcionarios.map(item => [item.id, String(item.matricula ?? '')]));
  const porPessoa = new Map<string, PresencaApontamento[]>();
  linhas.forEach(linha => {
    const chave = linha.funcionarioId || linha.funcionarioNome;
    porPessoa.set(chave, [...(porPessoa.get(chave) || []), linha]);
  });
  return [...porPessoa.entries()].map(([chave, dias]) => {
    const ordenados = [...dias].sort((a, b) => b.data.localeCompare(a.data));
    const ultimo = ordenados[0];
    const grupos = dias.map(linha => GRUPO_DA_SITUACAO[linha.status] ?? 'outro');
    const emCampo = grupos.filter(grupo => EM_CAMPO.has(grupo)).length;
    return {
      chave,
      nome: ultimo.funcionarioNome || 'Sem nome',
      matricula: matriculaDe.get(ultimo.funcionarioId) || '',
      funcao: ultimo.funcao,
      equipe: ultimo.grupoNome,
      dias: dias.length,
      emCampo,
      atrasos: grupos.filter(grupo => grupo === 'atraso').length,
      faltas: grupos.filter(grupo => grupo === 'falta').length,
      justificadas: grupos.filter(grupo => grupo === 'justificada').length,
      afastamentos: grupos.filter(grupo => grupo === 'afastamento').length,
      taxa: taxa(emCampo, grupos.filter(grupo => DEVIA_ESTAR.has(grupo)).length),
      ultimoDia: ultimo.data,
      ultimaSituacao: ultimo.status,
    };
  }).sort((a, b) => b.faltas - a.faltas || (a.taxa ?? 101) - (b.taxa ?? 101) || a.nome.localeCompare(b.nome, 'pt-BR'));
};
