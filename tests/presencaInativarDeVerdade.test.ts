import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { inativar, reativar, somenteAtivos } from '../src/utils/inativacao';

const ler = (caminho: string) => readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('C8: inativar presença guarda o registro e Reativar devolve igual', () => {
  type Registro = { id: string; funcionarioNome: string; data: string; status: string; inativoEm?: string; inativoPor?: string };
  const lista: Registro[] = [
    { id: 'p1', funcionarioNome: 'Ana', data: '2026-10-16', status: 'Presente' },
    { id: 'p2', funcionarioNome: 'Bruno', data: '2026-10-16', status: 'Atestado' },
  ];
  const inativada = inativar(lista, ['p1'], 'Deivid', '2026-10-19T12:00:00.000Z');
  assert.equal(inativada.length, 2, 'nada é apagado');
  assert.deepEqual(somenteAtivos(inativada).map(item => item.id), ['p2']);
  assert.deepEqual(reativar(inativada, ['p1']), lista);
});

test('C8: o painel não apaga presença na origem do link; apagar fica só no Zerar o dia', () => {
  const app = ler('src/App.tsx');
  assert.doesNotMatch(app, /deletePublicPresenceRecords/);
  assert.doesNotMatch(ler('src/publicApi.ts'), /excluir-registros/);
  assert.doesNotMatch(ler('api/public-presenca.js'), /excluir-registros/);
  const troca = app.slice(app.indexOf('const alterarAtividadePresenca'), app.indexOf('const handleInativarPresencaLink'));
  assert.match(troca, /reativar\(presencasLink, ids\) : inativar\(presencasLink, ids/);
  assert.match(troca, /updatedAt: agora/, 'carimbo para valer na mesclagem com a nuvem');
  const tela = ler('src/components/ControlePresencaTab.tsx');
  assert.match(tela, /data-testid="presenca-ver-inativos"/);
  assert.match(tela, /data-testid="presenca-reativar"/);
  assert.match(tela, /data-testid="presenca-desfazer"/);
  assert.doesNotMatch(tela, /exclusão permanente/);
});

test('A29: excluir equipe pede confirmação antes', () => {
  const tela = ler('src/components/ControlePresencaTab.tsx');
  assert.doesNotMatch(tela, /onClick=\{\(\) => onDeleteGrupoEquipe\(/);
  assert.match(tela, /onConfirm=\{\(\) => \{ if \(equipeExcluindo\) onDeleteGrupoEquipe\?\.\(equipeExcluindo\.id\)/);
});
