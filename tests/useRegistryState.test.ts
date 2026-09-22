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
