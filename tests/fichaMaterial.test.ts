import assert from 'node:assert/strict';
import type { MovimentoMaterial } from '../src/types';
import { fornecedoresDoMaterial, saldoPorSemana } from '../src/modules/materials/fichaMaterial';

const HOJE = '2026-09-26';
let seq = 0;
const mov = (tipo: MovimentoMaterial['tipo'], quantidade: number, data: string, extra: Partial<MovimentoMaterial> = {}) => ({
  id: `m${++seq}`, data, tipo, materialId: 'brita', materialDescricao: 'BRITA', quantidade, unidade: 'm³', responsavel: 'x', criadoEm: `${data}T10:00:00Z`, ...extra,
}) as MovimentoMaterial;

// Antes da janela: 50. Depois, uma entrada e duas saídas dentro das 4 semanas.
const movimentos = [
  mov('Entrada', 50, '2026-08-01'),
  mov('Entrada', 20, '2026-09-08'), // semana de 07/09
  mov('Saída', 10, '2026-09-15'), // semana de 14/09
  mov('Saída', 5, '2026-09-22', { canceladoEm: '2026-09-23T00:00:00Z' }), // desfeito, não conta
  mov('Saída', 8, '2026-09-23'), // semana de 21/09
];

const pontos = saldoPorSemana(movimentos, 'brita', HOJE, 4);
assert.deepEqual(pontos.map(p => p.inicio), ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21']);
assert.deepEqual(pontos.map(p => p.saldo), [50, 70, 60, 52]);

// Um material sem nenhum movimento na janela mantém o saldo anterior em todas as semanas.
const parado = saldoPorSemana([mov('Entrada', 12, '2026-01-01')], 'brita', HOJE, 3);
assert.deepEqual(parado.map(p => p.saldo), [12, 12, 12]);

const fornecedores = fornecedoresDoMaterial([
  mov('Entrada', 10, '2026-09-01', { fornecedorNome: 'Pedra Forte' }),
  mov('Entrada', 15, '2026-09-10', { fornecedorNome: 'Pedra Forte' }),
  mov('Entrada', 30, '2026-09-05', { fornecedorNome: 'Areal' }),
  mov('Saída', 5, '2026-09-06', { fornecedorNome: 'Pedra Forte' }), // saída não conta como recebimento
  mov('Entrada', 1, '2026-09-02', { fornecedorNome: '', materialId: 'brita' }), // sem fornecedor, ignorado
  mov('Entrada', 999, '2026-09-02', { materialId: 'outro', fornecedorNome: 'Areal' }), // outro material, ignorado
], 'brita');
assert.deepEqual(fornecedores, [
  { nome: 'Areal', recebimentos: 1, quantidade: 30, ultimoRecebimento: '2026-09-05' },
  { nome: 'Pedra Forte', recebimentos: 2, quantidade: 25, ultimoRecebimento: '2026-09-10' },
]);

console.log('fichaMaterial ok');
