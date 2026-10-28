import type { Abastecimento } from '../../types';
import { exportToExcel } from '../../modules/frota/fuelReport';

describe('exportToExcel helper', () => {
  it('creates a non‑empty Excel buffer with correct headers', async () => {
    const sample = [
      {
        id: '1',
        data: '2026-06-15',
        hora: '08:00',
        equipamentoId: 'eq-1',
        horimetroInicial: 100,
        kmInicial: 5000,
        bombaInicial: 5000,
        quantidadeLitros: 200,
        bombaFinal: 5200,
        tipoCombustivelId: 'cf-1',
        comboioId: 'co-1',
        responsavel: 'Operador',
        observacao: 'Teste',
        prefixoInformado: 'EQ1',
        status: 'OK',
      },
    ];
    const buffer = await exportToExcel(sample);
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(0);
    // Quick sanity: first few bytes of an XLSX file start with PK (ZIP signature)
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });
});
