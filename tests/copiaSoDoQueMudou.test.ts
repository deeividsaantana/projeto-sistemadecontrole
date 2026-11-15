import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStoredJson } from '../src/data/localStore';
import { registrosDoEspelho, registrosQueMudaram, type CopiaFeita } from '../src/utils/resilientStorage';

const lerDe = (dados: Record<string, string>) => (chave: string) => dados[chave] ?? null;

test('cópia de recuperação: só regrava o que mudou desde a última cópia', () => {
  const dados = { renea_abastecimentos: '[1,2]', renea_presencas_link: '[3]', renea_tema: 'claro' };
  const registros = registrosDoEspelho(Object.keys(dados), lerDe(dados), undefined, 'agora');
  const copiados = new Map<string, CopiaFeita>(registros.map(r => [r.key, { value: r.value, emReserva: false }]));

  assert.deepEqual(registrosQueMudaram(registros, copiados), [], 'nada novo, nada regravado');

  dados.renea_abastecimentos = '[1,2,9]';
  const depois = registrosDoEspelho(Object.keys(dados), lerDe(dados), undefined, 'depois', copiados);
  assert.deepEqual(registrosQueMudaram(depois, copiados).map(r => r.key), ['renea_abastecimentos']);
});

test('cópia de recuperação: valor que passou a ficar na reserva é regravado com a marca', () => {
  const dados = { renea_presencas_link: '[3]' };
  const copiados = new Map<string, CopiaFeita>([['renea_presencas_link', { value: '[3]', emReserva: false }]]);
  const reserva = new Map<string, string | null>([['renea_presencas_link', '[3]']]);
  const registros = registrosDoEspelho([], chave => reserva.get(chave) ?? lerDe(dados)(chave), reserva, 'agora', copiados);
  const mudaram = registrosQueMudaram(registros, copiados);
  assert.equal(mudaram.length, 1);
  assert.equal(mudaram[0].emReserva, true);
});

test('cópia de recuperação: JSON quebrado novo continua fora da cópia', () => {
  const dados = { renea_abastecimentos: '[1,' };
  const copiados = new Map<string, CopiaFeita>([['renea_abastecimentos', { value: '[1]', emReserva: false }]]);
  assert.deepEqual(registrosDoEspelho(Object.keys(dados), lerDe(dados), undefined, 'agora', copiados), []);
});

test('leitura local: uma leitura só e mesmas recusas de antes', () => {
  const original = JSON.parse;
  let leituras = 0;
  JSON.parse = ((texto: string, ...resto: unknown[]) => { leituras += 1; return original(texto, ...(resto as [])); }) as typeof JSON.parse;
  try {
    assert.deepEqual(parseStoredJson('[1,2]', 'renea_abastecimentos', []), [1, 2]);
    assert.equal(leituras, 1);
  } finally {
    JSON.parse = original;
  }
  const errosAntes = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(parseStoredJson('{"a":1}', 'renea_abastecimentos', ['vazio']), ['vazio'], 'objeto onde devia ser lista');
    assert.deepEqual(parseStoredJson('null', 'renea_abastecimentos', ['vazio']), ['vazio']);
    assert.deepEqual(parseStoredJson('[1,', 'renea_abastecimentos', ['vazio']), ['vazio']);
    assert.deepEqual(parseStoredJson('[1]', 'renea_controle_estacas', { ok: true }), { ok: true }, 'lista onde devia ser objeto');
  } finally {
    console.error = errosAntes;
  }
  assert.equal(parseStoredJson('"claro"', 'renea_tema', 'escuro'), 'claro');
  assert.equal(parseStoredJson(null, 'renea_tema', 'escuro'), 'escuro');
});
