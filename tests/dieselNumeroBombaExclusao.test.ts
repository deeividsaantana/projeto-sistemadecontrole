import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Abastecimento, Equipamento } from '../src/types';
import { lerNumero } from '../src/modules/frota/combustivelDoDia';
import { rotuloAbastecimento } from '../src/modules/frota/lixeiraCombustivel';
import { montarQuadro } from '../src/modules/frota/quadroFrota';
import { parseFuelFormNumber, resolveMacroPumpReadings } from '../src/utils/fuelMacroForm';

test('A16: milhar com ponto é lido igual na tela e no que é salvo', () => {
  assert.equal(parseFuelFormNumber('1.250'), 1250);
  assert.equal(parseFuelFormNumber('45.320'), 45320);
  assert.equal(parseFuelFormNumber('12.345'), 12345);
  assert.equal(parseFuelFormNumber('1.234.567'), 1234567);
  assert.equal(parseFuelFormNumber('1.250,5'), 1250.5);
  assert.equal(parseFuelFormNumber('1250,5'), 1250.5);
  assert.equal(parseFuelFormNumber('12.5'), 12.5);
  assert.equal(parseFuelFormNumber('1,250.75'), 1250.75);
  assert.equal(parseFuelFormNumber(320), 320);
  assert.equal(parseFuelFormNumber('', 0), 0);
  for (const texto of ['1.250', '45.320', '1.250,5', '12.5', '300']) {
    assert.equal(lerNumero(texto), parseFuelFormNumber(texto), `mesmo leitor para "${texto}"`);
  }
});

const abast = (id: string, data: string, hora: string, bombaFinal: number, extra: Partial<Abastecimento> = {}) =>
  ({ id, data, hora, comboioId: 'C1', bombaInicial: bombaFinal - 100, bombaFinal, quantidadeLitros: 100, ...extra }) as Abastecimento;

test('A20: bomba sugerida é a do abastecimento logo antes da data e hora, não o último da lista', () => {
  // Ordem da planilha importada: o mais recente primeiro, o mais antigo por último.
  const registros = [
    abast('novo', '2026-10-15', '16:00', 45_320),
    abast('meio', '2026-10-10', '09:00', 40_000),
    abast('antigo', '2026-09-20', '08:00', 31_000),
  ];
  const sugerida = (data: string, hora: string) => resolveMacroPumpReadings({ records: registros, comboioId: 'C1', data, hora, litros: 0 }).bombaInicial;
  assert.equal(sugerida('2026-10-16', '07:30'), 45_320);
  assert.equal(sugerida('2026-10-12', '0800'), 40_000, 'lançamento retroativo usa o que veio antes dele');
  assert.equal(sugerida('2026-09-01', '08:00'), 0, 'antes de tudo, a pessoa digita');
  const digitada = resolveMacroPumpReadings({ records: registros, comboioId: 'C1', data: '2026-10-16', hora: '07:30', litros: '1.000', bombaInicialManual: '45.320' });
  assert.deepEqual(digitada, { bombaInicial: 45_320, bombaFinal: 46_320 });
});

test('M31: o Quadro mostra o horímetro mais recente, não o maior já digitado', () => {
  const equipamento = { id: 'EC01', prefixo: 'EC01', nome: 'Escavadeira', tipo: 'Escavadeira', status: 'Ativo' } as unknown as Equipamento;
  const leitura = (id: string, data: string, hora: string, horimetroInicial: number) => ({ id, equipamentoId: 'EC01', data, hora, horimetroInicial }) as unknown as Abastecimento;
  const [cartao] = montarQuadro({
    dia: '2026-10-16',
    equipamentos: [equipamento],
    registros: [],
    gruposEquipe: [],
    abastecimentos: [leitura('a', '2026-10-14', '08:00', 15_230), leitura('c', '2026-10-15', '17:00', 1_530), leitura('b', '2026-10-15', '08:00', 1_524)],
  });
  assert.equal(cartao.horimetro, 1_530);
});

test('A17: excluir abastecimento vai para a Lixeira, com data, prefixo e litros', () => {
  const rotulo = rotuloAbastecimento({ data: '2026-10-15', hora: '07:40', equipamentoId: 'e1', prefixoInformado: '', quantidadeLitros: 1250.5 }, [{ id: 'e1', prefixo: 'CB-12' }]);
  assert.equal(rotulo, '15/10/2026 · 07:40 · CB-12 · 1.250,5 L');
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const exclusao = app.slice(app.indexOf('const handleDeleteAbastecimentos'), app.indexOf('const handleDeleteAbastecimento = '));
  assert.match(exclusao, /excluirCadastros\(\{\s*tabela: 'abastecimentos'/, 'a exclusão grava a marca e a cópia na Lixeira');
  assert.doesNotMatch(app, /Excluiu permanentemente[^`]*abastecimento/);
  assert.match(app, /abastecimentos: \{ lista: abastecimentos as never\[\]/, 'a Lixeira sabe devolver abastecimento');
});
