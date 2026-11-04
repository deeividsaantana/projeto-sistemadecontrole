import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { clearAllShortcuts, findShortcut } from '../src/hooks/useKeyboardShortcuts';
import { registrarAtalhosDoQuadro, type AcoesAtalhoQuadro } from '../src/components/quadroFrota/atalhosQuadro';
import type { GrupoStatus } from '../src/modules/frota/quadroFrota';

const quadro = readFileSync(new URL('../src/components/quadroFrota/QuadroFrota.tsx', import.meta.url), 'utf-8');
const cartao = readFileSync(new URL('../src/components/quadroFrota/CartaoArrastavel.tsx', import.meta.url), 'utf-8');

const tecla = (key: string, extra: Partial<Parameters<typeof findShortcut>[0]> = {}) =>
  ({ key, code: '', ctrlKey: false, metaKey: false, altKey: false, target: null, ...extra });

const montar = () => {
  const chamadas: string[] = [];
  const acoes: AcoesAtalhoQuadro = {
    focarBusca: () => chamadas.push('busca'),
    abrirAjuda: () => chamadas.push('ajuda'),
    atualizarPendentes: () => chamadas.push('pendentes'),
    alternarVista: () => chamadas.push('vista'),
    alternarGrupo: (grupo: GrupoStatus) => chamadas.push(`grupo:${grupo}`),
    limparFiltros: () => chamadas.push('limpar'),
  };
  clearAllShortcuts();
  registrarAtalhosDoQuadro(() => acoes);
  const apertar = (key: string, extra: Partial<Parameters<typeof findShortcut>[0]> = {}) => {
    const evento = tecla(key, extra);
    findShortcut(evento, 'frotas')?.callback(evento as unknown as KeyboardEvent);
  };
  return { chamadas, apertar };
};

test('quadroFrota: "/" foca a busca e "?" abre a lista de atalhos', () => {
  const { chamadas, apertar } = montar();
  apertar('/');
  apertar('?');
  assert.deepEqual(chamadas, ['busca', 'ajuda']);
});

test('quadroFrota: 1 a 4 filtram a situação, L limpa, A e V valem com Caps Lock', () => {
  const { chamadas, apertar } = montar();
  ['1', '2', '3', '4', 'L', 'A', 'V'].forEach(key => apertar(key));
  assert.deepEqual(chamadas, ['grupo:operando', 'grupo:manutencao', 'grupo:parado', 'grupo:sem-lancamento', 'limpar', 'pendentes', 'vista']);
});

test('quadroFrota: atalho não rouba Ctrl+V/Ctrl+A nem a digitação em campos', () => {
  const { chamadas, apertar } = montar();
  apertar('v', { ctrlKey: true });
  apertar('a', { metaKey: true });
  apertar('l', { altKey: true });
  apertar('/', { target: { tagName: 'INPUT' } as unknown as EventTarget });
  apertar('1', { target: { tagName: 'SELECT' } as unknown as EventTarget });
  apertar('v', { target: { tagName: 'DIV', isContentEditable: true } as unknown as EventTarget });
  assert.deepEqual(chamadas, []);
  assert.equal(findShortcut(tecla('/'), 'presenca'), undefined, 'atalho da frota não vale em outra aba');
});

test('quadroFrota: cada tecla usa as ações da hora, não as de quando registrou', () => {
  const chamadas: string[] = [];
  let versao = 1;
  clearAllShortcuts();
  registrarAtalhosDoQuadro(() => ({
    focarBusca: () => chamadas.push(`busca v${versao}`),
    abrirAjuda: () => {}, atualizarPendentes: () => {}, alternarVista: () => {}, alternarGrupo: () => {}, limparFiltros: () => {},
  }));
  versao = 2;
  findShortcut(tecla('/'), 'frotas')?.callback({} as KeyboardEvent);
  assert.deepEqual(chamadas, ['busca v2']);
});

test('quadroFrota: usa o registro global, desligado com painel, ajuda ou seleção abertos', () => {
  assert.match(quadro, /useKeyboardShortcuts\('frotas', !aberto && !atalhosAberto && !modoSelecao\)/);
  assert.match(quadro, /registrarAtalhosDoQuadro\(\(\) => acoesAtalho\.current!\)/);
  assert.doesNotMatch(quadro, /document\.addEventListener\('keydown'/, 'sem um segundo ouvinte de teclas duplicando o registro');
  assert.match(quadro, /alternarVista: \(\) => \{ if \(podeEditar\)/, 'V só troca a vista para quem pode lançar');
  assert.match(quadro, /atualizarPendentes: \(\) => \{ if \(podeEditar\)/, 'A só abre pendentes para quem pode lançar');
  assert.equal((quadro.match(/title="Atalhos do teclado"/g) || []).length, 1, 'uma lista de atalhos só');
});

test('quadroFrota: cartão arrastado levanta em vez de ficar apagado', () => {
  assert.match(cartao, /\$\{isDragging \? ARRASTANDO : ''\}/);
  assert.match(cartao, /ARRASTANDO = '[^']*scale-\[1\.04\][^']*motion-reduce:rotate-0[^']*ring-emerald-400/);
  assert.doesNotMatch(cartao, /opacity-40/);
});
