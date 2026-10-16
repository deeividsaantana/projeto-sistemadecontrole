import type { ControleEquipamentoDiario } from '../types';
import { normalizePrefix } from '../utils/canonicalIdentity';

/** Um operador que a obra espera ver lançado todo dia no Controle de Frotas. */
export interface OperationalDriverReferenceItem {
  matricula: string;
  nome: string;
}

export const OPERATIONAL_DRIVER_REFERENCE_STORAGE_KEY = 'renea_referencia_operadores_frota';

const semAcento = (texto: string): string => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const normalizeDriverName = (nome: string): string =>
  semAcento(String(nome ?? '')).toLocaleUpperCase('pt-BR').replace(/\s+/g, ' ').trim();

export const normalizeDriverCode = (matricula: unknown): string =>
  String(matricula ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');

/**
 * Relação dos operadores de caminhão basculante ativos, da planilha
 * "lista_operadores.xlsx" enviada em 16/10/2026. Vale enquanto ninguém escolhe
 * outra relação na conferência do dia.
 */
export const OPERATIONAL_DRIVER_REFERENCE: readonly OperationalDriverReferenceItem[] = ([
  ['101564', 'EUDES DOS SANTOS MATHEUS'],
  ['101671', 'ANDERSON PEIXOTO DA SILVA'],
  ['101788', 'CELSON SIQUEIRA SILVA'],
  ['101979', 'WEDLEY PEREIRA DOS SANTOS'],
  ['101990', 'FABIANO ALVES NUNES'],
  ['102016', 'JOSE APARECIDO FIRMINO'],
  ['102022', 'EDUARDO SOARES DE OLIVEIRA'],
  ['102023', 'GENIVALDO MANOEL DOS SANTOS'],
  ['102064', 'NELSON TADEU DOS SANTOS'],
  ['102146', 'EDMILSON ALVES DA SILVA'],
  ['102147', 'RONALDO SOARES DE OLIVEIRA'],
  ['102148', 'GLEISSON SANTOS DE JESUS'],
  ['102512', 'ARENILSON TEIXEIRA DOS SANTOS'],
  ['102515', 'RICARDO DE BARROS'],
  ['102861', 'HELIO EVARISTO LUCAS'],
  ['102863', 'ELADIO COSTA SILVA'],
  ['103038', 'APARECIDO MEIRA DA SILVA'],
  ['103109', 'JOSUE XAVIER FRANCISCO'],
  ['103174', 'JOSE RICARDO GARCIA'],
  ['103177', 'ADILSON PIRES DA CRUZ'],
  ['103206', 'EDUARDO ROMUALDO DA SILVA'],
  ['103240', 'JACONIAS ALVES DE OLIVEIRA'],
  ['103393', 'CELSO FERREIRA DE CARVALHO'],
  ['103438', 'RONALDO SEVERINO DE SANTANA'],
  ['103440', 'JORGE ROBERTO DA SILVA CARNEIRO'],
  ['103506', 'MARCO ANTONIO DE AVILA'],
  ['103564', 'CLAYTON BORGES DOS SANTOS'],
  ['103577', 'ANDERSON DONIZETE DE PAULA'],
  ['103585', 'DIOGENES GILA BATISTA'],
  ['103587', 'AGUINALDO BRAZ PAULO'],
] as const).map(([matricula, nome]) => ({ matricula, nome }));

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
