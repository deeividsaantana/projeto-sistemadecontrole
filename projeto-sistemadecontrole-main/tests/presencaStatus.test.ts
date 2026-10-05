import assert from 'node:assert/strict';
import test from 'node:test';
import { resumirPresencas } from '../src/utils/presencaStatus';

test('resumo separa falta de baixa, recesso e ferias', () => {
  const resumo = resumirPresencas([
    'Presente', 'Atraso', 'Saída antecipada', 'Ausente', 'Baixada', 'Recesso',
    'Férias', 'Falta justificada', 'Atestado', 'Desligado',
  ]);
  assert.deepEqual(resumo, {
    presentes: 3,
    faltas: 1,
    afastamentos: 3,
    justificados: 2,
    desligados: 1,
    outros: 0,
    previstos: 9,
  });
});
