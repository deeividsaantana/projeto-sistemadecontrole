import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agruparNotificacoes,
  alertasVisiveis,
  carregarPreferencias,
  contarNaoLidas,
  notificacoesVisiveis,
  PREFERENCIAS_PADRAO,
} from '../src/utils/notificacoes';
import type { AppNotification } from '../src/types';
import type { Alerta } from '../src/utils/alertas';

const notificacao = (extra: Partial<AppNotification> = {}): AppNotification => ({
  id: 'n1',
  type: 'info',
  title: 'Sincronização',
  message: 'Dados enviados',
  timestamp: '08:30',
  read: false,
  source: 'Firebase Cloud',
  ...extra,
});

const alerta = (titulo: string): Alerta => ({
  id: titulo, titulo, mensagem: `${titulo} pendente`, tab: 'pendencias', quantidade: 1,
});

test('preferência corrompida cai no padrão em vez de quebrar', () => {
  assert.deepEqual(carregarPreferencias({ getItem: () => '{{{' }), PREFERENCIAS_PADRAO);
  assert.deepEqual(carregarPreferencias({ getItem: () => null }), PREFERENCIAS_PADRAO);
});

test('categoria silenciada some do sino', () => {
  const alertas = [alerta('Qualidade'), alerta('Segurança')];
  assert.deepEqual(
    alertasVisiveis(alertas, { categoriasSilenciadas: ['Qualidade'], mostrarSistema: true }).map(item => item.titulo),
    ['Segurança'],
  );
  assert.equal(alertasVisiveis(alertas, PREFERENCIAS_PADRAO).length, 2);
});

test('avisos do sistema podem ser desligados sem afetar os demais', () => {
  const lista = [notificacao(), notificacao({ id: 'n2', source: 'Sistema Local' })];
  assert.equal(notificacoesVisiveis(lista, { categoriasSilenciadas: [], mostrarSistema: false }).length, 1);
  assert.equal(notificacoesVisiveis(lista, PREFERENCIAS_PADRAO).length, 2);
});

test('agrupamento usa a data quando existe e cai em hoje quando é só hora', () => {
  const grupos = agruparNotificacoes(
    [notificacao(), notificacao({ id: 'n2', timestamp: '2026-01-05T10:00:00.000Z' })],
    '2026-01-10',
  );
  assert.deepEqual(grupos.map(([dia]) => dia), ['2026-01-10', '2026-01-05']);
  assert.equal(contarNaoLidas([notificacao(), notificacao({ id: 'n2', read: true })]), 1);
});
