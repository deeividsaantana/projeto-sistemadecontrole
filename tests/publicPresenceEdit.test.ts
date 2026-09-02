import assert from 'node:assert/strict';
import test from 'node:test';
import { __testing } from '../netlify/functions/public-presenca.js';

const group = {
  id: 'group-1',
  nome: 'Equipe Norte',
  responsavel: 'Ana Lima',
  frenteServico: 'Terraplenagem',
  funcionarioIds: ['employee-1', 'employee-2'],
  token: 'team-secure-token',
};

const employee = { id: 'employee-1', nome: 'Ana Lima', cargo: 'Apontadora', empresaId: 'company-1', ativo: true };

const existingRecord = {
  id: 'plink-abc-1',
  data: '2026-08-25',
  horaEnvio: '08:00',
  grupoId: group.id,
  grupoNome: group.nome,
  responsavel: group.responsavel,
  frenteServico: group.frenteServico,
  funcionarioId: 'employee-1',
  funcionarioNome: 'Ana Lima',
  funcao: 'Apontadora',
  status: 'Presente',
  observacao: '',
  tokenUsado: 'validado-xyz',
  createdAt: '2026-08-25T11:00:00.000Z',
  submissionDocId: 'presence_abc',
};

test('edicao pontual atualiza somente o colaborador informado e preserva os demais', () => {
  const outroRegistro = { ...existingRecord, id: 'plink-abc-2', funcionarioId: 'employee-2', funcionarioNome: 'Bruno Silva' };
  const { records, record } = __testing.applyRecordEdit({
    records: [existingRecord, outroRegistro],
    group,
    employee,
    funcionarioId: 'employee-1',
    status: 'Ausente',
    observacao: 'Precisou se ausentar durante o expediente',
    token: group.token,
    date: '2026-08-25',
    nowIso: '2026-08-25T14:30:00.000Z',
    horaEnvio: '14:30',
    submissionDocId: 'presence_abc',
  });

  assert.equal(record.status, 'Ausente');
  assert.equal(record.observacao, 'Precisou se ausentar durante o expediente');
  assert.equal(records.length, 2);
  assert.equal(records.find(item => item.funcionarioId === 'employee-2')?.status, 'Presente');
});

test('edicao pontual nao apaga o historico anterior, apenas acrescenta', () => {
  const jaEditado = { ...existingRecord, historicoEdicoes: [{ statusAnterior: '', statusNovo: 'Presente', observacaoAnterior: '', observacaoNova: '', editadoEm: '2026-08-25T11:00:00.000Z', origem: 'link-publico' }] };
  const { record } = __testing.applyRecordEdit({
    records: [jaEditado],
    group,
    employee,
    funcionarioId: 'employee-1',
    status: 'Atestado',
    observacao: 'Enviou atestado',
    token: group.token,
    date: '2026-08-25',
    nowIso: '2026-08-25T16:00:00.000Z',
    horaEnvio: '16:00',
    submissionDocId: 'presence_abc',
  });

  assert.equal(record.historicoEdicoes.length, 2);
  assert.equal(record.historicoEdicoes[0].statusNovo, 'Presente');
  assert.equal(record.historicoEdicoes[1].statusAnterior, 'Presente');
  assert.equal(record.historicoEdicoes[1].statusNovo, 'Atestado');
});

test('edicao pontual cria o registro (upsert) quando o colaborador ainda nao tinha sido enviado', () => {
  const { records, record } = __testing.applyRecordEdit({
    records: [],
    group,
    employee,
    funcionarioId: 'employee-1',
    status: 'Presente',
    observacao: '',
    token: group.token,
    date: '2026-08-25',
    nowIso: '2026-08-25T09:00:00.000Z',
    horaEnvio: '09:00',
    submissionDocId: 'presence_abc',
  });

  assert.equal(records.length, 1);
  assert.equal(record.funcionarioId, 'employee-1');
  assert.equal(record.historicoEdicoes.length, 1);
  assert.equal(record.historicoEdicoes[0].statusAnterior, '');
});

test('edicao pontual rejeita situacao invalida', () => {
  assert.throws(() => __testing.applyRecordEdit({
    records: [existingRecord],
    group,
    employee,
    funcionarioId: 'employee-1',
    status: 'Invalido',
    observacao: '',
    token: group.token,
    date: '2026-08-25',
    nowIso: '2026-08-25T09:00:00.000Z',
    horaEnvio: '09:00',
    submissionDocId: 'presence_abc',
  }), /situação de presença inválida/i);
});

// --- Busca do envio do dia na edição pontual -------------------------------
// Editar uma situação é a ação mais repetida do turno. Ela não pode custar uma
// varredura no histórico inteiro da equipe, que ganha um documento por dia
// trabalhado e deixaria cada edição mais lenta que a anterior.

const fakeDatabase = ({ lock = null, submission = null, scan = [] } = {}) => {
  const leituras = { pontuais: 0, varreduras: 0 };
  const doc = data => ({ exists: data !== null, id: 'doc-envio', ref: { id: 'doc-envio' }, data: () => data });
  const database = {
    collection(nome) {
      return {
        doc: () => ({
          get: async () => {
            leituras.pontuais += 1;
            return doc(nome === 'sistemarenea_presence_locks' ? lock : submission);
          },
        }),
        where: () => ({
          get: async () => {
            leituras.varreduras += 1;
            return { docs: scan.map(doc) };
          },
        }),
      };
    },
  };
  return { database, leituras };
};

const envio = (data = '2026-09-02', extra = {}) => ({
  kind: 'presence',
  payload: { grupoId: 'group-1', data, records: [] },
  ...extra,
});

test('a edicao acha o envio pela reserva do dia, sem varrer o historico', async () => {
  const { database, leituras } = fakeDatabase({
    lock: { grupoId: 'group-1', data: '2026-09-02', submissionId: 'presence_abc' },
    submission: envio(),
  });

  const encontrado = await __testing.findDaySubmissionDoc(database, 'group-1', '2026-09-02');

  assert.equal(encontrado?.id, 'doc-envio');
  assert.equal(leituras.varreduras, 0, 'nao varre o historico da equipe');
  assert.equal(leituras.pontuais, 2, 'reserva + envio, nada alem disso');
});

test('sem reserva gravada, a varredura antiga ainda resgata o envio', async () => {
  const { database, leituras } = fakeDatabase({ lock: null, scan: [envio()] });

  const encontrado = await __testing.findDaySubmissionDoc(database, 'group-1', '2026-09-02');

  assert.equal(encontrado?.id, 'doc-envio');
  assert.equal(leituras.varreduras, 1);
});

test('reserva apontando para envio cancelado nao reabre o dia', async () => {
  const { database } = fakeDatabase({
    lock: { submissionId: 'presence_abc' },
    submission: envio('2026-09-02', { status: 'cancelled' }),
    scan: [],
  });

  assert.equal(await __testing.findDaySubmissionDoc(database, 'group-1', '2026-09-02'), null);
});

test('reserva de outra data nao contamina a edicao de hoje', async () => {
  const { database } = fakeDatabase({
    lock: { submissionId: 'presence_abc' },
    submission: envio('2026-09-01'),
    scan: [],
  });

  assert.equal(await __testing.findDaySubmissionDoc(database, 'group-1', '2026-09-02'), null);
});
