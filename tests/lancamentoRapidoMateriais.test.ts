import assert from 'node:assert/strict';
import {
  acharOpcao,
  filtrarOpcoes,
  lerColagem,
  lerDataBR,
  lerNumeroBR,
  lerTipo,
  linhaViagemVazia,
  montarViagens,
  pareceTabela,
  proximaLinha,
  recentes,
} from '../src/modules/materials/lancamentoRapido';
import type { MovimentoMaterial } from '../src/types';

const materiais = [
  { id: 'b1', nome: 'BRITA 01', apelido: 'BR-01' },
  { id: 'b2', nome: 'BRITA 02', apelido: 'BR-02' },
  { id: 'pd', nome: 'PÓ DE PEDRA' },
  { id: 'tb', nome: 'TUBO DE CONCRETO Ø800 PA4 1,50 m' },
];
const fornecedores = [{ id: 'pf', nome: 'PEDRA FORTE' }, { id: 'mz', nome: 'MINERAÇÃO ZAMBON' }];

// Busca por palavras em qualquer ordem, sem acento e sem caixa.
assert.deepEqual(filtrarOpcoes(materiais, 'brita').map(item => item.id), ['b1', 'b2']);
assert.deepEqual(filtrarOpcoes(materiais, 'pedra po').map(item => item.id), ['pd']);
assert.deepEqual(filtrarOpcoes(materiais, 'br-02').map(item => item.id), ['b2']);
assert.deepEqual(filtrarOpcoes(materiais, 'tubo 800').map(item => item.id), ['tb']);

// Achar só sem dúvida: "brita" sozinho bate em dois e não escolhe nenhum.
assert.equal(acharOpcao(materiais, 'brita'), undefined);
assert.equal(acharOpcao(materiais, 'Brita 02')?.id, 'b2');
assert.equal(acharOpcao(materiais, 'po de pedra')?.id, 'pd');
assert.equal(acharOpcao(fornecedores, 'mineracao zambon')?.id, 'mz');
assert.equal(acharOpcao(materiais, ''), undefined);

// Número e data no jeito brasileiro; texto sem número não vira zero.
assert.equal(lerNumeroBR('1.234,5'), 1234.5);
assert.equal(lerNumeroBR('12,5 m³'), 12.5);
assert.equal(lerNumeroBR('9.91'), 9.91);
assert.equal(lerNumeroBR('R$ 1.500,00'), 1500);
assert.equal(lerNumeroBR('sem'), null);
assert.equal(lerDataBR('26/09/2026'), '2026-09-26');
assert.equal(lerDataBR('6/9/26'), '2026-09-06');
assert.equal(lerDataBR('2026-09-26'), '2026-09-26');
assert.equal(lerDataBR('31/13/2026'), null);
assert.equal(lerTipo('Saída'), 'Saída');
assert.equal(lerTipo('entrada'), 'Entrada');
assert.equal(lerTipo('talvez'), null);

// Colar do Excel: tabulação entre colunas, uma viagem por linha.
assert.equal(pareceTabela('BRITA 01'), false);
assert.equal(pareceTabela('BRITA 01\t12'), true);
assert.equal(pareceTabela('12\n13'), true);
const colado = lerColagem(
  '26/09/2026\tEntrada\tBRITA 01\t12,5\tPEDRA FORTE\tfej7g39\t372175\tRAMO 700\n'
  + '25/09/2026\tEntrada\tAREIA FINA\t10\tNINGUEM\t\t\t\n',
  'data',
  { materiais, fornecedores },
);
assert.equal(colado.linhas.length, 2);
assert.deepEqual(colado.linhas[0], {
  data: '2026-09-26', tipo: 'Entrada', materialId: 'b1', quantidade: '12,5', fornecedorId: 'pf', placa: 'FEJ7G39', ticket: '372175', destino: 'RAMO 700',
});
// O que não está no cadastro fica em branco e vira aviso.
assert.equal(colado.linhas[1].materialId, undefined);
assert.equal(colado.linhas[1].fornecedorId, undefined);
assert.equal(colado.linhas[1].quantidade, '10');
assert.deepEqual(colado.avisos, [
  'Linha 2: material "AREIA FINA" não está no cadastro.',
  'Linha 2: fornecedor "NINGUEM" não está no cadastro.',
]);

// Colar a partir da coluna de quantidade preenche só dali para a direita.
const soQuantidades = lerColagem('10\n12\n', 'quantidade', { materiais, fornecedores });
assert.deepEqual(soQuantidades.linhas, [{ quantidade: '10' }, { quantidade: '12' }]);

// A linha nova repete data, tipo, material, fornecedor e destino; zera o que muda por viagem.
const nova = proximaLinha({
  data: '2026-09-20', tipo: 'Entrada', materialId: 'b1', quantidade: '12', fornecedorId: 'pf', placa: 'ABC1234', ticket: '9', destino: 'RAMO 700', valorUnitario: '80', valorTotal: '960',
}, '2026-09-26');
assert.deepEqual(nova, {
  data: '2026-09-20', tipo: 'Entrada', materialId: 'b1', quantidade: '', fornecedorId: 'pf', placa: '', ticket: '', destino: 'RAMO 700', valorUnitario: '80', valorTotal: '',
});
assert.equal(proximaLinha(undefined, '2026-09-26').data, '2026-09-26');

// Recentes: último usado primeiro, sem repetir e sem contar o desfeito.
const mov = (id: string, data: string, materialId: string, canceladoEm?: string) => ({
  id, data, tipo: 'Entrada', materialId, materialDescricao: materialId, quantidade: 1, unidade: 'm³', criadoEm: `${data}T10:00:00Z`, canceladoEm,
}) as MovimentoMaterial;
assert.deepEqual(
  recentes([mov('1', '2026-09-20', 'b1'), mov('2', '2026-09-25', 'b2'), mov('3', '2026-09-26', 'pd', '2026-09-26T11:00:00Z'), mov('4', '2026-09-24', 'b2')], item => item.materialId),
  ['b2', 'b1'],
);

// Montar viagens: linha vazia não conta, saída sem saldo para na linha certa.
const cadastro = [
  { id: 'b1', codigo: 'BR-01', descricao: 'BRITA 01', categoria: 'Agregado', unidade: 'm³', ativo: true, criadoEm: '', atualizadoEm: '' },
] as never[];
const contexto = { hoje: '2026-09-26', responsavel: 'Deivid', agora: '2026-09-26T12:00:00.000Z', materiais: cadastro, empresas: [{ id: 'pf', nome: 'PEDRA FORTE' }], movimentos: [] };
const montadas = montarViagens([
  linhaViagemVazia('2026-09-26', { materialId: 'b1', quantidade: '12,5', fornecedorId: 'pf', valorUnitario: '80' }),
  linhaViagemVazia('2026-09-26'),
  linhaViagemVazia('2026-09-26', { tipo: 'Saída', materialId: 'b1', quantidade: '2' }),
], contexto);
assert.equal(montadas.erro, undefined);
assert.equal(montadas.movimentos.length, 2);
assert.equal(montadas.movimentos[0].quantidade, 12.5);
assert.equal(montadas.movimentos[0].fornecedorNome, 'PEDRA FORTE');
assert.equal(montadas.movimentos[0].valorTotal, 1000);
assert.notEqual(montadas.movimentos[0].id, montadas.movimentos[1].id);
const semSaldo = montarViagens([linhaViagemVazia('2026-09-26', { tipo: 'Saída', materialId: 'b1', quantidade: '3' })], contexto);
assert.equal(semSaldo.linhaComErro, 0);
assert.match(semSaldo.erro ?? '', /^Linha 1: Saldo disponível/);
assert.equal(montarViagens([linhaViagemVazia('2026-09-26', { quantidade: '4' })], contexto).erro, 'Linha 1: escolha o material.');
assert.equal(montarViagens([linhaViagemVazia('2026-09-26')], contexto).erro, 'Preencha ao menos uma viagem para salvar.');

console.log('lancamentoRapidoMateriais ok');
