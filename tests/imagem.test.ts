import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { bytesDeDataUrl, LIMITE_FOTO_BYTES, validarFoto } from '../src/utils/imagem';

const dataUrl = (bytes: number) => `data:image/jpeg;base64,${'A'.repeat(Math.ceil((bytes * 4) / 3))}`;

test('tamanho é calculado sem materializar o binário', () => {
  assert.equal(bytesDeDataUrl(''), 0);
  assert.equal(bytesDeDataUrl('data:image/png;base64,QUJD'), 3);
  assert.ok(Math.abs(bytesDeDataUrl(dataUrl(1000)) - 1000) <= 2);
});

test('arquivo que não é imagem é recusado', () => {
  assert.match(String(validarFoto('data:application/pdf;base64,QUJD')), /precisa ser uma imagem/);
});

test('foto acima do limite é recusada para não quebrar a sincronização', () => {
  assert.equal(validarFoto(dataUrl(LIMITE_FOTO_BYTES - 10)), null);
  assert.match(String(validarFoto(dataUrl(LIMITE_FOTO_BYTES + 10_000))), /grande demais/);
});

test('as telas com foto reduzem a imagem antes de guardar', () => {
  const diario = readFileSync(new URL('../src/components/DiarioObraTab.tsx', import.meta.url), 'utf8');
  const checklist = readFileSync(new URL('../src/components/ChecklistTab.tsx', import.meta.url), 'utf8');
  [diario, checklist].forEach(fonte => {
    assert.match(fonte, /comprimirImagem\(/);
    assert.match(fonte, /validarFoto\(/);
  });
});
