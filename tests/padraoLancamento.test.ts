import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

/**
 * Trava do padrão de lançamento (pedido de 15/11/2026). Toda aba que lança
 * alguma coisa segue o Lançar do Combustível:
 * - telaCheia: o lançamento ocupa a área inteira da aba (Modal com
 *   `lancamento` ou formulário marcado com `data-lancamento`);
 * - atalhoNovo: a tecla N abre um lançamento novo (useAtalhoNovo);
 * - ctrlS: Ctrl+S salva (o Modal com `lancamento` e `onSubmit` já faz);
 * - relatorios: a aba tem a subaba "Relatórios".
 *
 * PENDENCIAS guarda o que cada aba ainda deve. A lista só diminui: quando a
 * aba passa a cumprir um item, o teste pede para tirar o item da lista.
 */
type Regra = 'telaCheia' | 'atalhoNovo' | 'ctrlS' | 'relatorios';

const ABAS_COM_LANCAMENTO: Record<string, readonly string[]> = {
  combustivel: ['CombustivelOperacionalTab.tsx', 'combustivel/LancamentoCombustivel.tsx'],
  programacao: ['ProgramacaoTab.tsx', 'programacao/AtividadeForm.tsx'],
  solicitacoes: ['SolicitacoesTab.tsx', 'solicitacoes/NovaSolicitacao.tsx'],
  estacas: ['EstacasTab.tsx', 'estacas/FormCravacao.tsx', 'estacas/abasEstacas.ts'],
  manutencao: ['ManutencaoTab.tsx'],
  frotas: ['ControleEquipamentosDiarioTab.tsx', 'fleet/DailyRecordForm.tsx'],
  pluviometro: ['PluviometroTab.tsx'],
  presenca: ['ControlePresencaTab.tsx'],
  contratacao: ['ContratacaoTab.tsx'],
};

const PENDENCIAS: Record<string, readonly Regra[]> = {
  programacao: ['atalhoNovo', 'relatorios'],
  solicitacoes: ['telaCheia'],
  estacas: ['telaCheia', 'atalhoNovo', 'ctrlS'],
  frotas: ['telaCheia', 'ctrlS', 'relatorios'],
  pluviometro: ['telaCheia', 'relatorios'],
  presenca: ['telaCheia', 'atalhoNovo', 'ctrlS'],
  contratacao: ['telaCheia', 'atalhoNovo', 'ctrlS', 'relatorios'],
};

const components = new URL('../src/components/', import.meta.url);

const regrasQueFaltam = (arquivos: readonly string[]): Regra[] => {
  const source = arquivos.map(arquivo => readFileSync(new URL(arquivo, components), 'utf8')).join('\n');
  const modalDeLancamento = /^\s*lancamento$/m.test(source);
  const faltam: Regra[] = [];
  if (!modalDeLancamento && !source.includes('data-lancamento')) faltam.push('telaCheia');
  if (!source.includes('useAtalhoNovo(') && !/key(?:\.toLowerCase\(\))? === ['"]n['"]/.test(source)) faltam.push('atalhoNovo');
  if (!(modalDeLancamento && source.includes('onSubmit=')) && !/=== ['"]s['"]/.test(source)) faltam.push('ctrlS');
  if (!/rotulo: ['"]Relatórios/.test(source)) faltam.push('relatorios');
  return faltam;
};

for (const [aba, arquivos] of Object.entries(ABAS_COM_LANCAMENTO)) {
  test(`${aba} segue o padrão de lançamento`, () => {
    const faltam = regrasQueFaltam(arquivos);
    const pendente = new Set(PENDENCIAS[aba] ?? []);
    const novas = faltam.filter(regra => !pendente.has(regra));
    assert.deepEqual(novas, [], `${aba} saiu do padrão de lançamento em: ${novas.join(', ')}.`);
    const resolvidas = [...pendente].filter(regra => !faltam.includes(regra));
    assert.deepEqual(resolvidas, [], `${aba} já cumpre ${resolvidas.join(', ')}: tire da lista PENDENCIAS.`);
  });
}

test('a lista de pendências de lançamento só cita abas conhecidas', () => {
  assert.deepEqual(Object.keys(PENDENCIAS).filter(aba => !(aba in ABAS_COM_LANCAMENTO)), []);
});
