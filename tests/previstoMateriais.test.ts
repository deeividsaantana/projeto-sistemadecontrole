import assert from 'node:assert/strict';
import test from 'node:test';
import type { EtapaServico, MovimentoMaterial, PrevistoMaterial } from '../src/types';
import { planoCargaSge } from '../src/modules/materials/locaisSge';
import {
  acompanharMes,
  chaveUnidade,
  copiarPrevistos,
  nomeDoMes,
  ramoDoLocal,
  ramosDaObra,
  somarMes,
  validarPrevisto,
} from '../src/modules/materials/previstoMateriais';

const etapas = planoCargaSge([]).novas;

const mov = (id: string, data: string, destino: string, quantidade: number, extra: Partial<MovimentoMaterial> = {}): MovimentoMaterial => ({
  id, data, tipo: 'Entrada', materialId: 'rachao', materialDescricao: 'RACHÃO PRIMÁRIO', quantidade, unidade: 't', destino, responsavel: 'x', criadoEm: id, ...extra,
});

const previsto = (extra: Partial<PrevistoMaterial> = {}): PrevistoMaterial => ({
  id: 'p1', mes: '2026-09', ramo: 'Ramo 900', materialId: 'rachao', materialDescricao: 'RACHÃO PRIMÁRIO', unidade: 't', quantidade: 40,
  responsavel: 'x', ativo: true, criadoEm: '2026-09-01', atualizadoEm: '2026-09-01', ...extra,
});

test('mês: soma, vira o ano e tem nome por extenso', () => {
  assert.equal(somarMes('2026-12', 1), '2027-01');
  assert.equal(somarMes('2026-01', -1), '2025-12');
  assert.equal(nomeDoMes('2026-09'), 'setembro de 2026');
  assert.equal(chaveUnidade('T'), chaveUnidade('ton'));
  assert.equal(chaveUnidade('m3'), chaveUnidade('m³'));
});

test('cada frente soma no ramo a que pertence, e os ramos saem na ordem do número', () => {
  const espinha = etapas.find(item => item.nome === 'Espinha Ramo 900');
  assert.equal(ramoDoLocal(espinha), 'Ramo 900');
  assert.equal(ramoDoLocal({ id: 'velho', nome: 'RAMO 900' }), 'RAMO 900', 'cadastro antigo sem tipo ainda é ramo');
  assert.equal(ramoDoLocal({ id: 'x', nome: 'Pedreira', tipoLocal: 'Origem' }), undefined);
  const ramos = ramosDaObra(etapas);
  assert.ok(ramos.indexOf('Ramo 900') < ramos.indexOf('Ramo 1400'));
  assert.equal(new Set(ramos).size, ramos.length);
});

test('40 t previstas no Ramo 900: frentes, apelidos e vínculo gravado somam; o resto fica de fora', () => {
  const movimentos = [
    mov('a', '2026-09-02', 'CS RAMO 900', 10),
    mov('b', '2026-09-03', 'ESPINHA RAMO 900', 6),
    mov('c', '2026-09-04', 'LUGAR DESCONHECIDO', 5, { etapaServicoId: 'etapa-sge-102' }),
    mov('d', '2026-09-05', 'CS RAMO 900', 50, { canceladoEm: '2026-09-06' }),
    mov('e', '2026-08-30', 'CS RAMO 900', 50),
    mov('f', '2026-09-05', 'CS RAMO 500 (MARGINAL)', 8),
    mov('g', '2026-09-06', 'CS RAMO 900', 3, { unidade: 'm³' }),
    mov('h', '2026-09-07', 'RAMO 900', 2, { tipo: 'Saída', finalidade: 'Consumo' }),
  ];
  const { linhas, semPrevisto } = acompanharMes({ mes: '2026-09', hoje: '2026-09-15', previstos: [previsto()], movimentos, etapas });
  assert.equal(linhas.length, 1);
  const [linha] = linhas;
  assert.equal(linha.recebido, 21);
  assert.equal(linha.entregas, 3);
  assert.equal(linha.aplicado, 2);
  assert.equal(linha.porcentagem, 52.5);
  assert.equal(linha.esperadoAteHoje, 20);
  assert.equal(linha.situacao, 'no-ritmo');
  assert.equal(linha.foraDaUnidade, 1, 'entrega em m³ não mistura com t');
  assert.equal(linha.ultimaEntrega, '2026-09-04');
  assert.deepEqual(semPrevisto.map(item => [item.ramo, item.recebido]), [['Ramo 500', 8]]);
});

test('situação do previsto conforme o mês e o ritmo', () => {
  const situacao = (mes: string, hoje: string, recebido: number) => acompanharMes({
    mes, hoje, previstos: [previsto({ mes })], etapas,
    movimentos: recebido ? [mov('a', `${mes}-01`, 'CS RAMO 900', recebido)] : [],
  }).linhas[0].situacao;
  assert.equal(situacao('2026-10', '2026-09-15', 0), 'futuro');
  assert.equal(situacao('2026-09', '2026-09-03', 0), 'sem-chegada');
  assert.equal(situacao('2026-09', '2026-09-20', 0), 'abaixo');
  assert.equal(situacao('2026-09', '2026-09-15', 10), 'abaixo');
  assert.equal(situacao('2026-09', '2026-09-15', 40), 'atingido');
  assert.equal(situacao('2026-09', '2026-09-15', 45), 'passou');
  assert.equal(situacao('2026-08', '2026-09-15', 30), 'faltou');
});

test('previsto repetido é recusado e o previsto tirado não conta', () => {
  const atuais = [previsto()];
  assert.match(validarPrevisto({ id: 'novo', mes: '2026-09', ramo: 'RAMO 900', materialId: 'rachao', quantidade: 10 }, atuais), /Já existe previsto/);
  assert.equal(validarPrevisto({ id: 'p1', mes: '2026-09', ramo: 'Ramo 900', materialId: 'rachao', quantidade: 50 }, atuais), '', 'editar o próprio pode');
  assert.equal(validarPrevisto({ id: 'novo', mes: '2026-09', ramo: 'Ramo 900', materialId: 'rachao', quantidade: 10 }, [previsto({ ativo: false })]), '');
  assert.match(validarPrevisto({ id: 'novo', mes: '2026-09', ramo: 'Ramo 900', materialId: 'rachao', quantidade: 0 }, []), /maior que zero/);
  assert.equal(acompanharMes({ mes: '2026-09', hoje: '2026-09-15', previstos: [previsto({ ativo: false })], movimentos: [], etapas }).linhas.length, 0);
});

test('copiar do mês anterior traz só o que ainda não existe', () => {
  const atuais = [previsto(), previsto({ id: 'p2', materialId: 'brita', materialDescricao: 'BRITA 1' }), previsto({ id: 'p3', mes: '2026-10' })];
  let n = 0;
  const copiados = copiarPrevistos(atuais, '2026-09', '2026-10', 'Deivid', '2026-10-01T10:00:00Z', () => `novo-${++n}`);
  assert.deepEqual(copiados.map(item => [item.id, item.mes, item.materialId, item.quantidade]), [['novo-1', '2026-10', 'brita', 40]]);
});
