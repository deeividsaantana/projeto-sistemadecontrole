import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  registerShortcut,
  getShortcutsForContext,
  clearAllShortcuts,
} from '../src/hooks/useKeyboardShortcuts';

test('registra shortcut corretamente', () => {
  clearAllShortcuts();
  const callback = () => {};
  registerShortcut('/', callback, 'frotas', 'Buscar');

  const frotas = getShortcutsForContext('frotas');
  assert.equal(frotas.length, 1);
  assert.equal(frotas[0].key, '/');
  assert.equal(frotas[0].description, 'Buscar');
  assert.equal(frotas[0].context, 'frotas');
});

test('retorna shortcuts do contexto correto', () => {
  clearAllShortcuts();
  const cb1 = () => {};
  const cb2 = () => {};
  registerShortcut('/', cb1, 'frotas', 'Buscar Frotas');
  registerShortcut('n', cb2, 'presenca', 'Novo');

  const frota = getShortcutsForContext('frotas');
  assert.equal(frota.length, 1);
  assert.equal(frota[0].key, '/');
  assert.equal(frota[0].description, 'Buscar Frotas');
});

test('inclui shortcuts globais em todos os contextos', () => {
  clearAllShortcuts();
  const globalCallback = () => {};
  const frotasCallback = () => {};

  registerShortcut('?', globalCallback, 'global', 'Ajuda');
  registerShortcut('/', frotasCallback, 'frotas', 'Buscar');

  const frotas = getShortcutsForContext('frotas');
  assert.equal(frotas.length, 2);
  assert.ok(frotas.find((s) => s.context === 'global'));
  assert.ok(frotas.find((s) => s.context === 'frotas'));

  const presenca = getShortcutsForContext('presenca');
  assert.equal(presenca.length, 1);
  assert.equal(presenca[0].key, '?');
});

test('suporta múltiplos shortcuts em um contexto', () => {
  clearAllShortcuts();
  const callbacks = [() => {}, () => {}, () => {}, () => {}];

  registerShortcut('/', callbacks[0], 'frotas', 'Buscar');
  registerShortcut('?', callbacks[1], 'frotas', 'Ajuda');
  registerShortcut('A', callbacks[2], 'frotas', 'Adicionar');
  registerShortcut('V', callbacks[3], 'frotas', 'Visualizar');

  const frotas = getShortcutsForContext('frotas');
  assert.equal(frotas.length, 4);
  assert.deepEqual(frotas.map((s) => s.key), ['/', '?', 'A', 'V']);
});

test('permite sobrescrever um shortcut existente', () => {
  clearAllShortcuts();
  const callback1 = () => {};
  const callback2 = () => {};

  registerShortcut('/', callback1, 'frotas', 'Buscar v1');
  let frotas = getShortcutsForContext('frotas');
  assert.equal(frotas[0].description, 'Buscar v1');

  registerShortcut('/', callback2, 'frotas', 'Buscar v2');
  frotas = getShortcutsForContext('frotas');
  assert.equal(frotas.length, 1);
  assert.equal(frotas[0].description, 'Buscar v2');
  assert.equal(frotas[0].callback, callback2);
});

test('limpa todos os shortcuts com clearAllShortcuts', () => {
  clearAllShortcuts();
  registerShortcut('/', () => {}, 'frotas', 'Buscar');
  registerShortcut('n', () => {}, 'presenca', 'Novo');

  let frotas = getShortcutsForContext('frotas');
  assert.equal(frotas.length, 1);

  clearAllShortcuts();

  frotas = getShortcutsForContext('frotas');
  assert.equal(frotas.length, 0);
});

test('retorna atalhos sem duplicatas', () => {
  clearAllShortcuts();
  const callback = () => {};
  registerShortcut('/', callback, 'frotas', 'Buscar');
  registerShortcut('/', callback, 'frotas', 'Buscar');

  const frotas = getShortcutsForContext('frotas');
  assert.equal(frotas.length, 1);
});

test('armazena callbacks corretamente', () => {
  clearAllShortcuts();
  const callback = () => {};
  registerShortcut('/', callback, 'frotas', 'Buscar');

  const frotas = getShortcutsForContext('frotas');
  assert.equal(frotas[0].callback, callback);
});

test('suporta shortcuts com teclas numéricas', () => {
  clearAllShortcuts();
  const callbacks = [() => {}, () => {}, () => {}, () => {}];

  registerShortcut('1', callbacks[0], 'frotas', 'Painel 1');
  registerShortcut('2', callbacks[1], 'frotas', 'Painel 2');
  registerShortcut('3', callbacks[2], 'frotas', 'Painel 3');
  registerShortcut('4', callbacks[3], 'frotas', 'Painel 4');

  const frotas = getShortcutsForContext('frotas');
  assert.equal(frotas.filter((s) => /^\d$/.test(s.key)).length, 4);
});

test('suporta vários contextos simultaneamente', () => {
  clearAllShortcuts();
  registerShortcut('/', () => {}, 'frotas', 'Buscar Frota');
  registerShortcut('/', () => {}, 'presenca', 'Buscar Presença');
  registerShortcut('/', () => {}, 'relatorios', 'Buscar Relatório');

  const frotas = getShortcutsForContext('frotas');
  const presenca = getShortcutsForContext('presenca');
  const relatorios = getShortcutsForContext('relatorios');

  assert.equal(frotas.length, 1);
  assert.equal(presenca.length, 1);
  assert.equal(relatorios.length, 1);

  assert.equal(frotas[0].description, 'Buscar Frota');
  assert.equal(presenca[0].description, 'Buscar Presença');
  assert.equal(relatorios[0].description, 'Buscar Relatório');
});

test('shortcuts globais aparecem em todos os contextos', () => {
  clearAllShortcuts();
  registerShortcut('?', () => {}, 'global', 'Ajuda');
  registerShortcut('L', () => {}, 'global', 'Log');

  const contextos: Array<'frotas' | 'presenca' | 'relatorios' | 'global'> = [
    'frotas',
    'presenca',
    'relatorios',
    'global',
  ];

  contextos.forEach((contexto) => {
    const shortcuts = getShortcutsForContext(contexto);
    const globalShortcuts = shortcuts.filter((s) => s.context === 'global');
    assert.equal(globalShortcuts.length, 2);
  });
});

test('cada atalho faz uma coisa só', () => {
  const ler = (arquivo: string) => readFileSync(new URL(`../src/${arquivo}`, import.meta.url), 'utf8');
  assert.doesNotMatch(ler('app/shell/DesktopTopBar.tsx'), /toLowerCase\(\) === 'k'/, 'Ctrl+K é só da pesquisa geral');
  const pesquisa = ler('app/shell/PesquisaGlobal.tsx');
  assert.match(pesquisa, /if \(!evento\.defaultPrevented\) setAberto\(true\)/, 'barra é da busca da tela quando ela existe');
  assert.match(ler('components/combustivel/LancamentoCombustivel.tsx'), /event\.key === 'Enter' \|\| event\.key\.toLowerCase\(\) === 's'/, 'Combustível salva com Ctrl+Enter');
});
