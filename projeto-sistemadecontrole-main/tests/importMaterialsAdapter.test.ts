import assert from 'node:assert/strict';
import { materialsAdapter } from '../src/imports/adapters/materialsAdapter';
import type { ImportParseContext } from '../src/imports/types';
import type { MovimentoMaterial } from '../src/types';

assert.equal(materialsAdapter.domain, 'materials-movements');
assert.equal(materialsAdapter.supports('Rachão'), true);
assert.equal(materialsAdapter.supports('Bota-fora Lara'), true);
assert.equal(materialsAdapter.supports('Q.E. São Bento'), true);
assert.equal(materialsAdapter.supports('resumo geral'), false, 'resumo agregado fica deferred');
assert.equal(materialsAdapter.supports('BRITA'), true, 'a aba "BRITA 02" foi renomeada para "BRITA" na planilha de 26/09');
assert.equal(materialsAdapter.supports('LANÇ_MAT_RENEA'), true);
assert.equal(materialsAdapter.supports('Aba qualquer'), false);

const context: ImportParseContext = {
  sourceFile: 'MATERIAIS COMPLEXO DO ALTO TIETÊ.xlsx',
  sourceHash: 'hash-xyz',
  sourceSheet: 'Rachão',
  importBatchId: 'imp-materiais-hashxyz',
  importedAt: '2026-09-21T12:00:00.000Z',
  headerRow: 1,
  rows: [
    { Data: '05/01/2026', Movimento: 'Entrada', Origem: 'Jazida', Destino: 'Frente 3', Quantidade: 40, Unidade: 'M3', Placa: 'ABC1D23' },
    { Data: '', Movimento: 'Saída', Destino: '', Quantidade: '', Unidade: '', Placa: '' },
    // Repete a chave operacional da linha 1 (mesma data, origem, destino, quantidade e placa).
    { Data: '05/01/2026', Movimento: 'Entrada', Origem: 'Jazida', Destino: 'Frente 3', Quantidade: 40, Unidade: 'M3', Placa: 'ABC1D23' },
  ],
};

const parsed = materialsAdapter.parse(context);
assert.equal(parsed.length, 3);
assert.equal(parsed[0].lineage.validationStatus, 'ready');
assert.ok(parsed[0].operationalKey);
assert.equal(parsed[1].lineage.validationStatus, 'review');
assert.equal(parsed[1].operationalKey, undefined);
assert.equal(parsed[2].operationalKey, parsed[0].operationalKey, 'mesma chave operacional da linha 1');

const preview = materialsAdapter.reconcile(parsed, [] as MovimentoMaterial[]);
assert.equal(preview.counts.new, 1);
assert.equal(preview.counts.review, 1);
assert.equal(preview.counts['duplicate-in-file'], 1, 'segunda ocorrência da mesma chave no arquivo é duplicate-in-file, nunca descartada');

// Planilha real de agregados: o mesmo caminhão faz viagens iguais no dia, a
// nota separa uma da outra; o item nomeia o material; a coluna LOCAIS ao lado
// e a fórmula de total arrastada não são viagem.
const agregados: ImportParseContext = {
  ...context,
  sourceSheet: 'Q.E.SÃO BENTO SPE LTDA',
  rows: [
    { DATA: '2026-05-07', ITEM: 'LIXO', UNIDADE: 'VIAGEM', QUANTIDADE: 1, FORNECEDOR: 'Renea', PLACA: 'DIQ0627', 'NUMERO DA NOTA': 682925, 'LOCAL DE CARREGAMENTO': 'BOTA ESPERA RAMO 600/700', 'TOTAL R$': 850 },
    { DATA: '2026-05-07', ITEM: 'LIXO', UNIDADE: 'VIAGEM', QUANTIDADE: 1, FORNECEDOR: 'Renea', PLACA: 'DIQ0627', 'NUMERO DA NOTA': 682926, 'LOCAL DE CARREGAMENTO': 'BOTA ESPERA RAMO 600/700', 'TOTAL R$': 850 },
    { LOCAIS: 'CS RAMO 900' },
    { 'TOTAL R$': '' , 'VALOR UNIT.': 70 },
    { DATA: '2026-05-08', ITEM: 'BRITA 02', UNIDADE: 'EFO7545', QUANTIDADE: 9.91, 'NUMERO DA NOTA': 372175, LOCAL: 'COLUNA DE BRITA RAMO 700' },
  ],
};
const viagens = materialsAdapter.parse(agregados);
assert.equal(viagens.length, 3, 'LOCAIS e fórmula de total sozinhas não viram linha');
assert.equal(viagens[0].value.material, 'LIXO');
assert.equal(viagens[0].value.fornecedor, 'RENEA');
assert.equal(viagens[0].value.notaFiscal, '682925');
assert.equal(viagens[0].value.valorTotal, 850);
assert.notEqual(viagens[0].operationalKey, viagens[1].operationalKey, 'nota diferente é outra viagem');
assert.equal(viagens[2].lineage.validationStatus, 'review', 'placa na coluna de unidade vai para conferência');
assert.match(viagens[2].lineage.validationMessages.join(' '), /Unidade "EFO7545"/);
const viagensPreview = materialsAdapter.reconcile(viagens, [] as MovimentoMaterial[]);
assert.equal(viagensPreview.counts.new, 2);

// Bota-fora é transporte para o aterro da aba, não entrada no estoque.
const [botaFora] = materialsAdapter.parse({
  ...context,
  sourceSheet: 'BOTA FORA (LARA)',
  rows: [{ DATA: '2026-03-22', ITEM: 'LIXO', UNIDADE: 'TON', QUANTIDADE: 13.16, PLACA: 'EFO7556', 'NUMERO DA NOTA': 411961, LOCAL: 'CS RAMO 600/700' }],
});
assert.equal(botaFora.value.tipoMovimento, 'Transferência');
assert.equal(botaFora.value.origem, 'CS RAMO 600/700');
assert.equal(botaFora.value.destino, 'LARA');
