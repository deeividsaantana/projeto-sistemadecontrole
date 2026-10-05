import assert from 'node:assert/strict';
import { buildEmptyDraft, type RegistryConfig } from '../src/shared/registry/registryTypes';

type Exemplo = { id: string; nome: string; ativo: boolean };

const config: RegistryConfig<Exemplo> = {
  key: 'exemplos',
  label: 'Exemplos',
  idPrefix: 'EX',
  fields: [
    { key: 'nome', label: 'Nome', type: 'text', required: true, searchable: true },
    { key: 'ativo', label: 'Ativo', type: 'checkbox' },
  ],
  operationalKey: item => item.nome.trim().toLowerCase() || undefined,
  duplicateMode: 'avisa',
  emptyItem: () => ({ nome: '', ativo: true }),
};

assert.deepEqual(buildEmptyDraft(config), { nome: '', ativo: true });
assert.equal(config.operationalKey({ id: '1', nome: '', ativo: true }), undefined, 'chave vazia nunca é uma chave real');
assert.equal(config.operationalKey({ id: '1', nome: 'ACME', ativo: true }), 'acme');
