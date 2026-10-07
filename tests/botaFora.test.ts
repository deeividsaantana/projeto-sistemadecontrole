import assert from 'node:assert/strict';
import test from 'node:test';
import type { MovimentoMaterial } from '../src/types';
import { planoCargaSge } from '../src/modules/materials/locaisSge';
import { residuoDe, resumirBotaFora, viagensDeBotaFora } from '../src/modules/materials/botaFora';

const viagem = (id: string, extra: Partial<MovimentoMaterial>): MovimentoMaterial => ({
  id, data: '2026-09-10', tipo: 'Transferência', materialId: 'lixo', materialDescricao: 'LIXO (VIAGEM)', quantidade: 1, unidade: 'VIAGEM',
  responsavel: 'x', criadoEm: id, ...extra,
});

// Como a importação grava as abas de bota-fora da planilha de 26/09.
const movimentos: MovimentoMaterial[] = [
  viagem('a', { destino: 'ITAQUAREIA', origem: 'ITAQUAREIA', materialDescricao: 'SOLO CONTAMINADO (VIAGEM)', valorTotal: 245 }),
  viagem('b', { destino: 'ITAQUAREIA', origem: 'ITAQUAREIA', materialDescricao: 'SOLO CONTAMINADO', quantidade: 15, unidade: 'M3', valorTotal: 300 }),
  viagem('c', { destino: 'Q.E. SÃO BENTO', origem: 'BOTA ESPERA RAMO 600', valorTotal: 850 }),
  viagem('d', { destino: 'LARA', origem: 'CS RAMO 600/700', materialDescricao: 'LIXO', quantidade: 13.16, unidade: 't', valorUnitario: 110, data: '2026-08-02' }),
  viagem('e', { destino: 'BOTA FORA LARA', tipo: 'Entrada', materialDescricao: 'SOLO (M3)', quantidade: 2, unidade: 'M3', data: '2026-08-03' }),
  viagem('f', { destino: 'LARA', canceladoEm: '2026-09-11' }),
  viagem('g', { destino: 'CS RAMO 900', tipo: 'Entrada', materialDescricao: 'RACHÃO PRIMÁRIO', quantidade: 20, unidade: 't' }),
];

test('o resíduo sai do nome do material', () => {
  assert.equal(residuoDe('SOLO CONTAMINADO (VIAGEM)'), 'Solo contaminado');
  assert.equal(residuoDe('LIXO'), 'Lixo');
  assert.equal(residuoDe('SOLO (M3)'), 'Solo');
  assert.equal(residuoDe('RACHÃO'), 'Outro');
});

test('só entram viagens a bota-fora, reconhecidas com ou sem a lista SGE carregada', () => {
  for (const etapas of [[], planoCargaSge([]).novas]) {
    const viagens = viagensDeBotaFora(movimentos, etapas);
    assert.deepEqual(viagens.map(item => item.movimento.id).sort(), ['a', 'b', 'c', 'd', 'e']);
  }
});

test('viagens, toneladas, m³ e custo por destino; a origem que repete o aterro não conta', () => {
  const viagens = viagensDeBotaFora(movimentos, []);
  const resumo = resumirBotaFora(viagens);
  assert.equal(resumo.totais.viagens, 5);
  const porNome = Object.fromEntries(resumo.porDestino.map(item => [item.destino.nome, item]));
  assert.equal(porNome.Itaquareia.viagens, 2);
  assert.equal(porNome.Itaquareia.metrosCubicos, 15);
  assert.equal(porNome.Itaquareia.custo, 545);
  assert.equal(porNome.Lara.toneladas, 13.16);
  assert.equal(Math.round(porNome.Lara.custo * 100) / 100, 1447.6, 'sem total, custo = unitário × quantidade');
  assert.deepEqual(porNome.Lara.residuos, [{ residuo: 'Lixo', viagens: 1 }, { residuo: 'Solo', viagens: 1 }]);
  assert.equal(porNome.Lara.ultima, '2026-08-03');

  const itaquareia = resumo.porOrigem.find(item => item.destino === 'Itaquareia');
  assert.equal(itaquareia?.origem, 'Sem origem na planilha');
  const saoBento = resumo.porOrigem.find(item => item.destino === 'São Bento (Q.E.)');
  assert.equal(saoBento?.conhecida, false, 'sem a lista carregada, a bota-espera não é conhecida');

  const comLista = resumirBotaFora(viagensDeBotaFora(movimentos, planoCargaSge([]).novas));
  const comCodigo = comLista.porOrigem.find(item => item.destino === 'São Bento (Q.E.)');
  assert.equal(comCodigo?.conhecida, true);
});

test('o mês escolhido filtra os números, mas o gráfico mostra todos os meses', () => {
  const resumo = resumirBotaFora(viagensDeBotaFora(movimentos, []), '2026-08');
  assert.equal(resumo.totais.viagens, 2);
  assert.deepEqual(resumo.meses, ['2026-08', '2026-09']);
  assert.equal(resumo.porMes.find(item => item.mes === '2026-09')?.total, 3);
});
