import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { __testing } from '../netlify/functions/public-presenca.js';

const submission = (data: string, records: Array<Record<string, unknown>>) => ({
  kind: 'presence',
  payload: { grupoId: 'group-1', data, records },
});

test('historico do link agrupa os envios por data, do mais recente para o mais antigo', () => {
  const { byDate, datas } = __testing.indexGroupHistory([
    submission('2026-08-31', [{ funcionarioId: 'employee-1', status: 'Presente' }]),
    submission('2026-09-02', [{ funcionarioId: 'employee-1', status: 'Ausente' }]),
    submission('2026-09-01', [{ funcionarioId: 'employee-1', status: 'Atestado' }]),
  ]);

  assert.deepEqual(datas, ['2026-09-02', '2026-09-01', '2026-08-31']);
  assert.equal(byDate.get('2026-09-01')?.[0].status, 'Atestado');
  assert.equal(byDate.get('2026-09-02')?.[0].status, 'Ausente');
});

test('historico ignora envios de outro tipo e datas invalidas', () => {
  const { datas } = __testing.indexGroupHistory([
    submission('2026-09-02', [{ funcionarioId: 'employee-1', status: 'Presente' }]),
    { kind: 'apontamento', payload: { grupoId: 'group-1', data: '2026-09-01', records: [] } },
    submission('2026-02-30', [{ funcionarioId: 'employee-1', status: 'Presente' }]),
    submission('', [{ funcionarioId: 'employee-1', status: 'Presente' }]),
  ]);

  assert.deepEqual(datas, ['2026-09-02']);
});

test('historico limita a janela consultavel pelo link publico', () => {
  const documents = Array.from({ length: 45 }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return submission(`2026-0${index < 31 ? '1' : '2'}-${index < 31 ? day : String(index - 30).padStart(2, '0')}`, []);
  });
  const { datas } = __testing.indexGroupHistory(documents);
  assert.ok(datas.length <= 30, `esperava no maximo 30 dias, recebeu ${datas.length}`);
});

test('a edicao pontual continua restrita ao dia corrente', () => {
  const source = readFileSync(new URL('../netlify/functions/public-presenca.js', import.meta.url), 'utf8');
  const patchBlock = source.slice(source.indexOf("if (method === 'PATCH')"), source.indexOf("if (method !== 'POST')"));
  assert.match(patchBlock, /const date = todayInSaoPaulo\(\);/);
  assert.doesNotMatch(patchBlock, /body\.data/);
});

test('a interface bloqueia edicao ao consultar um dia anterior', () => {
  const source = readFileSync(new URL('../src/components/PresencaTempoRealPublica.tsx', import.meta.url), 'utf8');
  assert.match(source, /const viewingPastDay = Boolean\(dataSelecionada && dataAtual && dataSelecionada !== dataAtual\)/);
  assert.match(source, /if \(!group \|\| viewingPastDay\) return;/);
  assert.match(source, /Dia anterior: consulta apenas/);
});
