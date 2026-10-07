import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSupabaseCostCenters } from '../src/next/services/repositories/costCentersRepository';

test('centros de custo são limitados à obra solicitada', () => {
  assert.deepEqual(normalizeSupabaseCostCenters([
    { id: 'cc-1', project_id: 'obra-1', name: 'Terraplenagem', code: 'TER-01' },
    { id: 'cc-2', project_id: 'obra-2', name: 'Drenagem', code: null },
    { id: '', project_id: 'obra-1', name: 'Sem id', code: null },
  ], 'obra-1'), [{
    id: 'cc-1',
    projectId: 'obra-1',
    name: 'Terraplenagem',
    code: 'TER-01',
  }]);
});
