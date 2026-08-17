/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Empresa, 
  ObraLocal, 
  Equipamento, 
  Funcionario, 
  Comboio, 
  TipoCombustivel, 
  ProdutoLubrificacao, 
  EtapaServico, 
  Abastecimento, 
  Lubrificacao, 
  HistoryLog,
  ListaPresenca,
  OrdemServico,
  GrupoEquipe,
  PresencaApontamento,
  HistoricoPresenca,
  ApontamentoRamo,
  ApontamentoRamoRegistro,
  TicketJazida,
  MaterialCadastro,
  MaterialRegistro,
  ParteDiariaEquipamento
} from '../types';
import { APONTAMENTO_LINK_TOKEN } from './apontamentoRamosConfig';
import { generateSecurePublicToken } from './publicLinkSecurity';

const mergeByKey = <T,>(base: T[], imported: T[], getKey: (item: T) => string) => {
  const keys = new Set(base.map(item => getKey(item)).filter(Boolean));
  const merged = [...base];
  imported.forEach(item => {
    const key = getKey(item);
    if (!key || keys.has(key)) return;
    keys.add(key);
    merged.push(item);
  });
  return merged;
};

const mergePreferImportedByKey = <T,>(base: T[], imported: T[], getKey: (item: T) => string) => {
  const importedByKey = new Map(imported.map(item => [getKey(item), item]));
  const merged = base.map(item => importedByKey.get(getKey(item)) ?? item);
  const baseKeys = new Set(base.map(getKey));
  imported.forEach(item => {
    if (!baseKeys.has(getKey(item))) merged.push(item);
  });
  return merged;
};

export const loadInitialMateriaisData = async (): Promise<{
  cadastro: MaterialCadastro[];
  registros: MaterialRegistro[];
}> => {
  const data = await import('./initialMateriaisData');
  return {
    cadastro: data.INITIAL_MATERIAIS_CADASTRO,
    registros: data.INITIAL_MATERIAIS_REGISTROS,
  };
};

let operationalSeedHydrated = false;

export const hydrateInitialOperationalSeedData = async (): Promise<void> => {
  if (operationalSeedHydrated) return;
  const [spreadsheetSeed, augustSeed] = await Promise.all([
    import('./importedSpreadsheetSeed'),
    import('./importedAugust2026Seed'),
  ]);

  INITIAL_EMPRESAS = mergeByKey(BASE_INITIAL_EMPRESAS, augustSeed.IMPORTED_AUG2026_EMPRESAS, item => item.id);
  INITIAL_EQUIPAMENTOS = mergePreferImportedByKey(
    mergeByKey(
      BASE_INITIAL_EQUIPAMENTOS,
      spreadsheetSeed.IMPORTED_SEED_EQUIPAMENTOS,
      item => item.prefixo.trim().toLowerCase()
    ),
    augustSeed.IMPORTED_AUG2026_EQUIPAMENTOS,
    item => item.prefixo.trim().toLowerCase()
  );
  INITIAL_COMBOIOS = mergeByKey(BASE_INITIAL_COMBOIOS, augustSeed.IMPORTED_AUG2026_COMBOIOS, item => item.placa.trim().toLowerCase());
  INITIAL_ABASTECIMENTOS = augustSeed.IMPORTED_AUG2026_ABASTECIMENTOS;
  INITIAL_TICKETS_JAZIDA = mergeByKey(
    spreadsheetSeed.IMPORTED_SEED_TICKETS_JAZIDA,
    augustSeed.IMPORTED_AUG2026_TICKETS_JAZIDA,
    item => item.id
  );
  operationalSeedHydrated = true;
};

const BASE_INITIAL_EMPRESAS: Empresa[] = [
  { id: 'emp-1', nome: 'RENEA INFRAESTRUTURA S.A.', cnpj: '12.345.678/0001-90', telefone: '(11) 3214-9900', responsavel: 'Eng. Ricardo Renea' },
  { id: 'emp-2', nome: 'CONSTRUTORA SUL-AMERICANA S/A', cnpj: '98.765.432/0001-10', telefone: '(21) 2500-1122', responsavel: 'Dr. Roberto Souza' },
  { id: 'emp-3', nome: 'GT Transportes', cnpj: '45.888.222/0001-30', telefone: '(19) 3876-5432', responsavel: 'Sandro Santos' },
  { id: 'emp-4', nome: 'Sondasolo', cnpj: '33.444.555/0001-22', telefone: '(11) 4004-1234', responsavel: 'Lucas Sonda' },
  { id: 'emp-5', nome: 'Escala Rental', cnpj: '22.111.000/0001-44', telefone: '(11) 3322-1100', responsavel: 'Fabio Escala' },
  { id: 'emp-6', nome: 'Gerasuper', cnpj: '55.666.777/0001-88', telefone: '(11) 5544-3322', responsavel: 'Carlos Gera' },
  { id: 'emp-7', nome: 'Vallocar', cnpj: '77.888.999/0001-11', telefone: '(11) 9988-7766', responsavel: 'Andre Vallo' },
  { id: 'emp-8', nome: 'JC Rental', cnpj: '11.222.333/0001-55', telefone: '(11) 7766-5544', responsavel: 'Julio Cesar' },
  { id: 'emp-9', nome: 'Tecnogeo', cnpj: '88.999.000/0001-33', telefone: '(11) 8877-6655', responsavel: 'Roberto Geo' },
  { id: 'emp-10', nome: 'Locado', cnpj: '44.555.666/0001-77', telefone: '(11) 2233-4455', responsavel: 'Mário Loca' },
  { id: 'emp-11', nome: 'Tecnogeo/Roda Muk', cnpj: '66.777.888/0001-99', telefone: '(11) 6655-4433', responsavel: 'Renato Muk' },
  { id: 'emp-12', nome: 'Locaguinchos', cnpj: '99.000.111/0001-22', telefone: '(11) 1122-3344', responsavel: 'Geraldo Guincho' },
  { id: 'emp-13', nome: 'Megapeso Transportes', cnpj: '12.233.344/0001-55', telefone: '(11) 2233-4455', responsavel: 'Marcos Peso' },
  { id: 'emp-14', nome: 'Camacon', cnpj: '34.455.566/0001-77', telefone: '(11) 4455-6677', responsavel: 'Eduardo Cama' },
  { id: 'emp-15', nome: 'MGM Rental', cnpj: '56.677.788/0001-99', telefone: '(11) 8899-0011', responsavel: 'Marcelo MGM' },
  { id: 'emp-16', nome: 'Zetaloc.com.br', cnpj: '78.899.900/0001-11', telefone: '(11) 1122-3344', responsavel: 'Zeca Loc' },
  { id: 'emp-17', nome: 'Lagon', cnpj: '90.011.122/0001-33', telefone: '(11) 3344-5566', responsavel: 'Leonardo Lagon' },
  { id: 'emp-18', nome: 'Formeq Rental', cnpj: '12.345.678/0002-12', telefone: '(11) 5566-7788', responsavel: 'Felipe Formeq' },
  { id: 'emp-19', nome: 'Sollo', cnpj: '34.567.890/0002-34', telefone: '(11) 7788-9900', responsavel: 'Silvio Sollo' }
];

export let INITIAL_EMPRESAS: Empresa[] = BASE_INITIAL_EMPRESAS;

export const INITIAL_OBRAS: ObraLocal[] = [
  { id: 'obr-1', nome: 'Mão de Obra Geral - RENEA', endereco: 'Frente de Trabalho Renea', responsavel: 'Eng. Ricardo Renea', status: 'Ativa' },
  { id: 'obr-2', nome: 'Duplicação BR-101 KM 230', endereco: 'Palhoça - SC', responsavel: 'Eng. Gabriel Neves', status: 'Ativa' },
  { id: 'obr-3', nome: 'Anel Viário Metropolitano', endereco: 'Campinas - SP', responsavel: 'Eng. Aline Lima', status: 'Ativa' },
  { id: 'obr-4', nome: 'Pavimentação Parque Industrial', endereco: 'Joinville - SC', responsavel: 'Mestre Carlos Abreu', status: 'Planejada' }
];

const BASE_INITIAL_EQUIPAMENTOS: Equipamento[] = [
  // Basculantes mentioned in Abastecimentos
  { id: 'eq-cb765', prefixo: 'CB765', nome: 'Caminhão Basculante Renea', tipo: 'Caminhão Basculante', marca: 'Mercedes-Benz', modelo: 'Axor 3131', seriePlaca: 'RE-765-BA', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota ativa de basculantes.' },
  { id: 'eq-cb754', prefixo: 'CB754', nome: 'Caminhão Basculante Renea', tipo: 'Caminhão Basculante', marca: 'Mercedes-Benz', modelo: 'Axor 3131', seriePlaca: 'RE-754-BA', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota ativa de basculantes.' },
  { id: 'eq-cb789', prefixo: 'CB789', nome: 'Caminhão Basculante Renea', tipo: 'Caminhão Basculante', marca: 'Volvo', modelo: 'VM 330', seriePlaca: 'RE-789-BA', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota ativa de basculantes.' },
  { id: 'eq-cb775', prefixo: 'CB775', nome: 'Caminhão Basculante Renea', tipo: 'Caminhão Basculante', marca: 'Volvo', modelo: 'VM 330', seriePlaca: 'RE-775-BA', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota ativa de basculantes.' },
  { id: 'eq-cb786', prefixo: 'CB786', nome: 'Caminhão Basculante Renea', tipo: 'Caminhão Basculante', marca: 'Mercedes-Benz', modelo: 'Axor 3131', seriePlaca: 'RE-786-BA', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota ativa de basculantes.' },
  { id: 'eq-cb755', prefixo: 'CB755', nome: 'Caminhão Basculante Renea', tipo: 'Caminhão Basculante', marca: 'Mercedes-Benz', modelo: 'Axor 3131', seriePlaca: 'RE-755-BA', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota ativa de basculantes.' },
  { id: 'eq-cb770', prefixo: 'CB770', nome: 'Caminhão Basculante Renea', tipo: 'Caminhão Basculante', marca: 'Volvo', modelo: 'VM 330', seriePlaca: 'RE-770-BA', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota ativa de basculantes.' },
  { id: 'eq-cb730', prefixo: 'CB730', nome: 'Caminhão Basculante Renea', tipo: 'Caminhão Basculante', marca: 'Mercedes-Benz', modelo: 'Axor 3131', seriePlaca: 'RE-730-BA', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota ativa de basculantes.' },
  { id: 'eq-cb804', prefixo: 'CB804', nome: 'Caminhão Basculante Renea', tipo: 'Caminhão Basculante', marca: 'Volkswagen', modelo: 'Constellation', seriePlaca: 'RE-804-BA', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota ativa de basculantes.' },
  { id: 'eq-cb776', prefixo: 'CB776', nome: 'Caminhão Basculante Renea', tipo: 'Caminhão Basculante', marca: 'Volvo', modelo: 'VM 330', seriePlaca: 'RE-776-BA', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota ativa de basculantes.' },
  { id: 'eq-cb794', prefixo: 'CB794', nome: 'Caminhão Basculante Renea', tipo: 'Caminhão Basculante', marca: 'Mercedes-Benz', modelo: 'Axor 3131', seriePlaca: 'RE-794-BA', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota ativa de basculantes.' },
  { id: 'eq-cb767', prefixo: 'CB767', nome: 'Caminhão Basculante Renea', tipo: 'Caminhão Basculante', marca: 'Mercedes-Benz', modelo: 'Axor 3131', seriePlaca: 'RE-767-BA', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota ativa de basculantes.' },
  { id: 'eq-cb735', prefixo: 'CB735', nome: 'Caminhão Basculante Renea', tipo: 'Caminhão Basculante', marca: 'Volvo', modelo: 'VM 330', seriePlaca: 'RE-735-BA', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota ativa de basculantes.' },
  { id: 'eq-cb790', prefixo: 'CB790', nome: 'Caminhão Basculante Renea', tipo: 'Caminhão Basculante', marca: 'Mercedes-Benz', modelo: 'Axor 3131', seriePlaca: 'RE-790-BA', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota ativa.' },
  { id: 'eq-cb748', prefixo: 'CB748', nome: 'Caminhão Basculante Renea', tipo: 'Caminhão Basculante', marca: 'Volvo', modelo: 'VM 330', seriePlaca: 'RE-748-BA', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota ativa de basculantes.' },

  // Equipment from Image 2
  { id: 'eq-gp004', prefixo: 'GP004', nome: 'Grua de Esteiras Sany SCC1800', tipo: 'Guindaste', marca: 'Sany', modelo: 'SCC1800', seriePlaca: 'SNY-1800', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-2', observacao: 'Grua de esteiras de alta capacidade.' },
  { id: 'eq-gp005', prefixo: 'GP005', nome: 'Grua de Esteiras Sany SCC2500C', tipo: 'Guindaste', marca: 'Sany', modelo: 'SCC2500C', seriePlaca: 'SNY-2500', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-2', observacao: 'Equipamento pesado.' },
  { id: 'eq-te007', prefixo: 'TE007', nome: 'Trator De Esteiras D61 EX', tipo: 'Trator de Esteira', marca: 'Komatsu', modelo: 'D61 EX', seriePlaca: 'KM-007-TE', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-2', observacao: 'Trator de esteira potente.' },
  { id: 'eq-gp008', prefixo: 'GP008', nome: 'Guindaste Sany STC800', tipo: 'Guindaste', marca: 'Sany', modelo: 'STC800', seriePlaca: 'SNY-800', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-2', observacao: 'Guindaste rodoviário.' },
  { id: 'eq-ec012', prefixo: 'EC012', nome: 'Escavadeira Hidráulica 210', tipo: 'Escavadeira', marca: 'Caterpillar', modelo: '320D', seriePlaca: 'CAT-210', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-2', observacao: 'Escavadeira hidráulica robusta.' },
  { id: 'eq-rt017', prefixo: 'RT017', nome: 'Retroescavadeira 416E', tipo: 'Retroescavadeira', marca: 'Caterpillar', modelo: '416E', seriePlaca: 'CAT-416', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-2', observacao: 'Retroescavadeira versátil.' },
  { id: 'eq-ca019', prefixo: 'CA019', nome: 'Comboio de Abastecimento', tipo: 'Caminhão Comboio', marca: 'Mercedes-Benz', modelo: 'Atego 1719', seriePlaca: 'CMB-019', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-2', observacao: 'Comboio com tanque de combustível integrado.' },
  { id: 'eq-te030', prefixo: 'TE030', nome: 'Trator De Esteiras D6N XL', tipo: 'Trator de Esteira', marca: 'Caterpillar', modelo: 'D6N XL', seriePlaca: 'CAT-030-TE', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-2', observacao: 'Trator de esteiras Caterpillar.' },
  { id: 'eq-bt031', prefixo: 'BT031', nome: 'Caminhão Betoneira', tipo: 'Caminhão Betoneira', marca: 'Volkswagen', modelo: 'Constellation', seriePlaca: 'VW-031-BT', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-2', observacao: 'Betoneira de concreto.' },
  { id: 'eq-cv035', prefixo: 'CV035', nome: 'Cavalo Mecânico', tipo: 'Cavalo Mecânico', marca: 'Scania', modelo: 'R440', seriePlaca: 'SC-035-CV', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-2', observacao: 'Transporte de carretas.' },
  { id: 'eq-rc041', prefixo: 'RC041', nome: 'Rolo Chapa CA250', tipo: 'Rolo Compactador', marca: 'Dynapac', modelo: 'CA250', seriePlaca: 'DY-041-RC', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-2', observacao: 'Rolo liso para asfalto.' },
  { id: 'eq-ec063', prefixo: 'EC063', nome: 'Escavadeira Hidráulica 210 BLC', tipo: 'Escavadeira', marca: 'Sany', modelo: 'SY215', seriePlaca: 'SNY-210-BLC', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-2', observacao: 'Escavadeira de esteiras.' },

  // Rent/Partners equipment
  { id: 'eq-lo145', prefixo: 'LO145', nome: 'Caminhão Carroceria GT', tipo: 'Caminhão', marca: 'Ford', modelo: 'Cargo', seriePlaca: 'GT-145', empresaId: 'emp-3', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Locado da GT Transportes.' },
  { id: 'eq-lo155', prefixo: 'LO155', nome: 'Perfuratriz Sondasolo', tipo: 'Perfuratriz', marca: 'Sondasolo', modelo: 'PS-155', seriePlaca: 'SS-155', empresaId: 'emp-4', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Locado da Sondasolo.' },
  { id: 'eq-lo156', prefixo: 'LO156', nome: 'Gerador 170KVA - 170-004', tipo: 'Gerador', marca: 'Cummins', modelo: '170KVA', seriePlaca: 'ER-156', empresaId: 'emp-5', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Locado da Escala Rental.' },
  { id: 'eq-lo157', prefixo: 'LO157', nome: 'Compressor - 4999002', tipo: 'Compressor', marca: 'Atlas Copco', modelo: '4999002', seriePlaca: 'GS-157', empresaId: 'emp-6', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Locado da Gerasuper.' },
  { id: 'eq-lo231', prefixo: 'LO231', nome: 'Gerador JC6063', tipo: 'Gerador', marca: 'MWM', modelo: 'JC6063', seriePlaca: 'JC-231', empresaId: 'emp-8', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Locado da JC Rental.' },
  { id: 'eq-lo237', prefixo: 'LO237', nome: 'Bate estaca (PE 3301) 7757', tipo: 'Bate Estaca', marca: 'Tecnogeo', modelo: 'PE3301', seriePlaca: 'TG-237', empresaId: 'emp-9', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Locado da Tecnogeo.' },
  { id: 'eq-lo249', prefixo: 'LO249', nome: 'Caminhão Munck Roda Muk', tipo: 'Caminhão Munck', marca: 'Mercedes-Benz', modelo: 'Atego', seriePlaca: 'RM-249', empresaId: 'emp-11', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Locado de Tecnogeo/Roda Muk.' },
  { id: 'eq-lo256', prefixo: 'LO256', nome: 'Caminhão Munck MB Atego 2730', tipo: 'Caminhão Munck', marca: 'Mercedes-Benz', modelo: 'Atego 2730', seriePlaca: 'LG-256', empresaId: 'emp-12', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Locado de Locaguinchos.' },
  { id: 'eq-lo278', prefixo: 'LO278', nome: 'Retroescavadeira JCB 3CX', tipo: 'Retroescavadeira', marca: 'JCB', modelo: '3CX', seriePlaca: 'CC-278', empresaId: 'emp-14', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Locado de Camacon.' },
  { id: 'eq-lo279', prefixo: 'LO279', nome: 'Escavadeira Hidráulica Cat 320 GC', tipo: 'Escavadeira', marca: 'Caterpillar', modelo: '320 GC', seriePlaca: 'MGM-279', empresaId: 'emp-15', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Locado de MGM Rental.' },
  { id: 'eq-lo321', prefixo: 'LO321', nome: 'Mini Escavadeira Bob Cat', tipo: 'Mini Escavadeira', marca: 'Bobcat', modelo: 'E27', seriePlaca: 'ZL-321', empresaId: 'emp-16', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Locado de Zetaloc.' },
  { id: 'eq-lo331', prefixo: 'LO331', nome: 'Caminhão Auto Bomba de Concreto', tipo: 'Caminhão Bomba', marca: 'Volkswagen', modelo: 'Constellation', seriePlaca: 'LA-331', empresaId: 'emp-17', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Locado de Lagon.' },
  { id: 'eq-lo337', prefixo: 'LO337', nome: 'Bomba Diesel Wacker PT6 6" W12', tipo: 'Bomba de Água', marca: 'Wacker Neuson', modelo: 'PT6', seriePlaca: 'FQ-337', empresaId: 'emp-18', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Locado de Formeq Rental.' },
  { id: 'eq-lo341', prefixo: 'LO341', nome: 'PTA JLG LIFT 600AJ', tipo: 'PTA', marca: 'JLG', modelo: '600AJ', seriePlaca: 'SL-341', empresaId: 'emp-19', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Locado de Sollo.' },

  // Equipamentos importados da planilha CONTROLE_DIARIO_DE_ABASTECIMENTO_-_LUBRIFICAÇÃO
  { id: 'eq-cb782', prefixo: 'CB782', nome: "Caminhão Betoneira", tipo: 'Caminhão Betoneira', marca: 'Volkswagen', modelo: "Constellation", seriePlaca: 'CB782', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota própria Renea.' },
  { id: 'eq-ec010', prefixo: 'EC010', nome: "Escavadeira Volvo", tipo: 'Escavadeira', marca: 'Volvo', modelo: "EC210", seriePlaca: 'EC010', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota própria Renea.' },
  { id: 'eq-ec077', prefixo: 'EC077', nome: "Escavadeia PC 210", tipo: 'Escavadeira', marca: 'Komatsu', modelo: "PC210", seriePlaca: 'EC077', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota própria Renea.' },
  { id: 'eq-ec079', prefixo: 'EC079', nome: "Escavadeira Hidráulica 320 D", tipo: 'Escavadeira', marca: 'Caterpillar', modelo: "320D", seriePlaca: 'EC079', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota própria Renea.' },
  { id: 'eq-ec081', prefixo: 'EC081', nome: "Escavadeira Hidráulica 320 D", tipo: 'Escavadeira', marca: 'Caterpillar', modelo: "320D", seriePlaca: 'EC081', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota própria Renea.' },
  { id: 'eq-lo162', prefixo: 'LO162', nome: "Perfuratriz (Sondasolo)", tipo: 'Perfuratriz', marca: 'Sondasolo', modelo: "PS-Perfuratriz", seriePlaca: 'LO162', empresaId: 'emp-4', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Sondasolo.' },
  { id: 'eq-lo165', prefixo: 'LO165', nome: "Gerador 170KVA - 170-006 (Escala Rental)", tipo: 'Gerador', marca: 'Cummins', modelo: "Gerador 170KVA - 170-006", seriePlaca: 'LO165', empresaId: 'emp-5', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Escala Rental.' },
  { id: 'eq-lo169', prefixo: 'LO169', nome: "Gerador Cat 60KVA - 060-001 (Escala Rental)", tipo: 'Gerador', marca: 'Cummins', modelo: "Gerador Cat 60KVA - 060-001", seriePlaca: 'LO169', empresaId: 'emp-5', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Escala Rental.' },
  { id: 'eq-lo232', prefixo: 'LO232', nome: "Perfuratriz (Sondasolo)", tipo: 'Perfuratriz', marca: 'Sondasolo', modelo: "PS-Perfuratriz", seriePlaca: 'LO232', empresaId: 'emp-4', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Sondasolo.' },
  { id: 'eq-lo241', prefixo: 'LO241', nome: "Vibrocat (Tecnogeo)", tipo: 'Compactador Vibratório', marca: 'Tecnogeo', modelo: "Vibrocat", seriePlaca: 'LO241', empresaId: 'emp-9', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Tecnogeo.' },
  { id: 'eq-lo244', prefixo: 'LO244', nome: "Bate estaca (ABI 14/17) 7742 (Tecnogeo)", tipo: 'Bate Estaca', marca: 'Tecnogeo', modelo: "Bate estaca (ABI 14/17) 7742", seriePlaca: 'LO244', empresaId: 'emp-9', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Tecnogeo.' },
  { id: 'eq-lo247', prefixo: 'LO247', nome: "Perfuratriz (Sondasolo)", tipo: 'Perfuratriz', marca: 'Sondasolo', modelo: "PS-Perfuratriz", seriePlaca: 'LO247', empresaId: 'emp-4', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Sondasolo.' },
  { id: 'eq-lo248', prefixo: 'LO248', nome: "Bate estaca (Banut 555) BE0104 (Tecnogeo)", tipo: 'Bate Estaca', marca: 'Tecnogeo', modelo: "Bate estaca (Banut 555) BE0104", seriePlaca: 'LO248', empresaId: 'emp-9', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Tecnogeo.' },
  { id: 'eq-lo250', prefixo: 'LO250', nome: "Gerador JC6059 (JC Rental)", tipo: 'Gerador', marca: 'Cummins', modelo: "Gerador JC6059", seriePlaca: 'LO250', empresaId: 'emp-8', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de JC Rental.' },
  { id: 'eq-lo258', prefixo: 'LO258', nome: "Gerador Cat JC10069 (JC Rental)", tipo: 'Gerador', marca: 'Cummins', modelo: "Gerador Cat JC10069", seriePlaca: 'LO258', empresaId: 'emp-8', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de JC Rental.' },
  { id: 'eq-lo260', prefixo: 'LO260', nome: "Bate estaca (PE 3302) (Tecnogeo)", tipo: 'Bate Estaca', marca: 'Tecnogeo', modelo: "Bate estaca (PE 3302)", seriePlaca: 'LO260', empresaId: 'emp-9', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Tecnogeo.' },
  { id: 'eq-lo264', prefixo: 'LO264', nome: "Compressor (Vibrocat LO241) (Tecnogeo)", tipo: 'Compactador Vibratório', marca: 'Tecnogeo', modelo: "Vibrocat", seriePlaca: 'LO264', empresaId: 'emp-9', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Tecnogeo.' },
  { id: 'eq-lo293', prefixo: 'LO293', nome: "Caminhão Munck MB Atego 2730 (Locaguincho)", tipo: 'Caminhão Munck', marca: 'Mercedes-Benz', modelo: "Atego 2730", seriePlaca: 'LO293', empresaId: 'emp-12', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Locaguincho.' },
  { id: 'eq-lo318', prefixo: 'LO318', nome: "Escavadeira Hidráulica CAT 320 GC (Camacon)", tipo: 'Escavadeira', marca: 'Caterpillar', modelo: "320 GC", seriePlaca: 'LO318', empresaId: 'emp-14', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Camacon.' },
  { id: 'eq-lo325', prefixo: 'LO325', nome: "Gerador 125-004 (Escala Rental)", tipo: 'Gerador', marca: 'Cummins', modelo: "Gerador 125-004", seriePlaca: 'LO325', empresaId: 'emp-5', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Escala Rental.' },
  { id: 'eq-lo326', prefixo: 'LO326', nome: "Caminhão Munck VW 26.280 (Locaguincho)", tipo: 'Caminhão Munck', marca: 'Volkswagen', modelo: "26.280", seriePlaca: 'LO326', empresaId: 'emp-12', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Locaguincho.' },
  { id: 'eq-lo334', prefixo: 'LO334', nome: "Gerador 025-004 (Escala Rental)", tipo: 'Gerador', marca: 'Cummins', modelo: "Gerador 025-004", seriePlaca: 'LO334', empresaId: 'emp-5', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Escala Rental.' },
  { id: 'eq-lo338', prefixo: 'LO338', nome: "Caminhão Munck Ford Cargo 2423 (Tecnogeo/Roda Muk)", tipo: 'Caminhão Munck', marca: 'Ford', modelo: "Cargo 2423", seriePlaca: 'LO338', empresaId: 'emp-11', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Tecnogeo/Roda Muk.' },
  { id: 'eq-lo352', prefixo: 'LO352', nome: "Gerador (Vibriocat LO241) (Tecnogeo)", tipo: 'Gerador', marca: 'Cummins', modelo: "Gerador (Vibriocat LO241)", seriePlaca: 'LO352', empresaId: 'emp-9', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Tecnogeo.' },
  { id: 'eq-lo354', prefixo: 'LO354', nome: "Escavadeira Liebherr 944 (Tecnogeo)", tipo: 'Escavadeira', marca: 'Liebherr', modelo: "944", seriePlaca: 'LO354', empresaId: 'emp-9', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Tecnogeo.' },
  { id: 'eq-lo355', prefixo: 'LO355', nome: "Gerador - 115-001 (Escala Rental)", tipo: 'Gerador', marca: 'Cummins', modelo: "Gerador - 115-001", seriePlaca: 'LO355', empresaId: 'emp-5', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Escala Rental.' },
  { id: 'eq-lo357', prefixo: 'LO357', nome: "Bomba Diesel Wacker PT6 6`` W18 (Formeq Rental)", tipo: 'Bomba de Água', marca: 'Wacker Neuson', modelo: "PT6", seriePlaca: 'LO357', empresaId: 'emp-18', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Formeq Rental.' },
  { id: 'eq-lo358', prefixo: 'LO358', nome: "Bomba Diesel Wacker PT6 6`` W09 (Formeq Rental)", tipo: 'Bomba de Água', marca: 'Wacker Neuson', modelo: "PT6", seriePlaca: 'LO358', empresaId: 'emp-18', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de Formeq Rental.' },
  { id: 'eq-lo360', prefixo: 'LO360', nome: "Gerador - JC10034 (JC Rental)", tipo: 'Gerador', marca: 'Cummins', modelo: "Gerador - JC10034", seriePlaca: 'LO360', empresaId: 'emp-8', status: 'Ativo', localAtualId: 'obr-3', observacao: 'Equipamento locado de JC Rental.' },
  { id: 'eq-rt018', prefixo: 'RT018', nome: "Retroescavadeira 416E", tipo: 'Retroescavadeira', marca: 'Caterpillar', modelo: "416E", seriePlaca: 'RT018', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota própria Renea.' },
  { id: 'eq-rt030', prefixo: 'RT030', nome: "Retroescavadeira", tipo: 'Retroescavadeira', marca: 'Caterpillar', modelo: "416E", seriePlaca: 'RT030', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota própria Renea.' },
  { id: 'eq-te037', prefixo: 'TE037', nome: "Trator De Esteiras D6N XL", tipo: 'Trator de Esteira', marca: 'Caterpillar', modelo: "D6N XL", seriePlaca: 'TE037', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota própria Renea.' },
  { id: 'eq-te038', prefixo: 'TE038', nome: "Trator De Esteiras D6 T XL", tipo: 'Trator de Esteira', marca: 'Caterpillar', modelo: "D6T XL", seriePlaca: 'TE038', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1', observacao: 'Frota própria Renea.' }
];

export let INITIAL_EQUIPAMENTOS: Equipamento[] = BASE_INITIAL_EQUIPAMENTOS;

export const INITIAL_FUNCIONARIOS: Funcionario[] = [
  { id: "fun-102240", matricula: "102240", nome: "ADEMAR FERREIRA DA CRUZ", cargo: "GREIDISTA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102163", matricula: "102163", nome: "ADRIANO GOMES DA SILVA", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101699", liderNome: "ROBERSON DA SILVA RODRIGUES", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-101997", matricula: "101997", nome: "ALAN RODRIGUES DA SILVA JESUS", cargo: "SINALEIRO", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102449", matricula: "102449", nome: "ALEXANDRE PASSOS BERNARDES", cargo: "OPERADOR DE RETROESCAVADEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-101671", matricula: "101671", nome: "ANDERSON PEIXOTO DA SILVA", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102317", matricula: "102317", nome: "ANTONIO FILHO DOS SANTOS", cargo: "OPERADOR DE TRATOR ESTEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102435", matricula: "102435", nome: "ARISMALDO SANTOS DA SILVA", cargo: "MEIO OFICIAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102063", liderNome: "SERGIO CONCEICAO DA SILVA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102406", matricula: "102406", nome: "BRUNO PEREIRA FACALHA", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101699", liderNome: "ROBERSON DA SILVA RODRIGUES", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102012", matricula: "102012", nome: "CARLOS EDUARDO DE ARAUJO", cargo: "OPERADOR DE ESCAVADEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-101788", matricula: "101788", nome: "CELSON SIQUEIRA SILVA", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102398", matricula: "102398", nome: "CLAELTON NUNES DE SOUSA", cargo: "ENCARREGADO DE OBRAS", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190123", liderNome: "THIAGO ABREU DE OLIVEIRA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102067", matricula: "102067", nome: "DILSON DOS SANTOS MACHADO", cargo: "LIDER DE EQUIPE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-101989", matricula: "101989", nome: "DOUGLAS GONCALVES SOARES", cargo: "OPERADOR DE TRATOR ESTEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102146", matricula: "102146", nome: "EDMILSON ALVES DA SILVA", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102022", matricula: "102022", nome: "EDUARDO SOARES DE OLIVEIRA", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102084", matricula: "102084", nome: "ERISMARCO DE OLIVEIRA SILVA", cargo: "OPERADOR DE ROLO COMPACTADOR", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-101564", matricula: "101564", nome: "EUDES DOS SANTOS MATHEUS", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102112", matricula: "102112", nome: "EZEQUIEL DE SOUZA VIEIRA", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-101990", matricula: "101990", nome: "FABIANO ALVES NUNES", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-101617", matricula: "101617", nome: "FRANCISCO DAS CHAGAS FERREIRA AZEVEDO", cargo: "OPERADOR DE ESCAVADEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-101635", matricula: "101635", nome: "FRANCISCO FERREIRA DE LIMA", cargo: "OPERADOR DE ESCAVADEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-101234", matricula: "101234", nome: "FRANCISCO GOMES FILHO", cargo: "OPERADOR DE MAQUINAS E EQUIPAMENTOS", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102023", matricula: "102023", nome: "GENIVALDO MANOEL DOS SANTOS", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102148", matricula: "102148", nome: "GLEISSON SANTOS DE JESUS", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102315", matricula: "102315", nome: "GONCALO ALIXANDRE DA SILVA", cargo: "OPERADOR DE MAQUINAS E EQUIPAMENTOS", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102143", matricula: "102143", nome: "GUILHERME MACEDO FACUNDO", cargo: "OPERADOR DE RETROESCAVADEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-101615", matricula: "101615", nome: "ISAIAS RODRIGUES PEREIRA", cargo: "ENCARREGADO DE OBRAS", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190123", liderNome: "THIAGO ABREU DE OLIVEIRA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-101676", matricula: "101676", nome: "IVAN FRANCISCO SANTOS", cargo: "OPERADOR DE MAQUINAS E EQUIPAMENTOS", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-101565", matricula: "101565", nome: "JEAM OLIVEIRA DA SILVA", cargo: "MOTORISTA DE CAMINHAO PIPA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102261", matricula: "102261", nome: "JOCELIO BRAZ DE OLIVEIRA DA SILVA", cargo: "OPERADOR DE ESCAVADEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102165", matricula: "102165", nome: "JONAS CARDOSO GONCALVES", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101567", liderNome: "CARLOS EDUARDO SILVA DE SANTANA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102139", matricula: "102139", nome: "JONATHAN SANTOS DA SILVA", cargo: "SINALEIRO", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102018", matricula: "102018", nome: "JOSE ALLAN KARDEC DA SILVA", cargo: "OPERADOR DE ESCAVADEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102016", matricula: "102016", nome: "JOSE APARECIDO FIRMINO", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-101998", matricula: "101998", nome: "JOSE CARLOS MARQUES PEREIRA", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190106", liderNome: "ALVARO ALVES VILELA", area: "MANUTENÇÃO CANTEIRO", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102250", matricula: "102250", nome: "JOSE DA SILVA", cargo: "OPERADOR DE TRATOR ESTEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102466", matricula: "102466", nome: "JOSE DA SILVA", cargo: "OPERADOR DE ESCAVADEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102476", matricula: "102476", nome: "JOSE HELDER RODRIGUES RAMOS", cargo: "OPERADOR DE ESCAVADEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102364", matricula: "102364", nome: "JOSE ILDO DOS SANTOS", cargo: "ARMADOR", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101699", liderNome: "ROBERSON DA SILVA RODRIGUES", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-101633", matricula: "101633", nome: "JUCIMAR DOS SANTOS DE ALCANTARA", cargo: "ARMADOR II", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101561", liderNome: "WANDERSON SILVA ALMEIDA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102065", matricula: "102065", nome: "JULIO CESAR DE ASSIS LUZ", cargo: "OPERADOR DE ESCAVADEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-100787", matricula: "100787", nome: "JULIO CESAR PEREIRA DOS SANTOS SOUZA", cargo: "OPERADOR DE MAQUINAS E EQUIPAMENTOS", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102365", matricula: "102365", nome: "KAICK LUIZ DA SILVA TAVARES", cargo: "MEIO OFICIAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101699", liderNome: "ROBERSON DA SILVA RODRIGUES", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102407", matricula: "102407", nome: "KAUAN SILVA RODRIGUES", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102398", liderNome: "CLAELTON NUNES DE SOUSA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102232", matricula: "102232", nome: "LUAN GUILHERME MUNIZ NOGUEIRA", cargo: "OPERADOR DE RETROESCAVADEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102144", matricula: "102144", nome: "MARCIO NUNES DE SIQUEIRA", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102398", liderNome: "CLAELTON NUNES DE SOUSA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102156", matricula: "102156", nome: "MARIO DRAGONI NETO", cargo: "AUXILIAR DE ALMOXARIFADO", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190106", liderNome: "ALVARO ALVES VILELA", area: "ALMOXARIFADO", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102166", matricula: "102166", nome: "MATEUS CAVALCANTI LEITE", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102017", matricula: "102017", nome: "MATEUS PEREIRA DA SILVA", cargo: "SOLDADOR DE ESTRUTURA METALICA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102063", liderNome: "SERGIO CONCEICAO DA SILVA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102064", matricula: "102064", nome: "NELSON TADEU DOS SANTOS", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102363", matricula: "102363", nome: "NILTON BARBOSA DOS SANTOS", cargo: "ARMADOR", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101699", liderNome: "ROBERSON DA SILVA RODRIGUES", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102359", matricula: "102359", nome: "ODAYR JOSE DA CONCEICAO DOS SANTOS", cargo: "ARMADOR", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101561", liderNome: "WANDERSON SILVA ALMEIDA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102355", matricula: "102355", nome: "PAULO DE TARSO ESTEVES FREIRES", cargo: "ENCARREGADO DE OBRAS", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190106", liderNome: "ALVARO ALVES VILELA", area: "CONTROLE", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102451", matricula: "102451", nome: "RAFAEL DA CRUZ", cargo: "OPERADOR DE ROLO COMPACTADOR", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102252", matricula: "102252", nome: "RAIMUNDO SANTOS RODRIGUES", cargo: "ENCARREGADO DE OBRAS", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190123", liderNome: "THIAGO ABREU DE OLIVEIRA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102138", matricula: "102138", nome: "REGINALDO MARQUES DE AMORIM", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102241", matricula: "102241", nome: "REINALDO DOS SANTOS", cargo: "OPERADOR DE RETROESCAVADEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102438", matricula: "102438", nome: "RENATO FERREIRA DE BARROS", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102398", liderNome: "CLAELTON NUNES DE SOUSA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102200", matricula: "102200", nome: "RENILSON DOS SANTOS", cargo: "ENCARREGADO GERAL II", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190106", liderNome: "ALVARO ALVES VILELA", area: "TERRAPLENAGEM", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-101699", matricula: "101699", nome: "ROBERSON DA SILVA RODRIGUES", cargo: "ENCARREGADO DE OBRAS", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190123", liderNome: "THIAGO ABREU DE OLIVEIRA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102111", matricula: "102111", nome: "ROBERTO ARAUJO AZEVEDO", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102410", matricula: "102410", nome: "RODRIGO DA SILVA DE PAULA", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101699", liderNome: "ROBERSON DA SILVA RODRIGUES", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102229", matricula: "102229", nome: "RODRIGO LOPES DA SILVA", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101699", liderNome: "ROBERSON DA SILVA RODRIGUES", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102319", matricula: "102319", nome: "ROGERIO PAULO GHILARDI", cargo: "PEDREIRO", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101615", liderNome: "ISAIAS RODRIGUES PEREIRA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102147", matricula: "102147", nome: "RONALDO SOARES DE OLIVEIRA", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-101985", matricula: "101985", nome: "SAMUEL RODRIGUES DE SOUSA", cargo: "OPERADOR DE RETROESCAVADEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102063", matricula: "102063", nome: "SERGIO CONCEICAO DA SILVA", cargo: "ENCARREGADO DE OBRAS", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190123", liderNome: "THIAGO ABREU DE OLIVEIRA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-101561", matricula: "101561", nome: "WANDERSON SILVA ALMEIDA", cargo: "ENCARREGADO DE OBRAS", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101561", liderNome: "WANDERSON SILVA ALMEIDA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-101979", matricula: "101979", nome: "WEDLEY PEREIRA DOS SANTOS", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102105", matricula: "102105", nome: "WELINGTON DA SILVA RODRIGUES", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-101785", matricula: "101785", nome: "WELLINGTON SILVA DE OLIVEIRA", cargo: "PEDREIRO", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101615", liderNome: "ISAIAS RODRIGUES PEREIRA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102103", matricula: "102103", nome: "WILSON GERVASIO DE MORAES FILHO", cargo: "MOTORISTA DE CAMINHAO PIPA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102468", matricula: "102468", nome: "CARLOS ROBERTO MIZAEL DOS SANTOS", cargo: "PEDREIRO", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102252", liderNome: "RAIMUNDO SANTOS RODRIGUES", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102472", matricula: "102472", nome: "CESAR DE SOUZA PEREIRA", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102252", liderNome: "RAIMUNDO SANTOS RODRIGUES", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102160", matricula: "102160", nome: "WAGNER RODRIGUES", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102252", liderNome: "RAIMUNDO SANTOS RODRIGUES", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102498", matricula: "102498", nome: "REGINALDO RODRIGUES LIMA", cargo: "LIDER DE EQUIPE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102252", liderNome: "RAIMUNDO SANTOS RODRIGUES", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-101880", matricula: "101880", nome: "EVANDRO GHELERE DE SOUZA", cargo: "PEDREIRO", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102252", liderNome: "RAIMUNDO SANTOS RODRIGUES", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102401", matricula: "102401", nome: "ADEMIR HENRIQUE BARBOSA", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102252", liderNome: "RAIMUNDO SANTOS RODRIGUES", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-101809", matricula: "101809", nome: "ARMANDO SEBASTIAO DA SILVA", cargo: "CARPINTEIRO", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102252", liderNome: "RAIMUNDO SANTOS RODRIGUES", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102470", matricula: "102470", nome: "MARCOS VINICIUS MOURA ROSA", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102252", liderNome: "RAIMUNDO SANTOS RODRIGUES", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102488", matricula: "102488", nome: "MARCIO DOS SANTOS SIMOES", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102252", liderNome: "RAIMUNDO SANTOS RODRIGUES", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102507", matricula: "102507", nome: "ALEXANDRE DOS SANTOS RODRIGUES", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102504", matricula: "102504", nome: "DEIVID BRANDAO DE SOUZA SANTANA", cargo: "AUXILIAR TECNICO I", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190106", liderNome: "ALVARO ALVES VILELA", area: "CONTROLE", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102508", matricula: "102508", nome: "ENRICK SHALON DA SILVA DIAS DOS SANTOS", cargo: "SINALEIRO", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-170909", matricula: "170909", nome: "VAGNER NASCIMENTO SANTOS", cargo: "NIVELADOR", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "170794", liderNome: "BRUNO MIKAEL FERREIRA MARTINS", area: "TOPOGRAFIA", responsavelArea: "MARCO CAMPELO" },
  { id: "fun-102354", matricula: "102354", nome: "JEILTON ROCHA FERNANDES", cargo: "NIVELADOR", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "170794", liderNome: "BRUNO MIKAEL FERREIRA MARTINS", area: "TOPOGRAFIA", responsavelArea: "MARCO CAMPELO" },
  { id: "fun-101953", matricula: "101953", nome: "JOSE JESUS DOS SANTOS", cargo: "MOTORISTA DE CAMINHAO", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101747", liderNome: "RENATO JOSE DA SILVA", area: "SINALIZAÇÃO", responsavelArea: "ROBERTO AUGUSTO ALVES GAUCH" },
  { id: "fun-102164", matricula: "102164", nome: "DAVID CAMILO DE JESUS SILVA", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101747", liderNome: "RENATO JOSE DA SILVA", area: "SINALIZAÇÃO", responsavelArea: "ROBERTO AUGUSTO ALVES GAUCH" },
  { id: "fun-101864", matricula: "101864", nome: "GABRIEL CORREIA SANTOS", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101747", liderNome: "RENATO JOSE DA SILVA", area: "SINALIZAÇÃO", responsavelArea: "ROBERTO AUGUSTO ALVES GAUCH" },
  { id: "fun-101862", matricula: "101862", nome: "ELTON SILVA GOMES DOS SANTOS", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101747", liderNome: "RENATO JOSE DA SILVA", area: "SINALIZAÇÃO", responsavelArea: "ROBERTO AUGUSTO ALVES GAUCH" },
  { id: "fun-101762", matricula: "101762", nome: "JOSE DEILTON DOS SANTOS", cargo: "OPERADOR DE GUINDASTE I", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "171446", liderNome: "JOSINALDO MEDEIROS DE OLIVEIRA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "ROBERTO AUGUSTO ALVES GAUCH" },
  { id: "fun-102369", matricula: "102369", nome: "MESSIAS AUGUSTO DOS SANTOS", cargo: "OPERADOR DE GUINDASTE I", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "171446", liderNome: "JOSINALDO MEDEIROS DE OLIVEIRA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "ROBERTO AUGUSTO ALVES GAUCH" },
  { id: "fun-102399", matricula: "102399", nome: "ADEILTON DE OLIVEIRA SILVA", cargo: "OPERADOR DE GUINDASTE I", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "171446", liderNome: "JOSINALDO MEDEIROS DE OLIVEIRA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "ROBERTO AUGUSTO ALVES GAUCH" },
  { id: "fun-102437", matricula: "102437", nome: "JOAO LUIZ CARDOSO DE OLIVEIRA", cargo: "OPERADOR DE GUINDASTE I", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "171446", liderNome: "JOSINALDO MEDEIROS DE OLIVEIRA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "ROBERTO AUGUSTO ALVES GAUCH" },
  { id: "fun-102158", matricula: "102158", nome: "CHARLITON JOSE DO NASCIMENTO", cargo: "AUXILIAR DE ELETRICISTA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102400", liderNome: "CESARNILDO DE MESQUITA CRISTALINO", area: "ELÉTRICA", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102517", matricula: "102517", nome: "RODRIGO BEZERRA DE ARAUJO", cargo: "APONTADOR", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190106", liderNome: "ALVARO ALVES VILELA", area: "TERRAPLENAGEM", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102400", matricula: "102400", nome: "CESARNILDO DE MESQUITA CRISTALINO", cargo: "ELETRICISTA DE MANUTENCAO", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190106", liderNome: "ALVARO ALVES VILELA", area: "ELÉTRICA", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-101480", matricula: "101480", nome: "PATRICIA SILVA DOS SANTOS", cargo: "TECNICO EM SEGURANCA DO TRABALHO", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190044", liderNome: "PAULO CESAR HONORATO DA SILVA VIEIRA", area: "SSTMA", responsavelArea: "PAULO CESAR HONORATO DA SILVA VIEIRA" },
  { id: "fun-101616", matricula: "101616", nome: "FABIO CAMPOS PASSOS", cargo: "ANALISTA AMBIENTAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190044", liderNome: "PAULO CESAR HONORATO DA SILVA VIEIRA", area: "SSTMA", responsavelArea: "PAULO CESAR HONORATO DA SILVA VIEIRA" },
  { id: "fun-102061", matricula: "102061", nome: "LUIZ FELIPE DA SILVA", cargo: "TECNICO EM SEGURANCA DO TRABALHO", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190044", liderNome: "PAULO CESAR HONORATO DA SILVA VIEIRA", area: "SSTMA", responsavelArea: "PAULO CESAR HONORATO DA SILVA VIEIRA" },
  { id: "fun-102254", matricula: "102254", nome: "DEUZINETE DE PAIVA E SILVA", cargo: "TECNICO EM SEGURANCA DO TRABALHO", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190044", liderNome: "PAULO CESAR HONORATO DA SILVA VIEIRA", area: "SSTMA", responsavelArea: "PAULO CESAR HONORATO DA SILVA VIEIRA" },
  { id: "fun-102516", matricula: "102516", nome: "THAYNARA VITORIA DA SILVA FERREIRA", cargo: "ASSISTENTE DE MEIO AMBIENTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101616", liderNome: "FABIO CAMPOS PASSOS", area: "SSTMA", responsavelArea: "PAULO CESAR HONORATO DA SILVA VIEIRA" },
  { id: "fun-101924", matricula: "101924", nome: "WILLIAN FRANCISCO MARIANO", cargo: "OPERADOR DE MAQUINAS E EQUIPAMENTOS PESAD", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "171446", liderNome: "JOSINALDO MEDEIROS DE OLIVEIRA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "ROBERTO AUGUSTO ALVES GAUCH" },
  { id: "fun-101973", matricula: "101973", nome: "JULIO CESAR LOPES", cargo: "OPERADOR DE CAMINHAO MUNCK", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101567", liderNome: "CARLOS EDUARDO SILVA DE SANTANA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102397", matricula: "102397", nome: "ROBERTO ANTONIO DE SOUZA MARTINS", cargo: "OPERADOR DE CAMINHAO MUNCK", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101567", liderNome: "CARLOS EDUARDO SILVA DE SANTANA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102434", matricula: "102434", nome: "LEONARDO BATISTA", cargo: "OPERADOR DE CAMINHAO MUNCK", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101567", liderNome: "CARLOS EDUARDO SILVA DE SANTANA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-101904", matricula: "101904", nome: "MARCOS ANTONIO VIEIRA", cargo: "OPERADOR DE CARRETA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "171446", liderNome: "JOSINALDO MEDEIROS DE OLIVEIRA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "ROBERTO AUGUSTO ALVES GAUCH" },
  { id: "fun-101955", matricula: "101955", nome: "DYONATAS DA SILVA FERREIRA", cargo: "OPERADOR DE CARRETA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "170721", liderNome: "CLAYTON DE JESUS APARECIDO", area: "TRNANSPORTE", responsavelArea: "MARCELO AMARAL" },
  { id: "fun-102068", matricula: "102068", nome: "IGOR MASCARENHAS FERREIRA", cargo: "OPERADOR DE CARRETA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "171446", liderNome: "JOSINALDO MEDEIROS DE OLIVEIRA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "ROBERTO AUGUSTO ALVES GAUCH" },
  { id: "fun-102417", matricula: "102417", nome: "ADILSON BARBOZA MARIANO", cargo: "OPERADOR DE CARRETA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "171446", liderNome: "JOSINALDO MEDEIROS DE OLIVEIRA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "ROBERTO AUGUSTO ALVES GAUCH" },
  { id: "fun-101921", matricula: "101921", nome: "FABIO JUNIO LOPES DA SILVA", cargo: "OPERADOR DE CAMINHAO BETONEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101820", liderNome: "RICARDO BISPO DE OLIVEIRA", area: "TRNANSPORTE", responsavelArea: "CLAYTON DE JESUS APARECIDO" },
  { id: "fun-101922", matricula: "101922", nome: "MAURICIO DA SILVA", cargo: "OPERADOR DE CAMINHAO BETONEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101820", liderNome: "RICARDO BISPO DE OLIVEIRA", area: "TRNANSPORTE", responsavelArea: "CLAYTON DE JESUS APARECIDO" },
  { id: "fun-102013", matricula: "102013", nome: "ANDREI DE JESUS DOS SANTOS SILVA", cargo: "OPERADOR DE CAMINHAO BETONEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101820", liderNome: "RICARDO BISPO DE OLIVEIRA", area: "TRNANSPORTE", responsavelArea: "CLAYTON DE JESUS APARECIDO" },
  { id: "fun-102140", matricula: "102140", nome: "ADRIANO CANCIAN DE SOUZA", cargo: "OPERADOR DE CAMINHAO BETONEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101820", liderNome: "RICARDO BISPO DE OLIVEIRA", area: "TRNANSPORTE", responsavelArea: "CLAYTON DE JESUS APARECIDO" },
  { id: "fun-102153", matricula: "102153", nome: "WILSON FLORENTINO RITI", cargo: "OPERADOR DE CAMINHAO BETONEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101820", liderNome: "RICARDO BISPO DE OLIVEIRA", area: "TRNANSPORTE", responsavelArea: "CLAYTON DE JESUS APARECIDO" },
  { id: "fun-102235", matricula: "102235", nome: "LUCAS SANTIAGO BARRETO", cargo: "OPERADOR DE CAMINHAO BETONEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101820", liderNome: "RICARDO BISPO DE OLIVEIRA", area: "TRNANSPORTE", responsavelArea: "CLAYTON DE JESUS APARECIDO" },
  { id: "fun-102258", matricula: "102258", nome: "EDSON BENEVIDES COSTA", cargo: "OPERADOR DE CAMINHAO BETONEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "171446", liderNome: "JOSINALDO MEDEIROS DE OLIVEIRA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "ROBERTO AUGUSTO ALVES GAUCH" },
  { id: "fun-102505", matricula: "102505", nome: "CLODOALDO CESAR GONZAGA", cargo: "OPERADOR DE CAMINHAO BETONEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101820", liderNome: "RICARDO BISPO DE OLIVEIRA", area: "TRNANSPORTE", responsavelArea: "CLAYTON DE JESUS APARECIDO" },
  { id: "fun-101820", matricula: "101820", nome: "RICARDO BISPO DE OLIVEIRA", cargo: "LIDER DE EQUIPE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "170721", liderNome: "CLAYTON DE JESUS APARECIDO", area: "TRNANSPORTE", responsavelArea: "CLAYTON DE JESUS APARECIDO" },
  { id: "fun-101636", matricula: "101636", nome: "DANIEL DE OLIVEIRA PIRES CAMARGO", cargo: "RIGGER", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101567", liderNome: "CARLOS EDUARDO SILVA DE SANTANA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-101878", matricula: "101878", nome: "PABLO ENRIQUE DE SOUZA SILVA", cargo: "RIGGER", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101567", liderNome: "CARLOS EDUARDO SILVA DE SANTANA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102006", matricula: "102006", nome: "FELIPE SANTOS DA SILVA", cargo: "RIGGER", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101567", liderNome: "CARLOS EDUARDO SILVA DE SANTANA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102007", matricula: "102007", nome: "GIOVANNY REZENDE BARBOSA", cargo: "RIGGER", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101567", liderNome: "CARLOS EDUARDO SILVA DE SANTANA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102414", matricula: "102414", nome: "IVANDO FAGUNDES DOS SANTOS", cargo: "RIGGER", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101567", liderNome: "CARLOS EDUARDO SILVA DE SANTANA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102439", matricula: "102439", nome: "MIZAEL DA CONCEICAO DE JESUS", cargo: "RIGGER", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101567", liderNome: "CARLOS EDUARDO SILVA DE SANTANA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102176", matricula: "102176", nome: "EDSON FERREIRA DA COSTA", cargo: "OPERADOR DE PA CARREGADEIRA I", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101820", liderNome: "RICARDO BISPO DE OLIVEIRA", area: "TRNANSPORTE", responsavelArea: "CLAYTON DE JESUS APARECIDO" },
  { id: "fun-102402", matricula: "102402", nome: "RAFAEL FIGUEIREDO MALAQUIAS", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101567", liderNome: "CARLOS EDUARDO SILVA DE SANTANA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102518", matricula: "102518", nome: "ANTONIO PEREIRA SOBRINHO", cargo: "OPERADOR DE ESCAVADEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102251", matricula: "102251", nome: "ROBERT SANTOS DA SILVA", cargo: "NIVELADOR", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "100000", liderNome: "MARCO CAMPELO", area: "TOPOGRAFIA", responsavelArea: "MARCO CAMPELO" },
  { id: "fun-102260", matricula: "102260", nome: "EDUARDO BATISTA BEZERRA", cargo: "AUXILIAR DE TOPOGRAFIA I", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "100000", liderNome: "MARCO CAMPELO", area: "TOPOGRAFIA", responsavelArea: "MARCO CAMPELO" },
  { id: "fun-102314", matricula: "102314", nome: "LUCAS ALVES DA SILVA", cargo: "AUXILIAR DE TOPOGRAFIA I", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "170794", liderNome: "BRUNO MIKAEL FERREIRA MARTINS", area: "TOPOGRAFIA", responsavelArea: "MARCO CAMPELO" },
  { id: "fun-102358", matricula: "102358", nome: "ADRIANO DE OLIVEIRA MELO", cargo: "AUXILIAR DE TOPOGRAFIA I", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "100000", liderNome: "MARCO CAMPELO", area: "TOPOGRAFIA", responsavelArea: "MARCO CAMPELO" },
  { id: "fun-102499", matricula: "102499", nome: "GILSON PEREIRA DA SILVA", cargo: "NIVELADOR", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "100000", liderNome: "MARCO CAMPELO", area: "TOPOGRAFIA", responsavelArea: "MARCO CAMPELO" },
  { id: "fun-102000", matricula: "102000", nome: "JONATHAN SAEGUSA MENDES", cargo: "APONTADOR II", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190106", liderNome: "ALVARO ALVES VILELA", area: "TERRAPLENAGEM", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-101970", matricula: "101970", nome: "PABLO AUGUSTO NASCIMENTO DE JESUS", cargo: "APONTADOR", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101567", liderNome: "CARLOS EDUARDO SILVA DE SANTANA", area: "CIVIL", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-101987", matricula: "101987", nome: "TADEU BELLO PEREIRA", cargo: "APONTADOR", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190116", liderNome: "JOSE AUGUSTO CHAGAS ARAUJO", area: "CIVIL", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102100", matricula: "102100", nome: "PETERSON APARECIDO DE CAMARGO", cargo: "AUXILIAR DE ALMOXARIFADO", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101567", liderNome: "CARLOS EDUARDO SILVA DE SANTANA", area: "ALMOXARIFADO", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102441", matricula: "102441", nome: "VITOR LUIZ MENDES DA SILVA ARAUJO", cargo: "GREIDISTA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102521", matricula: "102521", nome: "MAURICIO DE MACEDO ALVES", cargo: "SINALEIRO", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102513", matricula: "102513", nome: "SAMUEL PEREIRA DOS SANTOS", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102200", liderNome: "RENILSON DOS SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102512", matricula: "102512", nome: "ARENILSON TEIXEIRA DOS SANTOS", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102515", matricula: "102515", nome: "RICARDO DE BARROS", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102514", matricula: "102514", nome: "MANOEL MENDES COUTINHO", cargo: "OPERADOR DE CAMINHAO BASCULANTE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-101656", matricula: "101656", nome: "GUSTAVO VINICIUS DOS SANTOS RAMOS", cargo: "MEIO OFICIAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101561", liderNome: "WANDERSON SILVA ALMEIDA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102370", matricula: "102370", nome: "MAICON JEAN SANTOS SEVERINO", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101561", liderNome: "WANDERSON SILVA ALMEIDA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102101", matricula: "102101", nome: "RODRIGO CALDEIRA FARIAS", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101561", liderNome: "WANDERSON SILVA ALMEIDA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102440", matricula: "102440", nome: "RICARDO DE BARROS JUNIOR", cargo: "SINALEIRO", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101561", liderNome: "WANDERSON SILVA ALMEIDA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102338", matricula: "102338", nome: "MARCOS FERNANDES DAS NEVES BRITO", cargo: "LIDER DE EQUIPE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101561", liderNome: "WANDERSON SILVA ALMEIDA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-101596", matricula: "101596", nome: "DAVID LUCAS MIRANDA CAZE DE LIMA", cargo: "AUXILIAR DE ALMOXARIFADO", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101567", liderNome: "CARLOS EDUARDO SILVA DE SANTANA", area: "ALMOXARIFADO", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-101995", matricula: "101995", nome: "JUAREZ ALVES DOS SANTOS", cargo: "LIDER DE EQUIPE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190106", liderNome: "ALVARO ALVES VILELA", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102066", matricula: "102066", nome: "JOSE VALTER DA CRUZ SILVA", cargo: "LIDER DE EQUIPE", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "190106", liderNome: "ALVARO ALVES VILELA", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102487", matricula: "102487", nome: "ERNANDE DUARTE DA SILVA", cargo: "OPERADOR DE ESCAVADEIRA", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102412", matricula: "102412", nome: "KLEBER DA SILVA FILHO", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101616", liderNome: "FABIO CAMPOS PASSOS", area: "SSTMA", responsavelArea: "PAULO CESAR HONORATO DA SILVA VIEIRA" },
  { id: "fun-102403", matricula: "102403", nome: "LUIS HENRIQUE DA SILVA RODRIGUES", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101616", liderNome: "FABIO CAMPOS PASSOS", area: "SSTMA", responsavelArea: "PAULO CESAR HONORATO DA SILVA VIEIRA" },
  { id: "fun-101637", matricula: "101637", nome: "JOSE NUNES DE SIQUEIRA", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101567", liderNome: "CARLOS EDUARDO SILVA DE SANTANA", area: "MANUTENÇÃO CANTEIRO", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-101999", matricula: "101999", nome: "EDVAN PEREIRA ALVES", cargo: "CARPINTEIRO", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101567", liderNome: "CARLOS EDUARDO SILVA DE SANTANA", area: "CIVIL", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102159", matricula: "102159", nome: "FELIPE MELQUIADES MORAIS", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102252", liderNome: "RAIMUNDO SANTOS RODRIGUES", area: "CIVIL", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102109", matricula: "102109", nome: "JOSE ANTONIO SILVA SANTOS", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101567", liderNome: "CARLOS EDUARDO SILVA DE SANTANA", area: "MANUTENÇÃO CANTEIRO", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102357", matricula: "102357", nome: "FELIPE BATISTA BEZERRA", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "100000", liderNome: "MARCO CAMPELO", area: "TOPOGRAFIA", responsavelArea: "MARCO CAMPELO" },
  { id: "fun-102322", matricula: "102322", nome: "GUILHERME FERNANDES SANTOS SILVA", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102019", liderNome: "ARISNALDO GOULART PEDREIRA SANTOS", area: "TERRAPLENAGEM", responsavelArea: "ALVARO ALVES VILELA" },
  { id: "fun-102411", matricula: "102411", nome: "PEDRO ANTONIO CARVALHO DOS SANTOS", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "102063", liderNome: "SERGIO CONCEICAO DA SILVA", area: "CIVIL", responsavelArea: "JOSE AUGUSTO CHAGAS ARAUJO" },
  { id: "fun-102318", matricula: "102318", nome: "DIEGO TEIXEIRA DOS SANTOS", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "100000", liderNome: "MARCO CAMPELO", area: "TOPOGRAFIA", responsavelArea: "MARCO CAMPELO" },
  { id: "fun-101666", matricula: "101666", nome: "WILSON FERREIRA DA SILVA", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101567", liderNome: "CARLOS EDUARDO SILVA DE SANTANA", area: "MANUTENÇÃO CANTEIRO", responsavelArea: "CONSTANTINO DEMETRIO FILHO" },
  { id: "fun-102405", matricula: "102405", nome: "JOSE DOS REIS SANTOS", cargo: "AUXILIAR GERAL", telefone: '', empresaId: 'emp-1', ativo: true, liderMatricula: "101567", liderNome: "CARLOS EDUARDO SILVA DE SANTANA", area: "MOVIMENTAÇÃO DE CARGA", responsavelArea: "CONSTANTINO DEMETRIO FILHO" }
];

const BASE_INITIAL_COMBOIOS: Comboio[] = [
  { id: 'com-1', nome: 'Comboio TQC022', placa: 'BRA-2200', capacidadeLitros: 10000, responsavel: 'Espedito Bento da Silva' },
  { id: 'com-2', nome: 'Comboio 01 - Renea', placa: 'BRA-9A12', capacidadeLitros: 4000, responsavel: 'José da Silva' },
  { id: 'com-3', nome: 'Comboio 02 - Renea', placa: 'REO-4B90', capacidadeLitros: 6000, responsavel: 'Marcos de Souza' }
];

export let INITIAL_COMBOIOS: Comboio[] = BASE_INITIAL_COMBOIOS;

export const INITIAL_TIPOS_COMBUSTIVEL: TipoCombustivel[] = [
  { id: 'tc-1', nome: 'Óleo Diesel S 10 Comum' },
  { id: 'tc-2', nome: 'Óleo Diesel S 500' },
  { id: 'tc-3', nome: 'Gasolina Comum' },
  { id: 'tc-4', nome: 'Arla 32' },
  { id: 'tc-5', nome: 'Óleo Lubrificante 15W40' }
];

export const INITIAL_PRODUTOS_LUBRIFICACAO: ProdutoLubrificacao[] = [
  { id: 'pl-1', nome: 'Graxa de Lítio NLGI 2' },
  { id: 'pl-2', nome: 'Óleo Hidráulico 68T' },
  { id: 'pl-3', nome: 'Óleo Motor 15W40' },
  { id: 'pl-4', nome: 'Óleo de Transmissão SAE 90W' }
];

export const INITIAL_ETAPAS_SERVICO: EtapaServico[] = [
  { id: 'et-1', nome: 'Terraplenagem / Escavação' },
  { id: 'et-2', nome: 'Drenagem Pluvial profunda' },
  { id: 'et-3', nome: 'Sub-base e Base de bica corrida' },
  { id: 'et-4', nome: 'Pavimentação Asfáltica (CBUQ)' },
  { id: 'et-5', nome: 'Sinalização e Obras de Arte Correntes' }
];

const BASE_INITIAL_ABASTECIMENTOS: Abastecimento[] = [
  { id: 'ab-1', data: '2026-06-21', hora: '07:00', equipamentoId: 'eq-cb765', horimetroInicial: 705, kmInicial: 174980, bombaInicial: 87331, quantidadeLitros: 200, bombaFinal: 87531, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-2', data: '2026-06-21', hora: '07:20', equipamentoId: 'eq-cb754', horimetroInicial: 14811, kmInicial: 737545, bombaInicial: 87531, quantidadeLitros: 98, bombaFinal: 87629, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-3', data: '2026-06-21', hora: '07:30', equipamentoId: 'eq-cb789', horimetroInicial: 12824, kmInicial: 165714, bombaInicial: 87629, quantidadeLitros: 70, bombaFinal: 87699, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-4', data: '2026-06-21', hora: '07:40', equipamentoId: 'eq-cb775', horimetroInicial: 12443, kmInicial: 180568, bombaInicial: 87699, quantidadeLitros: 170, bombaFinal: 87869, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-5', data: '2026-06-21', hora: '07:50', equipamentoId: 'eq-cb786', horimetroInicial: 13559, kmInicial: 195678, bombaInicial: 87869, quantidadeLitros: 43, bombaFinal: 87912, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-6', data: '2026-06-21', hora: '08:00', equipamentoId: 'eq-cb755', horimetroInicial: 10296, kmInicial: 160626, bombaInicial: 87912, quantidadeLitros: 70, bombaFinal: 87982, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-7', data: '2026-06-21', hora: '08:20', equipamentoId: 'eq-cb770', horimetroInicial: 1431, kmInicial: 22033, bombaInicial: 87982, quantidadeLitros: 40, bombaFinal: 88022, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-8', data: '2026-06-21', hora: '08:30', equipamentoId: 'eq-cb730', horimetroInicial: 915, kmInicial: 224841, bombaInicial: 88022, quantidadeLitros: 75, bombaFinal: 88097, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-9', data: '2026-06-21', hora: '08:40', equipamentoId: 'eq-cb804', horimetroInicial: 913, kmInicial: 133860, bombaInicial: 88097, quantidadeLitros: 123, bombaFinal: 88220, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-10', data: '2026-06-21', hora: '08:50', equipamentoId: 'eq-cb776', horimetroInicial: 4844, kmInicial: 265192, bombaInicial: 88220, quantidadeLitros: 50, bombaFinal: 88270, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-11', data: '2026-06-21', hora: '09:00', equipamentoId: 'eq-cb794', horimetroInicial: 1806, kmInicial: 223359, bombaInicial: 88270, quantidadeLitros: 93, bombaFinal: 88363, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-12', data: '2026-06-21', hora: '09:20', equipamentoId: 'eq-cb767', horimetroInicial: 10047, kmInicial: 183636, bombaInicial: 88363, quantidadeLitros: 75, bombaFinal: 88438, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-13', data: '2026-06-21', hora: '09:40', equipamentoId: 'eq-cb735', horimetroInicial: 1613, kmInicial: 201470, bombaInicial: 88438, quantidadeLitros: 82, bombaFinal: 88520, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-14', data: '2026-06-21', hora: '10:00', equipamentoId: 'eq-cb790', horimetroInicial: 11672, kmInicial: 226948, bombaInicial: 88520, quantidadeLitros: 39, bombaFinal: 88559, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-15', data: '2026-06-22', hora: '06:00', equipamentoId: 'eq-cb748', horimetroInicial: 9650, kmInicial: 130905, bombaInicial: 88559, quantidadeLitros: 81, bombaFinal: 88640, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-16', data: '2026-06-22', hora: '06:10', equipamentoId: 'eq-lo145', horimetroInicial: 1073, kmInicial: 27284, bombaInicial: 88640, quantidadeLitros: 92, bombaFinal: 88732, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-17', data: '2026-06-22', hora: '06:20', equipamentoId: 'eq-ec079', horimetroInicial: 1957, kmInicial: 0, bombaInicial: 88732, quantidadeLitros: 84, bombaFinal: 88816, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-18', data: '2026-06-22', hora: '06:25', equipamentoId: 'eq-lo279', horimetroInicial: 1789, kmInicial: 0, bombaInicial: 88816, quantidadeLitros: 18, bombaFinal: 88834, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-19', data: '2026-06-22', hora: '06:30', equipamentoId: 'eq-ec063', horimetroInicial: 10873, kmInicial: 0, bombaInicial: 88834, quantidadeLitros: 89, bombaFinal: 88923, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-20', data: '2026-06-22', hora: '06:35', equipamentoId: 'eq-te007', horimetroInicial: 1853, kmInicial: 0, bombaInicial: 88923, quantidadeLitros: 90, bombaFinal: 89013, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-21', data: '2026-06-22', hora: '06:40', equipamentoId: 'eq-te038', horimetroInicial: 9302, kmInicial: 0, bombaInicial: 89013, quantidadeLitros: 93, bombaFinal: 89106, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-22', data: '2026-06-22', hora: '06:45', equipamentoId: 'eq-lo318', horimetroInicial: 1004, kmInicial: 0, bombaInicial: 89106, quantidadeLitros: 113, bombaFinal: 89219, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-23', data: '2026-06-22', hora: '06:50', equipamentoId: 'eq-ec012', horimetroInicial: 10971, kmInicial: 0, bombaInicial: 89219, quantidadeLitros: 123, bombaFinal: 89342, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-24', data: '2026-06-22', hora: '06:55', equipamentoId: 'eq-te030', horimetroInicial: 428, kmInicial: 0, bombaInicial: 89342, quantidadeLitros: 106, bombaFinal: 89448, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-25', data: '2026-06-22', hora: '07:05', equipamentoId: 'eq-lo237', horimetroInicial: 13026, kmInicial: 0, bombaInicial: 89448, quantidadeLitros: 72, bombaFinal: 89520, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-26', data: '2026-06-22', hora: '07:15', equipamentoId: 'eq-lo231', horimetroInicial: 719, kmInicial: 0, bombaInicial: 89520, quantidadeLitros: 47, bombaFinal: 89567, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-27', data: '2026-06-22', hora: '07:20', equipamentoId: 'eq-lo248', horimetroInicial: 6385, kmInicial: 0, bombaInicial: 89567, quantidadeLitros: 100, bombaFinal: 89667, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-28', data: '2026-06-22', hora: '07:30', equipamentoId: 'eq-lo354', horimetroInicial: 11943, kmInicial: 0, bombaInicial: 89667, quantidadeLitros: 156, bombaFinal: 89823, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-29', data: '2026-06-22', hora: '07:50', equipamentoId: 'eq-lo355', horimetroInicial: 1292, kmInicial: 0, bombaInicial: 89823, quantidadeLitros: 226, bombaFinal: 90049, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-30', data: '2026-06-22', hora: '08:00', equipamentoId: 'eq-lo260', horimetroInicial: 10700, kmInicial: 0, bombaInicial: 90049, quantidadeLitros: 112, bombaFinal: 90161, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-31', data: '2026-06-22', hora: '08:10', equipamentoId: 'eq-lo250', horimetroInicial: 3011, kmInicial: 0, bombaInicial: 90161, quantidadeLitros: 41, bombaFinal: 90202, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-32', data: '2026-06-22', hora: '08:15', equipamentoId: 'eq-lo169', horimetroInicial: 2565, kmInicial: 0, bombaInicial: 90202, quantidadeLitros: 39, bombaFinal: 90241, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-33', data: '2026-06-22', hora: '08:40', equipamentoId: 'eq-gp008', horimetroInicial: 1697, kmInicial: 1571, bombaInicial: 90241, quantidadeLitros: 116, bombaFinal: 90357, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-34', data: '2026-06-22', hora: '09:30', equipamentoId: 'eq-lo360', horimetroInicial: 2244, kmInicial: 0, bombaInicial: 90357, quantidadeLitros: 16, bombaFinal: 90373, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-35', data: '2026-06-22', hora: '09:35', equipamentoId: 'eq-lo241', horimetroInicial: 25636, kmInicial: 0, bombaInicial: 90373, quantidadeLitros: 86, bombaFinal: 90459, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-36', data: '2026-06-22', hora: '09:45', equipamentoId: 'eq-lo264', horimetroInicial: 8334, kmInicial: 0, bombaInicial: 90459, quantidadeLitros: 51, bombaFinal: 90510, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-37', data: '2026-06-22', hora: '09:50', equipamentoId: 'eq-lo352', horimetroInicial: 889, kmInicial: 0, bombaInicial: 90510, quantidadeLitros: 43, bombaFinal: 90553, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-38', data: '2026-06-22', hora: '09:55', equipamentoId: 'eq-lo334', horimetroInicial: 210, kmInicial: 0, bombaInicial: 90553, quantidadeLitros: 18, bombaFinal: 90571, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-39', data: '2026-06-22', hora: '10:15', equipamentoId: 'eq-te037', horimetroInicial: 11005, kmInicial: 0, bombaInicial: 90571, quantidadeLitros: 143, bombaFinal: 90714, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-40', data: '2026-06-22', hora: '13:40', equipamentoId: 'eq-cb782', horimetroInicial: 8484, kmInicial: 0, bombaInicial: 90714, quantidadeLitros: 234, bombaFinal: 90948, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-41', data: '2026-06-22', hora: '14:00', equipamentoId: 'eq-lo321', horimetroInicial: 1046, kmInicial: 0, bombaInicial: 90948, quantidadeLitros: 31, bombaFinal: 90979, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-42', data: '2026-06-22', hora: '14:10', equipamentoId: 'eq-lo247', horimetroInicial: 2714, kmInicial: 0, bombaInicial: 90979, quantidadeLitros: 39, bombaFinal: 91018, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-43', data: '2026-06-22', hora: '14:15', equipamentoId: 'eq-lo162', horimetroInicial: 1114, kmInicial: 0, bombaInicial: 91018, quantidadeLitros: 31, bombaFinal: 91049, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-44', data: '2026-06-22', hora: '14:20', equipamentoId: 'eq-lo165', horimetroInicial: 849, kmInicial: 0, bombaInicial: 91049, quantidadeLitros: 73, bombaFinal: 91122, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-45', data: '2026-06-22', hora: '14:30', equipamentoId: 'eq-lo156', horimetroInicial: 1683, kmInicial: 0, bombaInicial: 91122, quantidadeLitros: 41, bombaFinal: 91163, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-46', data: '2026-06-22', hora: '14:35', equipamentoId: 'eq-lo155', horimetroInicial: 1841, kmInicial: 0, bombaInicial: 91163, quantidadeLitros: 38, bombaFinal: 91201, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-47', data: '2026-06-22', hora: '14:50', equipamentoId: 'eq-lo232', horimetroInicial: 2135, kmInicial: 0, bombaInicial: 91201, quantidadeLitros: 51, bombaFinal: 91252, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-48', data: '2026-06-23', hora: '06:05', equipamentoId: 'eq-ec010', horimetroInicial: 1902, kmInicial: 0, bombaInicial: 91252, quantidadeLitros: 279, bombaFinal: 91531, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-49', data: '2026-06-23', hora: '06:15', equipamentoId: 'eq-lo260', horimetroInicial: 0, kmInicial: 0, bombaInicial: 91531, quantidadeLitros: 128, bombaFinal: 91659, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-50', data: '2026-06-23', hora: '06:25', equipamentoId: 'eq-lo278', horimetroInicial: 402, kmInicial: 0, bombaInicial: 91659, quantidadeLitros: 44, bombaFinal: 91703, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-51', data: '2026-06-23', hora: '06:35', equipamentoId: 'eq-ec079', horimetroInicial: 1962, kmInicial: 0, bombaInicial: 91703, quantidadeLitros: 75, bombaFinal: 91778, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-52', data: '2026-06-23', hora: '06:40', equipamentoId: 'eq-te030', horimetroInicial: 431, kmInicial: 0, bombaInicial: 91778, quantidadeLitros: 52, bombaFinal: 91830, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-53', data: '2026-06-23', hora: '07:00', equipamentoId: 'eq-lo337', horimetroInicial: 868, kmInicial: 0, bombaInicial: 91830, quantidadeLitros: 39, bombaFinal: 91869, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-54', data: '2026-06-23', hora: '07:10', equipamentoId: 'eq-lo325', horimetroInicial: 737, kmInicial: 0, bombaInicial: 91869, quantidadeLitros: 51, bombaFinal: 91920, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-55', data: '2026-06-23', hora: '07:20', equipamentoId: 'eq-lo357', horimetroInicial: 271, kmInicial: 0, bombaInicial: 91920, quantidadeLitros: 30, bombaFinal: 91950, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-56', data: '2026-06-23', hora: '07:25', equipamentoId: 'eq-lo355', horimetroInicial: 1315, kmInicial: 0, bombaInicial: 91950, quantidadeLitros: 120, bombaFinal: 92070, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-57', data: '2026-06-23', hora: '07:30', equipamentoId: 'eq-lo358', horimetroInicial: 2031, kmInicial: 0, bombaInicial: 92070, quantidadeLitros: 33, bombaFinal: 92103, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-58', data: '2026-06-23', hora: '07:40', equipamentoId: 'eq-ec077', horimetroInicial: 1423, kmInicial: 0, bombaInicial: 92103, quantidadeLitros: 205, bombaFinal: 92308, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-59', data: '2026-06-23', hora: '08:00', equipamentoId: 'eq-lo293', horimetroInicial: 7721, kmInicial: 3529, bombaInicial: 92308, quantidadeLitros: 144, bombaFinal: 92452, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-60', data: '2026-06-23', hora: '08:20', equipamentoId: 'eq-lo169', horimetroInicial: 2578, kmInicial: 0, bombaInicial: 92452, quantidadeLitros: 35, bombaFinal: 92487, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-61', data: '2026-06-23', hora: '09:00', equipamentoId: 'eq-lo326', horimetroInicial: 19390, kmInicial: 216725, bombaInicial: 92487, quantidadeLitros: 167, bombaFinal: 92654, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-62', data: '2026-06-23', hora: '11:45', equipamentoId: 'eq-lo241', horimetroInicial: 25644, kmInicial: 0, bombaInicial: 92654, quantidadeLitros: 127, bombaFinal: 92781, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-63', data: '2026-06-23', hora: '11:50', equipamentoId: 'eq-lo264', horimetroInicial: 8342, kmInicial: 0, bombaInicial: 92781, quantidadeLitros: 147, bombaFinal: 92928, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-64', data: '2026-06-23', hora: '11:55', equipamentoId: 'eq-lo352', horimetroInicial: 897, kmInicial: 0, bombaInicial: 92928, quantidadeLitros: 129, bombaFinal: 93057, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-65', data: '2026-06-23', hora: '12:05', equipamentoId: 'eq-ec081', horimetroInicial: 2301, kmInicial: 0, bombaInicial: 93057, quantidadeLitros: 159, bombaFinal: 93216, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-66', data: '2026-06-23', hora: '12:10', equipamentoId: 'eq-rt030', horimetroInicial: 2884, kmInicial: 0, bombaInicial: 93216, quantidadeLitros: 102, bombaFinal: 93318, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-67', data: '2026-06-23', hora: '12:25', equipamentoId: 'eq-lo338', horimetroInicial: 0, kmInicial: 0, bombaInicial: 93318, quantidadeLitros: 154, bombaFinal: 93472, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-68', data: '2026-06-23', hora: '12:30', equipamentoId: 'eq-lo256', horimetroInicial: 269, kmInicial: 0, bombaInicial: 93472, quantidadeLitros: 83, bombaFinal: 93555, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-69', data: '2026-06-23', hora: '12:35', equipamentoId: 'eq-rt018', horimetroInicial: 920, kmInicial: 0, bombaInicial: 93555, quantidadeLitros: 55, bombaFinal: 93610, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-70', data: '2026-06-23', hora: '12:40', equipamentoId: 'eq-lo244', horimetroInicial: 528, kmInicial: 0, bombaInicial: 93610, quantidadeLitros: 192, bombaFinal: 93802, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-71', data: '2026-06-23', hora: '12:45', equipamentoId: 'eq-lo258', horimetroInicial: 226, kmInicial: 0, bombaInicial: 93802, quantidadeLitros: 112, bombaFinal: 93914, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-72', data: '2026-06-23', hora: '12:50', equipamentoId: 'eq-lo334', horimetroInicial: 10882, kmInicial: 0, bombaInicial: 93914, quantidadeLitros: 28, bombaFinal: 93942, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'ab-73', data: '2026-06-23', hora: '12:55', equipamentoId: 'eq-ec063', horimetroInicial: 0, kmInicial: 0, bombaInicial: 93942, quantidadeLitros: 181, bombaFinal: 94123, tipoCombustivelId: 'tc-1', comboioId: 'com-1', responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
];

export let INITIAL_ABASTECIMENTOS: Abastecimento[] = BASE_INITIAL_ABASTECIMENTOS;

export let INITIAL_TICKETS_JAZIDA: TicketJazida[] = [];

export const INITIAL_LUBRIFICACOES: Lubrificacao[] = [
  { id: 'lub-1', data: '2026-06-22', hora: '06:20', equipamentoId: 'eq-ec079', horimetro: 1954, produtoLubrificacaoId: 'pl-1', compartimento: 'Pinos e Articulações', quantidade: 1, responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'lub-2', data: '2026-06-22', hora: '06:25', equipamentoId: 'eq-lo279', horimetro: 1789, produtoLubrificacaoId: 'pl-1', compartimento: 'Pinos e Articulações', quantidade: 1, responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'lub-3', data: '2026-06-22', hora: '06:35', equipamentoId: 'eq-te007', horimetro: 1853, produtoLubrificacaoId: 'pl-2', compartimento: 'Sistema Hidráulico', quantidade: 15, responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'lub-4', data: '2026-06-22', hora: '06:40', equipamentoId: 'eq-te038', horimetro: 9302, produtoLubrificacaoId: 'pl-3', compartimento: 'Cárter do Motor', quantidade: 4, responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'lub-5', data: '2026-06-22', hora: '06:45', equipamentoId: 'eq-lo318', horimetro: 1004, produtoLubrificacaoId: 'pl-1', compartimento: 'Pinos e Articulações', quantidade: 1, responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'lub-6', data: '2026-06-22', hora: '06:55', equipamentoId: 'eq-ec012', horimetro: 10971, produtoLubrificacaoId: 'pl-1', compartimento: 'Pinos e Articulações', quantidade: 1, responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'lub-7', data: '2026-06-22', hora: '07:35', equipamentoId: 'eq-rc041', horimetro: 4521, produtoLubrificacaoId: 'pl-3', compartimento: 'Cárter do Motor', quantidade: 3, responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'lub-8', data: '2026-06-22', hora: '10:15', equipamentoId: 'eq-cb782', horimetro: 8484, produtoLubrificacaoId: 'pl-3', compartimento: 'Cárter do Motor', quantidade: 5, responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'lub-9', data: '2026-06-23', hora: '06:05', equipamentoId: 'eq-ec010', horimetro: 1902, produtoLubrificacaoId: 'pl-2', compartimento: 'Sistema Hidráulico', quantidade: 28, responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'lub-10', data: '2026-06-23', hora: '07:40', equipamentoId: 'eq-ec077', horimetro: 1423, produtoLubrificacaoId: 'pl-1', compartimento: 'Pinos e Articulações', quantidade: 1, responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
  { id: 'lub-11', data: '2026-06-23', hora: '12:55', equipamentoId: 'eq-ec063', horimetro: 10882, produtoLubrificacaoId: 'pl-1', compartimento: 'Pinos e Articulações', quantidade: 1, responsavel: 'Espedito Bento da Silva', observacao: 'Conferência OK' },
];

export const INITIAL_HISTORY_LOGS: HistoryLog[] = [];

export const INITIAL_PRESENCAS: ListaPresenca[] = [
  {
    id: 'pre-1',
    data: '2026-06-30',
    obraId: 'obr-1',
    responsavel: "RENILSON DOS SANTOS",
    funcionarios: [
      { funcionarioId: "fun-102240", presente: true },
      { funcionarioId: "fun-102163", presente: true },
      { funcionarioId: "fun-101997", presente: false, observacao: 'Falta justificada' },
      { funcionarioId: "fun-102449", presente: true }
    ],
    observacoes: 'Lista inicial atualizada com colaboradores da planilha informada.'
  }
];

const INITIAL_GRUPOS_EQUIPES_LEGACY: GrupoEquipe[] = [
  {
    id: "grp-renilson-dos-santos-terraplenagem-1",
    nome: "TERRAPLENAGEM - RENILSON DOS SANTOS",
    responsavel: "RENILSON DOS SANTOS",
    frenteServico: "TERRAPLENAGEM",
    obraId: 'obr-1',
    funcionarioIds: ["fun-102240", "fun-101997", "fun-101671", "fun-102067", "fun-101989", "fun-102146", "fun-102084", "fun-102112", "fun-101635", "fun-101234", "fun-102148", "fun-102143", "fun-101676", "fun-102139", "fun-102018", "fun-102476", "fun-102065", "fun-100787", "fun-102232", "fun-102166", "fun-102064", "fun-102138", "fun-102111", "fun-102147", "fun-102105", "fun-102103", "fun-102507", "fun-102508", "fun-102518", "fun-102521", "fun-102513"],
    status: 'ativo',
    token: "renea-renilson-dos-santos-terraplenagem-1",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-roberson-da-silva-rodrigues-civil-2",
    nome: "CIVIL - ROBERSON DA SILVA RODRIGUES",
    responsavel: "ROBERSON DA SILVA RODRIGUES",
    frenteServico: "CIVIL",
    obraId: 'obr-1',
    funcionarioIds: ["fun-102163", "fun-102406", "fun-102364", "fun-102365", "fun-102363", "fun-102410", "fun-102229"],
    status: 'ativo',
    token: "renea-roberson-da-silva-rodrigues-civil-2",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-arisnaldo-goulart-pedreira-santos-terraplenagem-3",
    nome: "TERRAPLENAGEM - ARISNALDO GOULART PEDREIRA SANTOS",
    responsavel: "ARISNALDO GOULART PEDREIRA SANTOS",
    frenteServico: "TERRAPLENAGEM",
    obraId: 'obr-1',
    funcionarioIds: ["fun-102449", "fun-102317", "fun-102012", "fun-101788", "fun-102022", "fun-101564", "fun-101990", "fun-101617", "fun-102023", "fun-102315", "fun-101565", "fun-102261", "fun-102016", "fun-102250", "fun-102466", "fun-102451", "fun-102241", "fun-101985", "fun-101979", "fun-102441", "fun-102512", "fun-102515", "fun-102514", "fun-102487", "fun-102322"],
    status: 'ativo',
    token: "renea-arisnaldo-goulart-pedreira-santos-terraplenagem-3",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-sergio-conceicao-da-silva-civil-4",
    nome: "CIVIL - SERGIO CONCEICAO DA SILVA",
    responsavel: "SERGIO CONCEICAO DA SILVA",
    frenteServico: "CIVIL",
    obraId: 'obr-1',
    funcionarioIds: ["fun-102435", "fun-102017", "fun-102411"],
    status: 'ativo',
    token: "renea-sergio-conceicao-da-silva-civil-4",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-thiago-abreu-de-oliveira-civil-5",
    nome: "CIVIL - THIAGO ABREU DE OLIVEIRA",
    responsavel: "THIAGO ABREU DE OLIVEIRA",
    frenteServico: "CIVIL",
    obraId: 'obr-1',
    funcionarioIds: ["fun-102398", "fun-101615", "fun-102252", "fun-101699", "fun-102063"],
    status: 'ativo',
    token: "renea-thiago-abreu-de-oliveira-civil-5",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-carlos-eduardo-silva-de-santana-movimentacao-de-carga-6",
    nome: "MOVIMENTAÇÃO DE CARGA - CARLOS EDUARDO SILVA DE SANTANA",
    responsavel: "CARLOS EDUARDO SILVA DE SANTANA",
    frenteServico: "MOVIMENTAÇÃO DE CARGA",
    obraId: 'obr-1',
    funcionarioIds: ["fun-102165", "fun-101973", "fun-102397", "fun-102434", "fun-101636", "fun-101878", "fun-102006", "fun-102007", "fun-102414", "fun-102439", "fun-102402", "fun-102405"],
    status: 'ativo',
    token: "renea-carlos-eduardo-silva-de-santana-movimentacao-de-carga-6",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-alvaro-alves-vilela-manutencao-canteiro-7",
    nome: "MANUTENÇÃO CANTEIRO - ALVARO ALVES VILELA",
    responsavel: "ALVARO ALVES VILELA",
    frenteServico: "MANUTENÇÃO CANTEIRO",
    obraId: 'obr-1',
    funcionarioIds: ["fun-101998"],
    status: 'ativo',
    token: "renea-alvaro-alves-vilela-manutencao-canteiro-7",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-wanderson-silva-almeida-civil-8",
    nome: "CIVIL - WANDERSON SILVA ALMEIDA",
    responsavel: "WANDERSON SILVA ALMEIDA",
    frenteServico: "CIVIL",
    obraId: 'obr-1',
    funcionarioIds: ["fun-101633", "fun-102359", "fun-101561", "fun-101656", "fun-102370", "fun-102101", "fun-102440", "fun-102338"],
    status: 'ativo',
    token: "renea-wanderson-silva-almeida-civil-8",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-claelton-nunes-de-sousa-civil-9",
    nome: "CIVIL - CLAELTON NUNES DE SOUSA",
    responsavel: "CLAELTON NUNES DE SOUSA",
    frenteServico: "CIVIL",
    obraId: 'obr-1',
    funcionarioIds: ["fun-102407", "fun-102144", "fun-102438"],
    status: 'ativo',
    token: "renea-claelton-nunes-de-sousa-civil-9",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-alvaro-alves-vilela-almoxarifado-10",
    nome: "ALMOXARIFADO - ALVARO ALVES VILELA",
    responsavel: "ALVARO ALVES VILELA",
    frenteServico: "ALMOXARIFADO",
    obraId: 'obr-1',
    funcionarioIds: ["fun-102156"],
    status: 'ativo',
    token: "renea-alvaro-alves-vilela-almoxarifado-10",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-alvaro-alves-vilela-controle-11",
    nome: "CONTROLE - ALVARO ALVES VILELA",
    responsavel: "ALVARO ALVES VILELA",
    frenteServico: "CONTROLE",
    obraId: 'obr-1',
    funcionarioIds: ["fun-102355", "fun-102504"],
    status: 'ativo',
    token: "renea-alvaro-alves-vilela-controle-11",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-alvaro-alves-vilela-terraplenagem-12",
    nome: "TERRAPLENAGEM - ALVARO ALVES VILELA",
    responsavel: "ALVARO ALVES VILELA",
    frenteServico: "TERRAPLENAGEM",
    obraId: 'obr-1',
    funcionarioIds: ["fun-102200", "fun-102517", "fun-102000"],
    status: 'ativo',
    token: "renea-alvaro-alves-vilela-terraplenagem-12",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-isaias-rodrigues-pereira-civil-13",
    nome: "CIVIL - ISAIAS RODRIGUES PEREIRA",
    responsavel: "ISAIAS RODRIGUES PEREIRA",
    frenteServico: "CIVIL",
    obraId: 'obr-1',
    funcionarioIds: ["fun-102319", "fun-101785"],
    status: 'ativo',
    token: "renea-isaias-rodrigues-pereira-civil-13",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-raimundo-santos-rodrigues-civil-14",
    nome: "CIVIL - RAIMUNDO SANTOS RODRIGUES",
    responsavel: "RAIMUNDO SANTOS RODRIGUES",
    frenteServico: "CIVIL",
    obraId: 'obr-1',
    funcionarioIds: ["fun-102468", "fun-102472", "fun-102160", "fun-102498", "fun-101880", "fun-102401", "fun-101809", "fun-102470", "fun-102488"],
    status: 'ativo',
    token: "renea-raimundo-santos-rodrigues-civil-14",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-bruno-mikael-ferreira-martins-topografia-15",
    nome: "TOPOGRAFIA - BRUNO MIKAEL FERREIRA MARTINS",
    responsavel: "BRUNO MIKAEL FERREIRA MARTINS",
    frenteServico: "TOPOGRAFIA",
    obraId: 'obr-1',
    funcionarioIds: ["fun-170909", "fun-102354", "fun-102314"],
    status: 'ativo',
    token: "renea-bruno-mikael-ferreira-martins-topografia-15",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-renato-jose-da-silva-sinalizacao-16",
    nome: "SINALIZAÇÃO - RENATO JOSE DA SILVA",
    responsavel: "RENATO JOSE DA SILVA",
    frenteServico: "SINALIZAÇÃO",
    obraId: 'obr-1',
    funcionarioIds: ["fun-101953", "fun-102164", "fun-101864", "fun-101862"],
    status: 'ativo',
    token: "renea-renato-jose-da-silva-sinalizacao-16",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-josinaldo-medeiros-de-oliveira-movimentacao-de-carga-17",
    nome: "MOVIMENTAÇÃO DE CARGA - JOSINALDO MEDEIROS DE OLIVEIRA",
    responsavel: "JOSINALDO MEDEIROS DE OLIVEIRA",
    frenteServico: "MOVIMENTAÇÃO DE CARGA",
    obraId: 'obr-1',
    funcionarioIds: ["fun-101762", "fun-102369", "fun-102399", "fun-102437", "fun-101924", "fun-101904", "fun-102068", "fun-102417", "fun-102258"],
    status: 'ativo',
    token: "renea-josinaldo-medeiros-de-oliveira-movimentacao-de-carga-17",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-cesarnildo-de-mesquita-cristalino-eletrica-18",
    nome: "ELÉTRICA - CESARNILDO DE MESQUITA CRISTALINO",
    responsavel: "CESARNILDO DE MESQUITA CRISTALINO",
    frenteServico: "ELÉTRICA",
    obraId: 'obr-1',
    funcionarioIds: ["fun-102158"],
    status: 'ativo',
    token: "renea-cesarnildo-de-mesquita-cristalino-eletrica-18",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-alvaro-alves-vilela-eletrica-19",
    nome: "ELÉTRICA - ALVARO ALVES VILELA",
    responsavel: "ALVARO ALVES VILELA",
    frenteServico: "ELÉTRICA",
    obraId: 'obr-1',
    funcionarioIds: ["fun-102400"],
    status: 'ativo',
    token: "renea-alvaro-alves-vilela-eletrica-19",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-paulo-cesar-honorato-da-silva-vieira-sstma-20",
    nome: "SSTMA - PAULO CESAR HONORATO DA SILVA VIEIRA",
    responsavel: "PAULO CESAR HONORATO DA SILVA VIEIRA",
    frenteServico: "SSTMA",
    obraId: 'obr-1',
    funcionarioIds: ["fun-101480", "fun-101616", "fun-102061", "fun-102254"],
    status: 'ativo',
    token: "renea-paulo-cesar-honorato-da-silva-vieira-sstma-20",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-fabio-campos-passos-sstma-21",
    nome: "SSTMA - FABIO CAMPOS PASSOS",
    responsavel: "FABIO CAMPOS PASSOS",
    frenteServico: "SSTMA",
    obraId: 'obr-1',
    funcionarioIds: ["fun-102516", "fun-102412", "fun-102403"],
    status: 'ativo',
    token: "renea-fabio-campos-passos-sstma-21",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-clayton-de-jesus-aparecido-trnansporte-22",
    nome: "TRNANSPORTE - CLAYTON DE JESUS APARECIDO",
    responsavel: "CLAYTON DE JESUS APARECIDO",
    frenteServico: "TRNANSPORTE",
    obraId: 'obr-1',
    funcionarioIds: ["fun-101955"],
    status: 'ativo',
    token: "renea-clayton-de-jesus-aparecido-trnansporte-22",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-ricardo-bispo-de-oliveira-trnansporte-23",
    nome: "TRNANSPORTE - RICARDO BISPO DE OLIVEIRA",
    responsavel: "RICARDO BISPO DE OLIVEIRA",
    frenteServico: "TRNANSPORTE",
    obraId: 'obr-1',
    funcionarioIds: ["fun-101921", "fun-101922", "fun-102013", "fun-102140", "fun-102153", "fun-102235", "fun-102505", "fun-102176"],
    status: 'ativo',
    token: "renea-ricardo-bispo-de-oliveira-trnansporte-23",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-clayton-de-jesus-aparecido-trnansporte-24",
    nome: "TRNANSPORTE - CLAYTON DE JESUS APARECIDO",
    responsavel: "CLAYTON DE JESUS APARECIDO",
    frenteServico: "TRNANSPORTE",
    obraId: 'obr-1',
    funcionarioIds: ["fun-101820"],
    status: 'ativo',
    token: "renea-clayton-de-jesus-aparecido-trnansporte-24",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-marco-campelo-topografia-25",
    nome: "TOPOGRAFIA - MARCO CAMPELO",
    responsavel: "MARCO CAMPELO",
    frenteServico: "TOPOGRAFIA",
    obraId: 'obr-1',
    funcionarioIds: ["fun-102251", "fun-102260", "fun-102358", "fun-102499", "fun-102357", "fun-102318"],
    status: 'ativo',
    token: "renea-marco-campelo-topografia-25",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-carlos-eduardo-silva-de-santana-civil-26",
    nome: "CIVIL - CARLOS EDUARDO SILVA DE SANTANA",
    responsavel: "CARLOS EDUARDO SILVA DE SANTANA",
    frenteServico: "CIVIL",
    obraId: 'obr-1',
    funcionarioIds: ["fun-101970", "fun-101999"],
    status: 'ativo',
    token: "renea-carlos-eduardo-silva-de-santana-civil-26",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-jose-augusto-chagas-araujo-civil-27",
    nome: "CIVIL - JOSE AUGUSTO CHAGAS ARAUJO",
    responsavel: "JOSE AUGUSTO CHAGAS ARAUJO",
    frenteServico: "CIVIL",
    obraId: 'obr-1',
    funcionarioIds: ["fun-101987"],
    status: 'ativo',
    token: "renea-jose-augusto-chagas-araujo-civil-27",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-carlos-eduardo-silva-de-santana-almoxarifado-28",
    nome: "ALMOXARIFADO - CARLOS EDUARDO SILVA DE SANTANA",
    responsavel: "CARLOS EDUARDO SILVA DE SANTANA",
    frenteServico: "ALMOXARIFADO",
    obraId: 'obr-1',
    funcionarioIds: ["fun-102100", "fun-101596"],
    status: 'ativo',
    token: "renea-carlos-eduardo-silva-de-santana-almoxarifado-28",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-alvaro-alves-vilela-terraplenagem-29",
    nome: "TERRAPLENAGEM - ALVARO ALVES VILELA",
    responsavel: "ALVARO ALVES VILELA",
    frenteServico: "TERRAPLENAGEM",
    obraId: 'obr-1',
    funcionarioIds: ["fun-101995", "fun-102066"],
    status: 'ativo',
    token: "renea-alvaro-alves-vilela-terraplenagem-29",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-carlos-eduardo-silva-de-santana-manutencao-canteiro-30",
    nome: "MANUTENÇÃO CANTEIRO - CARLOS EDUARDO SILVA DE SANTANA",
    responsavel: "CARLOS EDUARDO SILVA DE SANTANA",
    frenteServico: "MANUTENÇÃO CANTEIRO",
    obraId: 'obr-1',
    funcionarioIds: ["fun-101637", "fun-102109", "fun-101666"],
    status: 'ativo',
    token: "renea-carlos-eduardo-silva-de-santana-manutencao-canteiro-30",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  },
  {
    id: "grp-raimundo-santos-rodrigues-civil-31",
    nome: "CIVIL - RAIMUNDO SANTOS RODRIGUES",
    responsavel: "RAIMUNDO SANTOS RODRIGUES",
    frenteServico: "CIVIL",
    obraId: 'obr-1',
    funcionarioIds: ["fun-102159"],
    status: 'ativo',
    token: "renea-raimundo-santos-rodrigues-civil-31",
    linkAtivo: true,
    createdAt: '2026-06-30T07:00:00.000Z',
    updatedAt: '2026-06-30T07:00:00.000Z'
  }
];

export const INITIAL_GRUPOS_EQUIPES: GrupoEquipe[] = INITIAL_GRUPOS_EQUIPES_LEGACY.map(group => ({
  ...group,
  token: generateSecurePublicToken('presenca'),
}));

export const INITIAL_PRESENCAS_LINK: PresencaApontamento[] = [];

export const INITIAL_HISTORICO_PRESENCAS: HistoricoPresenca[] = [];

const APONTAMENTO_RAMOS_BASE = [
  { canteiroNome: 'Rua Padre Eustáquio', ramoNome: 'Ramo 200' },
  { canteiroNome: 'Rua Padre Eustáquio', ramoNome: 'Ramo 300' },
  { canteiroNome: 'Rua Padre Eustáquio', ramoNome: 'Ramo 500' },
  { canteiroNome: 'Rua Padre Eustáquio', ramoNome: 'Ramo 900' },
  { canteiroNome: 'Rua Padre Eustáquio', ramoNome: 'Ramo 2000' },
  { canteiroNome: 'Rua Padre Eustáquio', ramoNome: 'Agulha' },
  { canteiroNome: 'SP066 Ibar', ramoNome: 'Ramo 200 Alargamento' },
  { canteiroNome: 'SP066 Ibar', ramoNome: 'Ramo 600 Ferradura' },
  { canteiroNome: 'Canteiro da Marginal', ramoNome: 'Ramo 800' },
  { canteiroNome: 'Canteiro da Marginal', ramoNome: 'Ramo 500 Marginal' },
  { canteiroNome: 'Canteiro da Marginal', ramoNome: 'Ramo 1000' }
];

export const INITIAL_APONTAMENTO_RAMOS: ApontamentoRamo[] = APONTAMENTO_RAMOS_BASE.map((item, index) => ({
  id: `ramo-renea-${index + 1}`,
  canteiroNome: item.canteiroNome,
  ramoNome: item.ramoNome,
  responsavel: 'Apontador RENEA',
  token: APONTAMENTO_LINK_TOKEN,
  status: 'ativo',
  linkAtivo: true
}));

export const INITIAL_APONTAMENTO_RAMO_REGISTROS: ApontamentoRamoRegistro[] = [];

export const INITIAL_PARTES_DIARIAS_EQUIPAMENTOS: ParteDiariaEquipamento[] = [];


export const INITIAL_ORDENS_SERVICO: OrdemServico[] = [];
