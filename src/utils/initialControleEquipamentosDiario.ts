import type { ControleEquipamentoDiario, StatusControleEquipamentoDiario } from '../types';

type SeedRow = [string, string, string, StatusControleEquipamentoDiario, string, string?, string?, string?];

const SOURCE_DATE = '2026-08-12';
const CREATED_AT = '2026-08-12T12:00:00.000Z';

const rows: SeedRow[] = [
  ['103177', 'ADILSON PIRES DA CRUZ', 'CB770', 'Em manutenção', '07:59', '07:59', '08:54', 'reparo de solda no gavião e faixa refletiva no para-choque'],
  ['101671', 'ANDERSON PEIXOTO DA SILVA', 'CB767', 'Em operação', '07:13'],
  ['103038', 'APARECIDO MEIRA DA SILVA', 'CB802', 'Em operação', '07:01'],
  ['102512', 'ARENILSON TEIXEIRA DOS SANTOS', 'CB793', 'Em operação', '06:59'],
  ['101788', 'CELSON SIQUEIRA SILVA', 'CB970', 'Em operação', '07:16'],
  ['102146', 'EDMILSON ALVES DA SILVA', 'CB730', 'Em operação', '07:00'],
  ['102022', 'EDUARDO SOARES DE OLIVEIRA', 'CB929', 'Em manutenção', '08:13', '07:00', '08:13', 'manutenção da parte elétrica'],
  ['102863', 'ELADIO COSTA SILVA', 'CB755', 'Em operação', '07:29'],
  ['101564', 'EUDES DOS SANTOS MATHEUS', 'CB790', 'Em operação', '07:08'],
  ['102112', 'EZEQUIEL DE SOUZA VIEIRA', 'CB804', 'Em operação', '07:17'],
  ['101990', 'FABIANO ALVES NUNES', 'CB801', 'Em operação', '07:39'],
  ['102023', 'GENIVALDO MANOEL DOS SANTOS', 'CB1005', 'Em operação', '07:14'],
  ['102148', 'GLEISSON SANTOS DE JESUS', 'CB739', 'Em operação', '07:06'],
  ['102861', 'HELIO EVARISTO LUCAS', 'CB748', 'Em operação', '07:04'],
  ['102016', 'JOSE APARECIDO FIRMINO', 'CB771', 'Em operação', '07:44'],
  ['103174', 'JOSE RICARDO GARCIA', 'CB775', 'Em operação', '06:51'],
  ['102865', 'JOSIAS LIMA DE ARAUJO', 'CB735', 'Em manutenção', '07:38', '07:38', '11:24', 'falta de operador após as 12:00'],
  ['103109', 'JOSUE XAVIER FRANCISCO', 'CB786', 'Em operação', '07:08'],
  ['102514', 'MANOEL MENDES COUTINHO', 'CB740', 'Em operação', '06:52'],
  ['102064', 'NELSON TADEU DOS SANTOS', 'CB754', 'Em operação', '06:47'],
  ['102939', 'RICARDO ALVES DOS SANTOS JUNIOR', 'CB732', 'Em operação', '06:53'],
  ['102928', 'RODRIGO SOARES SALDANHA', 'CB738', 'Em operação', '07:11'],
  ['102147', 'RONALDO SOARES DE OLIVEIRA', 'CB774', 'Em operação', '07:09'],
  ['102513', 'SAMUEL PEREIRA DOS SANTOS', 'CB758', 'Em operação', '07:04'],
  ['102868', 'THIAGO FELIPE SPAMPINATO PRADO', 'CB965', 'Em operação', '07:31'],
  ['101979', 'WEDLEY PEREIRA DOS SANTOS', 'CB726', 'Em operação', '07:01'],
];

export const INITIAL_CONTROLE_EQUIPAMENTOS_DIARIO: ControleEquipamentoDiario[] = rows.map((row) => {
  const [codigoFuncionario, nomeMotorista, prefixo, status, horaSaida, horaEntradaManutencao = '', horaLiberacao = '', observacao = ''] = row;
  return {
    id: `alto-tiete-${SOURCE_DATE}-${codigoFuncionario}`,
    chave: `${SOURCE_DATE}|${codigoFuncionario}`,
    data: SOURCE_DATE,
    funcionarioId: '',
    codigoFuncionario,
    nomeMotorista,
    equipamentoId: '',
    prefixo,
    familia: 'Basculantes',
    status,
    horaSaida,
    horaEntradaManutencao,
    horaLiberacao,
    observacao,
    origem: 'PLANILHA',
    revisao: [],
    criadoEm: CREATED_AT,
    atualizadoEm: CREATED_AT,
  };
});
