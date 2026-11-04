import assert from 'node:assert/strict';
import test from 'node:test';
import * as presenca from '../src/utils/presencaPublicaAuth';
import { gerarCsvCiclos, gerarHtmlCiclos } from '../src/fleet/exportarCiclosPdf';
import type { EquipmentCycle } from '../src/fleet/cycleHistory';

const MALICIOSO = '<img src=x onerror=alert(1)>';
const ciclo = (extra: Partial<EquipmentCycle> = {}): EquipmentCycle => ({
  id: 'c1',
  equipamentoId: 'eq1',
  prefixo: '<script>alert(1)</script>',
  dataInicio: '2026-11-04',
  statusAtual: 'Em manutenção',
  eventos: [
    { id: 'e1', equipamentoId: 'eq1', status: 'Em manutenção', timestamp: '2026-11-04T10:00:00Z', hora: '07:00', responsavel: `Ana ${MALICIOSO}`, motivo: MALICIOSO, operador: '"><b>x</b>' },
    { id: 'e2', equipamentoId: 'eq1', status: 'Em operação', timestamp: '2026-11-04T12:00:00Z', hora: '09:00', responsavel: 'Bia' },
  ],
  ...extra,
});

test('relatório de ciclos escapa todo texto digitado antes de abrir a janela', () => {
  const html = gerarHtmlCiclos([ciclo()], { titulo: `Ciclos ${MALICIOSO}`, rodape: '<i>rodapé</i>', dataRelatorio: '<u>hoje</u>' });
  for (const cru of ['<script>alert(1)</script>', '<img src=x', '"><b>x</b>', '<i>rodapé</i>', '<u>hoje</u>']) {
    assert.equal(html.includes(cru), false, `não pode sair cru: ${cru}`);
  }
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&quot;&gt;&lt;b&gt;x&lt;\/b&gt;/);
});

test('CSV de ciclos dobra aspas e neutraliza fórmula de planilha', () => {
  const csv = gerarCsvCiclos([ciclo({ prefixo: 'CB"1', eventos: [
    { id: 'e1', equipamentoId: 'eq1', status: 'Em manutenção', timestamp: '2026-11-04T10:00:00Z', hora: '07:00', responsavel: '=HYPERLINK("http://x")', motivo: '+1+1', operador: '@SOMA(A1)' },
  ] })]);
  const linha = csv.split('\n')[1];
  assert.match(linha, /^"CB""1",/);
  assert.match(linha, /"'=HYPERLINK\(""http:\/\/x""\)"/);
  assert.match(linha, /"'@SOMA\(A1\)"/);
  assert.match(linha, /"'\+1\+1"/);
});

test('token de presença pública sem assinatura não existe mais (era forjável e não tinha uso)', () => {
  assert.equal('gerarTokenPresencaPublica' in presenca, false);
  assert.equal('validarTokenPresencaPublica' in presenca, false);
  assert.equal(typeof presenca.validarMatricula, 'function');
});
