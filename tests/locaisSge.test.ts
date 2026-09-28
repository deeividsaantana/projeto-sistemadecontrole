import assert from 'node:assert/strict';
import test from 'node:test';
import type { EtapaServico, MovimentoMaterial } from '../src/types';
import {
  CATALOGO_LOCAIS_SGE,
  ROTAS_VIAGEM_SGE,
  chaveLocal,
  codigoDaViagem,
  indiceDeLocais,
  ligarNome,
  localDoMovimento,
  localDoNome,
  nomesSemLocal,
  planoCargaSge,
  resolverLocal,
} from '../src/modules/materials/locaisSge';

const carregado = () => planoCargaSge([]).novas;

const mov = (id: string, destino: string, extra: Partial<MovimentoMaterial> = {}): MovimentoMaterial => ({
  id, data: '2026-09-20', tipo: 'Entrada', materialId: 'm', materialDescricao: 'RACHÃO PRIMÁRIO', quantidade: 20, unidade: 't', destino, responsavel: 'x', criadoEm: id, ...extra,
});

test('a chave junta as grafias da planilha, do PDF e do campo', () => {
  assert.equal(chaveLocal('CS RAMO 500 (MARGINAL)'), chaveLocal('Cs Ramo 500 Marginal'));
  assert.equal(chaveLocal('Ramo100'), chaveLocal('Ramo 100'));
  assert.equal(chaveLocal('SP66'), chaveLocal('SP 66'));
  assert.equal(chaveLocal('Pátio de Vigas Aracaré'), 'patio de vigas aracare');
});

test('o catálogo não tem dois locais com o mesmo nome, apelido ou código', () => {
  const vistos = new Map<string, string>();
  for (const local of CATALOGO_LOCAIS_SGE) {
    for (const texto of [local.nome, ...(local.apelidos || []), ...(local.codigo ? [`sge ${local.codigo}`] : [])]) {
      const chave = chaveLocal(texto);
      assert.ok(!vistos.has(chave), `"${texto}" repete "${vistos.get(chave)}"`);
      vistos.set(chave, local.nome);
    }
  }
  assert.equal(CATALOGO_LOCAIS_SGE.filter(local => local.codigo).length + CATALOGO_LOCAIS_SGE.flatMap(local => local.outrosCodigos || []).length, 61);
});

test('a tabela de viagens tem os 133 códigos do PDF, sem o 6', () => {
  assert.equal(ROTAS_VIAGEM_SGE.length, 133);
  assert.ok(!ROTAS_VIAGEM_SGE.some(rota => rota.codigo === '6'));
  assert.equal(ROTAS_VIAGEM_SGE.at(-1)?.codigo, '134');
});

test('com a lista carregada, os locais mais usados da planilha de 26/09 são reconhecidos', () => {
  const indice = indiceDeLocais(carregado());
  const esperado: Record<string, string> = {
    'CS RAMO 900': '102',
    'CS RAMO 500 (MARGINAL)': '104',
    'CS RAMO 600 (FERRADURA)': '103',
    'ESPINHA RAMO 500 (MARGINAL)': '110',
    'ESPINHA RAMO 900': '108',
    'CS CB RAMO 700': '105',
    'CS RAMO 200 (ALARGAMENTO)': '122',
    'COLUNA DE BRITA RAMO 700': '115',
    'PLATORES (CANTEIRO)': '111',
    'ACESSOS PRA OBRA': '112',
    'PEDREIRA CONTERN': '116',
    'JAZIDA KM 128': '136',
    IBAR: '100',
  };
  for (const [texto, codigo] of Object.entries(esperado)) {
    assert.equal(resolverLocal(texto, indice)?.codigoSge, codigo, texto);
  }
  assert.equal(resolverLocal('ITAQUAREIA', indice)?.tipoLocal, 'Bota-fora');
  assert.equal(resolverLocal('BOTA FORA LARA', indice)?.nome, 'Lara');
  assert.equal(resolverLocal('138', indice), undefined, 'código repetido não resolve sozinho');
  assert.equal(resolverLocal('102', indice)?.nome, 'Ramo 900');
});

test('carregar a lista não apaga, não renomeia e só completa o que já existe', () => {
  const atuais: EtapaServico[] = [
    { id: 'et-1', nome: 'Terraplenagem / Escavação' },
    { id: 'r900', nome: 'RAMO 900' },
    { id: 'r1400', nome: 'Ramo 1400', codigoSge: '999' },
  ];
  const plano = planoCargaSge(atuais);
  const r900 = plano.completadas.find(item => item.id === 'r900');
  assert.equal(r900?.nome, 'RAMO 900');
  assert.equal(r900?.codigoSge, '102');
  assert.equal(r900?.ramo, 'Ramo 900');
  assert.deepEqual(r900?.apelidos, ['CS Ramo 900']);
  assert.ok(!plano.novas.some(item => item.nome === 'Ramo 900'));
  assert.deepEqual(plano.conflitos.map(item => [item.etapa.id, item.codigoDaLista]), [['r1400', '123']]);
  assert.ok(!plano.completadas.some(item => item.id === 'et-1'));

  const depois = [...atuais.map(item => plano.completadas.find(novo => novo.id === item.id) ?? item), ...plano.novas];
  const segunda = planoCargaSge(depois);
  assert.equal(segunda.novas.length, 0, 'carregar de novo não duplica');
  assert.equal(segunda.completadas.length, 0);
});

test('nomes sem local sugerem o ramo citado e somem ao ligar', () => {
  const etapas = carregado();
  const movimentos = [
    mov('a', 'BASE DE REFORÇO RAMO 1400'),
    mov('b', 'BASE DE REFORÇO RAMO 1400'),
    mov('c', 'CS RAMO 900'),
    mov('d', 'LOCAL QUALQUER'),
    mov('f', 'BOTA ESPERA RAMO 600/700'),
    mov('e', 'OUTRO', { canceladoEm: '2026-09-21' }),
  ];
  const faltando = nomesSemLocal(movimentos, etapas);
  assert.deepEqual(faltando.map(item => [item.texto, item.movimentos]), [['BASE DE REFORÇO RAMO 1400', 2], ['BOTA ESPERA RAMO 600/700', 1], ['LOCAL QUALQUER', 1]]);
  assert.equal(faltando[0].sugestao?.nome, 'Ramo 1400');
  assert.equal(faltando[1].sugestao, undefined, 'dois ramos no nome: sem sugestão');
  assert.equal(faltando[2].sugestao, undefined);

  const ramo1400 = etapas.find(item => item.nome === 'Ramo 1400') as EtapaServico;
  const ligado = ligarNome(ramo1400, 'BASE DE REFORÇO RAMO 1400');
  const depois = etapas.map(item => (item.id === ligado.id ? ligado : item));
  assert.deepEqual(nomesSemLocal(movimentos, depois).map(item => item.texto), ['BOTA ESPERA RAMO 600/700', 'LOCAL QUALQUER']);
  assert.equal(ligarNome(ligado, 'base de reforco ramo 1400').apelidos?.length, ligado.apelidos?.length, 'mesmo nome não entra duas vezes');
});

test('o vínculo gravado vence o texto da planilha', () => {
  const etapas = carregado();
  const porId = new Map(etapas.map(item => [item.id, item]));
  const indice = indiceDeLocais(etapas);
  assert.equal(localDoMovimento({ destino: 'CS RAMO 900' }, porId, indice)?.codigoSge, '102');
  assert.equal(localDoMovimento({ destino: 'CS RAMO 900', etapaServicoId: 'etapa-sge-123' }, porId, indice)?.nome, 'Ramo 1400');
});

test('o código da viagem sai do par origem e destino, em qualquer grafia', () => {
  const indice = indiceDeLocais(carregado());
  assert.equal(codigoDaViagem('PEDREIRA CONTERN', 'CS RAMO 900', indice), '49');
  assert.equal(codigoDaViagem('Bota Espera Ramo 600', 'BOTA FORA LARA', indice), '9');
  assert.equal(codigoDaViagem('IBAR', 'RAMO 700', indice), '40', 'código repetido fica com o primeiro');
  assert.equal(codigoDaViagem('LUGAR NENHUM', 'Ibar', indice), undefined);
});

test('nome da planilha vira local próprio, sem código SGE, com tipo e ramo tirados do nome', () => {
  const etapas = carregado();
  const movimentos = [
    mov('a', 'BOTA-FORA ESTRADA VELHA'),
    mov('b', 'ATERRO RAMO 1300'),
    mov('c', 'PÁTIO CENTRAL'),
    mov('d', 'ATERRO RAMO 1300', { origem: 'PEDREIRA NOVA' }),
  ];
  const faltando = nomesSemLocal(movimentos, etapas);
  const pedreira = faltando.find(item => item.texto === 'PEDREIRA NOVA')!;
  assert.equal(pedreira.comoOrigem, 1);
  const novos = Object.fromEntries(faltando.map(item => [item.texto, localDoNome(item, `id-${item.texto}`)]));
  assert.deepEqual(novos['BOTA-FORA ESTRADA VELHA'], { id: 'id-BOTA-FORA ESTRADA VELHA', nome: 'BOTA-FORA ESTRADA VELHA', tipoLocal: 'Bota-fora' });
  assert.equal(novos['ATERRO RAMO 1300'].tipoLocal, 'Frente');
  assert.equal(novos['ATERRO RAMO 1300'].ramo, 'Ramo 1300');
  assert.equal(novos['ATERRO RAMO 1300'].codigoSge, undefined);
  assert.equal(novos['PÁTIO CENTRAL'].tipoLocal, 'Estoque');
  assert.equal(novos['PEDREIRA NOVA'].tipoLocal, 'Origem', 'só veio como origem');
  const depois = [...etapas, ...Object.values(novos)];
  assert.deepEqual(nomesSemLocal(movimentos, depois), [], 'depois de criados, todos contam em algum local');
});

test('a lista SGE não traz de volta o local que foi para a Lixeira', () => {
  const plano = planoCargaSge([]);
  const primeiro = plano.novas[0];
  const semEle = planoCargaSge([], undefined, new Set([primeiro.id]));
  assert.equal(semEle.novas.length, plano.novas.length - 1);
  assert.ok(!semEle.novas.some(item => item.id === primeiro.id));
});
