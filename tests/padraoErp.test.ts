import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Padrão ERP (pedido de 10/11/2026: "extremamente rígido, todas as abas no
 * padrão ERP"). Complementa tests/padraoAbas.test.ts com regras de peça a
 * peça, que a máquina confere sem opinião:
 *
 * - tabela-manual: lista em grade só pela TabelaPadrao (o relatório impresso
 *   e os gráficos ficam de fora);
 * - campo-fora: input, select e textarea usam o CAMPO comum, não classe
 *   desenhada à mão (que escondia o foco do teclado);
 * - cartao-fora: cartão é rounded-2xl border-slate-200 bg-white (CARTAO);
 * - cor-botao-fora: o verde de ação é #176b4d, nunca emerald/green 600-900
 *   como fundo;
 * - cinza-claro-na-letra: text-slate-300/400 não passa de 3:1 no branco;
 *   letra secundária é text-slate-500 ou mais escura;
 * - caixa-alta-espacada: rótulo em MAIÚSCULAS ESPAÇADAS (uppercase com
 *   qualquer tracking largo) sai; rótulo é frase normal. Só o cabeçalho de
 *   tabela (th, thead, tr) pode;
 * - emoji: ícone vem do lucide, nunca de emoji;
 * - janela-do-navegador: alert, confirm e prompt travam a tela; use o
 *   ConfirmDialog ou um aviso na faixa;
 * - botao-sem-type: todo <button> diz o type, para não enviar formulário
 *   sem querer.
 *
 * PENDENCIAS guarda quantas ocorrências cada arquivo ainda tem. A lista só
 * diminui: arquivo novo nasce no padrão, um número não pode subir, e quando
 * cai o teste pede para atualizar a lista.
 */
type Regra =
  | 'tabela-manual'
  | 'campo-fora'
  | 'cartao-fora'
  | 'cor-botao-fora'
  | 'cinza-claro-na-letra'
  | 'caixa-alta-espacada'
  | 'emoji'
  | 'janela-do-navegador'
  | 'botao-sem-type';

type Contagem = Partial<Record<Regra, number>>;

const PENDENCIAS: Record<string, Contagem> = {
  'LGPD/LGPDConsentModal.tsx': { 'botao-sem-type': 2, 'emoji': 3, 'janela-do-navegador': 1 },
  'ciclosEquipamento/CycleTimeline.tsx': { 'emoji': 4 },
  'ciclosEquipamento/HistoricoCiclos.tsx': { 'botao-sem-type': 3, 'cartao-fora': 2, 'emoji': 2 },
  'ciclosEquipamento/RegistrarCiclo.tsx': { 'botao-sem-type': 2, 'cartao-fora': 1 },
};

const RAIZ = new URL('../src/components/', import.meta.url);
const ARQUIVOS = readdirSync(RAIZ, { recursive: true, encoding: 'utf8' })
  .filter(arquivo => arquivo.endsWith('.tsx'))
  .map(arquivo => arquivo.replace(/\\/g, '/'))
  .sort();

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
const SEM_TABELA_PADRAO = /(ReportLayout|Grafico)[^/]*\.tsx$/;
/**
 * Tabelas que não são lista: a grade de digitação de viagens (cada célula é
 * um campo, cola do Excel) e as folhas que só existem na impressão.
 */
const TABELA_DE_OUTRO_TIPO = new Set(['materiais/GradeViagens.tsx', 'estacas/RelatoriosEstacas.tsx', 'materiais/RelatoriosMateriais.tsx']);
/** "uppercase" junto de qualquer tracking largo na mesma lista de classes. */
const ESPACADO = String.raw`\btracking-(?:widest|wider|wide|\[[^\]]*\])`;
const CAIXA_ALTA_ESPACADA = new RegExp(String.raw`\buppercase\b[^'"\x60\n{}]*?${ESPACADO}|${ESPACADO}[^'"\x60\n{}]*?\buppercase\b`, 'g');

export const contarForaDoPadrao = (arquivo: string, fonte: string): Contagem => {
  const contagem: Contagem = {};
  const somar = (regra: Regra, quantas = 1) => {
    if (quantas > 0) contagem[regra] = (contagem[regra] ?? 0) + quantas;
  };
  if (!SEM_TABELA_PADRAO.test(arquivo) && !TABELA_DE_OUTRO_TIPO.has(arquivo)) somar('tabela-manual', (fonte.match(/<table\b/g) ?? []).length);
  for (const classe of fonte.matchAll(/className="([^"]*)"/g)) {
    const antes = fonte.slice(Math.max(0, classe.index - 1500), classe.index);
    const tags = [...antes.matchAll(/<([a-zA-Z]+)\b/g)];
    const tag = tags.length ? tags[tags.length - 1][1] : '';
    const valor = classe[1];
    if (['input', 'select', 'textarea'].includes(tag) && /\bborder\b/.test(valor) && !/\baccent-/.test(valor)) somar('campo-fora');
    if (/\brounded-(lg|xl)\b/.test(valor) && /\bborder\b/.test(valor) && valor.includes('bg-white') && /\bp-\d/.test(valor)
      && (!tag || ['div', 'section', 'article', 'li'].includes(tag))) somar('cartao-fora');
  }
  somar('cor-botao-fora', (fonte.match(/\bbg-(emerald|green)-[6789]00\b/g) ?? []).length);
  somar('cinza-claro-na-letra', (fonte.match(/\btext-slate-(300|400)\b/g) ?? []).length);
  for (const trecho of fonte.matchAll(CAIXA_ALTA_ESPACADA)) {
    const tags = [...fonte.slice(Math.max(0, trecho.index - 1500), trecho.index).matchAll(/<([a-zA-Z]+)\b/g)];
    if (!['th', 'thead', 'tr'].includes(tags.length ? tags[tags.length - 1][1] : '')) somar('caixa-alta-espacada');
  }
  somar('emoji', (fonte.match(EMOJI) ?? []).length);
  somar('janela-do-navegador', (fonte.match(/\b(?:window\.)?(?:alert|confirm|prompt)\(/g) ?? []).length);
  somar('botao-sem-type', (fonte.match(/<button\b(?![^>]*\btype=)/g) ?? []).length);
  return contagem;
};

for (const arquivo of ARQUIVOS) {
  test(`${arquivo} segue o padrão ERP`, () => {
    const atual = contarForaDoPadrao(arquivo, readFileSync(new URL(arquivo, RAIZ), 'utf8'));
    const permitido = PENDENCIAS[arquivo] ?? {};
    const piorou = (Object.keys(atual) as Regra[])
      .filter(regra => (atual[regra] ?? 0) > (permitido[regra] ?? 0))
      .map(regra => `${regra}: ${atual[regra]} (o limite é ${permitido[regra] ?? 0})`);
    assert.deepEqual(piorou, [], `${arquivo} saiu do padrão ERP. Veja o comentário do topo de tests/padraoErp.test.ts.`);
    const melhorou = (Object.keys(permitido) as Regra[])
      .filter(regra => (atual[regra] ?? 0) < (permitido[regra] ?? 0))
      .map(regra => `${regra}: agora ${atual[regra] ?? 0}`);
    assert.deepEqual(melhorou, [], `${arquivo} melhorou: baixe o número em PENDENCIAS.`);
  });
}

test('a lista de pendências do padrão ERP só cita arquivos que existem', () => {
  assert.deepEqual(Object.keys(PENDENCIAS).filter(arquivo => !ARQUIVOS.includes(arquivo)), []);
});
