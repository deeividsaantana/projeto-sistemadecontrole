import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlanejamentoItem, RegistroProducao } from '../src/types';
import {
  avancoGeral,
  diasDeTrabalho,
  inicioDaSemana,
  metaDiariaDe,
  observacaoSemCarga,
  resumirAtividade,
  textoDoDia,
} from '../src/utils/programacao';

const item = (extra: Partial<PlanejamentoItem> = {}): PlanejamentoItem => ({
  id: 'a1', dataInicio: '2026-11-12', dataFim: '2026-11-19', servicoId: 'servico-guia', servicoDescricao: 'GUIA',
  unidade: 'M', quantidadePlanejada: 157, frente: 'RAMO 1400', responsavel: 'SILLAME', situacao: 'Planejado',
  ativo: true, criadoEm: '', atualizadoEm: '', ...extra,
});

const lanc = (data: string, quantidade: number, extra: Partial<RegistroProducao> = {}): RegistroProducao => ({
  id: `${data}-${quantidade}`, data, servicoId: 'servico-guia', servicoDescricao: 'GUIA', unidade: 'M', quantidade,
  frente: 'RAMO 1400', responsavel: 'X', ativo: true, criadoEm: '', atualizadoEm: '', ...extra,
});

test('dias de trabalho pulam domingo, como a planilha', () => {
  assert.equal(diasDeTrabalho('2026-11-12', '2026-11-19'), 7);
  assert.equal(diasDeTrabalho('2026-11-12', '2026-12-05'), 21);
  assert.equal(diasDeTrabalho('2026-11-15', '2026-11-15'), 1, 'nunca menos de 1');
  assert.equal(diasDeTrabalho('2026-11-16', '2026-11-21'), 6);
});

test('semana começa na segunda; domingo fecha a semana anterior', () => {
  assert.equal(inicioDaSemana('2026-11-14'), '2026-11-09');
  assert.equal(inicioDaSemana('2026-11-15'), '2026-11-09');
  assert.equal(inicioDaSemana('2026-11-16'), '2026-11-16');
});

test('meta por dia: campo, depois o texto da carga original, depois a conta', () => {
  assert.equal(metaDiariaDe(item({ metaDiaria: 30 })), 30);
  assert.equal(metaDiariaDe(item({ observacao: 'Meta diária: 23 M. Estacas de 20 m.' })), 23);
  assert.equal(metaDiariaDe(item()), 23, '157 m em 7 dias = 22,4, arredonda para cima');
  assert.equal(observacaoSemCarga('Meta diária: 23 M. Estacas de 20 m.'), '');
  assert.equal(observacaoSemCarga('Meta diária: 23 M. Estacas de 20 m. Chuva atrasou'), 'Chuva atrasou');
});

test('produção nova conta pela atividade; antiga, por serviço, frente e período', () => {
  const outraFrente = item({ id: 'a2', frente: 'RAMO 200A' });
  const producao = [
    lanc('2026-11-12', 20, { planejamentoId: 'a1' }),
    lanc('2026-11-13', 10),
    lanc('2026-11-13', 99, { frente: 'RAMO 200A', planejamentoId: 'a2' }),
    lanc('2026-11-25', 50),
    lanc('2026-11-13', 5, { ativo: false }),
  ];
  assert.equal(resumirAtividade(item(), producao, '2026-11-14').realizado, 30);
  assert.equal(resumirAtividade(outraFrente, producao, '2026-11-14').realizado, 99);
});

test('situação: programada, em dia, atenção, atrasada, concluída e cancelada', () => {
  assert.equal(resumirAtividade(item(), [], '2026-11-10').situacao, 'programada');
  assert.equal(resumirAtividade(item(), [], '2026-11-12').situacao, 'em-dia', 'primeiro dia ainda não deve nada');
  // Até 13/11 (2 dias de 7) o previsto é 44,9 m.
  assert.equal(resumirAtividade(item(), [lanc('2026-11-13', 44, { planejamentoId: 'a1' })], '2026-11-14').situacao, 'em-dia');
  assert.equal(resumirAtividade(item(), [lanc('2026-11-13', 38, { planejamentoId: 'a1' })], '2026-11-14').situacao, 'atencao');
  assert.equal(resumirAtividade(item(), [lanc('2026-11-13', 10, { planejamentoId: 'a1' })], '2026-11-14').situacao, 'atrasada');
  assert.equal(resumirAtividade(item(), [], '2026-11-20').situacao, 'atrasada', 'passou do término sem terminar');
  assert.equal(resumirAtividade(item(), [lanc('2026-11-13', 157, { planejamentoId: 'a1' })], '2026-11-14').situacao, 'concluida');
  assert.equal(resumirAtividade(item({ situacao: 'Cancelado' }), [], '2026-11-14').situacao, 'cancelada');
});

test('quanto falta por dia para terminar no prazo', () => {
  const resumo = resumirAtividade(item(), [lanc('2026-11-13', 57, { planejamentoId: 'a1' })], '2026-11-14');
  assert.equal(resumo.saldo, 100);
  assert.equal(resumo.diasRestantes, 5, 'sábado, segunda a quinta');
  assert.equal(resumo.precisaPorDia, 20);
});

test('avanço geral pesa pelos dias e ignora canceladas', () => {
  const a = resumirAtividade(item(), [lanc('2026-11-13', 157, { planejamentoId: 'a1' })], '2026-11-14');
  const b = resumirAtividade(item({ id: 'b' }), [], '2026-11-14');
  const c = resumirAtividade(item({ id: 'c', situacao: 'Cancelado' }), [], '2026-11-14');
  assert.equal(Math.round(avancoGeral([a, b, c])), 50);
});

test('texto do WhatsApp agrupa por frente e pula domingo', () => {
  const resumos = [resumirAtividade(item({ estacaInicial: '1401+10', estacaFinal: '1409+7' }), [], '2026-11-14')];
  const texto = textoDoDia(resumos, '2026-11-14');
  assert.match(texto, /\*RAMO 1400\*/);
  assert.match(texto, /GUIA · SILLAME · meta 23 M · est\. 1401\+10 a 1409\+7/);
  assert.match(textoDoDia(resumos, '2026-11-15'), /Nenhum serviço programado/);
});
