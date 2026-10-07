import assert from 'node:assert/strict';
import type { Material, MovimentoMaterial } from '../src/types';
import { posicaoEstoque } from '../src/utils/estoque';
import { avisosDeMateriais, inicioDaSemana, movimentoPorSemana, rankingPor } from '../src/modules/materials/avisosMateriais';

const HOJE = '2026-09-26';
const material = (id: string, descricao: string, extra: Partial<Material> = {}) => ({
  id, codigo: '', descricao, categoria: '', unidade: 'm³', ativo: true, criadoEm: '', atualizadoEm: '', ...extra,
}) as Material;
let seq = 0;
const mov = (materialId: string, tipo: MovimentoMaterial['tipo'], quantidade: number, data: string, extra: Partial<MovimentoMaterial> = {}) => ({
  id: `m${++seq}`, data, tipo, materialId, materialDescricao: materialId.toUpperCase(), quantidade, unidade: 'm³', responsavel: 'x', criadoEm: `${data}T10:00:00Z`, ...extra,
}) as MovimentoMaterial;

const materiais = [
  material('brita', 'BRITA 01'),
  material('areia', 'AREIA', { estoqueMinimo: 50 }),
  material('tubo', 'TUBO Ø800'),
  material('cimento', 'CIMENTO'),
  material('po', 'PÓ DE PEDRA'),
];
const movimentos = [
  // Brita: entrou 100, saiu 90 no último mês (3 por dia), sobram 10: acaba em 3 dias.
  mov('brita', 'Entrada', 100, '2026-08-20'),
  ...Array.from({ length: 9 }, (_, i) => mov('brita', 'Saída', 10, `2026-09-${String(10 + i).padStart(2, '0')}`)),
  // Areia: 40 com mínimo 50 e sem uso recente.
  mov('areia', 'Entrada', 40, '2026-09-20'),
  // Tubo: parado desde julho.
  mov('tubo', 'Entrada', 12, '2026-07-01'),
  // Cimento: saldo negativo.
  mov('cimento', 'Entrada', 5, '2026-09-01'),
  mov('cimento', 'Ajuste', -8, '2026-09-02'),
  // Pó: a mesma viagem duas vezes, e uma terceira desfeita que não conta.
  mov('po', 'Entrada', 12, '2026-09-25', { placa: 'FEJ7G39', ticket: '372175' }),
  mov('po', 'Entrada', 12, '2026-09-25', { placa: 'FEJ7G39', ticket: '372175' }),
  mov('po', 'Entrada', 12, '2026-09-25', { placa: 'FEJ7G39', ticket: '372175', canceladoEm: '2026-09-26T00:00:00Z' }),
  // Iguais sem placa nem ticket não viram aviso.
  mov('po', 'Saída', 1, '2026-09-25'),
  mov('po', 'Saída', 1, '2026-09-25'),
  // Mesmo caminhão e volume sem ticket nem nota: viagens do bota-fora.
  mov('po', 'Transferência', 3, '2026-06-10', { placa: 'CB1003' }),
  mov('po', 'Transferência', 3, '2026-06-10', { placa: 'CB1003' }),
  // Mesmo caminhão e peso, notas diferentes: duas viagens de verdade.
  mov('po', 'Entrada', 24.7, '2026-06-10', { placa: 'UFW0D22', notaFiscal: '1001' }),
  mov('po', 'Entrada', 24.7, '2026-06-10', { placa: 'UFW0D22', notaFiscal: '1002' }),
];

const avisos = avisosDeMateriais(posicaoEstoque(materiais, movimentos), movimentos, HOJE);
const porId = new Map(avisos.map(aviso => [aviso.id, aviso]));

assert.equal(avisos[0].gravidade, 'critico', 'o mais grave vem primeiro');
assert.equal(porId.get('negativo-cimento')?.titulo, 'CIMENTO está com saldo negativo');
assert.equal(porId.get('acaba-brita')?.titulo, 'BRITA 01 acaba em 3 dia(s)');
assert.match(porId.get('acaba-brita')?.detalhe ?? '', /3 m³ por dia/);
assert.equal(porId.get('minimo-areia')?.detalhe, 'Sobram 40 m³; o mínimo é 50 m³.');
assert.equal(porId.get('parados')?.titulo, 'TUBO Ø800 parado há 87 dias');
assert.equal(porId.get('parados')?.busca, 'TUBO Ø800');
const repetidos = avisos.filter(aviso => aviso.id.startsWith('repetido-'));
assert.equal(repetidos.length, 1, 'nota diferente ou só a placa igual não é repetição');
assert.equal(repetidos[0].titulo, '2 lançamentos iguais de PO', 'o desfeito não conta');
assert.equal(repetidos[0].busca, '372175');
assert.equal(porId.has('minimo-brita'), false, 'sem mínimo cadastrado não há aviso de mínimo');

// Semana começa na segunda; 26/09/2026 é sábado.
assert.equal(inicioDaSemana('2026-09-26'), '2026-09-21');
assert.equal(inicioDaSemana('2026-09-21'), '2026-09-21');
assert.equal(inicioDaSemana('2026-09-20'), '2026-09-14');

// Sem material, conta lançamentos; com material, soma a quantidade dele.
const semanas = movimentoPorSemana(movimentos, HOJE, 4);
assert.deepEqual(semanas.map(ponto => ponto.inicio), ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21']);
assert.deepEqual(semanas[3], { inicio: '2026-09-21', rotulo: '21/09', entradas: 2, saidas: 2, transporte: 0 });
const britaSemanas = movimentoPorSemana(movimentos, HOJE, 4, 'brita');
assert.equal(britaSemanas[1].saidas, 40, 'saídas de 10 a 13/09');
assert.equal(britaSemanas[2].saidas, 50, 'saídas de 14 a 18/09');

// Ranking: quem mais aparece, com o material principal.
const ranking = rankingPor([
  mov('brita', 'Entrada', 1, HOJE, { fornecedorNome: 'PEDRA FORTE' }),
  mov('brita', 'Entrada', 1, HOJE, { fornecedorNome: 'PEDRA FORTE' }),
  mov('areia', 'Entrada', 1, HOJE, { fornecedorNome: 'PEDRA FORTE' }),
  mov('areia', 'Entrada', 1, HOJE, { fornecedorNome: 'AREAL' }),
  mov('areia', 'Entrada', 1, HOJE),
], item => item.fornecedorNome);
assert.deepEqual(ranking, [
  { nome: 'PEDRA FORTE', lancamentos: 3, detalhe: 'BRITA e mais 1' },
  { nome: 'AREAL', lancamentos: 1, detalhe: 'AREIA' },
]);

// Vários parados viram um aviso só, do mais antigo para o mais recente.
const paradosJuntos = avisosDeMateriais(
  posicaoEstoque([material('a', 'SAIBRO'), material('b', 'TURFA')], [mov('a', 'Entrada', 5, '2026-04-10'), mov('b', 'Entrada', 5, '2026-07-01')]),
  [],
  HOJE,
);
assert.deepEqual(paradosJuntos.map(aviso => aviso.titulo), ['2 materiais parados há mais de 45 dias']);
assert.equal(paradosJuntos[0].detalhe, 'Têm saldo e nenhum movimento: SAIBRO (169 dias), TURFA (87 dias).');
assert.equal(paradosJuntos[0].busca, undefined);

console.log('avisosMateriais ok');
