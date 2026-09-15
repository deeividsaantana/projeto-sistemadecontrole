import type { Funcionario, GrupoEquipe } from '../types';
import { cleanImportValue, normalizeImportText } from './importHelpers';
import { aplicarSituacao, estaNoEfetivo } from './situacaoColaborador';

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
  telefone: string;
  matriculaLider: string;
  encarregado: string;
  area: string;
  responsavel: string;
}

/** Cadastro de RH vindo da aba Custo Gerencial. */
export interface CadastroOficialRow {
  matricula: string;
  nome: string;
  cargo: string;
  divisao: string;
  secao: string;
  situacao: NonNullable<Funcionario['status']>;
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
  /**
   * Colaboradores do cadastro (com matrícula) que não aparecem em nenhuma
   * linha da planilha — já com a situação DESMOBILIZADO aplicada. Ninguém é
   * apagado: o registro continua existindo, só sai do efetivo.
   */
  colaboradoresParaDesmobilizar: Funcionario[];
  /** Linhas descartadas, com o motivo, para o administrativo conferir. */
  ignoradas: Array<{ linha: number; motivo: string }>;
  resumo: {
    criar: number;
    atualizar: number;
    desativar: number;
    inalteradas: number;
    colaboradoresNovos: number;
    desmobilizar: number;
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
  telefone: ['contato', 'telefone', 'celular'],
};

const CADASTRO_ALIASES = {
  matricula: ['codigo', 'matricula'],
  nome: ['nome'],
  cargo: ['cargo', 'funcao'],
  divisao: ['divisao'],
  secao: ['secao'],
  situacao: ['situacao', 'status'],
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

const normalizarSituacao = (value: unknown): NonNullable<Funcionario['status']> => {
  const situacao = normalizeImportText(cleanImportValue(value));
  if (situacao.includes('feria')) return 'FÉRIAS';
  if (situacao.includes('afast')) return 'AFASTADO';
  if (situacao.includes('desmobil')) return 'DESMOBILIZADO';
  if (situacao.includes('inativ') || situacao.includes('deslig')) return 'INATIVO';
  return 'ATIVO';
};

/**
 * Lê o cadastro mestre de RH. Ele é deliberadamente separado dos vínculos de
 * equipe: há pessoas ativas em apoio, administração e engenharia que não
 * aparecem na aba Efetivo, mas continuam na obra e não podem ser desligadas.
 */
export const parseCadastroOficialRows = (rows: Array<Record<string, unknown>>): CadastroOficialRow[] => {
  const porMatricula = new Map<string, CadastroOficialRow>();
  (Array.isArray(rows) ? rows : []).forEach(row => {
    const matricula = normalizeRegistration(valorDaColuna(row, CADASTRO_ALIASES.matricula));
    if (!matricula) return;
    porMatricula.set(matricula, {
      matricula,
      nome: cleanImportValue(valorDaColuna(row, CADASTRO_ALIASES.nome)),
      cargo: cleanImportValue(valorDaColuna(row, CADASTRO_ALIASES.cargo)),
      divisao: cleanImportValue(valorDaColuna(row, CADASTRO_ALIASES.divisao)),
      secao: cleanImportValue(valorDaColuna(row, CADASTRO_ALIASES.secao)),
      situacao: normalizarSituacao(valorDaColuna(row, CADASTRO_ALIASES.situacao)),
    });
  });
  return [...porMatricula.values()];
};

/**
 * Converte as linhas cruas da aba em registros aproveitáveis. Linha sem
 * matrícula ou sem encarregado não vira vínculo: é devolvida em `ignoradas`
 * para que a ausência apareça na conferência em vez de sumir.
 */
export const parseEfetivoRows = (
  rows: Array<Record<string, unknown>>,
): {
  linhas: EfetivoRow[];
  ignoradas: Array<{ linha: number; motivo: string }>;
  /**
   * Toda matrícula vista em alguma linha da planilha, mesmo quando a linha
   * não teve vínculo de encarregado utilizável para montar equipe. É o sinal
   * de "esta pessoa ainda está na planilha" — mais amplo que `linhas`, para
   * nunca marcar alguém como desmobilizado só porque a linha dela não pôde
   * virar um vínculo de equipe.
   */
  matriculasNaPlanilha: Set<string>;
} => {
  const linhas: EfetivoRow[] = [];
  const ignoradas: Array<{ linha: number; motivo: string }> = [];
  const matriculasNaPlanilha = new Set<string>();
  (Array.isArray(rows) ? rows : []).forEach((row, index) => {
    const matricula = normalizeRegistration(valorDaColuna(row, ALIASES.matricula));
    const nome = cleanImportValue(valorDaColuna(row, ALIASES.nome));
    const encarregado = cleanImportValue(valorDaColuna(row, ALIASES.encarregado));
    if (!matricula && !nome && !encarregado) return;
    if (!matricula) {
      ignoradas.push({ linha: index + 1, motivo: `${nome || 'Linha sem nome'}: sem matrícula.` });
      return;
    }
    matriculasNaPlanilha.add(matricula);
    const matriculaLider = normalizeRegistration(valorDaColuna(row, ALIASES.matriculaLider));
    if (!matriculaLider && !encarregado) {
      ignoradas.push({ linha: index + 1, motivo: `${nome || matricula}: sem vínculo com encarregado.` });
      return;
    }
    linhas.push({
      matricula,
      nome,
      funcao: cleanImportValue(valorDaColuna(row, ALIASES.funcao)),
      telefone: cleanImportValue(valorDaColuna(row, ALIASES.telefone)),
      matriculaLider,
      encarregado,
      area: cleanImportValue(valorDaColuna(row, ALIASES.area)),
      responsavel: cleanImportValue(valorDaColuna(row, ALIASES.responsavel)),
    });
  });
  return { linhas, ignoradas, matriculasNaPlanilha };
};

interface BuildPlanInput {
  linhas: EfetivoRow[];
  ignoradas?: Array<{ linha: number; motivo: string }>;
  /**
   * Toda matrícula vista na planilha (ver `parseEfetivoRows`). Quando
   * omitido, usa só as matrículas de `linhas` — menos seguro, pois perde
   * quem apareceu na planilha sem vínculo de encarregado utilizável.
   */
  matriculasNaPlanilha?: Set<string>;
  /** Cadastro mestre de RH, que complementa a composição das equipes. */
  cadastrosOficiais?: CadastroOficialRow[];
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
  matriculasNaPlanilha,
  cadastrosOficiais = [],
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

  const presentes = new Set([
    ...(matriculasNaPlanilha ?? linhas.map(linha => linha.matricula)),
    ...cadastrosOficiais.map(item => item.matricula),
  ]);
  const hoje = agoraIso.slice(0, 10);
  // Quem tem matrícula, está no efetivo hoje e não aparece em nenhuma linha
  // da planilha saiu da obra. O cadastro nunca é apagado, só a situação muda.
  const colaboradoresParaDesmobilizar = cadastro
    .filter(employee => {
      const chave = normalizeRegistration(employee.matricula);
      if (!chave) return false;
      if (presentes.has(chave)) return false;
      return estaNoEfetivo(employee);
    })
    .map(employee => aplicarSituacao(employee, {
      situacao: 'DESMOBILIZADO',
      data: hoje,
      motivo: 'Fora da planilha de efetivo sincronizada',
    }, agoraIso));

  // A planilha manda: se a mesma pessoa aparecer duas vezes, vale a última
  // linha. Ninguém pode ficar em duas equipes — seria contado duas vezes.
  const vinculo = new Map<string, EfetivoRow>();
  linhas.forEach(linha => vinculo.set(linha.matricula, linha));

  const novosPorMatricula = new Map<string, Funcionario>();
  const atualizadosPorMatricula = new Map<string, Funcionario>();
  const cadastroOficialPorMatricula = new Map(cadastrosOficiais.map(item => [item.matricula, item]));
  const atualizarPeloCadastroOficial = (base: Funcionario | undefined, oficial: CadastroOficialRow): Funcionario => {
    const ativo = oficial.situacao !== 'INATIVO' && oficial.situacao !== 'DESMOBILIZADO';
    const proximo: Funcionario = {
      ...(base || {
        id: `fun-${oficial.matricula}`,
        matricula: oficial.matricula,
        telefone: '',
        empresaId,
        criadoEm: agoraIso,
      }),
      matricula: oficial.matricula,
      nome: oficial.nome || base?.nome || '',
      cargo: oficial.cargo || base?.cargo || '',
      divisao: oficial.divisao || undefined,
      secao: oficial.secao || undefined,
      status: oficial.situacao,
      ativo,
      atualizadoEm: agoraIso,
    };
    if (oficial.situacao === 'ATIVO') delete proximo.dataDesmobilizacao;
    return proximo;
  };

  cadastroOficialPorMatricula.forEach((oficial, matricula) => {
    const existente = porMatricula.get(matricula);
    const atualizado = atualizarPeloCadastroOficial(existente, oficial);
    if (existente) atualizadosPorMatricula.set(matricula, atualizado);
    else novosPorMatricula.set(matricula, atualizado);
  });

  const resolvido = new Map<string, Funcionario>();
  vinculo.forEach((linha, matricula) => {
    const existente = atualizadosPorMatricula.get(matricula)
      || novosPorMatricula.get(matricula)
      || porMatricula.get(matricula);
    const novo: Funcionario = {
      ...(existente || {
        id: `fun-${matricula}`,
        matricula,
        telefone: '',
        empresaId,
        ativo: true,
        criadoEm: agoraIso,
      }),
      nome: linha.nome || existente?.nome || '',
      cargo: linha.funcao || existente?.cargo || '',
      ...(linha.telefone ? { telefone: linha.telefone } : {}),
      liderMatricula: linha.matriculaLider || undefined,
      liderNome: linha.encarregado || undefined,
      area: linha.area || undefined,
      responsavelArea: linha.responsavel || undefined,
      ativo: true,
      status: existente?.status === 'FÉRIAS' || existente?.status === 'AFASTADO' ? existente.status : 'ATIVO',
      atualizadoEm: agoraIso,
    };
    if (porMatricula.has(matricula)) atualizadosPorMatricula.set(matricula, novo);
    else novosPorMatricula.set(matricula, novo);
    resolvido.set(matricula, novo);
  });
  const colaboradoresNovos = [...novosPorMatricula.values()];
  const colaboradoresAtualizados = [...atualizadosPorMatricula.values()];

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
    colaboradoresParaDesmobilizar,
    ignoradas,
    resumo: {
      criar: conta('criar'),
      atualizar: conta('atualizar'),
      desativar: conta('desativar'),
      inalteradas: conta('inalterada'),
      colaboradoresNovos: colaboradoresNovos.length,
      desmobilizar: colaboradoresParaDesmobilizar.length,
      pessoasNaPlanilha: presentes.size,
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
  const atualizadosPorId = new Map([
    ...plan.colaboradoresAtualizados.map(employee => [employee.id, employee] as const),
    ...plan.colaboradoresParaDesmobilizar.map(employee => [employee.id, employee] as const),
  ]);
  const cadastro = (Array.isArray(funcionarios) ? funcionarios : [])
    .filter(Boolean)
    .map(employee => atualizadosPorId.get(employee.id) || employee);
  const idsExistentes = new Set(cadastro.map(employee => employee.id));
  return {
    funcionarios: [...cadastro, ...plan.colaboradoresNovos.filter(employee => !idsExistentes.has(employee.id))],
    gruposEquipe: [...porId.values()],
  };
};
