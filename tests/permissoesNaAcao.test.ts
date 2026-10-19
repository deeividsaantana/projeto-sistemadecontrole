import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assertKeepsActiveAdmin, assertManagerRole } from '../api/_shared/supabase-admin.js';
import { pode } from '../src/utils/permissoes';

const app = readFileSync('src/App.tsx', 'utf8');

test('A7: só o administrador exclui lançamento, e a recusa fica dentro de cada ação', () => {
  for (const papel of ['gestor', 'operador', 'leitura'] as const) assert.equal(pode(papel, 'lancamentos', 'excluir'), false);
  assert.equal(pode('admin', 'lancamentos', 'excluir'), true);
  const acoes: Array<[string, string]> = [
    ['handleDeleteAbastecimentos', 'podeExcluirLancamento'],
    ['handleDeleteLubrificacao', 'podeExcluirLancamento'],
    ['handleDeleteTicketJazida', 'podeExcluirLancamento'],
    ['handleDeleteTicketsJazida', 'podeExcluirLancamento'],
    ['handleDeleteOrdemServico', 'podeExcluirLancamento'],
    ['handleDeleteControleEquipamentosDiario', 'podeExcluirLancamento'],
    ['handleDeleteGrupoEquipe', 'podeExcluirCadastro'],
    ['handleDeleteOperationalDriver', 'podeExcluirCadastro'],
  ];
  for (const [acao, permissao] of acoes) {
    const corpo = app.slice(app.indexOf(`const ${acao} = (`));
    const primeiraLinha = corpo.split('\n')[1];
    assert.match(primeiraLinha, new RegExp(`exclusaoRecusada\\(${permissao}\\)`), `${acao} confere o perfil antes de excluir`);
  }
});

test('A7: quem não pode excluir não recebe o botão de excluir', () => {
  for (const prop of ['onDeleteAbastecimento', 'onDeleteAbastecimentos', 'onDeleteLubrificacao', 'onDeleteTicket', 'onDeleteTickets', 'onDeleteGrupoEquipe', 'onDeleteOperationalDriver']) {
    assert.match(app, new RegExp(`${prop}=\\{podeExcluir(Lancamento|Cadastro) \\?`), `${prop} só vai para quem pode`);
  }
  assert.equal((app.match(/onDeleteMany=\{podeExcluirLancamento \?/g) || []).length, 2);
});

test('M1: zerar o dia e pegar o endereço dos links é de gestor ou administrador', () => {
  assert.doesNotThrow(() => assertManagerRole({ role: 'admin' }));
  assert.doesNotThrow(() => assertManagerRole({ role: 'gestor' }));
  for (const role of ['operador', 'leitura']) {
    assert.throws(() => assertManagerRole({ role }), (error: { statusCode?: number }) => error.statusCode === 403);
  }
  for (const rota of ['api/public-presenca.js', 'api/public-tickets.js', 'api/public-materiais.js']) {
    const codigo = readFileSync(rota, 'utf8');
    assert.match(codigo, /await requireManagerUser\(event\)/, rota);
    assert.doesNotMatch(codigo, /requireStaffUser/, rota);
  }
});

const ativos = new Map([['a1', { disabled: false }], ['a2', { disabled: false }], ['a3', { disabled: true }]]);
const getUser = async (id: string) => ativos.get(id) || null;

test('M12: a última conta de administrador ativa não perde o perfil nem é inativada', async () => {
  await assert.rejects(
    assertKeepsActiveAdmin({ uid: 'a1', role: 'gestor', active: true, adminIds: ['a1'], getUser }),
    (error: { statusCode?: number }) => error.statusCode === 409,
  );
  await assert.rejects(
    assertKeepsActiveAdmin({ uid: 'a1', role: 'admin', active: false, adminIds: ['a1', 'a3'], getUser }),
    (error: { statusCode?: number }) => error.statusCode === 409,
    'o outro admin está inativo, então não conta',
  );
  await assertKeepsActiveAdmin({ uid: 'a1', role: 'gestor', active: true, adminIds: ['a1', 'a2'], getUser });
  await assertKeepsActiveAdmin({ uid: 'u9', role: 'leitura', active: false, adminIds: ['a1'], getUser });
  await assertKeepsActiveAdmin({ uid: 'a1', role: 'admin', active: true, adminIds: ['a1'], getUser });
});

test('M12: trocar perfil e inativar pedem confirmação na tela de Usuários', () => {
  const tela = readFileSync('src/components/UsuariosTab.tsx', 'utf8');
  assert.match(tela, /onChange=\{event => setPendente\(/);
  assert.match(tela, /setPendente\(\{ user, changes: \{ active: false \} \}\)/);
  assert.match(tela, /<ConfirmDialog/);
});
