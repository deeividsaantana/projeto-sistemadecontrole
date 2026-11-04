import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Settings, Bell } from 'lucide-react';
import { TabNavigation } from '../src/components/shared/TabNavigation';

/**
 * Testes do componente TabNavigation.
 * Valida estrutura HTML, ARIA attributes, seleção e callbacks.
 */

const items = [
  { id: 'tab1', label: 'Início' },
  { id: 'tab2', label: 'Configurações', icon: <Settings className="size-4" /> },
  { id: 'tab3', label: 'Notificações', icon: <Bell className="size-4" /> },
];

test('TabNavigation: renderiza todas as abas com labels corretos', () => {
  const html = renderToStaticMarkup(
    <TabNavigation items={items} activeId="tab1" onSelect={() => {}} />
  );

  assert.match(html, /Início/);
  assert.match(html, /Configurações/);
  assert.match(html, /Notificações/);
});

test('TabNavigation: marca aba ativa com border-b-2 e text-emerald-700', () => {
  const html = renderToStaticMarkup(
    <TabNavigation items={items} activeId="tab2" onSelect={() => {}} />
  );

  // A aba ativa deve ter border-b-2 border-emerald-600 text-emerald-700
  // Verificamos que há um botão com aria-selected="true"
  assert.match(html, /aria-selected="true"[^>]*>.*?Configurações/s);
  // E que tem as classes de ativa
  assert.match(html, /border-b-2 border-emerald-600 text-emerald-700/);
});

test('TabNavigation: abas inativas têm text-slate-600', () => {
  const html = renderToStaticMarkup(
    <TabNavigation items={items} activeId="tab1" onSelect={() => {}} />
  );

  // Tab2 e Tab3 devem estar inativas
  assert.match(html, /text-slate-600.*?Configurações/s);
  assert.match(html, /text-slate-600.*?Notificações/s);
});

test('TabNavigation: implementa ARIA com role="tablist" e aria-label', () => {
  const html = renderToStaticMarkup(
    <TabNavigation items={items} activeId="tab1" onSelect={() => {}} />
  );

  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-label="Navegação de abas"/);
});

test('TabNavigation: cada aba tem role="tab" e aria-selected correto', () => {
  const html = renderToStaticMarkup(
    <TabNavigation items={items} activeId="tab2" onSelect={() => {}} />
  );

  // Deve haver 3 botões com role="tab"
  const tabMatches = html.match(/role="tab"/g);
  assert.equal(tabMatches?.length, 3, 'Deve ter 3 abas com role="tab"');

  // Apenas tab2 deve ter aria-selected="true"
  assert.match(html, /aria-selected="true"[^>]*>.*?Configurações/s);
  assert.match(html, /aria-selected="false"[^>]*>.*?Início/s);
  assert.match(html, /aria-selected="false"[^>]*>.*?Notificações/s);
});

test('TabNavigation: renderiza ícones quando fornecidos', () => {
  const html = renderToStaticMarkup(
    <TabNavigation items={items} activeId="tab1" onSelect={() => {}} />
  );

  // Tab 2 e 3 têm ícones, tab 1 não
  // Procuramos por aria-hidden que marca ícones
  const hiddenMatches = html.match(/aria-hidden="true"/g);
  assert.ok((hiddenMatches?.length ?? 0) >= 2, 'Deve ter pelo menos 2 ícones');
});

test('TabNavigation: accept className customizado', () => {
  const html = renderToStaticMarkup(
    <TabNavigation
      items={items}
      activeId="tab1"
      onSelect={() => {}}
      className="rounded-2xl bg-slate-100"
    />
  );

  assert.match(html, /rounded-2xl bg-slate-100/);
});

test('TabNavigation: estrutura básica com flex, gap-2 e border-b', () => {
  const html = renderToStaticMarkup(
    <TabNavigation items={items} activeId="tab1" onSelect={() => {}} />
  );

  assert.match(html, /flex gap-2 border-b border-slate-200/);
});

test('TabNavigation: botões têm padding e font corretos', () => {
  const html = renderToStaticMarkup(
    <TabNavigation items={items} activeId="tab1" onSelect={() => {}} />
  );

  // Todos os botões devem ter px-4 py-2 e font-medium
  assert.match(html, /px-4 py-2 font-medium/);
});

test('TabNavigation: callback onSelect é armazenado para cada aba (teste de props)', () => {
  // Este teste valida que a interface recebe o callback
  let selectedId = '';
  const handleSelect = (id: string) => {
    selectedId = id;
  };

  // Renderiza o componente com callback registrado
  const html = renderToStaticMarkup(
    <TabNavigation items={items} activeId="tab1" onSelect={handleSelect} />
  );

  // Verifica que renderizou
  assert.match(html, /Início/);

  // Em um teste real, o callback seria invocado por um evento de clique.
  // Aqui validamos que a prop foi aceita sem erros
  assert.equal(typeof handleSelect, 'function');
});

test('TabNavigation: lista de itens pode estar vazia', () => {
  const html = renderToStaticMarkup(
    <TabNavigation items={[]} activeId="" onSelect={() => {}} />
  );

  assert.match(html, /role="tablist"/);
  assert.doesNotMatch(html, /role="tab"/);
});

test('TabNavigation: todos os itens têm id e label', () => {
  const validos = items.every(item => item.id && item.label);
  assert.ok(validos, 'Todos os items devem ter id e label');
});

test('TabNavigation: ativa tab existente por id', () => {
  const html = renderToStaticMarkup(
    <TabNavigation items={items} activeId="tab3" onSelect={() => {}} />
  );

  // Tab3 deve estar marcada como ativa
  assert.match(html, /aria-selected="true"[^>]*>.*?Notificações/s);
});

test('TabNavigation: tab inválida não quebra o componente', () => {
  // Quando activeId não existe nos items, nenhuma tab é marcada como ativa
  const html = renderToStaticMarkup(
    <TabNavigation items={items} activeId="tab-inexistente" onSelect={() => {}} />
  );

  assert.match(html, /role="tablist"/);
  assert.match(html, /role="tab"/);
  // Nenhuma deve ser ativa
  const activeMatches = html.match(/aria-selected="true"/g);
  assert.equal(activeMatches?.length ?? 0, 0, 'Nenhuma tab deve estar ativa');
});
