import assert from 'node:assert/strict';
import { computeRegistryView } from '../src/shared/registry/useRegistryState';
import type { RegistryConfig } from '../src/shared/registry/registryTypes';

type Pessoa = { id: string; nome: string; cargo: string; ativo: boolean };

const config: RegistryConfig<Pessoa> = {
  key: 'pessoas',
  label: 'Pessoas',
  idPrefix: 'PES',
  fields: [
    { key: 'nome', label: 'Nome', type: 'text', required: true, searchable: true },
    { key: 'cargo', label: 'Cargo', type: 'text', searchable: true },
  ],
  operationalKey: item => item.nome.trim().toLowerCase() || undefined,
  duplicateMode: 'avisa',
  emptyItem: () => ({ nome: '', cargo: '', ativo: true }),
};

const items: Pessoa[] = [
  { id: '1', nome: 'Ana Souza', cargo: 'Encarregada', ativo: true },
  { id: '2', nome: 'Bruno Lima', cargo: 'Operador', ativo: true },
  { id: '3', nome: 'ana souza', cargo: 'Encarregada', ativo: false }, // mesma chave normalizada de "Ana Souza"
];

const view = computeRegistryView(items, config, 'souza', {}, 1, 50);
assert.equal(view.filtered.length, 2, 'busca por "souza" acha os dois registros de Ana');
assert.equal(view.duplicateCount, 2, 'os dois "Ana Souza" contam como duplicata pela chave operacional');

const paged = computeRegistryView(items, config, '', {}, 1, 2);
assert.equal(paged.paged.length, 2);
assert.equal(paged.totalPages, 2, '3 itens com pageSize 2 dá 2 páginas');

const withSubFilter = computeRegistryView(items, { ...config, subFilter: item => item.ativo }, '', {}, 1, 50);
assert.equal(withSubFilter.scoped.length, 2, 'subFilter tira os inativos antes de filtrar/paginar');
assert.equal(
  withSubFilter.duplicateCount, 0,
  'duplicidade é contada sobre "scoped": sem a "ana souza" inativa, a "Ana Souza" ativa que sobra não é duplicata de ninguém',
);

const filteredByCargo = computeRegistryView(items, config, '', { cargo: 'Operador' }, 1, 50);
assert.equal(filteredByCargo.filtered.length, 1, 'selectFilters filtra por igualdade exata no campo');
assert.equal(filteredByCargo.filtered[0]?.id, '2');

const filteredByCargoTodos = computeRegistryView(items, config, '', { cargo: 'todos' }, 1, 50);
assert.equal(filteredByCargoTodos.filtered.length, 3, 'o valor sentinela "todos" não filtra nada');

const emptyView = computeRegistryView([], config, '', {}, 1, 50);
assert.deepEqual(emptyView.scoped, []);
assert.deepEqual(emptyView.filtered, []);
assert.deepEqual(emptyView.paged, []);
assert.equal(emptyView.totalPages, 1, 'lista vazia ainda tem 1 página (nunca 0)');
assert.equal(emptyView.duplicateCount, 0);

const overshoot = computeRegistryView(items, config, '', {}, 99, 2);
assert.equal(overshoot.totalPages, 2, '3 itens com pageSize 2 continuam dando 2 páginas');
assert.equal(overshoot.paged.length, 1, 'page 99 é clampada para a última página existente (2)');
assert.equal(overshoot.paged[0]?.id, '3', 'a última página clampada mostra o item restante, não uma página vazia');
