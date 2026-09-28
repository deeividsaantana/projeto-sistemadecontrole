/**
 * Ramos e locais da obra com o código de apropriação do SGE.
 *
 * A lista vem dos dois PDFs de referência da obra ("Códigos SGE: apropriação
 * de horas" e "apropriação de viagens"). Ela não é gravada por conta própria:
 * vira cadastro de ramos (EtapaServico) quando alguém carrega a lista na tela,
 * e dali em diante o cadastro é a verdade.
 *
 * O movimento continua guardando o local como a planilha escreveu. O local
 * cadastrado é achado na hora pelo nome, pelos apelidos ou pelo código: ligar
 * um nome novo é gravar um apelido no ramo, não reescrever 11 mil viagens.
 */
import type { EtapaServico, MovimentoMaterial, TipoLocalObra } from '../../types';
import { normalizeComparable } from '../../utils/canonicalIdentity';

export interface LocalSge {
  codigo?: string;
  /** Mesmo nome com outro código na lista de horas (ex.: 102 e 138, Ramo 900). */
  outrosCodigos?: readonly string[];
  nome: string;
  tipo: TipoLocalObra;
  ramo?: string;
  apelidos?: readonly string[];
  /** Regra da lista de horas que vale lembrar ao apropriar. */
  regra?: string;
}

export interface RotaViagemSge {
  codigo: string;
  origem: string;
  destino: string;
}

/**
 * "CS RAMO 500 (MARGINAL)", "Ramo 500 Marginal" e "ramo500 marginal" são a
 * mesma coisa: sem acento, sem pontuação e com número separado da palavra.
 */
export const chaveLocal = (texto: unknown): string => normalizeComparable(texto)
  .replace(/([a-z])(\d)/g, '$1 $2')
  .replace(/(\d)([a-z])/g, '$1 $2')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export const TIPOS_LOCAL: readonly TipoLocalObra[] = ['Ramo', 'Frente', 'Origem', 'Bota-fora', 'Bota-espera', 'Estoque', 'Canteiro', 'Serviço'];

/** O que cada tipo quer dizer, para quem escolhe na tela. */
export const EXPLICA_TIPO: Record<TipoLocalObra, string> = {
  Ramo: 'O ramo em si',
  Frente: 'Parte de um ramo: espinha, coluna de brita, aterro',
  Origem: 'De onde o material sai: pedreira, jazida',
  'Bota-fora': 'Para onde vai lixo e solo',
  'Bota-espera': 'Onde o material espera antes de ir',
  Estoque: 'Pilha guardada para usar depois',
  Canteiro: 'Canteiro, pátio e fábrica',
  Serviço: 'Código só de horas, sem lugar de material',
};

/** Lista de horas (100 a 160) e os lugares que só aparecem nas viagens e na planilha. */
export const CATALOGO_LOCAIS_SGE: readonly LocalSge[] = [
  { codigo: '100', nome: 'Ibar', tipo: 'Frente' },
  { codigo: '101', outrosCodigos: ['144'], nome: 'Ramo 2000', tipo: 'Ramo', ramo: 'Ramo 2000', apelidos: ['CS Ramo 2000'] },
  { codigo: '102', outrosCodigos: ['138'], nome: 'Ramo 900', tipo: 'Ramo', ramo: 'Ramo 900', apelidos: ['CS Ramo 900'] },
  { codigo: '103', outrosCodigos: ['109'], nome: 'Ramo 600 (Ferradura)', tipo: 'Ramo', ramo: 'Ramo 600', apelidos: ['CS Ramo 600 (Ferradura)'] },
  { codigo: '104', nome: 'Ramo 500 (Marginal)', tipo: 'Ramo', ramo: 'Ramo 500', apelidos: ['CS Ramo 500 (Marginal)', 'Ramo 500', 'Marginal', 'Marginal 500'] },
  { codigo: '105', nome: 'CB Ramo 700', tipo: 'Frente', ramo: 'Ramo 700', apelidos: ['CS CB Ramo 700'] },
  { codigo: '106', nome: 'CB Ramo 600', tipo: 'Frente', ramo: 'Ramo 600', apelidos: ['CS CB Ramo 600'] },
  { codigo: '107', nome: 'Espinha Ramo 2000', tipo: 'Frente', ramo: 'Ramo 2000' },
  { codigo: '108', nome: 'Espinha Ramo 900', tipo: 'Frente', ramo: 'Ramo 900' },
  { codigo: '110', nome: 'Espinha Ramo 500 (Marginal)', tipo: 'Frente', ramo: 'Ramo 500', apelidos: ['Espinha Ramo Marginal'] },
  { codigo: '111', nome: 'Platores (Canteiro)', tipo: 'Canteiro', apelidos: ['Plator Canteiro'] },
  { codigo: '112', nome: 'Acessos pra obra', tipo: 'Frente', apelidos: ['Acesso Obra'] },
  { codigo: '113', nome: 'Ramo 600 (Agulha e Acesso)', tipo: 'Ramo', ramo: 'Ramo 600' },
  { codigo: '114', nome: 'Coluna de Brita Ramo 600', tipo: 'Frente', ramo: 'Ramo 600' },
  { codigo: '115', nome: 'Coluna de Brita Ramo 700', tipo: 'Frente', ramo: 'Ramo 700' },
  { codigo: '116', nome: 'Pedreira Contern', tipo: 'Origem', apelidos: ['Pedreira Conterne'] },
  { codigo: '117', nome: 'Fábrica', tipo: 'Canteiro' },
  { codigo: '118', nome: 'Fornecimento Sondasolo', tipo: 'Serviço' },
  { codigo: '119', nome: 'Ramo 1300', tipo: 'Ramo', ramo: 'Ramo 1300' },
  { codigo: '120', nome: 'Fornecimento Rivoli', tipo: 'Serviço' },
  { codigo: '121', nome: 'Bota Espera Ramo 600', tipo: 'Bota-espera', ramo: 'Ramo 600', apelidos: ['Bora Espera Ramo 600'] },
  { codigo: '122', nome: 'Ramo 200 Alargamento', tipo: 'Ramo', ramo: 'Ramo 200', apelidos: ['CS Ramo 200 Alargamento'] },
  { codigo: '123', nome: 'Ramo 1400', tipo: 'Ramo', ramo: 'Ramo 1400', apelidos: ['CS Ramo 1400'] },
  { codigo: '124', nome: 'Desmobilizado', tipo: 'Serviço' },
  { codigo: '125', nome: 'Transporte de Concreto', tipo: 'Serviço', regra: 'Betoneiras (centro de custo).' },
  { codigo: '126', outrosCodigos: ['140'], nome: 'Escavação de Perfil Ramo 500', tipo: 'Serviço', ramo: 'Ramo 500' },
  { codigo: '127', nome: 'Fornecimento de Água', tipo: 'Serviço' },
  { codigo: '128', nome: 'Canteiro Barraca do Coco', tipo: 'Canteiro', apelidos: ['Barraca do Coco', 'Pátio PM Barraca do Coco'] },
  { codigo: '129', nome: 'Ramo 1600', tipo: 'Ramo', ramo: 'Ramo 1600' },
  { codigo: '130', nome: 'Ramo 400', tipo: 'Ramo', ramo: 'Ramo 400' },
  { codigo: '131', nome: 'SP66', tipo: 'Frente' },
  { codigo: '132', nome: 'Ramo 1700', tipo: 'Ramo', ramo: 'Ramo 1700' },
  { codigo: '133', nome: 'Brasil', tipo: 'Frente' },
  { codigo: '134', nome: 'Fornecimento Central de Concreto', tipo: 'Serviço', regra: 'Carregadeira CR039 e retroescavadeira da fábrica.' },
  { codigo: '135', nome: 'Ramo 800', tipo: 'Ramo', ramo: 'Ramo 800', apelidos: ['CS Ramo 800'] },
  { codigo: '136', nome: 'Jazida Km 128', tipo: 'Origem', apelidos: ['Km 128'] },
  { codigo: '137', nome: 'Apoio canteiro de obra', tipo: 'Serviço' },
  { codigo: '139', nome: 'Ramo 300', tipo: 'Ramo', ramo: 'Ramo 300' },
  { codigo: '141', nome: 'Fornecimento de Combustível', tipo: 'Serviço' },
  { codigo: '142', nome: 'Bota Espera Ramo 700', tipo: 'Bota-espera', ramo: 'Ramo 700', apelidos: ['Bora Espera Ramo 700'] },
  { codigo: '143', nome: 'Transporte de Pré-Moldados', tipo: 'Serviço', regra: 'Cavalo mecânico da fábrica.' },
  { codigo: '145', nome: 'Ramo 600', tipo: 'Ramo', ramo: 'Ramo 600' },
  { codigo: '146', nome: 'Ramo 700', tipo: 'Ramo', ramo: 'Ramo 700' },
  { codigo: '147', nome: 'Montagem e desmontagem de guindaste', tipo: 'Serviço', regra: 'Guindaste: sempre apoio à Rivoli.' },
  { codigo: '148', nome: 'Regularização de Acessos', tipo: 'Serviço' },
  { codigo: '149', nome: 'Limpeza na estrada Padre Eustáquio', tipo: 'Serviço' },
  { codigo: '150', nome: 'Bota-fora Rodoanel', tipo: 'Bota-fora', apelidos: ['Espalhamento de Bota fora Rodoanel'] },
  { codigo: '151', nome: 'Aracaré', tipo: 'Frente', apelidos: ['Atendendo Aracaré'] },
  { codigo: '152', nome: 'Jazida Sabesp', tipo: 'Origem' },
  { codigo: '153', nome: 'Ramo 1000', tipo: 'Ramo', ramo: 'Ramo 1000' },
  { codigo: '154', nome: 'Coluna de Brita Ramo 200', tipo: 'Frente', ramo: 'Ramo 200' },
  { codigo: '155', nome: 'Fornecimento Tecnogeo', tipo: 'Serviço' },
  { codigo: '156', nome: 'Aterro Pétreo Ramo 700', tipo: 'Frente', ramo: 'Ramo 700', apelidos: ['Aterro Pétrio Ramo 700', '1ª Camada de Aterro Pétreo Ramo 700', '2ª Camada de Aterro Pétreo Ramo 700'] },
  { codigo: '157', nome: 'Ramo 100', tipo: 'Ramo', ramo: 'Ramo 100' },
  { codigo: '158', nome: 'Ramo 700 Fase 1', tipo: 'Ramo', ramo: 'Ramo 700' },
  { codigo: '159', nome: 'Pátio para Viga Aracaré', tipo: 'Canteiro', apelidos: ['Pátio de Vigas Aracaré', 'Pátio de Viga Aracaré'] },
  { codigo: '160', nome: 'Ramo 200', tipo: 'Ramo', ramo: 'Ramo 200' },
  // Sem código de horas: aparecem nas viagens e na planilha de materiais.
  { nome: 'Itaquareia', tipo: 'Bota-fora', apelidos: ['Bota Fora Itaquareia'] },
  { nome: 'Lara', tipo: 'Bota-fora', apelidos: ['Bota Fora Lara'] },
  { nome: 'São Bento (Q.E.)', tipo: 'Bota-fora', apelidos: ['Q.E. São Bento SPE Ltda', 'Q.E. São Bento'] },
  { nome: 'Bota Espera Rodoanel', tipo: 'Bota-espera' },
  { nome: 'Bota Espera Ramo 900', tipo: 'Bota-espera', ramo: 'Ramo 900' },
  { nome: 'Bota Espera Marginal 500', tipo: 'Bota-espera', ramo: 'Ramo 500' },
  { nome: 'Bota Espera Pátio Aracaré', tipo: 'Bota-espera' },
  { nome: 'Estoque Ramo 700', tipo: 'Estoque', ramo: 'Ramo 700' },
  { nome: 'Estoque Fresa Ramo 700', tipo: 'Estoque', ramo: 'Ramo 700' },
  { nome: 'Estoque Ramo 900', tipo: 'Estoque', ramo: 'Ramo 900' },
  { nome: 'Estoque Ramo 1400', tipo: 'Estoque', ramo: 'Ramo 1400' },
  { nome: 'Estoque Ramo 2000', tipo: 'Estoque', ramo: 'Ramo 2000' },
  { nome: 'Espinha Ramo 600 (Ferradura)', tipo: 'Frente', ramo: 'Ramo 600' },
  { nome: 'Espinha Ramo 600 (Agulha e Acesso)', tipo: 'Frente', ramo: 'Ramo 600' },
  { nome: 'Espinha Ramo 200 (Alargamento)', tipo: 'Frente', ramo: 'Ramo 200' },
  { nome: 'Espinha Ramo 800 (Marginal)', tipo: 'Frente', ramo: 'Ramo 800' },
  { nome: 'Coluna de Brita Ramo 1000', tipo: 'Frente', ramo: 'Ramo 1000' },
  { nome: 'Ramo 700 Fase 3', tipo: 'Ramo', ramo: 'Ramo 700' },
  { nome: 'Ramo 1200', tipo: 'Ramo', ramo: 'Ramo 1200' },
  { nome: 'Apoio 12 (Ferradura)', tipo: 'Frente', ramo: 'Ramo 600', apelidos: ['Apoio 12'] },
];

/** Tabela de apropriação de viagens, como está no PDF (sem o código 6). */
export const ROTAS_VIAGEM_SGE: readonly RotaViagemSge[] = ([
  ['1', 'Pedreira Contern', 'Ramo 600 (Agulha E Acesso)'], ['2', 'Jazida km 128', 'Ramo 600 (Agulha E Acesso)'], ['3', 'Fábrica', 'SP 66'],
  ['4', 'Ramo 1300', 'SP 66'], ['5', 'Ibar', 'Ramo 500 (Marginal)'], ['7', 'Pedreira Contern', 'Ibar'], ['8', 'Ibar', 'Ramo 2000 Sondasolo'],
  ['9', 'Bota Espera Ramo 600', 'Lara'], ['10', 'Pedreira Contern', 'SP 66'], ['11', 'Ramo 500 Marginal', 'SP 66'], ['12', 'Pedreira Contern', 'Ramo 200 Alargamento'],
  ['13', 'Pedreira Contern', 'Ramo 700 Fase 3'], ['14', 'CS Ramo 200 Alargamento', 'Ibar'], ['15', 'Pedreira Contern', 'Ramo 500 (Marginal)'], ['16', 'Ramo 1300', 'Ibar'],
  ['17', 'Ramo 500 Marginal', 'Ibar'], ['18', 'Ramo 1300', 'Ramo 200'], ['19', 'CS Ramo 200 Alargamento', 'Ramo 200 Alargamento'], ['20', 'Cs Ramo 500 (Marginal)', 'Ramo 500 (Marginal)'],
  ['21', 'Pedreira Contern', 'Pátio PM Barraca do coco'], ['22', 'Ibar', 'Ibar'], ['23', 'Ramo 1400', 'Bora Espera Ramo 700'], ['24', 'Pedreira Contern', 'Plator Canteiro Rivoli'],
  ['25', 'Ramo 500', 'Bota Espera Ramo 600'], ['26', 'Pedreira Contern', 'Plator Canteiro'], ['27', 'Ramo 1300', 'Marginal'], ['28', 'Pedreira Contern', 'Barraca do Coco'],
  ['29', 'Bota Espera Ramo 600', 'Bota Fora Itaquareia'], ['30', 'Bota Espera Ramo 600', 'Barraca do Coco'], ['31', 'Pedreira Contern', 'Ramo 800'], ['32', 'Ramo 1400', 'Ramo 1200'],
  ['33', 'Brasil', 'Ramo 200'], ['34', 'Ibar', 'Ramo 900'], ['35', 'Ramo 700 Fase 3', 'Itaquareia'], ['36', 'Ramo 1300', 'Itaquareia'], ['37', 'Ramo 900', 'Ramo 900'],
  ['38', 'Ramo 200', 'Ramo 600'], ['39', 'Ramo 1400', 'Plator Canteiro'], ['40', 'Ibar', 'Ramo 700'], ['41', 'SP66', 'Ramo 900'], ['42', 'Ibar', 'Plator Canteiro'],
  ['43', 'Ramo 300', 'Bota Espera Rodoanel'], ['44', 'Fábrica', 'Bota Espera Ramo 600'], ['45', 'Fábrica', 'Plator Canteiro'], ['46', 'Ramo 200', 'Plator Canteiro'],
  ['47', 'Ramo 1300', 'Ramo 1600'], ['48', 'Ramo 1300', 'Ramo 700'], ['49', 'Pedreira Contern', 'Ramo 900'], ['50', 'Pedreira Contern', 'Ramo 300'],
  ['51', 'Ibar', 'Barraca do Coco'], ['52', 'SP66', 'SP66'], ['53', 'Bota Espera Ramo 700', 'Itaquareia'], ['54', 'Ibar', 'Ramo 700'], ['55', 'Ramo 900', 'Bota espera ramo 700'],
  ['56', 'Ramo 900', 'Ramo 600'], ['57', 'Ibar', 'Bota Espera ramo 600'], ['58', 'Ibar', 'Bota espera Rodoanel'], ['59', 'Ramo 2000', 'Ramo 600'], ['60', 'Ramo 2000', 'Marginal 500'],
  ['61', 'Ramo 900', 'Ramo 800'], ['62', 'Ramo 600', 'Marginal'], ['63', 'Ramo 1400', 'Ramo 800'], ['64', 'Pedreira Conterne', 'Km128'], ['65', 'Jazida Km 128', 'Ramo 800'],
  ['66', 'Ramo 800', 'Bota fora Rodoanel'], ['67', 'Ramo 1400', 'Ramo 600 agulha e acesso'], ['68', 'Pedreira Contern', 'Regul. Arranque blocos marginal'], ['69', 'Jazida Km 128', 'Ramo 600'],
  ['70', 'Ramo 900', 'Bota Espera marginal 500'], ['71', 'Ramo 700', 'Bora espera ramo 600'], ['72', 'Ramo 300', 'Ramo 800'], ['73', 'Ramo 300', 'Acesso Obra'], ['74', 'Ramo 300', 'Ramo 700'],
  ['75', 'Pedreira Contern', 'Acesso Obra'], ['76', 'Ramo 900', 'Acesso Obra'], ['77', 'Jazida Km 128', 'Acesso Obra'], ['78', 'Ibar', 'Ramo 800'], ['79', 'Pedreira Contern', 'Fábrica'],
  ['80', 'Jazida Km 128', 'Espinha Ramo 900'], ['81', 'Ramo 900', 'Bota fora Itaquareia'], ['82', 'Ramo 300', 'Ramo 800'], ['83', 'Ramo 300', 'Ramo 200'], ['84', 'Ramo 900', 'Ibar'],
  ['85', 'Ramo 900', 'Ramo 300'], ['86', 'SP66', 'Ramo 800'], ['87', 'Ramo 700', 'Acesso Obra'], ['88', 'Jazida Km 128', 'Ramo 200'], ['89', 'Aracaré', 'Ibar'], ['90', 'Marginal', 'Itaquareia'],
  ['91', 'Aracaré', 'Ramo 900'], ['92', 'Pedreira Contern', 'Jazida Sabesp'], ['93', 'Pedreira Contern', 'Ramo 100'], ['94', 'Ramo 1000', 'Bota Espera Rodoanel'], ['95', 'Jazida Sabesp', 'Marginal'],
  ['96', 'Jazida Sabesp', 'Ramo 600'], ['97', 'Ramo 100', 'Bota Espera Rodoanel'], ['98', 'Jazida Km 128', 'Ramo 300'], ['99', 'Ramo 200', 'Ramo100'], ['100', 'Ramo 700 Fase 1', 'Bota Espera Rodoanel'],
  ['101', 'Jazida Sabesp', 'Ramo 700'], ['102', 'Ramo 1400', 'Ramo 600'], ['103', 'Ramo 1400', 'Bota Fora Itaquareia'], ['104', 'Ramo 900', 'Ramo 1400'], ['105', 'Ramo 200', 'Bota Espera Rodoanel'],
  ['106', 'Ibar', 'Bota Fora Itaquareia'], ['107', 'Pedreira Contern', 'Estoque Ramo 700'], ['108', 'Bota Espera Ramo 700', 'Aterro blocos Ramo 900'], ['109', 'Apoio 12 Ferradura', 'Ramo 200'],
  ['110', 'Apoio 12 Ferradura', 'Bota espera Ramo 900'], ['111', 'Pedreira Contern', 'Ramo 1400'], ['112', 'Pedreira Contern', 'Pátio de Vigas Aracaré'], ['113', 'Jazida Km 128', 'Ibar'],
  ['114', 'Apoio 12', 'Ibar'], ['115', 'Ramo 200', 'Estoque Ramo 900'], ['116', 'Jazida Km 128', 'Espinha Ramo Marginal'], ['117', 'Jazida Sabesp', 'Ibar'], ['118', 'Estoque Fresa Ramo 700', 'Jazida Sabesp'],
  ['119', 'Estoque Fresa Ramo 700', 'Apoio 12 Ferradura'], ['120', 'Fábrica', 'Pátio de Viga Aracaré'], ['121', 'Jazida Sabesp', 'Fábrica'], ['122', 'Ibar', 'Ramo 300'], ['123', 'Ramo 500', 'Ramo 200'],
  ['124', 'Ramo 500', 'Ramo 800'], ['125', 'Ramo 1300', 'Ramo 600 Ferradura'], ['126', 'Ramo 1400', 'Espinha AP 01 Ramo 100'], ['127', 'Estoque Ramo 700', 'Ramo 1300'], ['128', 'Ramo 1300', 'Bota espera Ramo 600'],
  ['129', 'Ramo 2000', 'Itaquareia'], ['130', 'Pedreira Contern', 'Ramo 1300'], ['131', 'Ramo 200', 'Itaquareia'], ['132', 'Ramo 1300', 'Bota Espera Pátio Aracaré'], ['133', 'Ramo 700 Fase 1', 'Itaquareia'],
  ['134', 'Estoque Ramo 700', 'Fábrica'],
] as const).map(([codigo, origem, destino]) => ({ codigo, origem, destino }));

const idDoCatalogo = (local: LocalSge) => (local.codigo ? `etapa-sge-${local.codigo}` : `etapa-local-${chaveLocal(local.nome).replace(/ /g, '-')}`);

const semRepetir = (lista: readonly string[]) => {
  const vistas = new Set<string>();
  return lista.map(item => item.trim()).filter(item => {
    const chave = chaveLocal(item);
    if (!chave || vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
};

/** Nome, apelidos e código de cada local ativo, apontando para o próprio local. */
export const indiceDeLocais = (etapas: readonly EtapaServico[]): Map<string, EtapaServico> => {
  const indice = new Map<string, EtapaServico>();
  const guardar = (texto: string | undefined, etapa: EtapaServico) => {
    const chave = chaveLocal(texto);
    // O primeiro que chegou fica: nome repetido não troca o local de ninguém.
    if (chave && !indice.has(chave)) indice.set(chave, etapa);
  };
  etapas.forEach(etapa => guardar(etapa.nome, etapa));
  etapas.forEach(etapa => (etapa.apelidos || []).forEach(apelido => guardar(apelido, etapa)));
  etapas.forEach(etapa => { if (etapa.codigoSge) guardar(`sge ${etapa.codigoSge}`, etapa); });
  return indice;
};

export const resolverLocal = (texto: string | undefined, indice: ReadonlyMap<string, EtapaServico>) => {
  const chave = chaveLocal(texto);
  if (!chave) return undefined;
  return indice.get(chave) ?? (/^\d{3}$/.test(chave) ? indice.get(`sge ${chave}`) : undefined);
};

/** Onde o movimento foi parar: o vínculo gravado vence; depois, o que a planilha escreveu. */
export const localDoMovimento = (
  movimento: Pick<MovimentoMaterial, 'etapaServicoId' | 'destino'>,
  porId: ReadonlyMap<string, EtapaServico>,
  indice: ReadonlyMap<string, EtapaServico>,
) => (movimento.etapaServicoId ? porId.get(movimento.etapaServicoId) : undefined) ?? resolverLocal(movimento.destino, indice);

export interface PlanoCargaSge {
  novas: EtapaServico[];
  completadas: EtapaServico[];
  /** Local que já tem outro código SGE: fica como está, para a pessoa conferir. */
  conflitos: Array<{ etapa: EtapaServico; codigoDaLista: string }>;
}

/**
 * O que carregar a lista SGE faria no cadastro de ramos. Nada é apagado nem
 * renomeado: local que já existe só ganha o que falta (código, tipo, ramo e
 * apelidos); o que não existe entra novo.
 */
/**
 * `apagados` são os ids que alguém mandou para a Lixeira: a lista SGE não
 * traz de volta o local que a pessoa apagou de propósito.
 */
export const planoCargaSge = (etapas: readonly EtapaServico[], catalogo: readonly LocalSge[] = CATALOGO_LOCAIS_SGE, apagados: ReadonlySet<string> = new Set()): PlanoCargaSge => {
  const novas: EtapaServico[] = [];
  const completadas = new Map<string, EtapaServico>();
  const conflitos: PlanoCargaSge['conflitos'] = [];
  const indice = indiceDeLocais(etapas);
  const porCodigo = new Map(etapas.filter(item => item.codigoSge).map(item => [item.codigoSge as string, item]));
  const usados = new Set<string>();

  for (const local of catalogo) {
    const existente = (local.codigo ? porCodigo.get(local.codigo) : undefined)
      ?? [local.nome, ...(local.apelidos || [])].map(texto => resolverLocal(texto, indice)).find(item => item && !usados.has(item.id));
    if (!existente) {
      if (apagados.has(idDoCatalogo(local))) continue;
      novas.push({
        id: idDoCatalogo(local),
        nome: local.nome,
        ...(local.codigo ? { codigoSge: local.codigo } : {}),
        tipoLocal: local.tipo,
        ...(local.ramo ? { ramo: local.ramo } : {}),
        ...(local.apelidos?.length ? { apelidos: semRepetir(local.apelidos) } : {}),
      });
      continue;
    }
    usados.add(existente.id);
    const base = completadas.get(existente.id) ?? existente;
    if (local.codigo && base.codigoSge && base.codigoSge !== local.codigo) {
      conflitos.push({ etapa: base, codigoDaLista: local.codigo });
      continue;
    }
    const apelidos = semRepetir([...(base.apelidos || []), ...(chaveLocal(local.nome) !== chaveLocal(base.nome) ? [local.nome] : []), ...(local.apelidos || [])])
      .filter(apelido => chaveLocal(apelido) !== chaveLocal(base.nome));
    const proxima: EtapaServico = {
      ...base,
      ...(!base.codigoSge && local.codigo ? { codigoSge: local.codigo } : {}),
      tipoLocal: base.tipoLocal ?? local.tipo,
      ...(!base.ramo && local.ramo ? { ramo: local.ramo } : {}),
      ...(apelidos.length ? { apelidos } : {}),
    };
    const mudou = proxima.codigoSge !== existente.codigoSge || proxima.tipoLocal !== existente.tipoLocal || proxima.ramo !== existente.ramo
      || (proxima.apelidos || []).length !== (existente.apelidos || []).length;
    if (mudou) completadas.set(existente.id, proxima);
  }
  return { novas, completadas: [...completadas.values()], conflitos };
};

export interface NomeSemLocal {
  texto: string;
  movimentos: number;
  /** Em quantos movimentos o nome veio como origem (de onde saiu). */
  comoOrigem: number;
  /** Local provável pelo número do ramo ("BASE DE REFORÇO RAMO 1400" → Ramo 1400). */
  sugestao?: EtapaServico;
}

/** Ramo principal citado no texto: "Ramo 1400", "ramo1300", "Marginal". */
const ramoCitado = (texto: string) => {
  const chave = chaveLocal(texto);
  // "Ramo 600/700" fala de dois ramos: aí quem escolhe é a pessoa.
  if (/\bramo \d{3,4} \d{3,4}\b/.test(chave)) return undefined;
  const numero = chave.match(/\bramo (\d{3,4})\b/)?.[1];
  if (numero) return `Ramo ${numero}`;
  if (/\bmarginal\b/.test(chave)) return 'Ramo 500';
  return undefined;
};

/**
 * Nomes que a planilha usou e que nenhum local reconhece. Cada um aparece uma
 * vez, com quantos movimentos usam, do mais usado ao menos usado.
 */
export const nomesSemLocal = (movimentos: readonly MovimentoMaterial[], etapas: readonly EtapaServico[]): NomeSemLocal[] => {
  const indice = indiceDeLocais(etapas);
  const grupos = new Map<string, NomeSemLocal>();
  for (const movimento of movimentos) {
    if (movimento.canceladoEm || movimento.etapaServicoId) continue;
    for (const [texto, origem] of [[movimento.destino, false], [movimento.origem, true]] as const) {
      if (!texto?.trim() || resolverLocal(texto, indice)) continue;
      const chave = chaveLocal(texto);
      const grupo = grupos.get(chave) ?? { texto: texto.trim(), movimentos: 0, comoOrigem: 0 };
      grupo.movimentos += 1;
      if (origem) grupo.comoOrigem += 1;
      grupos.set(chave, grupo);
    }
  }
  const principais = etapas.filter(etapa => etapa.tipoLocal === 'Ramo' || !etapa.tipoLocal);
  return [...grupos.values()]
    .map(grupo => {
      const ramo = ramoCitado(grupo.texto);
      const sugestao = ramo ? principais.find(etapa => chaveLocal(etapa.nome) === chaveLocal(ramo)) ?? principais.find(etapa => etapa.ramo && chaveLocal(etapa.ramo) === chaveLocal(ramo)) : undefined;
      return sugestao ? { ...grupo, sugestao } : grupo;
    })
    .sort((a, b) => b.movimentos - a.movimentos || a.texto.localeCompare(b.texto, 'pt-BR'));
};

/**
 * Local novo a partir de um nome da planilha, sem código SGE: o tipo sai do
 * próprio nome (bota-fora, estoque, canteiro) ou de ter vindo só como origem,
 * e o ramo, do número citado. A pessoa corrige depois, se precisar.
 */
export const localDoNome = (nome: NomeSemLocal, id: string): EtapaServico => {
  const chave = chaveLocal(nome.texto);
  const tipoLocal: TipoLocalObra = /\bbota fora\b/.test(chave) ? 'Bota-fora'
    : /\bbota espera\b/.test(chave) ? 'Bota-espera'
      : /\b(estoque|almoxarifado|patio)\b/.test(chave) ? 'Estoque'
        : /\bcanteiro\b/.test(chave) ? 'Canteiro'
          : nome.comoOrigem === nome.movimentos ? 'Origem'
            : 'Frente';
  const ramo = ramoCitado(nome.texto);
  return { id, nome: nome.texto.trim(), tipoLocal, ...(ramo ? { ramo } : {}) };
};

/** Guarda o nome da planilha como apelido do local escolhido. */
export const ligarNome = (etapa: EtapaServico, texto: string): EtapaServico => {
  const apelidos = semRepetir([...(etapa.apelidos || []), texto]).filter(apelido => chaveLocal(apelido) !== chaveLocal(etapa.nome));
  return { ...etapa, apelidos };
};

/** Código de viagem do SGE para o par origem → destino, pelos locais cadastrados. */
export const codigoDaViagem = (
  origem: string | undefined,
  destino: string | undefined,
  indice: ReadonlyMap<string, EtapaServico>,
  rotas: readonly RotaViagemSge[] = ROTAS_VIAGEM_SGE,
): string | undefined => {
  const de = resolverLocal(origem, indice);
  const para = resolverLocal(destino, indice);
  if (!de || !para) return undefined;
  return rotas.find(rota => resolverLocal(rota.origem, indice)?.id === de.id && resolverLocal(rota.destino, indice)?.id === para.id)?.codigo;
};

/** Ordem de leitura: Ramo 100, Ramo 200 ... Ramo 2000, depois o resto em ordem alfabética. */
export const ordemDoRamo = (ramo: string) => {
  const numero = Number(chaveLocal(ramo).match(/^ramo (\d+)/)?.[1]);
  return Number.isFinite(numero) && numero > 0 ? numero : Number.POSITIVE_INFINITY;
};

/** Nome do grupo em que o local aparece na tela. */
export const grupoDoLocal = (etapa: EtapaServico): string => {
  if (etapa.ramo) return etapa.ramo;
  switch (etapa.tipoLocal) {
    case 'Origem': return 'Pedreiras e jazidas';
    case 'Bota-fora': return 'Bota-foras';
    case 'Bota-espera': return 'Bota-esperas';
    case 'Estoque': return 'Estoques';
    case 'Canteiro': return 'Canteiros e pátios';
    case 'Serviço': return 'Serviços (só horas)';
    case 'Ramo': return etapa.nome;
    default: return 'Outros locais';
  }
};

const ORDEM_GRUPOS = ['Pedreiras e jazidas', 'Canteiros e pátios', 'Estoques', 'Bota-esperas', 'Bota-foras', 'Outros locais', 'Serviços (só horas)'];

/** Ramos pelo número, depois os grupos na ordem de quem pensa a obra: de onde vem, para onde vai. */
export const ordemDoGrupo = (grupo: string) => {
  const ramo = ordemDoRamo(grupo);
  if (Number.isFinite(ramo)) return ramo;
  const posicao = ORDEM_GRUPOS.indexOf(grupo);
  return 100_000 + (posicao < 0 ? ORDEM_GRUPOS.indexOf('Outros locais') : posicao);
};

export const rotuloDoLocal = (etapa: EtapaServico) => (etapa.codigoSge ? `${etapa.codigoSge} · ${etapa.nome}` : etapa.nome);

/**
 * Locais que recebem ou mandam material, agrupados para um select. Código só
 * de horas fica de fora, a não ser o que já está escolhido no lançamento.
 */
export const locaisParaEscolher = (etapas: readonly EtapaServico[], manterId = ''): Array<[string, EtapaServico[]]> => {
  const mapa = new Map<string, EtapaServico[]>();
  etapas.filter(etapa => etapa.tipoLocal !== 'Serviço' || etapa.id === manterId).forEach(etapa => {
    const grupo = grupoDoLocal(etapa);
    mapa.set(grupo, [...(mapa.get(grupo) || []), etapa]);
  });
  return [...mapa.entries()]
    .map(([grupo, itens]): [string, EtapaServico[]] => [grupo, itens.sort((a, b) => (Number(a.codigoSge) || 999) - (Number(b.codigoSge) || 999) || a.nome.localeCompare(b.nome, 'pt-BR'))])
    .sort((a, b) => ordemDoGrupo(a[0]) - ordemDoGrupo(b[0]) || a[0].localeCompare(b[0], 'pt-BR'));
};
