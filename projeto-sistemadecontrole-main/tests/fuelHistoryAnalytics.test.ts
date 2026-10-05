import assert from 'node:assert/strict';
import test from 'node:test';
import type { Abastecimento, Comboio, Empresa, Equipamento, TipoCombustivel } from '../src/types';
import { buildFuelHistoryAnalytics } from '../src/modules/frota/fuelHistoryAnalytics';

const empresa: Empresa = { id: 'empresa-a', nome: 'Empresa A', cnpj: '', telefone: '', responsavel: '' };
const equipamento: Equipamento = {
  id: 'equip-a', prefixo: 'CB101', nome: 'Caminhão', tipo: 'Caminhão', marca: '', modelo: '', seriePlaca: '',
  empresaId: empresa.id, status: 'Ativo', localAtualId: '', observacao: '',
};
const comboio: Comboio = { id: 'comboio-a', nome: 'TQC022', placa: '', capacidadeLitros: 0, responsavel: '' };
const combustivel: TipoCombustivel = { id: 'diesel', nome: 'Diesel S10' };
const registros: Abastecimento[] = [
  { id: 'l1', data: '2026-10-02', hora: '10:00', equipamentoId: equipamento.id, horimetroInicial: 10, kmInicial: 0, bombaInicial: 100, quantidadeLitros: 100, bombaFinal: 200, tipoCombustivelId: combustivel.id, comboioId: comboio.id, responsavel: '', observacao: '' },
  { id: 'l2', data: '2026-09-20', hora: '11:00', equipamentoId: equipamento.id, horimetroInicial: 20, kmInicial: 0, bombaInicial: 200, quantidadeLitros: 50, bombaFinal: 250, tipoCombustivelId: combustivel.id, comboioId: comboio.id, responsavel: '', observacao: '' },
];

test('resume litros e quantidade por empresa, equipamento, comboio e combustível', () => {
  const resumo = buildFuelHistoryAnalytics({ records: registros, equipamentos: [equipamento], empresas: [empresa], comboios: [comboio], combustiveis: [combustivel], referenceDate: '2026-10-05' });

  assert.equal(resumo.totalRegistros, 2);
  assert.equal(resumo.totalLitros, 150);
  assert.deepEqual(resumo.porEmpresa[0], { chave: 'empresa-a', nome: 'Empresa A', registros: 2, litros: 150, percentual: 100 });
  assert.deepEqual(resumo.porEquipamento[0], { chave: 'equip-a', nome: 'CB101', registros: 2, litros: 150, percentual: 100 });
  assert.equal(resumo.porComboio[0].nome, 'TQC022');
  assert.equal(resumo.porCombustivel[0].nome, 'Diesel S10');
});

test('monta seis meses sem preencher períodos vazios com lançamentos fictícios', () => {
  const resumo = buildFuelHistoryAnalytics({ records: registros, equipamentos: [equipamento], empresas: [empresa], comboios: [comboio], combustiveis: [combustivel], referenceDate: '2026-10-05' });

  assert.deepEqual(resumo.porMes.map(item => item.chave), ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
  assert.deepEqual(resumo.porMes.map(item => item.litros), [0, 0, 0, 0, 50, 100]);
});
