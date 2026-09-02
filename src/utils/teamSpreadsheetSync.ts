import type { Funcionario, GrupoEquipe } from '../types';
import { cleanImportValue, normalizeImportText } from './importHelpers';

/**
 * Sincronização das equipes de presença com a planilha de efetivo da obra.
 *
 * A planilha é a fonte de verdade do vínculo colaborador → encarregado. Uma
 * equipe por encarregado, cada uma com seu link. Aqui só se monta o plano; a
 * gravação acontece depois que o administrativo confere o que vai mudar.
 */

/** Uma linha aproveitável da aba "Efetivo". */
export interface EfetivoRow {
  matricula: string;
  nome: string;
  funcao: string;
  matriculaLider: string;
  encarregado: string;
  area: string;
  responsavel: string;
}

export type TeamSyncAction = 'criar' | 'atualizar' | 'desativar' | 'inalterada';

export interface TeamSyncEntry {
  acao: TeamSyncAction;
  nome: string;
  responsavel: string;
  frenteServico: string;
  /** Colaboradores que passam a integrar a equipe. */
  entram: Funcionario[];
  /** Colaboradores que deixam a equipe. Continuam no cadastro. */
  saem: Funcionario[];
  total: number;
  grupo: GrupoEquipe;
}

export interface TeamSyncPlan {
  entradas: TeamSyncEntry[];
  /** Colaboradores da planilha ausentes do cadastro, criados pela sincronização. */
  colaboradoresNovos: Funcionario[];
  /** Colaboradores já cadastrados cujo vínculo de liderança vem da planilha. */
  colaboradoresAtualizados: Funcionario[];
  /** Linhas descartadas, com o motivo, para o administrativo conferir. */
  ignoradas: Array<{ linha: number; motivo: string }>;
  resumo: {
    criar: number;
    atualizar: number;
    desativar: number;
    inalteradas: number;
    colaboradoresNovos: number;
    pessoasNaPlanilha: number;
  };
}

const ALIASES = {
  matricula: ['matcolab', 'matricula', 'matriculacolaborador', 'matcolaborador'],
  nome: ['nome', 'colaborador', 'nomecolaborador'],
  funcao: ['funcao', 'cargo'],
  matriculaLider: ['matlider', 'matriculalider'],
  encarregado: ['nomeencarregado', 'encarregado'],
  area: ['area', 'frente', 'frenteservico'],
  responsavel: ['responsavel', 'responsavelarea'],
};

/**
 * Correspondência exata de cabeçalho. `getImportValue` também casa por
 * substring, e ali isso é perigoso: com "NOME ENCARREGADO" vazio, o alias
 * cairia em "MAT. LÍDER" e o encarregado viraria um número de matrícula.
 */
const valorDaColuna = (row: Record<string, unknown>, aliases: string[]) => {
  const lookup = new Map<string, string>();
  Object.entries(row || {}).forEach(([chave, valor]) => {
    const normalizada = normalizeImportText(chave);
    if (normalizada && !lookup.has(normalizada)) lookup.set(normalizada, cleanImportValue(valor));
  });
  for (const alias of aliases) {
    const valor = lookup.get(normalizeImportText(alias));
    if (valor) return valor;
  }
  return '';
};

/** Matrícula sem zeros à esquerda nem separadores, para casar planilha e cadastro. */
export const normalizeRegistration = (value: unknown) => {
  const text = cleanImportValue(value).replace(/\D+/g, '');
  return text.replace(/^0+(?=\d)/, '');
};

const normalizeName = (value: string) => normalizeImportText(value);

/**
 * Converte as linhas cruas da aba em registros aproveitáveis. Linha sem
 * matrícula ou sem encarregado não vira vínculo: é devolvida em `ignoradas`
 * para que a ausência apareça na conferência em vez de sumir.
 */
export const parseEfetivoRows = (
  rows: Array<Record<string, unknown>>,
): { linhas: EfetivoRow[]; ignoradas: Array<{ linha: number; motivo: string }> } => {
  const linhas: EfetivoRow[] = [];
  const ignoradas: Array<{ linha: number; motivo: string }> = [];
  (Array.isArray(rows) ? rows : []).forEach((row, index) => {
    const matricula = normalizeRegistration(valorDaColuna(row, ALIASES.matricula));
    const nome = cleanImportValue(valorDaColuna(row, ALIASES.nome));
    const encarregado = cleanImportValue(valorDaColuna(row, ALIASES.encarregado));
    if (!matricula && !nome && !encarregado) return;
    if (!matricula) {
      ignoradas.push({ linha: index + 1, motivo: `${nome || 'Linha sem nome'}: sem matrícula.` });
      return;
    }
    const matriculaLider = normalizeRegistration(valorDaColuna(row, ALIASES.matriculaLider));
    if (!matriculaLider && !encarregado) {
      ignoradas.push({ linha: index + 1, motivo: `${nome || matricula}: sem vínculo com encarregado.` });
      return;
    }
    linhas.push({
      matricula,
      nome,
      funcao: cleanImportValue(valorDaColuna(row, ALIASES.funcao)),
      matriculaLider,
      encarregado,
      area: cleanImportValue(valorDaColuna(row, ALIASES.area)),
      responsavel: cleanImportValue(valorDaColuna(row, ALIASES.responsavel)),
    });
  });
  return { linhas, ignoradas };
};

interface BuildPlanInput {
  linhas: EfetivoRow[];
  ignoradas?: Array<{ linha: number; motivo: string }>;
  funcionarios: Funcionario[];
  gruposEquipe: GrupoEquipe[];
  obraId: string;
  empresaId: string;
  /** Só é chamada para equipe nova: token existente nunca é substituído. */
  criarToken: () => string;
  agoraIso?: string;
}

const nomeDaEquipe = (area: string, encarregado: string) => (area
  ? `${area.toUpperCase()} - ${encarregado.toUpperCase()}`
  : encarregado.toUpperCase());

const chaveDoEncarregado = (matriculaLider: string, encarregado: string) => {
  const matricula = normalizeRegistration(matriculaLider);
  return matricula ? `mat:${matricula}` : `nome:${normalizeName(encarregado)}`;
};

export const buildTeamSyncPlan = ({
  linhas,
  ignoradas = [],
  funcionarios,
  gruposEquipe,
  obraId,
  empresaId,
  criarToken,
  agoraIso = new Date().toISOString(),
}: BuildPlanInput): TeamSyncPlan => {
  const cadastro = (Array.isArray(funcionarios) ? funcionarios : []).filter(Boolean);
  const porMatricula = new Map<string, Funcionario>();
  cadastro.forEach(employee => {
    const chave = normalizeRegistration(employee.matricula) || normalizeRegistration(employee.id);
    if (chave && !porMatricula.has(chave)) porMatricula.set(chave, employee);
  });

  // A planilha manda: se a mesma pessoa aparecer duas vezes, vale a última
  // linha. Ninguém pode ficar em duas equipes — seria contado duas vezes.
  const vinculo = new Map<string, EfetivoRow>();
  linhas.forEach(linha => vinculo.set(linha.matricula, linha));

  const colaboradoresNovos: Funcionario[] = [];
  const colaboradoresAtualizados: Funcionario[] = [];
  const resolvido = new Map<string, Funcionario>();
  vinculo.forEach((linha, matricula) => {
    const existente = porMatricula.get(matricula);
    if (existente) {
      const atualizado: Funcionario = {
        ...existente,
        ...(linha.nome ? { nome: linha.nome } : {}),
        ...(linha.funcao ? { cargo: linha.funcao } : {}),
        liderMatricula: linha.matriculaLider || undefined,
        liderNome: linha.encarregado || undefined,
        area: linha.area || undefined,
        responsavelArea: linha.responsavel || undefined,
      };
      colaboradoresAtualizados.push(atualizado);
      resolvido.set(matricula, atualizado);
      return;
    }
    const novo: Funcionario = {
      id: `fun-${matricula}`,
      matricula,
      nome: linha.nome,
      cargo: linha.funcao,
      telefone: '',
      empresaId,
      ativo: true,
      liderMatricula: linha.matriculaLider || undefined,
      liderNome: linha.encarregado || undefined,
      area: linha.area || undefined,
      responsavelArea: linha.responsavel || undefined,
      criadoEm: agoraIso,
    };
    colaboradoresNovos.push(novo);
    resolvido.set(matricula, novo);
  });

  // Uma equipe por vínculo de encarregado. A matrícula é a chave estável;
  // o nome é apenas a identificação legível e pode mudar ou vir vazio.
  const porEncarregado = new Map<string, {
    matriculaLider: string;
    encarregado: string;
    area: string;
    membros: Funcionario[];
  }>();
  vinculo.forEach((linha, matricula) => {
    const chave = chaveDoEncarregado(linha.matriculaLider, linha.encarregado);
    const atual = porEncarregado.get(chave)
      || {
        matriculaLider: linha.matriculaLider,
        encarregado: linha.encarregado || linha.matriculaLider,
        area: linha.area,
        membros: [],
      };
    atual.membros.push(resolvido.get(matricula) as Funcionario);
    if ((!atual.encarregado || atual.encarregado === atual.matriculaLider) && linha.encarregado) {
      atual.encarregado = linha.encarregado;
    }
    if (!atual.area && linha.area) atual.area = linha.area;
    porEncarregado.set(chave, atual);
  });

  const grupos = (Array.isArray(gruposEquipe) ? gruposEquipe : []).filter(Boolean);
  // Primeiro casa pela matrícula do líder. Para registros antigos, ainda sem
  // essa chave, usa o nome uma única vez para migrar sem trocar o link.
  const grupoPorMatricula = new Map<string, GrupoEquipe>();
  const grupoPorNome = new Map<string, GrupoEquipe>();
  const preferirGrupo = (mapa: Map<string, GrupoEquipe>, chave: string, group: GrupoEquipe) => {
    if (!chave) return;
    const anterior = mapa.get(chave);
    if (!anterior
      || (anterior.status !== 'ativo' && group.status === 'ativo')
      || (anterior.status === group.status && (group.funcionarioIds?.length || 0) > (anterior.funcionarioIds?.length || 0))) {
      mapa.set(chave, group);
    }
  };
  grupos.forEach(group => {
    preferirGrupo(grupoPorMatricula, normalizeRegistration(group.liderMatricula), group);
    preferirGrupo(grupoPorNome, normalizeName(group.responsavel || ''), group);
  });

  const porId = new Map(cadastro.map(employee => [employee.id, employee]));
  const entradas: TeamSyncEntry[] = [];
  const gruposReutilizados = new Set<string>();

  porEncarregado.forEach(dados => {
    const membros = dados.membros;
    const ids = membros.map(employee => employee.id);
    const candidatoPorMatricula = grupoPorMatricula.get(normalizeRegistration(dados.matriculaLider));
    const candidatoPorNome = grupoPorNome.get(normalizeName(dados.encarregado));
    const existente = [candidatoPorMatricula, candidatoPorNome]
      .find(candidate => candidate && !gruposReutilizados.has(candidate.id));
    if (existente) gruposReutilizados.add(existente.id);
    const anteriores = existente?.funcionarioIds || [];
    const entram = membros.filter(employee => !anteriores.includes(employee.id));
    const saem = anteriores
      .filter(id => !ids.includes(id))
      .map(id => porId.get(id))
      .filter((employee): employee is Funcionario => Boolean(employee));
    const nome = nomeDaEquipe(dados.area, dados.encarregado);

    const grupo: GrupoEquipe = existente
      ? {
        ...existente,
        nome,
        responsavel: dados.encarregado,
        liderMatricula: dados.matriculaLider || existente.liderMatricula,
        frenteServico: dados.area,
        obraId: existente.obraId || obraId,
        funcionarioIds: ids,
        funcionarioMatriculas: membros.map(employee => normalizeRegistration(employee.matricula) || ''),
        status: 'ativo',
        linkAtivo: existente.linkAtivo !== false,
        updatedAt: agoraIso,
      }
      : {
        id: dados.matriculaLider
          ? `grp-lider-${dados.matriculaLider}`
          : `grp-${normalizeName(dados.encarregado)}-${normalizeName(dados.area) || 'obra'}`,
        nome,
        responsavel: dados.encarregado,
        liderMatricula: dados.matriculaLider || undefined,
        frenteServico: dados.area,
        obraId,
        funcionarioIds: ids,
        funcionarioMatriculas: membros.map(employee => normalizeRegistration(employee.matricula) || ''),
        status: 'ativo',
        token: criarToken(),
        linkAtivo: true,
        createdAt: agoraIso,
        updatedAt: agoraIso,
      };

    const mudou = !existente
      || entram.length > 0
      || saem.length > 0
      || existente.nome !== nome
      || existente.status !== 'ativo';

    entradas.push({
      acao: !existente ? 'criar' : mudou ? 'atualizar' : 'inalterada',
      nome,
      responsavel: dados.encarregado,
      frenteServico: dados.area,
      entram,
      saem,
      total: ids.length,
      grupo,
    });
  });

  // Equipe fora da planilha é desativada, nunca apagada: o histórico de
  // apontamentos já enviados continua referenciando o grupo.
  grupos.forEach(group => {
    if (gruposReutilizados.has(group.id)) return;
    if (group.status !== 'ativo') return;
    entradas.push({
      acao: 'desativar',
      nome: group.nome,
      responsavel: group.responsavel,
      frenteServico: group.frenteServico,
      entram: [],
      saem: (group.funcionarioIds || [])
        .map(id => porId.get(id))
        .filter((employee): employee is Funcionario => Boolean(employee)),
      total: 0,
      grupo: { ...group, status: 'inativo', linkAtivo: false, updatedAt: agoraIso },
    });
  });

  const conta = (acao: TeamSyncAction) => entradas.filter(entry => entry.acao === acao).length;
  return {
    entradas,
    colaboradoresNovos,
    colaboradoresAtualizados,
    ignoradas,
    resumo: {
      criar: conta('criar'),
      atualizar: conta('atualizar'),
      desativar: conta('desativar'),
      inalteradas: conta('inalterada'),
      colaboradoresNovos: colaboradoresNovos.length,
      pessoasNaPlanilha: vinculo.size,
    },
  };
};

/** Aplica o plano já conferido, preservando o que ele não menciona. */
export const applyTeamSyncPlan = (
  plan: TeamSyncPlan,
  funcionarios: Funcionario[],
  gruposEquipe: GrupoEquipe[],
) => {
  const porId = new Map((Array.isArray(gruposEquipe) ? gruposEquipe : []).filter(Boolean).map(group => [group.id, group]));
  plan.entradas.forEach(entry => porId.set(entry.grupo.id, entry.grupo));
  const atualizadosPorId = new Map(plan.colaboradoresAtualizados.map(employee => [employee.id, employee]));
  const cadastro = (Array.isArray(funcionarios) ? funcionarios : [])
    .filter(Boolean)
    .map(employee => atualizadosPorId.get(employee.id) || employee);
  const idsExistentes = new Set(cadastro.map(employee => employee.id));
  return {
    funcionarios: [...cadastro, ...plan.colaboradoresNovos.filter(employee => !idsExistentes.has(employee.id))],
    gruposEquipe: [...porId.values()],
  };
};
