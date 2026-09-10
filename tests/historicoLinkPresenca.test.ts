import assert from 'node:assert/strict';
import test from 'node:test';
import { __testing } from '../netlify/functions/public-presenca.js';

const { loadGroupHistory, HISTORY_DOCS_LIMIT } = __testing as {
  loadGroupHistory: (db: unknown, grupoId: string) => Promise<{ datas: string[] }>;
  HISTORY_DOCS_LIMIT: number;
};

const envio = (data: string) => ({
  data: () => ({ kind: 'presence', payload: { data, grupoId: 'grupo-ramo-100', records: [] } }),
});

// Um banco de mentira que registra como a consulta foi montada, para provar
// que o corte acontece no Firestore e não depois de baixar a obra inteira.
const bancoFalso = ({ exigeIndice = false } = {}) => {
  const consulta = { ordenou: '', limite: 0, varreuTudo: false };
  // No Firestore cada refinamento devolve uma consulta nova; o objeto original
  // continua sem ordem e sem limite. O falso precisa imitar isso, senão o
  // caminho de retorno herdaria o limite e o teste mentiria.
  const query = (estado: { ordenou: string; limite: number }) => ({
    where: () => query(estado),
    orderBy: (campo: string, direcao: string) => query({ ...estado, ordenou: `${campo} ${direcao}` }),
    limit: (valor: number) => query({ ...estado, limite: valor }),
    get: async () => {
      if (estado.limite === 0) consulta.varreuTudo = true;
      else {
        consulta.ordenou = estado.ordenou;
        consulta.limite = estado.limite;
        if (exigeIndice) {
          const erro = new Error('The query requires an index.') as Error & { code?: number };
          erro.code = 9;
          throw erro;
        }
      }
      return { docs: [envio('2026-09-10'), envio('2026-09-09')] };
    },
  });
  return { consulta, database: { collection: () => query({ ordenou: '', limite: 0 }) } };
};

test('o histórico do link é cortado no banco, não depois de baixar tudo', async () => {
  const { consulta, database } = bancoFalso();
  const historico = await loadGroupHistory(database, 'grupo-ramo-100');

  assert.equal(consulta.ordenou, 'payload.data desc');
  assert.equal(consulta.limite, HISTORY_DOCS_LIMIT);
  assert.equal(consulta.varreuTudo, false, 'não houve varredura de todos os envios da equipe');
  assert.deepEqual(historico.datas, ['2026-09-10', '2026-09-09']);
});

test('sem o índice publicado o link continua abrindo, pela varredura antiga', async () => {
  const { consulta, database } = bancoFalso({ exigeIndice: true });
  const historico = await loadGroupHistory(database, 'grupo-ramo-100');

  assert.equal(consulta.varreuTudo, true, 'caiu no caminho antigo em vez de derrubar o link');
  assert.deepEqual(historico.datas, ['2026-09-10', '2026-09-09']);
});

test('erro que não é falta de índice não é engolido', async () => {
  const query = {
    where: () => query,
    orderBy: () => query,
    limit: () => query,
    get: async () => { throw new Error('permission denied'); },
  };
  await assert.rejects(
    () => loadGroupHistory({ collection: () => query }, 'grupo-ramo-100'),
    /permission denied/,
  );
});
