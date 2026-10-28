import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  OPCOES_POR_PAGINA,
  POR_PAGINA_PADRAO,
  TabelaPadrao,
  colunasDoCartao,
  gruposDaPagina,
  ordenarLinhasTabela,
  paginarLinhas,
  paginasVisiveis,
  proximaOrdenacao,
  type ColunaTabela,
} from '../src/shared/ui/TabelaPadrao';

/**
 * Contrato da TabelaPadrao, a única tabela do sistema (auditoria de front
 * 21/10/2026, C2/A5/M9): ordena pelo cabeçalho com aria-sort no <th>, pagina
 * em 25/50/100 (padrão 50) e no celular mostra os mesmos campos em cartões.
 */
interface Linha { id: string; nome: string; litros: number | null; obs: string }

const linhas: Linha[] = [
  { id: 'a', nome: 'Escavadeira 10', litros: 120, obs: 'ok' },
  { id: 'b', nome: 'escavadeira 2', litros: null, obs: '' },
  { id: 'c', nome: 'Caminhão 7', litros: 35.5, obs: 'troca de pneu' },
  { id: 'd', nome: 'Ácido', litros: 900, obs: '' },
];

const colunas: ColunaTabela<Linha>[] = [
  { chave: 'nome', titulo: 'Nome', render: l => l.nome, valorOrdenacao: l => l.nome },
  { chave: 'litros', titulo: 'Litros', alinhamento: 'direita', render: l => l.litros ?? '—', valorOrdenacao: l => l.litros },
  { chave: 'obs', titulo: 'Observação', render: l => l.obs, noCartao: false },
];

const ids = (lista: readonly Linha[]) => lista.map(item => item.id).join(',');

test('ordena texto em pt-BR com número natural e sem diferenciar acento/caixa', () => {
  assert.equal(ids(ordenarLinhasTabela(linhas, colunas, { chave: 'nome', direcao: 'asc' })), 'd,c,b,a');
  assert.equal(ids(ordenarLinhasTabela(linhas, colunas, { chave: 'nome', direcao: 'desc' })), 'a,b,c,d');
});

test('ordena número como número e deixa vazio sempre no fim', () => {
  assert.equal(ids(ordenarLinhasTabela(linhas, colunas, { chave: 'litros', direcao: 'asc' })), 'c,a,d,b');
  assert.equal(ids(ordenarLinhasTabela(linhas, colunas, { chave: 'litros', direcao: 'desc' })), 'd,a,c,b');
});

test('coluna sem valor de ordenação ou sem ordenação mantém a ordem recebida, sem mutar a lista', () => {
  const copia = [...linhas];
  assert.equal(ordenarLinhasTabela(linhas, colunas, { chave: 'obs', direcao: 'asc' }), linhas);
  assert.equal(ordenarLinhasTabela(linhas, colunas, null), linhas);
  ordenarLinhasTabela(linhas, colunas, { chave: 'nome', direcao: 'asc' });
  assert.deepEqual(linhas, copia);
});

test('clicar na mesma coluna inverte; coluna nova começa crescente', () => {
  assert.deepEqual(proximaOrdenacao(null, 'nome'), { chave: 'nome', direcao: 'asc' });
  assert.deepEqual(proximaOrdenacao({ chave: 'nome', direcao: 'asc' }, 'nome'), { chave: 'nome', direcao: 'desc' });
  assert.deepEqual(proximaOrdenacao({ chave: 'nome', direcao: 'desc' }, 'nome'), { chave: 'nome', direcao: 'asc' });
  assert.deepEqual(proximaOrdenacao({ chave: 'nome', direcao: 'desc' }, 'litros'), { chave: 'litros', direcao: 'asc' });
});

test('paginação: 25/50/100 com 50 de padrão, fatia e nunca passa do total', () => {
  assert.deepEqual([...OPCOES_POR_PAGINA], [25, 50, 100]);
  assert.equal(POR_PAGINA_PADRAO, 50);
  const muitas = Array.from({ length: 130 }, (_, indice) => indice);
  const primeira = paginarLinhas(muitas, 1, 50);
  assert.equal(primeira.visiveis.length, 50);
  assert.equal(primeira.totalPaginas, 3);
  assert.equal(primeira.inicio, 0);
  const ultima = paginarLinhas(muitas, 3, 50);
  assert.deepEqual([ultima.visiveis[0], ultima.visiveis.length, ultima.inicio], [100, 30, 100]);
  assert.equal(paginarLinhas(muitas, 99, 50).pagina, 3, 'página além do fim cai na última');
  assert.equal(paginarLinhas(muitas, 0, 50).pagina, 1);
  assert.equal(paginarLinhas([], 4, 50).totalPaginas, 1);
  assert.equal(paginarLinhas(muitas, 2, 100).visiveis.length, 30);
});

test('janela de páginas tem até 5 números em volta da atual', () => {
  assert.deepEqual(paginasVisiveis(1, 3), [1, 2, 3]);
  assert.deepEqual(paginasVisiveis(1, 20), [1, 2, 3, 4, 5]);
  assert.deepEqual(paginasVisiveis(10, 20), [8, 9, 10, 11, 12]);
  assert.deepEqual(paginasVisiveis(20, 20), [16, 17, 18, 19, 20]);
});

test('cartão do celular mostra os mesmos campos na mesma ordem, menos os marcados fora', () => {
  assert.deepEqual(colunasDoCartao(colunas).map(coluna => coluna.chave), ['nome', 'litros']);
});

test('desenha a tabela acessível: título, th scope=col com aria-sort, números à direita e rodapé', () => {
  const html = renderToStaticMarkup(
    <TabelaPadrao
      titulo="Abastecimentos"
      linhas={Array.from({ length: 60 }, (_, indice) => ({ id: `l${indice}`, nome: `Máquina ${indice}`, litros: indice, obs: '' }))}
      colunas={colunas}
      idDaLinha={linha => linha.id}
      nomeDoItem={{ um: 'abastecimento', varios: 'abastecimentos' }}
      ordenacaoInicial={{ chave: 'litros', direcao: 'desc' }}
      onAbrirLinha={() => undefined}
      acoes={linha => <button type="button">Editar {linha.nome}</button>}
      selecao={{ marcados: new Set(['l59']), onAlternar: () => undefined, onAlternarVarios: () => undefined }}
    />,
  );
  assert.match(html, /<caption class="sr-only">Abastecimentos<\/caption>/);
  assert.match(html, /<th scope="col" aria-sort="none"[^>]*>.*?Nome/);
  assert.match(html, /<th scope="col" aria-sort="descending"[^>]*>.*?Litros/);
  assert.doesNotMatch(html, /<button[^>]*aria-sort/, 'aria-sort fica no th, não no botão');
  assert.match(html, /<th scope="col"[^>]*>Observação<\/th>/, 'coluna sem ordenação não vira botão');
  assert.match(html, /text-right tabular-nums/);
  assert.match(html, /Ações<\/th>/);
  assert.match(html, /aria-label="Marcar os mostrados"/);
  assert.equal((html.match(/<tr[ >]/g) ?? []).length, 51, 'cabeçalho + 50 linhas da primeira página');
  assert.match(html, /<tr data-linha-lista="true" tabindex="0"/, 'linha clicável recebe foco pelo teclado');
  assert.match(html, /Máquina 59/, 'ordenação inicial decrescente põe o maior primeiro');
  assert.match(html, /1 a 50 de 60 abastecimentos/);
  assert.match(html, /Mostrar/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /role="region" aria-label="Abastecimentos" tabindex="0"/, 'área que rola recebe foco');
  assert.match(html, /flex h-full min-h-0 flex-col/, 'ocupa a altura do pai e rola por dentro');
});

test('estado vazio e carregando aparecem no lugar da tabela', () => {
  const vazia = renderToStaticMarkup(<TabelaPadrao titulo="X" linhas={[]} colunas={colunas} idDaLinha={l => l.id} vazio="Nada por aqui." />);
  assert.match(vazia, /Nada por aqui\./);
  assert.doesNotMatch(vazia, /<table/);
  const carregando = renderToStaticMarkup(<TabelaPadrao titulo="X" linhas={linhas} colunas={colunas} idDaLinha={l => l.id} carregando />);
  assert.match(carregando, /role="status"/);
  assert.doesNotMatch(carregando, /<table/);
});

test('ordenação e página controladas por fora: a tabela não reordena o que recebe', () => {
  const html = renderToStaticMarkup(
    <TabelaPadrao
      titulo="Cadastros"
      linhas={linhas}
      colunas={colunas}
      idDaLinha={l => l.id}
      ordenacao={{ chave: 'nome', direcao: 'asc' }}
      onOrdenar={() => undefined}
      pagina={1}
      onPagina={() => undefined}
    />,
  );
  const ordem = [...html.matchAll(/>(Escavadeira 10|escavadeira 2|Caminhão 7|Ácido)</g)].map(match => match[1]);
  assert.deepEqual(ordem, ['Escavadeira 10', 'escavadeira 2', 'Caminhão 7', 'Ácido']);
  assert.match(html, /aria-sort="ascending"/);
});

test('grupos seguidos na página: cada grupo vira um tbody com th scope=rowgroup que abre e fecha', () => {
  const grupos = gruposDaPagina(['a1', 'a2', 'b1', 'a3'], item => item[0]);
  assert.deepEqual(grupos.map(grupo => [grupo.chave, grupo.linhas.length, grupo.inicio]), [['a', 2, 0], ['b', 1, 2], ['a', 1, 3]], 'só junta o que vem seguido');
  const html = renderToStaticMarkup(
    <TabelaPadrao
      titulo="Abastecimentos"
      linhas={linhas}
      colunas={colunas}
      idDaLinha={l => l.id}
      grupos={{
        chaveDe: l => (l.litros === null ? 'Sem litros' : 'Com litros'),
        cabecalho: (chave, doGrupo) => `${chave}: ${doGrupo.length}`,
        fechados: new Set(['Sem litros']),
        onAlternar: () => undefined,
      }}
      testIdLinha="linha-teste"
    />,
  );
  assert.equal((html.match(/<tbody/g) ?? []).length, 3, 'Com litros, Sem litros, Com litros');
  assert.match(html, /<th scope="rowgroup" colSpan="3"|<th scope="rowgroup" colspan="3"/);
  assert.match(html, /aria-expanded="false"[^>]*>.*?Sem litros: 1/);
  assert.match(html, /aria-expanded="true"[^>]*>.*?Com litros: 2/);
  assert.doesNotMatch(html, /escavadeira 2/, 'grupo fechado não mostra as linhas');
  assert.equal((html.match(/data-testid="linha-teste"/g) ?? []).length, 3);
});

test('tabela densa, rodapé com começo e resumo, e quantos por página controlado por fora', () => {
  const html = renderToStaticMarkup(
    <TabelaPadrao
      titulo="Planilha"
      linhas={Array.from({ length: 130 }, (_, indice) => ({ id: `l${indice}`, nome: `M${indice}`, litros: indice, obs: '' }))}
      colunas={colunas}
      idDaLinha={l => l.id}
      densa
      porPagina={100}
      onPorPagina={() => undefined}
      pagina={Number.POSITIVE_INFINITY}
      onPagina={() => undefined}
      rodapeInicio={<nav aria-label="Meses">Outubro</nav>}
      resumo={<span> · Total 10 L</span>}
    />,
  );
  assert.match(html, /white-space:normal/, 'título do cabeçalho pode quebrar');
  assert.match(html, /101 a 130 de 130 registros<\/span><span> · Total 10 L<\/span>/, 'página infinita cai na última; resumo vem depois do total');
  assert.match(html, /<nav aria-label="Meses">Outubro<\/nav>/);
  const vazia = renderToStaticMarkup(<TabelaPadrao titulo="X" linhas={[]} colunas={colunas} idDaLinha={l => l.id} rodapeInicio={<nav aria-label="Meses">Outubro</nav>} />);
  assert.match(vazia, /<footer[\s\S]*Meses[\s\S]*0 registros/, 'sem linhas, o rodapé fica para trocar de mês');
});

test('o padrão antigo de tabela não volta: só a TabelaPadrao desenha tabela compartilhada', () => {
  const ui = readdirSync(new URL('../src/shared/ui/', import.meta.url));
  for (const antigo of ['TableShell.tsx', 'DataTable.tsx', 'Pagination.tsx']) assert.equal(ui.includes(antigo), false, `${antigo} voltou`);
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /renea-table/);
  const fontes: string[] = [];
  const andar = (pasta: string) => readdirSync(pasta).forEach(nome => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) andar(caminho);
    else if (/\.tsx?$/.test(nome)) fontes.push(readFileSync(caminho, 'utf8'));
  });
  andar(join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src'));
  assert.equal(fontes.some(fonte => /\b(TableShell|DataTable|usePaginacao)\b/.test(fonte)), false);
});

test('telas já migradas usam a TabelaPadrao e não montam <table> à mão', () => {
  const migradas = [
    'ManutencaoTab.tsx', 'PlanejamentoTab.tsx', 'AdministracaoTab.tsx', 'MateriaisTab.tsx', 'UsuariosTab.tsx',
    'administracao/HistoricoAcoes.tsx', 'administracao/MatrizPermissoes.tsx',
    'materiais/MateriaisListas.tsx', 'cadastros/CadastroLista.tsx',
    'materiais/ApontadoresMateriais.tsx', 'materiais/BotaForaMateriais.tsx', 'materiais/LocaisMateriais.tsx', 'materiais/MateriaisVisaoGeral.tsx',
  ];
  for (const arquivo of migradas) {
    const fonte = readFileSync(new URL(`../src/components/${arquivo}`, import.meta.url), 'utf8');
    assert.match(fonte, /TabelaPadrao/, `${arquivo} deveria usar a TabelaPadrao`);
    assert.doesNotMatch(fonte, /<table\b/, `${arquivo} voltou a montar <table> à mão`);
  }
});

// Materiais › Relatórios: na tela é a TabelaPadrao; a <table> à mão só existe
// dentro do bloco que aparece no papel (exceção de relatório impresso).
test('relatórios de materiais usam a TabelaPadrao na tela e a tabela à mão só no papel', () => {
  const fonte = readFileSync(new URL('../src/components/materiais/RelatoriosMateriais.tsx', import.meta.url), 'utf8');
  assert.match(fonte, /<TabelaPadrao/);
  const papel = fonte.indexOf('className="hidden print:block"');
  assert.ok(papel > 0, 'bloco só de impressão');
  assert.equal(fonte.slice(0, papel).includes('<table'), false, 'tabela à mão fora do bloco de impressão');
});

// Tabelas de apoio dos gráficos de Materiais ficam como tabela, mas com título e escopo.
test('tabelas de apoio dos gráficos de materiais têm caption e th scope', () => {
  for (const arquivo of ['GraficoPizza.tsx', 'GraficoSaldoMaterial.tsx', 'GraficoSemanas.tsx']) {
    const fonte = readFileSync(new URL(`../src/components/materiais/${arquivo}`, import.meta.url), 'utf8');
    assert.match(fonte, /<caption/, arquivo);
    assert.equal(/<th\b(?![^>]*scope=)/.test(fonte), false, `${arquivo}: todo th precisa de scope`);
  }
});
