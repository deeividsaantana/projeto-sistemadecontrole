import assert from 'node:assert/strict';
import test from 'node:test';
import { ligarPeloPrefixo } from '../src/modules/frota/vinculoPrefixo';
import type { Abastecimento, Equipamento } from '../src/types';

const maquina = (id: string, prefixo: string, status: Equipamento['status'] = 'Ativo') => ({ id, prefixo, status } as Equipamento);
const abastecimento = (id: string, equipamentoId: string, prefixoInformado?: string) => ({ id, equipamentoId, prefixoInformado } as Abastecimento);

test('abastecimento sem máquina acha o cadastro pelo prefixo', () => {
  const [ligado] = ligarPeloPrefixo([abastecimento('a', '', ' lo 146 ')], [maquina('eq-1', 'LO146')]);
  assert.equal(ligado.equipamentoId, 'eq-1');
});

test('vínculo para cadastro que não existe mais é refeito pelo prefixo', () => {
  const [ligado] = ligarPeloPrefixo([abastecimento('a', 'eq-fuel-cb940', 'CB940')], [maquina('eq-2', 'CB940')]);
  assert.equal(ligado.equipamentoId, 'eq-2');
});

test('vínculo válido não muda e prefixo repetido prefere o ativo', () => {
  const lista = [abastecimento('a', 'eq-1', 'CB940'), abastecimento('b', '', 'CB940')];
  const [mantido, novo] = ligarPeloPrefixo(lista, [maquina('eq-1', 'XX1'), maquina('eq-velho', 'CB940', 'Desmobilizado'), maquina('eq-novo', 'CB940')]);
  assert.equal(mantido, lista[0]);
  assert.equal(novo.equipamentoId, 'eq-novo');
});

test('prefixo sem cadastro continua sem máquina', () => {
  const [item] = ligarPeloPrefixo([abastecimento('a', '', 'ZZ999')], [maquina('eq-1', 'CB940')]);
  assert.equal(item.equipamentoId, '');
});
