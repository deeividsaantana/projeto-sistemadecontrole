import assert from 'node:assert/strict';
import test from 'node:test';
import type { BlocoRotina, ModeloRotina, PendenciaRotina, RotinaDiaria } from '../src/types';
import {
  BLOCOS_CHECKLIST, alternarBloco, alternarItem, blocosDaPessoa, concluidasNoDia, contarPorPrioridade, copiarPadrao, diaFechado,
  moverBloco, moverItem, novoBloco, novoItem, pendenciasAbertas, prioridadesDeOntem, progresso, rotinaVazia, temModeloProprio, tirarBloco,
} from '../src/modules/rotina/checklistDiario';

const pendencia = (id: string, extra: Partial<PendenciaRotina> = {}): PendenciaRotina => ({
  id, titulo: id, prioridade: 'importante', tipo: 'cobrar', dia: '2026-09-20', responsavel: 'Deivid', criadoEm: `2026-09-20T10:00:0${id.length}Z`, atualizadoEm: '2026-09-20T10:00:00Z', ...extra,
});

test('o modelo padrão tem os 15 blocos e nenhum id repetido', () => {
  assert.equal(BLOCOS_CHECKLIST.length, 15);
  const ids = BLOCOS_CHECKLIST.flatMap(bloco => bloco.itens.map(item => item.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(BLOCOS_CHECKLIST.find(bloco => bloco.id === 'fechamento')!.itens.length, 12);
});

test('marcar item e bloco conta o progresso, e o dia só fecha com o fim do dia todo marcado', () => {
  let rotina = rotinaVazia('2026-09-20', ' Deivid ', 'agora');
  assert.equal(rotina.id, '2026-09-20:Deivid');
  rotina = alternarItem(rotina, 'inicio-1');
  assert.equal(progresso(rotina).feitos, 1);
  rotina = alternarItem(rotina, 'inicio-1');
  assert.equal(progresso(rotina).feitos, 0);
  const fim = BLOCOS_CHECKLIST.find(bloco => bloco.id === 'fechamento')!;
  rotina = alternarBloco(rotina, fim);
  assert.equal(progresso(rotina).porBloco.fechamento.feitos, 12);
  assert.equal(diaFechado(rotina), true);
  rotina = alternarBloco(rotina, fim);
  assert.equal(diaFechado(rotina), false);
});

test('cada pessoa tem o próprio checklist e quem nunca montou usa uma cópia do padrão', () => {
  const meu: BlocoRotina[] = [{ ...novoBloco('Drenagem', 'durante'), itens: [novoItem('Conferir bueiro'), novoItem(' Limpar caixa ')] }];
  const modelos: ModeloRotina[] = [{ id: 'Ana', responsavel: 'Ana', blocos: meu, criadoEm: 'x', atualizadoEm: 'x' }];
  assert.equal(blocosDaPessoa(modelos, 'Ana'), meu);
  assert.equal(temModeloProprio(modelos, 'Ana'), true);
  const padrao = blocosDaPessoa(modelos, 'Deivid');
  assert.equal(padrao.length, 15);
  padrao[0].itens.pop();
  assert.equal(BLOCOS_CHECKLIST[0].itens.length, 8, 'mexer na cópia não muda o padrão');
  assert.equal(meu[0].itens[1].texto, 'Limpar caixa');
  assert.notEqual(meu[0].itens[0].id, meu[0].itens[1].id);
});

test('o progresso segue os blocos da pessoa e ignora itens que ela apagou', () => {
  const bloco = { ...novoBloco('Fim', 'fechamento'), itens: [novoItem('RDO'), novoItem('Diesel')] };
  let rotina = rotinaVazia('2026-09-20', 'Ana');
  rotina = { ...rotina, feitos: ['inicio-1', bloco.itens[0].id] };
  assert.deepEqual(progresso(rotina, [bloco]), { feitos: 1, total: 2, percentual: 50, porBloco: { [bloco.id]: { feitos: 1, total: 2 } } });
  assert.equal(diaFechado(rotina, [bloco]), false);
  assert.equal(diaFechado({ feitos: bloco.itens.map(item => item.id) }, [bloco]), true);
  assert.equal(diaFechado({ feitos: [] }, [novoBloco('Sem fim', 'durante')]), false, 'sem bloco de fim do dia o dia não fecha sozinho');
  assert.equal(progresso(rotina, []).percentual, 0);
});

test('subir, descer e apagar blocos e itens', () => {
  const [a, b, c] = copiarPadrao();
  assert.deepEqual(moverBloco([a, b, c], b.id, -1).map(item => item.id), [b.id, a.id, c.id]);
  assert.deepEqual(moverBloco([a, b, c], c.id, 1).map(item => item.id), [a.id, b.id, c.id]);
  assert.deepEqual(tirarBloco([a, b, c], b.id).map(item => item.id), [a.id, c.id]);
  const movido = moverItem(a, a.itens[1].id, -1);
  assert.equal(movido.itens[0].id, 'inicio-2');
  assert.equal(moverItem(a, a.itens[0].id, -1), a);
});

test('pendências abertas passam para os dias seguintes, da mais grave para a mais leve', () => {
  const lista = [
    pendencia('rotina', { prioridade: 'rotina' }),
    pendencia('critica', { prioridade: 'critico', dia: '2026-09-18' }),
    pendencia('vencida', { prazo: '2026-09-19' }),
    pendencia('prazo', { prazo: '2026-09-25' }),
    pendencia('futura', { dia: '2026-09-22' }),
    pendencia('outra pessoa', { responsavel: 'Ana' }),
    pendencia('feita', { concluidaEm: '2026-09-20T12:00:00Z' }),
    pendencia('feita depois', { concluidaEm: '2026-09-21T12:00:00Z' }),
    pendencia('apagada', { excluidaEm: '2026-09-20T12:00:00Z' }),
  ];
  assert.deepEqual(pendenciasAbertas(lista, '2026-09-20', 'Deivid').map(item => item.id), ['critica', 'vencida', 'prazo', 'feita depois', 'rotina']);
  assert.deepEqual(concluidasNoDia(lista, '2026-09-20', 'Deivid').map(item => item.id), ['feita']);
  assert.deepEqual(contarPorPrioridade(pendenciasAbertas(lista, '2026-09-20', 'Deivid')), { critico: 1, importante: 3, acompanhar: 0, rotina: 1 });
});

test('as prioridades de amanhã aparecem no dia seguinte, vindas do último dia que tem', () => {
  const dia = (data: string, amanha: string[]): RotinaDiaria => ({ ...rotinaVazia(data, 'Deivid'), amanha });
  const rotinas = [dia('2026-09-18', ['Velha']), dia('2026-09-19', [' Cobrar nota ', '', 'Ir ao Ramo 900']), dia('2026-09-20', ['', '', ''])];
  assert.deepEqual(prioridadesDeOntem(rotinas, '2026-09-21', 'Deivid'), { dia: '2026-09-19', itens: ['Cobrar nota', 'Ir ao Ramo 900'] });
  assert.equal(prioridadesDeOntem(rotinas, '2026-09-18', 'Deivid'), null);
  assert.equal(prioridadesDeOntem(rotinas, '2026-09-21', 'Ana'), null);
});
