import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSupabaseFuncionarios } from '../src/next/services/repositories/funcionariosRepository';

test('funcionários Supabase preservam situação e campos opcionais', () => {
  assert.deepEqual(normalizeSupabaseFuncionarios([{
    id: 'func-1', matricula: '001', nome: 'Ana', cargo: 'Engenheira', telefone: '',
    empresa_id: null, ativo: true, lider_matricula: null, lider_nome: null, area: 'Obras',
    responsavel_area: null, divisao: null, secao: null, status: 'ATIVO',
    data_mobilizacao: '2026-10-01', data_desmobilizacao: null, situacao_rh: null,
    observacao: null, created_at: '2026-10-03T00:00:00Z', updated_at: '2026-10-03T00:00:00Z',
  }, {
    id: 'func-2', matricula: null, nome: 'Sem status', cargo: '', telefone: '',
    empresa_id: null, ativo: true, lider_matricula: null, lider_nome: null, area: null,
    responsavel_area: null, divisao: null, secao: null, status: 'DESCONHECIDO',
    data_mobilizacao: null, data_desmobilizacao: null, situacao_rh: null,
    observacao: null, created_at: '2026-10-03T00:00:00Z', updated_at: '2026-10-03T00:00:00Z',
  }]), [
    {
      id: 'func-1', matricula: '001', nome: 'Ana', cargo: 'Engenheira', telefone: '', empresaId: '',
      ativo: true, area: 'Obras', status: 'ATIVO', dataMobilizacao: '2026-10-01',
      criadoEm: '2026-10-03T00:00:00Z', atualizadoEm: '2026-10-03T00:00:00Z',
    },
    {
      id: 'func-2', nome: 'Sem status', cargo: '', telefone: '', empresaId: '', ativo: true,
      criadoEm: '2026-10-03T00:00:00Z', atualizadoEm: '2026-10-03T00:00:00Z',
    },
  ]);
});
