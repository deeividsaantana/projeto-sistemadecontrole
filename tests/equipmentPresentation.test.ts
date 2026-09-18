/**
 * A operação reconhece a máquina pelo ícone antes de ler o prefixo. Estes
 * testes travam a classificação: casos ambíguos como "caminhão pipa" e
 * "caminhão munck" não podem cair na família de basculante.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyEquipment, presentEquipment, EQUIPMENT_FAMILIES } from '../src/utils/equipmentPresentation';

const eq = (nome: string, extras: { prefixo?: string; tipo?: string; familia?: string } = {}) => ({
  prefixo: extras.prefixo ?? '',
  nome,
  tipo: extras.tipo ?? '',
  familia: extras.familia ?? '',
});

test('basculante é reconhecido por nome e por prefixo CB', () => {
  assert.equal(classifyEquipment(eq('Caminhão basculante')), 'basculante');
  assert.equal(classifyEquipment(eq('Caçamba 6x4')), 'basculante');
  assert.equal(classifyEquipment(eq('', { prefixo: 'CB-1005' })), 'basculante');
});

test('escavadeira e carregadeira ficam na mesma família', () => {
  assert.equal(classifyEquipment(eq('Escavadeira hidráulica')), 'escavadeira');
  assert.equal(classifyEquipment(eq('Retroescavadeira')), 'escavadeira');
  assert.equal(classifyEquipment(eq('Pá carregadeira')), 'escavadeira');
});

test('trator, motoniveladora e rolo são máquina pesada', () => {
  assert.equal(classifyEquipment(eq('Trator de esteira')), 'pesada');
  assert.equal(classifyEquipment(eq('Motoniveladora')), 'pesada');
  assert.equal(classifyEquipment(eq('Rolo compactador')), 'pesada');
});

test('caminhão pipa vai para apoio, não para basculante', () => {
  // "caminhao" casaria com carga e "pipa" é o que decide: a ordem dos testes
  // na classificação é o que mantém isso correto.
  assert.equal(classifyEquipment(eq('Caminhão pipa')), 'apoio');
  assert.equal(classifyEquipment(eq('Comboio de lubrificação')), 'apoio');
});

test('munck e guindaste vão para carga', () => {
  assert.equal(classifyEquipment(eq('Caminhão munck')), 'carga');
  assert.equal(classifyEquipment(eq('Guindaste')), 'carga');
  assert.equal(classifyEquipment(eq('Carreta prancha')), 'carga');
});

test('perfuratriz tem família própria', () => {
  assert.equal(classifyEquipment(eq('Perfuratriz')), 'perfuratriz');
  assert.equal(classifyEquipment(eq('Bate-estaca')), 'perfuratriz');
});

test('cadastro sem descrição cai em genérico', () => {
  assert.equal(classifyEquipment(eq('')), 'generico');
  assert.equal(classifyEquipment(undefined), 'generico');
});

test('toda família tem ícone e rótulo', () => {
  EQUIPMENT_FAMILIES.forEach(family => {
    const presentation = presentEquipment(eq(family === 'basculante' ? 'Caminhão basculante' : family));
    assert.ok(presentation.Icon, `família ${family} sem ícone`);
    assert.ok(presentation.label.length > 0, `família ${family} sem rótulo`);
  });
});

test('genérico usa o tipo cadastrado como rótulo quando existe', () => {
  assert.equal(presentEquipment(eq('', { tipo: 'Container' })).label, 'Container');
  assert.equal(presentEquipment(eq('')).label, 'Equipamento');
});
