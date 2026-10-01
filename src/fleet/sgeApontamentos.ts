/**
 * Importa o relatório "Equipamentos Apontados" do SGE: uma linha por
 * equipamento e dia, com o operador e o horímetro do turno. Cada linha vira
 * um lançamento do dia (Em operação com o operador, ou À disposição quando o
 * horímetro não andou), no mesmo formato que o Controle de Frotas grava.
 *
 * Nunca sobrescreve um lançamento feito à mão no app (origem "SISTEMA") — só
 * completa dias sem lançamento ou atualiza uma importação anterior. Um
 * equipamento com duas linhas no mesmo dia fica de fora, para alguém decidir
 * qual vale, em vez do import escolher sozinho.
 */
import type { ControleEquipamentoDiario, Equipamento, Funcionario } from '../types';
import type { FleetPersistedRecord } from './domain';
import { classifyOperationalFleet, reconcileEmployee } from './reconciliation';
import { normalizeIsoDate } from './time';
import { normalizePrefix } from '../utils/canonicalIdentity';
import { lerNumero } from '../modules/frota/combustivelDoDia';

/**
 * Casamento só por prefixo, sem o fallback por placa que `reconcileEquipment`
 * usa: a planilha do SGE não informa placa, e duas máquinas sem placa
 * cadastrada bateriam por engano nesse fallback (o SGE não tem essa coluna).
 */
const equipamentoPorPrefixo = (prefixo: string, equipamentos: readonly Equipamento[]): Equipamento | undefined => {
  const normalizado = normalizePrefix(prefixo);
  const candidatos = equipamentos.filter(item => normalizePrefix(item.prefixo) === normalizado);
  return candidatos.length === 1 ? candidatos[0] : undefined;
};

export interface LinhaBrutaSge {
  linha: number;
  data: unknown;
  uaEquipamento: unknown;
  descricaoEquipamento: unknown;
  horimetroInicial: unknown;
  horimetroFinal: unknown;
  horasHorimetro: unknown;
  matriculaOperador: unknown;
  nomeOperador: unknown;
  observacoes: unknown;
}

export type DisposicaoSge = 'NOVO' | 'ATUALIZA' | 'PROTEGIDO' | 'DUPLICADO' | 'ERRO';

export interface LinhaPreviaSge {
  linha: number;
  disposicao: DisposicaoSge;
  chave: string;
  registro?: FleetPersistedRecord;
  mensagens: string[];
}

export interface PreviaImportacaoSge {
  geradaEm: string;
  linhas: LinhaPreviaSge[];
  novos: number;
  atualizados: number;
  protegidos: number;
  duplicados: number;
  comErro: number;
  podeAplicar: boolean;
}

const textoDe = (valor: unknown): string => String(valor ?? '').trim();

const observacaoDaLinha = (raw: LinhaBrutaSge, horas?: number): string => {
  const partes: string[] = [];
  const nota = textoDe(raw.observacoes);
  if (nota && nota !== '-') partes.push(nota);
  const inicial = lerNumero(textoDe(raw.horimetroInicial));
  const final = lerNumero(textoDe(raw.horimetroFinal));
  if (inicial !== undefined && final !== undefined) {
    partes.push(`Horímetro SGE: ${inicial.toLocaleString('pt-BR')} → ${final.toLocaleString('pt-BR')}${horas ? ` (${horas.toLocaleString('pt-BR')} h)` : ''}.`);
  }
  return partes.join(' ');
};

const EM_MANUTENCAO_STATUS: ReadonlyArray<ControleEquipamentoDiario['status']> = ['Em manutenção', 'Aguardando manutenção'];

/**
 * Monta a prévia da importação: reconcilia equipamento e operador, decide
 * "Em operação"/"À disposição" pelas horas do horímetro, e marca como
 * protegida qualquer linha que bateria em cima de um lançamento manual.
 */
export const preverImportacaoSge = ({ linhas, equipamentos, registros, motoristas, agora = new Date() }: {
  linhas: readonly LinhaBrutaSge[];
  equipamentos: readonly Equipamento[];
  registros: readonly ControleEquipamentoDiario[];
  motoristas: readonly Funcionario[];
  agora?: Date;
}): PreviaImportacaoSge => {
  const nowIso = agora.toISOString();
  const chavesNoArquivo = new Set<string>();
  const previa: LinhaPreviaSge[] = linhas.map(raw => {
    const data = normalizeIsoDate(raw.data);
    const prefixo = textoDe(raw.uaEquipamento);
    const mensagens: string[] = [];
    if (!data) mensagens.push('Data inválida ou não informada.');
    if (!prefixo) mensagens.push('Equipamento (UA) não informado.');
    const equipamento = prefixo ? equipamentoPorPrefixo(prefixo, equipamentos) : undefined;
    if (prefixo && !equipamento) mensagens.push(`Equipamento "${prefixo}" não está no cadastro (ou o prefixo está duplicado).`);
    if (!data || !prefixo || !equipamento) {
      return { linha: raw.linha, disposicao: 'ERRO', chave: '', mensagens: [...new Set(mensagens)] };
    }

    const chave = `${data}|${equipamento.id}`;
    if (chavesNoArquivo.has(chave)) {
      return { linha: raw.linha, disposicao: 'DUPLICADO', chave, mensagens: [`${prefixo} já aparece em outra linha no dia ${data}; nenhuma das duas foi importada.`] };
    }
    chavesNoArquivo.add(chave);

    const existente = (registros as readonly FleetPersistedRecord[])
      .find(item => !item.excluido && (item.chave === chave || (item.data === data && item.equipamentoId === equipamento.id)));
    if (existente && existente.origem === 'SISTEMA') {
      return { linha: raw.linha, disposicao: 'PROTEGIDO', chave, mensagens: [`Já tem lançamento manual de ${existente.prefixo} em ${data}; a planilha não sobrescreve.`] };
    }
    // Uma OS em manutenção não vem da planilha; não pisa em cima de um controle já em manutenção.
    if (existente && EM_MANUTENCAO_STATUS.includes(existente.status)) {
      return { linha: raw.linha, disposicao: 'PROTEGIDO', chave, mensagens: [`${existente.prefixo} está em manutenção em ${data}; a planilha não muda essa situação.`] };
    }

    const horas = lerNumero(textoDe(raw.horasHorimetro)) ?? 0;
    const operador = reconcileEmployee({ employeeCode: textoDe(raw.matriculaOperador), employeeName: textoDe(raw.nomeOperador) }, [...motoristas]);
    mensagens.push(...(operador.warnings || []));
    const nomeOperador = operador.value?.nome || textoDe(raw.nomeOperador);
    if (horas > 0 && !nomeOperador) mensagens.push('Horímetro andou mas a planilha não tem operador.');
    const classificacao = classifyOperationalFleet(equipamento);

    const registro: FleetPersistedRecord = {
      id: existente?.id || `sge-import-${chave}`,
      chave,
      data,
      funcionarioId: operador.value?.id || '',
      codigoFuncionario: operador.value?.matricula || textoDe(raw.matriculaOperador),
      nomeMotorista: nomeOperador,
      equipamentoId: equipamento.id,
      prefixo: equipamento.prefixo,
      familia: existente?.familia || classificacao.group,
      tipoEquipamento: existente?.tipoEquipamento || classificacao.equipmentType,
      status: horas > 0 ? 'Em operação' : 'Disponível',
      horaSaida: existente?.horaSaida || '',
      horaEntradaManutencao: existente?.horaEntradaManutencao || '',
      horaLiberacao: existente?.horaLiberacao || '',
      motivoManutencao: existente?.motivoManutencao,
      observacao: observacaoDaLinha(raw, horas),
      origem: 'PLANILHA',
      revisao: [...new Set(mensagens)],
      motoristaTemporario: Boolean(nomeOperador && !operador.value),
      criadoEm: existente?.criadoEm || nowIso,
      atualizadoEm: nowIso,
    };
    return {
      linha: raw.linha,
      disposicao: existente ? 'ATUALIZA' : 'NOVO',
      chave,
      registro,
      mensagens: [...new Set(mensagens)],
    };
  });

  const contar = (disposicao: DisposicaoSge) => previa.filter(item => item.disposicao === disposicao).length;
  return {
    geradaEm: nowIso,
    linhas: previa,
    novos: contar('NOVO'),
    atualizados: contar('ATUALIZA'),
    protegidos: contar('PROTEGIDO'),
    duplicados: contar('DUPLICADO'),
    comErro: contar('ERRO'),
    podeAplicar: previa.some(item => item.disposicao === 'NOVO' || item.disposicao === 'ATUALIZA'),
  };
};

/** Só as linhas seguras para gravar: novas ou atualizando uma importação anterior. */
export const registrosParaAplicar = (previa: PreviaImportacaoSge): FleetPersistedRecord[] =>
  previa.linhas
    .filter(item => (item.disposicao === 'NOVO' || item.disposicao === 'ATUALIZA') && item.registro)
    .map(item => item.registro as FleetPersistedRecord);

/**
 * Motorista e horímetro do cadastro de cada equipamento, tirados do mesmo
 * apontamento do SGE. Vale o dia mais recente do equipamento: o operador desse
 * dia vira o motorista responsável e o horímetro final vira o horímetro atual.
 *
 * O site mantém um motorista em um equipamento só. Quando a planilha põe o
 * mesmo operador como último de vários equipamentos, ele fica no de dia mais
 * recente e os outros vão para a revisão; empate no dia não escolhe sozinho.
 */
export interface AlteracaoCadastroSge {
  equipamentoId: string;
  prefixo: string;
  motorista?: { antes: string; depois: string; funcionarioId?: string; data?: string };
  horimetro?: { antes?: number; depois: number; data: string };
  avisos: string[];
}

export interface PreviaCadastroSge {
  alteracoes: AlteracaoCadastroSge[];
  motoristasVinculados: number;
  motoristasRetirados: number;
  horimetrosAtualizados: number;
  revisao: string[];
}

const numeroDe = (valor: unknown): number | undefined =>
  typeof valor === 'number' ? (Number.isFinite(valor) ? valor : undefined) : lerNumero(textoDe(valor));

const temOperador = (raw: LinhaBrutaSge) =>
  [raw.matriculaOperador, raw.nomeOperador].some(valor => !['', '-'].includes(textoDe(valor)));

interface LeituraSge { raw: LinhaBrutaSge; data: string; horas: number }

/** A linha que vale num dia: a única do dia, ou a de mais horas quando a outra não andou. */
const linhaDoDia = (doDia: LeituraSge[]): LeituraSge | undefined => {
  if (doDia.length === 1) return doDia[0];
  const ordenadas = [...doDia].sort((a, b) => b.horas - a.horas);
  return ordenadas[0].horas > ordenadas[1].horas ? ordenadas[0] : undefined;
};

const ultimaLeitura = (leituras: LeituraSge[], filtro: (leitura: LeituraSge) => boolean): LeituraSge | undefined => {
  const datas = [...new Set(leituras.filter(filtro).map(item => item.data))].sort().reverse();
  for (const data of datas) {
    const escolhida = linhaDoDia(leituras.filter(item => item.data === data && filtro(item)));
    if (escolhida) return escolhida;
  }
  return undefined;
};

export const preverCadastroSge = ({ linhas, equipamentos, funcionarios }: {
  linhas: readonly LinhaBrutaSge[];
  equipamentos: readonly Equipamento[];
  funcionarios: readonly Funcionario[];
}): PreviaCadastroSge => {
  const porEquipamento = new Map<string, LeituraSge[]>();
  for (const raw of linhas) {
    const data = normalizeIsoDate(raw.data);
    const equipamento = equipamentoPorPrefixo(textoDe(raw.uaEquipamento), equipamentos);
    if (!data || !equipamento) continue;
    const lista = porEquipamento.get(equipamento.id) || [];
    lista.push({ raw, data, horas: numeroDe(raw.horasHorimetro) ?? 0 });
    porEquipamento.set(equipamento.id, lista);
  }

  const revisao: string[] = [];
  const alteracoes = new Map<string, AlteracaoCadastroSge>();
  const alteracaoDe = (equipamento: Equipamento) => {
    const atual = alteracoes.get(equipamento.id) || { equipamentoId: equipamento.id, prefixo: equipamento.prefixo, avisos: [] };
    alteracoes.set(equipamento.id, atual);
    return atual;
  };

  // Último operador de cada equipamento, já casado com o cadastro de colaboradores.
  const candidatos: Array<{ equipamento: Equipamento; funcionario: Funcionario; data: string }> = [];
  const diaDoOperador = new Map<string, string>();
  for (const equipamento of equipamentos) {
    const leituras = porEquipamento.get(equipamento.id);
    if (!leituras) continue;

    const comHorimetro = ultimaLeitura(leituras, item => numeroDe(item.raw.horimetroFinal) !== undefined);
    const horimetro = comHorimetro ? numeroDe(comHorimetro.raw.horimetroFinal) : undefined;
    if (comHorimetro && horimetro !== undefined && horimetro !== equipamento.horimetroAtual
      && !(equipamento.horimetroAtualData && equipamento.horimetroAtualData > comHorimetro.data)) {
      const alteracao = alteracaoDe(equipamento);
      alteracao.horimetro = { antes: equipamento.horimetroAtual, depois: horimetro, data: comHorimetro.data };
      if (equipamento.horimetroAtual !== undefined && horimetro < equipamento.horimetroAtual) {
        alteracao.avisos.push(`Horímetro caiu de ${equipamento.horimetroAtual.toLocaleString('pt-BR')} para ${horimetro.toLocaleString('pt-BR')} h; confira se o horímetro foi trocado.`);
      }
    }

    const doOperador = ultimaLeitura(leituras, item => temOperador(item.raw));
    if (!doOperador) continue;
    const matricula = textoDe(doOperador.raw.matriculaOperador);
    const nome = textoDe(doOperador.raw.nomeOperador);
    const operador = reconcileEmployee({ employeeCode: matricula, employeeName: nome }, [...funcionarios]);
    if (!operador.value) {
      revisao.push(`${equipamento.prefixo}: ${nome || matricula}${matricula && nome ? ` (${matricula})` : ''} não está no cadastro de colaboradores; o motorista não foi vinculado.`);
      continue;
    }
    candidatos.push({ equipamento, funcionario: operador.value, data: doOperador.data });
  }

  // Um motorista em um equipamento só: fica no de dia mais recente.
  const vencedores = new Map<string, Equipamento>();
  const porFuncionario = new Map<string, typeof candidatos>();
  for (const candidato of candidatos) {
    const lista = porFuncionario.get(candidato.funcionario.id) || [];
    lista.push(candidato);
    porFuncionario.set(candidato.funcionario.id, lista);
  }
  for (const [funcionarioId, lista] of porFuncionario) {
    const ordenada = [...lista].sort((a, b) => b.data.localeCompare(a.data));
    const prefixos = ordenada.map(item => item.equipamento.prefixo).join(', ');
    if (ordenada.length > 1 && ordenada[0].data === ordenada[1].data) {
      revisao.push(`${ordenada[0].funcionario.nome} aparece como último operador de ${prefixos} no mesmo dia; escolha o equipamento dele no cadastro.`);
      continue;
    }
    vencedores.set(funcionarioId, ordenada[0].equipamento);
    if (ordenada.length > 1) {
      const outros = ordenada.slice(1).map(item => item.equipamento.prefixo);
      revisao.push(`${ordenada[0].funcionario.nome} ficou no ${ordenada[0].equipamento.prefixo} (operou por último); ${outros.join(', ')} ${outros.length > 1 ? 'ficaram' : 'ficou'} sem trocar de motorista.`);
    }
  }

  for (const candidato of candidatos) diaDoOperador.set(candidato.equipamento.id, candidato.data);
  const novoDono = new Map([...vencedores].map(([funcionarioId, equipamento]) => [equipamento.id, funcionarioId]));
  for (const equipamento of equipamentos) {
    const funcionarioId = novoDono.get(equipamento.id);
    if (funcionarioId && funcionarioId !== equipamento.operadorResponsavelId) {
      const funcionario = funcionarios.find(item => item.id === funcionarioId) as Funcionario;
      alteracaoDe(equipamento).motorista = { antes: equipamento.operadorResponsavelNome || '', depois: funcionario.nome, funcionarioId, data: diaDoOperador.get(equipamento.id) };
      continue;
    }
    // Quem foi para outro equipamento sai deste, como no vínculo feito à mão.
    const foiPara = equipamento.operadorResponsavelId ? vencedores.get(equipamento.operadorResponsavelId) : undefined;
    if (!funcionarioId && foiPara && foiPara.id !== equipamento.id) {
      const alteracao = alteracaoDe(equipamento);
      alteracao.motorista = { antes: equipamento.operadorResponsavelNome || '', depois: '', data: diaDoOperador.get(foiPara.id) };
      alteracao.avisos.push(`${equipamento.operadorResponsavelNome || 'O motorista'} passou para o ${foiPara.prefixo}.`);
    }
  }

  const lista = [...alteracoes.values()].sort((a, b) => a.prefixo.localeCompare(b.prefixo, 'pt-BR'));
  return {
    alteracoes: lista,
    motoristasVinculados: lista.filter(item => item.motorista?.funcionarioId).length,
    motoristasRetirados: lista.filter(item => item.motorista && !item.motorista.funcionarioId).length,
    horimetrosAtualizados: lista.filter(item => item.horimetro).length,
    revisao,
  };
};

/** Aplica a prévia sobre o cadastro: só os campos de motorista e horímetro mudam. */
export const aplicarCadastroSge = (equipamentos: readonly Equipamento[], previa: PreviaCadastroSge, funcionarios: readonly Funcionario[], agora = new Date().toISOString()): Equipamento[] => {
  const porId = new Map(previa.alteracoes.map(item => [item.equipamentoId, item]));
  return equipamentos.map(equipamento => {
    const alteracao = porId.get(equipamento.id);
    if (!alteracao) return equipamento;
    // Com a data, a mesclagem com a nuvem mantém esta versão em vez da antiga.
    const proximo = { ...equipamento, atualizadoEm: agora };
    if (alteracao.motorista) {
      const funcionario = funcionarios.find(item => item.id === alteracao.motorista?.funcionarioId);
      proximo.operadorResponsavelId = funcionario?.id;
      proximo.operadorResponsavelNome = funcionario?.nome;
      proximo.operadorResponsavelDesde = funcionario ? alteracao.motorista.data : undefined;
    }
    if (alteracao.horimetro) {
      proximo.horimetroAtual = alteracao.horimetro.depois;
      proximo.horimetroAtualData = alteracao.horimetro.data;
    }
    return proximo;
  });
};

/** Texto do botão da prévia do SGE conforme o que vai ser gravado: lançamentos, cadastro ou os dois. */
export const rotuloImportacaoSge = (lancamentos: number, equipamentos: number): string => {
  const partes = [
    lancamentos > 0 ? `importar ${lancamentos} lançamento(s)` : '',
    equipamentos > 0 ? `atualizar ${equipamentos} equipamento(s)` : '',
  ].filter(Boolean);
  if (!partes.length) return 'Nada para gravar';
  const texto = partes.join(' e ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};
