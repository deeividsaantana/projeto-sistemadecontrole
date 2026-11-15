import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlanejamentoItem, RegistroProducao } from '../src/types';
import { resumirAtividade } from '../src/utils/programacao';
import {
  avancoPorServico,
  comRitmo,
  diaUtilNumero,
  estacaEmMetros,
  folgaEmDias,
  produtividade,
  terminoDaObra,
  textoEstaca,
  trechosPorFrente,
} from '../src/utils/avancoObra';

const item = (extra: Partial<PlanejamentoItem> = {}): PlanejamentoItem => ({
  id: 'a1', dataInicio: '2026-11-12', dataFim: '2026-11-19', servicoId: 's', servicoDescricao: 'GUIA',
  unidade: 'M', quantidadePlanejada: 157, frente: 'RAMO 1400', responsavel: 'SILLAME', situacao: 'Planejado',
  estacaInicial: '1401+10', estacaFinal: '1409+7', ativo: true, criadoEm: '', atualizadoEm: '', ...extra,
});
const lanc = (data: string, quantidade: number, planejamentoId = 'a1'): RegistroProducao => ({
  id: `${data}-${quantidade}`, data, servicoId: 's', servicoDescricao: 'GUIA', unidade: 'M', quantidade, planejamentoId,
  frente: 'RAMO 1400', responsavel: 'X', ativo: true, criadoEm: '', atualizadoEm: '',
});

test('estaca de 20 m: texto, metros e volta', () => {
  assert.equal(estacaEmMetros('1401+10'), 28030);
  assert.equal(estacaEmMetros(' 1401 + 10,5 '), 28030.5);
  assert.equal(estacaEmMetros('1401'), 28020);
  assert.equal(estacaEmMetros('km 3'), undefined);
  assert.equal(estacaEmMetros(''), undefined);
  assert.equal(textoEstaca(28030), '1401+10');
  assert.equal(textoEstaca(28020), '1401+0');
});

test('dia útil e folga pulam domingo', () => {
  assert.equal(diaUtilNumero('2026-11-14', 2), '2026-11-16', 'sábado conta, domingo não');
  assert.equal(diaUtilNumero('2026-11-15', 1), '2026-11-16');
  assert.equal(folgaEmDias('2026-11-19', '2026-11-20'), -1);
  assert.equal(folgaEmDias('2026-11-19', '2026-11-17'), 2);
  assert.equal(folgaEmDias('2026-11-19', '2026-11-19'), 0);
});

test('produtividade: média, desempenho e término pelo ritmo real', () => {
  const producao = [lanc('2026-11-13', 44)];
  const resumo = resumirAtividade(item(), producao, '2026-11-14');
  const ritmo = produtividade(resumo, producao, '2026-11-14');
  assert.equal(ritmo.diasTrabalhados, 2, 'dias 12 e 13; hoje ainda sem lançamento');
  assert.equal(ritmo.mediaDiaria, 22);
  assert.equal(Math.round(ritmo.desempenho!), 96);
  assert.equal(ritmo.termino, '2026-11-20', 'faltam 113 m a 22 m/dia = 6 dias úteis a partir de hoje');
  assert.equal(ritmo.folga, -1);
  assert.equal(ritmo.extensao, 157);

  const parada = produtividade(resumirAtividade(item(), [], '2026-11-14'), [], '2026-11-14');
  assert.equal(parada.termino, undefined, 'começou e não produziu: sem projeção');

  const futura = produtividade(resumirAtividade(item({ dataInicio: '2026-11-20', dataFim: '2026-11-25' }), [], '2026-11-14'), [], '2026-11-14');
  assert.equal(futura.termino, '2026-11-25');
  assert.equal(futura.folga, 0);

  const feita = [lanc('2026-11-13', 100), lanc('2026-11-16', 57)];
  const concluida = produtividade(resumirAtividade(item(), feita, '2026-11-18'), feita, '2026-11-18');
  assert.equal(concluida.termino, '2026-11-16');
  assert.equal(concluida.folga, 3);
});

test('avanço por serviço soma as frentes; trecho por frente usa as estacas', () => {
  const producao = [lanc('2026-11-13', 44), lanc('2026-11-13', 10, 'b')];
  const resumos = [
    resumirAtividade(item(), producao, '2026-11-14'),
    resumirAtividade(item({ id: 'b', frente: 'RAMO 200A', quantidadePlanejada: 43, estacaInicial: '', estacaFinal: '' }), producao, '2026-11-14'),
    resumirAtividade(item({ id: 'c', servicoDescricao: 'SARJETA' }), producao, '2026-11-14'),
  ];
  const atividades = comRitmo(resumos, producao, '2026-11-14');
  const servicos = avancoPorServico(atividades, '2026-11-14');
  assert.deepEqual(servicos.map(s => s.servico), ['GUIA', 'SARJETA']);
  assert.equal(servicos[0].quantidade, 200);
  assert.equal(servicos[0].executado, 54);
  assert.deepEqual(servicos[0].frentes, ['RAMO 200A', 'RAMO 1400']);
  assert.equal(servicos[1].termino, undefined, 'SARJETA não produziu nada');

  const trechos = trechosPorFrente(atividades);
  const ramo1400 = trechos.find(t => t.frente === 'RAMO 1400')!;
  assert.equal(ramo1400.de, 28030);
  assert.equal(ramo1400.ate, 28187);
  assert.equal(trechos.find(t => t.frente === 'RAMO 200A')!.semEstaca.length, 1);

  const obra = terminoDaObra(atividades)!;
  assert.equal(obra.planejado, '2026-11-19');
  assert.equal(obra.projetado, undefined);
  assert.equal(obra.semRitmo, 1);
});

test('atividade da primeira carga sem estaca recebe as estacas da planilha original', async () => {
  const { INITIAL_PROGRAMACAO, completarEstacasDaCarga } = await import('../src/utils/initialProgramacaoData');
  const guia = INITIAL_PROGRAMACAO.itens.find(item => item.servicoDescricao === 'GUIA')!;
  const semEstaca = { ...guia, estacaInicial: undefined, estacaFinal: undefined };
  assert.equal(completarEstacasDaCarga(semEstaca).estacaInicial, '1401+10');
  assert.equal(completarEstacasDaCarga({ ...guia, estacaInicial: '1500+0' }).estacaInicial, '1500+0', 'estaca informada pela pessoa vale');
  assert.equal(completarEstacasDaCarga(item({ id: 'outra', estacaInicial: undefined, estacaFinal: undefined })).estacaInicial, undefined);
});
