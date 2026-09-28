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
