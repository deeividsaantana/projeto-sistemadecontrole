import type { ControleEquipamentoDiario, Funcionario } from '../types';
import { normalizePrefix } from '../utils/canonicalIdentity';

/** Um operador que a obra espera ver lançado todo dia no Controle de Frotas. */
export interface OperationalDriverReferenceItem {
  matricula: string;
  nome: string;
}

export const OPERATIONAL_DRIVER_REFERENCE_STORAGE_KEY = 'renea_referencia_operadores_frota';

const semAcento = (texto: string): string => texto.normalize('NFD').replace(/[̀-ͯ]/g, '');

export const normalizeDriverName = (nome: string): string =>
  semAcento(String(nome ?? '')).toLocaleUpperCase('pt-BR').replace(/\s+/g, ' ').trim();

export const normalizeDriverCode = (matricula: unknown): string =>
  String(matricula ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');

const ehAtivo = (driver: Funcionario): boolean =>
  driver.ativo !== false && !['INATIVO', 'DESMOBILIZADO'].includes(String(driver.status || '').toUpperCase());

/**
 * Sem relação escolhida à mão, a conferência espera os operadores de caminhão
 * basculante ativos da lista de Motoristas da frota.
 */
export const defaultDriverReference = (drivers: readonly Funcionario[]): OperationalDriverReferenceItem[] =>
  drivers
    .filter(driver => ehAtivo(driver) && normalizeDriverName(driver.cargo).includes('BASCULANTE'))
    .map(driver => ({ matricula: String(driver.matricula || '').trim(), nome: normalizeDriverName(driver.nome) }))
    .sort((left, right) => left.nome.localeCompare(right.nome, 'pt-BR'));

/**
 * Lê a lista colada do Excel ou digitada: uma pessoa por linha, com matrícula
 * (só números) e nome em qualquer ordem, separados por tabulação, ponto e
 * vírgula, vírgula ou espaço. Linha sem matrícula ou sem nome fica de fora,
 * e matrícula repetida conta uma vez só.
 */
export const parseDriverList = (texto: string): { itens: OperationalDriverReferenceItem[]; ignoradas: string[] } => {
  const itens: OperationalDriverReferenceItem[] = [];
  const ignoradas: string[] = [];
  const vistas = new Set<string>();
  texto.split(/\r?\n/).forEach(linhaBruta => {
    const linha = linhaBruta.trim();
    if (!linha) return;
    const matricula = linha.match(/\b\d{3,}\b/)?.[0] || '';
    // A coluna de função ("OPERADOR DE CAMINHAO BASCULANTE") pode vir junto;
    // o nome é a outra coluna com letras.
    const nome = normalizeDriverName(
      linha
        .split(/[\t;,]/)
        .map(parte => parte.replace(/\d/g, ' ').trim())
        .find(parte => /[A-Za-zÀ-ÿ]{2,}/.test(parte) && !/OPERADOR|MOTORISTA|MATRICULA|^NOME$/i.test(semAcento(parte))) || '',
    );
    const codigo = normalizeDriverCode(matricula);
    if (!codigo || nome.split(' ').length < 2) {
      ignoradas.push(linha);
      return;
    }
    if (vistas.has(codigo)) return;
    vistas.add(codigo);
    itens.push({ matricula, nome });
  });
  return { itens, ignoradas };
};

export interface OperationalDriverReferenceStatus extends OperationalDriverReferenceItem {
  informed: boolean;
  /** Prefixos em que o operador foi lançado no dia. */
  prefixes: string[];
  operationalStatus?: string;
  departureTime?: string;
}

export interface OperationalDriverDayReconciliation {
  date: string;
  total: number;
  informed: number;
  missing: number;
  operating: number;
  items: OperationalDriverReferenceStatus[];
  missingItems: OperationalDriverReferenceStatus[];
  /** Operadores de basculante lançados no dia que não estão na relação. */
  unexpectedDrivers: string[];
  /** Operadores da relação lançados em mais de um equipamento no mesmo dia. */
  duplicateDrivers: string[];
}

const ehExcluido = (record: ControleEquipamentoDiario): boolean =>
  Boolean((record as ControleEquipamentoDiario & { excluido?: unknown }).excluido);

export const reconcileOperationalDriversDay = (
  records: readonly ControleEquipamentoDiario[],
  date: string,
  reference: readonly OperationalDriverReferenceItem[],
): OperationalDriverDayReconciliation => {
  const doDia = records.filter(record => record.data === date && !ehExcluido(record));
  const casa = (item: OperationalDriverReferenceItem, record: ControleEquipamentoDiario): boolean => {
    const codigo = normalizeDriverCode(item.matricula);
    const codigoRegistro = normalizeDriverCode(record.codigoFuncionario);
    if (codigo && codigoRegistro) return codigo === codigoRegistro;
    return Boolean(record.nomeMotorista) && normalizeDriverName(record.nomeMotorista) === normalizeDriverName(item.nome);
  };

  const usados = new Set<ControleEquipamentoDiario>();
  const items = reference.map(item => {
    const doOperador = doDia.filter(record => casa(item, record));
    doOperador.forEach(record => usados.add(record));
    const ultimo = [...doOperador].sort((left, right) =>
      String(right.atualizadoEm || right.criadoEm).localeCompare(String(left.atualizadoEm || left.criadoEm)))[0];
    const prefixes = [...new Set(doOperador.map(record => normalizePrefix(record.prefixo)).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'pt-BR', { numeric: true }));
    return {
      ...item,
      informed: doOperador.length > 0,
      prefixes,
      operationalStatus: ultimo?.status,
      departureTime: ultimo?.horaSaida,
    };
  });
  const missingItems = items.filter(item => !item.informed);

  return {
    date,
    total: items.length,
    informed: items.length - missingItems.length,
    missing: missingItems.length,
    operating: items.filter(item => item.operationalStatus === 'Em operação').length,
    items,
    missingItems,
    unexpectedDrivers: [...new Set(doDia
      // Escavadeira, pá e pipa têm operador próprio: só basculante fora da relação chama atenção.
      .filter(record => !usados.has(record) && record.nomeMotorista?.trim()
        && normalizeDriverName(`${record.familia} ${record.tipoEquipamento || ''}`).includes('BASCULANTE'))
      .map(record => normalizeDriverName(record.nomeMotorista)))]
      .sort((left, right) => left.localeCompare(right, 'pt-BR')),
    duplicateDrivers: items
      .filter(item => item.prefixes.length > 1)
      .map(item => item.nome),
  };
};
