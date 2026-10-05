import assert from 'node:assert/strict';
import test from 'node:test';
import type { MovimentoMaterial } from '../src/types';
import { SEM_NOME, enviosDoCampo, mensagemDoLink, resumoPorApontador, semEnvioNoDia } from '../src/modules/materials/apontadores';

const uso = (id: string, envio: string | undefined, extra: Partial<MovimentoMaterial> = {}): MovimentoMaterial => ({
  id, data: '2026-09-20', tipo: 'Saída', finalidade: 'Consumo', materialId: 'tubo', materialDescricao: 'TUBO 300', quantidade: 6, unidade: 'm',
  etapaServicoNome: 'Ramo 900', origemApontamentoId: envio, apontadoPor: 'João', responsavel: 'João', criadoEm: `2026-09-20T1${id.length}:00:00Z`, ...extra,
});

const movimentos = [
  uso('a1', 'e1', { fotos: ['f1.jpg'] }),
  uso('a2', 'e1', { materialDescricao: 'CAIXA', quantidade: 2, unidade: 'un', fotos: ['f1.jpg', 'f2.jpg'] }),
  uso('b1', 'e2', { apontadoPor: ' joão  ', data: '2026-09-21', etapaServicoNome: 'Ramo 200' }),
  uso('c1', 'e3', { apontadoPor: 'Maria', canceladoEm: '2026-09-21T10:00:00Z' }),
  uso('d1', 'e4', { apontadoPor: '', data: '2026-09-19' }),
  uso('x1', undefined, { apontadoPor: 'Escritório' }),
];

test('envios juntam os itens e as fotos do mesmo envio, sem o que foi desfeito', () => {
  const envios = enviosDoCampo(movimentos);
  assert.deepEqual(envios.map(envio => envio.id), ['e2', 'e1', 'e4']);
  const e1 = envios.find(envio => envio.id === 'e1')!;
  assert.equal(e1.itens.length, 2);
  assert.deepEqual(e1.fotos, ['f1.jpg', 'f2.jpg']);
  assert.equal(envios.find(envio => envio.id === 'e4')!.apontador, SEM_NOME);
});

test('envio com parte desfeita mostra só o que vale e guarda todos os movimentos', () => {
  const [e1] = enviosDoCampo([uso('a1', 'e1'), uso('a2', 'e1', { canceladoEm: 'x' })]);
  assert.equal(e1.itens.length, 1);
  assert.equal(e1.movimentos.length, 2);
});

test('filtro por período, apontador (sem ligar para maiúscula e espaço) e ramo', () => {
  assert.deepEqual(enviosDoCampo(movimentos, { de: '2026-09-20', ate: '2026-09-20' }).map(envio => envio.id), ['e1']);
  assert.deepEqual(enviosDoCampo(movimentos, { apontador: 'JOÃO' }).map(envio => envio.id), ['e2', 'e1']);
  assert.deepEqual(enviosDoCampo(movimentos, { ramo: 'ramo 200' }).map(envio => envio.id), ['e2']);
});

test('resumo por apontador junta o mesmo nome e conta dias, fotos e ramos', () => {
  const resumo = resumoPorApontador(enviosDoCampo(movimentos));
  assert.equal(resumo[0].nome, 'joão');
  assert.equal(resumo[0].envios, 2);
  assert.equal(resumo[0].dias, 2);
  assert.equal(resumo[0].comFoto, 1);
  assert.equal(resumo[0].fotos, 2);
  assert.deepEqual(resumo[0].ramos, ['Ramo 200', 'Ramo 900']);
  assert.equal(resumo[0].ultimo, '2026-09-21');
  assert.equal(resumo.length, 2);
});

test('quem ainda não mandou no dia ignora quem não pôs o nome', () => {
  const envios = enviosDoCampo([...movimentos, uso('m1', 'e5', { apontadoPor: 'Maria', data: '2026-09-18' })]);
  assert.deepEqual(semEnvioNoDia(envios, '2026-09-21'), ['Maria']);
  assert.deepEqual(semEnvioNoDia(envios, '2026-09-18'), ['joão']);
});

test('mensagem do link leva o endereço e o passo a passo', () => {
  const texto = mensagemDoLink('https://x/material-link/abc');
  assert.match(texto, /https:\/\/x\/material-link\/abc/);
  assert.match(texto, /Salvar uso/);
});
