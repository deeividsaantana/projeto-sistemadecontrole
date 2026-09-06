import assert from 'node:assert/strict';
import test from 'node:test';
import { divergenciasDeRegistro, formatarBytes, resumoArmazenamento, volumePorColecao } from '../src/utils/diagnostico';
import { INTERMEDIATE_TABLE_IDS } from '../src/firebaseCloudSync';
import { STORAGE_KEYS } from '../src/data/storageKeys';

test('toda coleção de dados está no backup e na sincronização', () => {
  const divergencias = divergenciasDeRegistro(INTERMEDIATE_TABLE_IDS);
  assert.deepEqual(divergencias, [], `Coleções mal registradas: ${divergencias.map(item => `${item.colecao} (${item.problema})`).join(', ')}`);
});

test('a rede de proteção acusa coleção fora da nuvem', () => {
  const semProducao = INTERMEDIATE_TABLE_IDS.filter(item => item !== 'producaoRegistros');
  const divergencias = divergenciasDeRegistro(semProducao);
  assert.equal(divergencias.some(item => item.colecao === 'producaoRegistros'), true);
});

test('volume conta registros e bytes por coleção', () => {
  const storage = {
    getItem: (chave: string) => chave === STORAGE_KEYS.obras ? JSON.stringify([{ id: '1' }, { id: '2' }]) : null,
  };
  const volumes = volumePorColecao(storage);
  const obras = volumes.find(item => item.chave === STORAGE_KEYS.obras);
  assert.equal(obras?.registros, 2);
  assert.ok((obras?.bytes || 0) > 0);
  const resumo = resumoArmazenamento(volumes);
  assert.equal(resumo.registros, 2);
  assert.equal(resumo.vazias, volumes.length - 1);
});

test('formatação de bytes muda de unidade', () => {
  assert.equal(formatarBytes(512), '512 B');
  assert.equal(formatarBytes(2048), '2.0 KB');
  assert.equal(formatarBytes(3 * 1024 * 1024), '3.00 MB');
});
