import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { abasEstacas } from '../src/components/estacas/abasEstacas';
import { abasCadastros } from '../src/components/cadastros/abasCadastros';

/**
 * Pedido do usuário em 10/11/2026: cada aba com só o essencial no topo. A
 * primeira linha de subtelas tem no máximo quatro opções; o resto fica num
 * grupo, que abre a segunda linha. Esta trava não pode ser afrouxada.
 */
const MAXIMO = 4;

test('Estacas e Cadastros têm no máximo quatro opções no topo', () => {
  assert.ok(abasEstacas({ faltam: 3, estacas: 10, notasPendentes: 2, lotes: 1 }).length <= MAXIMO);
  for (const lixeira of [true, false]) {
    for (const admin of [true, false]) {
      assert.ok(abasCadastros(() => 1, lixeira, admin).length <= MAXIMO, `lixeira=${lixeira} admin=${admin}`);
    }
  }
});

// As abas que montam a lista dentro do componente: conta as entradas de
// primeiro nível (aba solta ou grupo) da lista entregue ao AbasDaTela.
const TELAS: Array<[arquivo: string, inicio: string]> = [
  ['ControleEquipamentosDiarioTab.tsx', 'const vistas: ReadonlyArray<ItemDasAbas<FleetView>> = ['],
  ['ManutencaoTab.tsx', 'const subtelas = ['],
  ['ControlePresencaTab.tsx', 'const navItems: ReadonlyArray<ItemDasAbas<View>> = ['],
  ['MeuDiaTab.tsx', 'const abas: ItemDasAbas<Parte>[] = ['],
  ['CombustivelOperacionalTab.tsx', 'const vistas'],
  ['SolicitacoesTab.tsx', 'const subtelas: ItemDasAbas<Subtela>[] = ['],
];

const entradasDePrimeiroNivel = (fonte: string, inicio: string) => {
  const comeco = fonte.indexOf(inicio);
  assert.ok(comeco >= 0, `não achei ${inicio}`);
  let i = fonte.indexOf('[', comeco + inicio.length - 1);
  let nivel = 0;
  let entradas = 0;
  for (; i < fonte.length; i += 1) {
    const c = fonte[i];
    if (c === '[' || c === '{' || c === '(') {
      nivel += 1;
      if (nivel === 2 && c === '{') entradas += 1;
    } else if (c === ']' || c === '}' || c === ')') {
      nivel -= 1;
      if (nivel === 0) break;
    } else if (nivel === 1 && fonte.startsWith('...', i)) {
      entradas += 1;
      i += 2;
    }
  }
  return entradas;
};

for (const [arquivo, inicio] of TELAS) {
  test(`${arquivo} tem no máximo quatro opções no topo`, () => {
    const fonte = readFileSync(new URL(`../src/components/${arquivo}`, import.meta.url), 'utf8');
    const total = entradasDePrimeiroNivel(fonte, inicio);
    assert.ok(total > 0 && total <= MAXIMO, `${arquivo}: ${total} opções no topo`);
  });
}
