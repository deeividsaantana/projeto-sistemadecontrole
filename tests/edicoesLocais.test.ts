import assert from 'node:assert/strict';
import test from 'node:test';
import { manterEdicoesLocais } from '../src/cloud/edicoesLocais';
import { capturarAssinaturas } from '../src/cloud/mudancasNuvem';

const base = {
  ordensServico: [
    { id: 'os-1', status: 'Aberta' },
    { id: 'os-2', status: 'Aberta' },
    { id: 'os-3', status: 'Aberta', atualizadoEm: '2026-10-20T10:00:00Z' },
  ],
};
const assinaturas = capturarAssinaturas(base, 'v1');

test('edição feita aqui e não mexida na nuvem fica com a versão daqui (A13)', () => {
  const local = { ordensServico: [{ id: 'os-1', status: 'Concluída' }, base.ordensServico[1], base.ordensServico[2]] };
  const nuvem = { ordensServico: [...base.ordensServico, { id: 'os-4', status: 'Aberta' }] };
  const { retrato, editadas } = manterEdicoesLocais(nuvem, local, assinaturas);
  assert.deepEqual(editadas, [{ tabela: 'ordensServico', editados: 1 }]);
  assert.deepEqual((retrato.ordensServico as Array<{ id: string; status: string }>).map(item => `${item.id}:${item.status}`), ['os-1:Concluída', 'os-2:Aberta', 'os-3:Aberta', 'os-4:Aberta']);
});

test('edição só na nuvem fica com a da nuvem; os dois mudaram, vence a data mais nova', () => {
  const local = {
    ordensServico: [
      base.ordensServico[0],
      { id: 'os-2', status: 'Em Andamento' },
      { id: 'os-3', status: 'Concluída', atualizadoEm: '2026-10-20T12:00:00Z' },
    ],
  };
  const nuvem = {
    ordensServico: [
      { id: 'os-1', status: 'Cancelada' },
      { id: 'os-2', status: 'Aguardando Peça' },
      { id: 'os-3', status: 'Em Análise', atualizadoEm: '2026-10-20T11:00:00Z' },
    ],
  };
  const { retrato } = manterEdicoesLocais(nuvem, local, assinaturas);
  assert.deepEqual((retrato.ordensServico as Array<{ status: string }>).map(item => item.status), ['Cancelada', 'Aguardando Peça', 'Concluída']);
});

test('sem assinaturas da versão conhecida nada muda', () => {
  const nuvem = { ordensServico: base.ordensServico };
  const local = { ordensServico: [{ id: 'os-1', status: 'Concluída' }] };
  const { retrato, editadas } = manterEdicoesLocais(nuvem, local, null);
  assert.equal(retrato, nuvem);
  assert.deepEqual(editadas, []);
});

test('registro excluído na nuvem não volta pela edição local', () => {
  const local = { ordensServico: [{ id: 'os-1', status: 'Concluída' }] };
  const nuvem = { ordensServico: [base.ordensServico[1]] };
  const { retrato } = manterEdicoesLocais(nuvem, local, assinaturas);
  assert.deepEqual((retrato.ordensServico as Array<{ id: string }>).map(item => item.id), ['os-2']);
});
