import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { aplicarExclusoes, criarExclusao } from '../src/cloud/exclusoes';

test('equipe excluída grava marca e não volta quando a nuvem ainda tem ela', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /handleDeleteGrupoEquipe = \(id: string\) => \{[\s\S]{0,200}excluirCadastros\(\{\s*tabela: 'gruposEquipe'/);

  const marca = criarExclusao({ tabela: 'gruposEquipe', registro: { id: 'grp-1', nome: 'SILLAME' }, rotulo: 'SILLAME', usuario: 'Deivid', agora: '2026-10-16T14:30:00.000Z' });
  const daNuvem = { gruposEquipe: [{ id: 'grp-1', nome: 'SILLAME' }, { id: 'grp-2', nome: 'OUTRA' }], exclusoes: [marca] };
  assert.deepEqual(aplicarExclusoes(daNuvem).gruposEquipe, [{ id: 'grp-2', nome: 'OUTRA' }]);
});
