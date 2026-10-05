import assert from 'node:assert/strict';
import test from 'node:test';
import { juntarPresencaBaixada, presencasFaltantes, resumoRecuperadas } from '../src/utils/presencaRecuperacao';
import type { PeriodoArquivado, PresencaApontamento } from '../src/types';

const registro = (funcionarioId: string, data: string, status: string, extra: Partial<PresencaApontamento> = {}) => ({
  id: `${funcionarioId}-${data}`, grupoId: 'g-1', data, funcionarioId, status, ...extra,
}) as PresencaApontamento;

test('a recuperação não desfaz a correção feita no painel', () => {
  const local = [registro('c-1', '2026-09-20', 'Ausente')];
  const fila = [registro('c-1', '2026-09-20', 'Presente')];
  assert.deepEqual(presencasFaltantes(local, fila), []);
});

test('a recuperação traz de volta o dia que sumiu', () => {
  const local = [registro('c-1', '2026-09-20', 'Presente')];
  const fila = [registro('c-1', '2026-09-20', 'Presente'), registro('c-1', '2026-09-21', 'Presente')];
  assert.deepEqual(presencasFaltantes(local, fila).map(item => item.data), ['2026-09-21']);
});

test('a recuperação não ressuscita presença de período arquivado', () => {
  const arquivado = { dados: { presencasLink: [registro('c-1', '2026-08-10', 'Presente')] } } as Pick<PeriodoArquivado, 'dados'>;
  const fila = [registro('c-1', '2026-08-10', 'Presente')];
  assert.deepEqual(presencasFaltantes([], fila, [arquivado]), []);
});

test('envio repetido na fila entra uma vez só', () => {
  const fila = [registro('c-1', '2026-09-21', 'Presente'), registro('c-1', '2026-09-21', 'Ausente')];
  assert.equal(presencasFaltantes([], fila).length, 1);
});

test('o aviso diz de qual equipe e dia veio o que foi recuperado', () => {
  const fila = [
    registro('c-1', '2026-09-21', 'Presente', { grupoNome: 'Equipe do Renilson' }),
    registro('c-2', '2026-09-21', 'Presente', { grupoNome: 'Equipe do Renilson' }),
  ];
  assert.equal(resumoRecuperadas(fila), 'Equipe do Renilson em 21/09/2026 (2)');
});

test('apontamento com o mesmo id não volta como cópia, mesmo se a equipe mudou', () => {
  const local = [registro('c-1', '2026-09-20', 'Presente', { id: 'p-1', grupoId: 'g-novo' })];
  const fila = [registro('c-1', '2026-09-20', 'Presente', { id: 'p-1', grupoId: 'g-antigo' })];
  assert.deepEqual(presencasFaltantes(local, fila), []);
});

test('download da nuvem não apaga presença lançada aqui que ainda não subiu', () => {
  const nuvem = [registro('c-9', '2026-09-01', 'Presente'), registro('c-8', '2026-09-01', 'Presente'), registro('c-1', '2026-09-25', 'Presente')];
  const local = [registro('c-1', '2026-09-25', 'Presente'), registro('c-2', '2026-09-25', 'Presente')];
  const resultado = juntarPresencaBaixada(nuvem, local, ['c-1-2026-09-25']);
  assert.deepEqual(resultado.map(item => item.id).sort(), ['c-1-2026-09-25', 'c-2-2026-09-25', 'c-8-2026-09-01', 'c-9-2026-09-01']);
});

test('presença que saiu da nuvem depois da última sincronização sai daqui também', () => {
  const local = [registro('c-1', '2026-09-25', 'Presente')];
  assert.deepEqual(juntarPresencaBaixada([], local, ['c-1-2026-09-25']), []);
});
