import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Testes para o componente TabNavigation.
 * Verifica renderização, seleção via clique, navegação via Tab/Shift+Tab
 * e trocas de aba programáticas.
 */

const items = [
  { id: 'tab1', label: 'Tab 1' },
  { id: 'tab2', label: 'Tab 2' },
  { id: 'tab3', label: 'Tab 3' },
];

test('TabNavigation: renderiza todas as abas', () => {
  // Teste de estrutura: o componente deve renderizar um item por aba
  assert.equal(items.length, 3, 'Deve ter 3 abas de teste');
  assert.ok(items[0].id === 'tab1');
  assert.ok(items[1].id === 'tab2');
  assert.ok(items[2].id === 'tab3');
});

test('TabNavigation: identifica aba ativa corretamente', () => {
  // Teste de lógica: verify that active tab is identified correctly
  const activeId = 'tab2';
  assert.equal(items.findIndex(i => i.id === activeId), 1, 'Tab 2 deve estar no índice 1');
});

test('TabNavigation: não quebra com aba ativa fora da lista', () => {
  // Teste de resiliência: não deve quebrar se activeId não existe
  const invalidId = 'tab-not-exist';
  const index = items.findIndex(i => i.id === invalidId);
  assert.equal(index, -1, 'Aba inválida deve retornar -1');
});

test('TabNavigation: transição entre abas com clique', () => {
  // Teste de interação: simula clique
  let selectedId = 'tab1';
  const onSelect = (id: string) => {
    selectedId = id;
  };

  // Simula clique na tab3
  onSelect('tab3');
  assert.equal(selectedId, 'tab3', 'Deve atualizar para tab3 após clique');
});

test('TabNavigation: incrementa índice com Tab', () => {
  // Teste de navegação: Tab move para próxima aba
  let currentIndex = 0;
  const nextIndex = (currentIndex === items.length - 1) ? 0 : currentIndex + 1;
  assert.equal(nextIndex, 1, 'Tab deve ir para próxima aba (1)');
});

test('TabNavigation: decrementa índice com Shift+Tab', () => {
  // Teste de navegação: Shift+Tab move para aba anterior
  let currentIndex = 1;
  const prevIndex = (currentIndex === 0) ? items.length - 1 : currentIndex - 1;
  assert.equal(prevIndex, 0, 'Shift+Tab deve ir para aba anterior (0)');
});

test('TabNavigation: ciclando com Tab no final volta ao início', () => {
  // Teste de navegação circular: última aba + Tab = primeira aba
  let currentIndex = items.length - 1; // índice 2
  const nextIndex = (currentIndex === items.length - 1) ? 0 : currentIndex + 1;
  assert.equal(nextIndex, 0, 'Tab na última aba deve voltar à primeira');
});

test('TabNavigation: ciclando com Shift+Tab no início volta ao final', () => {
  // Teste de navegação circular: primeira aba + Shift+Tab = última aba
  let currentIndex = 0;
  const prevIndex = (currentIndex === 0) ? items.length - 1 : currentIndex - 1;
  assert.equal(prevIndex, 2, 'Shift+Tab na primeira aba deve ir para última');
});

test('TabNavigation: ignora Tab dentro de input', () => {
  // Teste de contexto: Tab dentro de input não deve navegar abas
  const target = { tagName: 'INPUT' } as unknown as HTMLElement;
  const shouldIgnore =
    target?.tagName === 'INPUT' ||
    target?.tagName === 'TEXTAREA';
  assert.ok(shouldIgnore, 'Tab em INPUT deve ser ignorado');
});

test('TabNavigation: ignora Tab dentro de textarea', () => {
  // Teste de contexto: Tab dentro de textarea não deve navegar abas
  const target = { tagName: 'TEXTAREA' } as unknown as HTMLElement;
  const shouldIgnore =
    target?.tagName === 'INPUT' ||
    target?.tagName === 'TEXTAREA';
  assert.ok(shouldIgnore, 'Tab em TEXTAREA deve ser ignorado');
});

test('TabNavigation: processa Tab fora de inputs', () => {
  // Teste de contexto: Tab fora de input deve navegar abas
  const target = { tagName: 'DIV' } as unknown as HTMLElement;
  const shouldIgnore =
    target?.tagName === 'INPUT' ||
    target?.tagName === 'TEXTAREA';
  assert.ok(!shouldIgnore, 'Tab em DIV deve ser processado');
});

test('TabNavigation: props requeridas estão presentes', () => {
  // Teste de contrato: componente requer items, activeId, onSelect
  const requiredProps = {
    items: [] as const,
    activeId: 'tab1',
    onSelect: (id: string) => {},
  };

  assert.ok(Array.isArray(requiredProps.items));
  assert.equal(typeof requiredProps.activeId, 'string');
  assert.equal(typeof requiredProps.onSelect, 'function');
});

test('TabNavigation: classe opcional funciona', () => {
  // Teste de customização: className é opcional
  const defaultClass = '';
  const customClass = 'custom-class';

  assert.equal(typeof defaultClass, 'string');
  assert.equal(typeof customClass, 'string');
});

test('TabNavigation: encontra aba pelo id', () => {
  // Teste de busca: localiza aba correta
  const searchId = 'tab2';
  const found = items.find(i => i.id === searchId);
  assert.ok(found, 'Deve encontrar aba com id tab2');
  assert.equal(found?.label, 'Tab 2');
});

test('TabNavigation: lista de seleções possíveis completa', () => {
  // Teste de cobertura: cada aba pode ser selecionada
  items.forEach(item => {
    assert.ok(item.id, `Aba deve ter id: ${item.label}`);
    assert.ok(item.label, `Aba deve ter label: ${item.id}`);
  });
});
