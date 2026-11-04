import assert from 'node:assert/strict';
import test from 'node:test';
import { enforceRateLimit, getAdminDb, substituirClienteSupabase } from '../api/_shared/supabase-admin.js';
import { withIdempotency } from '../api/_shared/idempotency.js';

interface Linha { id: string; path: string; collection_path: string; organization_id: string; payload: Record<string, unknown> }
type Rpc = (args: Record<string, unknown>, linhas: Map<string, Linha>) => { data?: unknown; error?: unknown };

// Imita o pedaço do supabase-js que o adaptador usa: legacy_documents com chave
// única em path, o corte de 1000 linhas do PostgREST e as funções (rpc).
const clienteFalso = (rpcs: Record<string, Rpc> = {}) => {
  const linhas = new Map<string, Linha>();
  const chamadas: Array<[string, Record<string, unknown>]> = [];
  const from = (tabela: string) => {
    const estado = { filtros: [] as Array<[string, unknown]>, intervalo: null as [number, number] | null, ordem: '', apagar: false };
    const executar = () => {
      if (tabela !== 'legacy_documents') return { data: null, error: null };
      let lista = [...linhas.values()].filter(linha => estado.filtros.every(([coluna, valor]) => (linha as unknown as Record<string, unknown>)[coluna] === valor));
      if (estado.ordem) lista.sort((a, b) => a.path.localeCompare(b.path));
      if (estado.apagar) { lista.forEach(linha => linhas.delete(linha.path)); return { data: null, error: null }; }
      const [de, ate] = estado.intervalo || [0, 999];
      lista = lista.slice(de, Math.min(ate, de + 999) + 1);
      return { data: lista.map(linha => ({ id: linha.id, payload: linha.payload })), error: null };
    };
    const consulta = {
      select: () => consulta,
      eq: (coluna: string, valor: unknown) => { estado.filtros.push([coluna, valor]); return consulta; },
      order: (coluna: string) => { estado.ordem = coluna; return consulta; },
      range: (de: number, ate: number) => { estado.intervalo = [de, ate]; return consulta; },
      delete: () => { estado.apagar = true; return consulta; },
      maybeSingle: async () => ({ data: executar().data?.[0] ?? null, error: null }),
      then: (ok: (valor: unknown) => unknown, falha?: (erro: unknown) => unknown) => Promise.resolve(executar()).then(ok, falha),
      insert: async (linha: Linha) => {
        await Promise.resolve();
        if (linhas.has(linha.path)) return { error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        linhas.set(linha.path, linha);
        return { error: null };
      },
      upsert: async (linha: Linha) => { linhas.set(linha.path, linha); return { error: null }; },
    };
    return consulta;
  };
  const rpc = async (nome: string, args: Record<string, unknown>) => {
    chamadas.push([nome, args]);
    const funcao = rpcs[nome];
    return funcao ? { data: null, error: null, ...funcao(args, linhas) } : { data: null, error: { code: 'PGRST202', message: `function ${nome} not found` } };
  };
  return { linhas, chamadas, from, rpc };
};

const linha = (colecao: string, id: string, payload: Record<string, unknown>): Linha => ({ id, path: `${colecao}/${id}`, collection_path: colecao, organization_id: 'renea', payload });

test('limite de requisições: a função do banco recusa e a API responde 429', async t => {
  const cliente = clienteFalso({ registrar_requisicao: () => ({ data: false }) });
  substituirClienteSupabase(cliente);
  t.after(() => substituirClienteSupabase(null));
  await assert.rejects(enforceRateLimit(null, { headers: { 'x-real-ip': '10.0.0.1' } }, 'public-tickets-POST', 60, 3600, 'equipe-7'), (erro: { statusCode?: number }) => erro.statusCode === 429);
  const [nome, args] = cliente.chamadas[0];
  assert.equal(nome, 'registrar_requisicao');
  assert.equal(args.p_limite, 60);
  assert.equal(args.p_janela_segundos, 3600);
  assert.match(String(args.p_chave), /^public-tickets-POST\|equipe-7$/);
});

test('limite de requisições: sem identidade conta por IP; dentro do limite passa', async t => {
  const cliente = clienteFalso({ registrar_requisicao: () => ({ data: true }) });
  substituirClienteSupabase(cliente);
  t.after(() => substituirClienteSupabase(null));
  await enforceRateLimit(null, { headers: { 'x-real-ip': '10.0.0.1' } }, 'public-materiais-GET', 240, 300);
  assert.match(String(cliente.chamadas[0][1].p_chave), /^public-materiais-GET\|ip-[0-9a-f]{24}$/);
});

test('limite de requisições: banco ainda sem a migration não derruba os links de campo', async t => {
  substituirClienteSupabase(clienteFalso());
  t.after(() => substituirClienteSupabase(null));
  const avisos: unknown[] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => { avisos.push(args); });
  await enforceRateLimit(null, { headers: {} }, 'public-presenca-POST', 30, 3600);
  assert.equal(avisos.length, 1);
});

test('idempotência: dois envios simultâneos com a mesma chave executam uma vez só', async t => {
  substituirClienteSupabase(clienteFalso());
  t.after(() => substituirClienteSupabase(null));
  const contexto = { database: getAdminDb(), organizationId: 'renea', userId: 'u1' };
  const evento = { httpMethod: 'POST', path: '/api/public-presenca', body: '{"a":1}' };
  let execucoes = 0;
  const operacao = async () => { execucoes += 1; return { statusCode: 200, body: '{"ok":true}' }; };
  const resultados = await Promise.allSettled([
    withIdempotency(evento, contexto, 'chave-1', operacao),
    withIdempotency(evento, contexto, 'chave-1', operacao),
  ]);
  assert.equal(execucoes, 1);
  assert.equal(resultados.filter(item => item.status === 'fulfilled').length, 1);
  const recusado = resultados.find(item => item.status === 'rejected') as PromiseRejectedResult;
  assert.equal(recusado.reason.statusCode, 409);
});

test('transação: escritas na ordem pedida, só depois do bloco, e create repetido interrompe as seguintes', async t => {
  const cliente = clienteFalso();
  substituirClienteSupabase(cliente);
  t.after(() => substituirClienteSupabase(null));
  const db = getAdminDb();
  const doc = db.collection('c').doc('a');
  await db.runTransaction(async transacao => {
    transacao.set(doc, { passo: 1, nome: 'A' });
    transacao.update(doc, { passo: 2 });
  });
  assert.deepEqual(cliente.linhas.get('c/a')?.payload, { passo: 2, nome: 'A' });

  await assert.rejects(db.runTransaction(async transacao => {
    transacao.set(db.collection('c').doc('b'), { nome: 'B' });
    throw new Error('desistiu');
  }));
  assert.equal(cliente.linhas.has('c/b'), false, 'bloco com erro não grava nada');

  await assert.rejects(db.runTransaction(async transacao => {
    transacao.create(doc, { outro: true });
    transacao.create(db.collection('c').doc('envio'), { envio: true });
  }), (erro: { code?: string }) => erro.code === 'already-exists');
  assert.equal(cliente.linhas.has('c/envio'), false, 'reserva recusada não deixa o envio gravado');
});

test('limite de requisições: cabeçalhos inventados pelo cliente não abrem janela nova', async t => {
  const cliente = clienteFalso({ registrar_requisicao: () => ({ data: true }) });
  substituirClienteSupabase(cliente);
  t.after(() => substituirClienteSupabase(null));
  await enforceRateLimit(null, { headers: { 'x-nf-client-connection-ip': '1.1.1.1', 'x-forwarded-for': '9.9.9.9, 200.0.0.5' } }, 'b', 10, 60);
  await enforceRateLimit(null, { headers: { 'x-nf-client-connection-ip': '2.2.2.2', 'x-forwarded-for': '8.8.8.8, 200.0.0.5' } }, 'b', 10, 60);
  assert.equal(cliente.chamadas[0][1].p_chave, cliente.chamadas[1][1].p_chave);
});

test('lote: grava tudo numa chamada só e, se o banco recusar, nada muda', async t => {
  const aplicar: Rpc = (args, linhas) => {
    const gravar = args.p_gravar as Linha[];
    if (gravar.some(item => item.payload.quebra)) return { error: { code: '23514', message: 'check violation' } };
    gravar.forEach(item => linhas.set(item.path, item));
    (args.p_apagar as string[]).forEach(path => linhas.delete(path));
    return { data: null };
  };
  const cliente = clienteFalso({ aplicar_lote_documentos: aplicar });
  cliente.linhas.set('c/a', linha('c', 'a', { nome: 'A', qtd: 1 }));
  cliente.linhas.set('c/z', linha('c', 'z', { nome: 'Z' }));
  substituirClienteSupabase(cliente);
  t.after(() => substituirClienteSupabase(null));
  const db = getAdminDb();

  const ok = db.batch();
  ok.update(db.collection('c').doc('a'), { qtd: 2 });
  ok.set(db.collection('c').doc('b'), { nome: 'B' });
  ok.delete(db.collection('c').doc('z'));
  await ok.commit();
  assert.equal(cliente.chamadas.filter(([nome]) => nome === 'aplicar_lote_documentos').length, 1);
  assert.deepEqual(cliente.linhas.get('c/a')?.payload, { nome: 'A', qtd: 2 });
  assert.deepEqual(cliente.linhas.get('c/b')?.payload, { nome: 'B' });
  assert.equal(cliente.linhas.has('c/z'), false);

  const ruim = db.batch();
  ruim.set(db.collection('c').doc('d'), { nome: 'D' });
  ruim.set(db.collection('c').doc('e'), { quebra: true });
  await assert.rejects(ruim.commit());
  assert.equal(cliente.linhas.has('c/d'), false, 'o primeiro do lote não pode ficar gravado sozinho');
});

test('consulta: com mais de 1000 linhas o registro do fim não some', async t => {
  const cliente = clienteFalso();
  for (let n = 0; n < 1500; n += 1) cliente.linhas.set(`c/${String(n).padStart(4, '0')}`, linha('c', String(n).padStart(4, '0'), { n }));
  substituirClienteSupabase(cliente);
  t.after(() => substituirClienteSupabase(null));
  const { docs } = await getAdminDb().collection('c').where('n', '==', 1499).get();
  assert.deepEqual(docs.map(doc => doc.data()), [{ n: 1499 }]);
  const todos = await getAdminDb().collection('c').get();
  assert.equal(todos.docs.length, 1500);
});
