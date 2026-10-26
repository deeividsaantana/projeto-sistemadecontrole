import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Viagens da jazida no padrão (auditoria de front de 21/10/2026, C3, A9,
 * A11, M3 e M6): janelas pelo Modal comum (Esc fecha, foco preso), tabelas
 * pela TabelaPadrao (área rolável com foco e nome), letra de 12 px para
 * cima e linguagem do dia a dia da obra. O link público segue leve.
 */
const ler = (caminho: string) => readFileSync(caminho, 'utf8');
const pasta = 'src/components/jazida/';
const partes = readdirSync(pasta).map(arquivo => ({ arquivo: `${pasta}${arquivo}`, fonte: ler(`${pasta}${arquivo}`) }));
const tela = ler('src/components/TicketsJazidaTab.tsx');
const link = ler('src/components/TicketLinkExterno.tsx');
const todas = [{ arquivo: 'src/components/TicketsJazidaTab.tsx', fonte: tela }, ...partes];

test('C3: cabeçalho comum, abas no topo e uma ação principal só', () => {
  assert.match(tela, /<TelaCheia[\s\S]*id="tickets-jazida-tab"/);
  assert.match(tela, /<PageHeader[\s\S]*title="Viagens da jazida"/);
  assert.match(tela, /<AbasDaTela/);
  assert.match(tela, /Mais ações/);
  assert.equal((tela.match(/BOTAO_PRIMARIO/g) ?? []).length, 2, 'importa e usa o botão verde uma vez: Novo ticket');
  assert.match(tela, /reduzMovimento\(\)/, 'GSAP com a guarda de movimento');
});

test('A11/M6: nenhuma janela nem tabela feita à mão', () => {
  for (const { arquivo, fonte } of [...todas, { arquivo: 'TicketLinkExterno', fonte: link }]) {
    assert.doesNotMatch(fonte, /fixed inset-0/, `${arquivo}: use o Modal de src/shared/ui`);
  }
  for (const { arquivo, fonte } of todas) {
    assert.doesNotMatch(fonte, /<table\b/, `${arquivo}: use a TabelaPadrao`);
  }
});

test('A9: nenhuma letra abaixo de 12 px na tela e no link', () => {
  for (const { arquivo, fonte } of [...todas, { arquivo: 'TicketLinkExterno', fonte: link }]) {
    assert.doesNotMatch(fonte, /text-xxs|text-\[(?:[0-9]|1[01])px\]/, arquivo);
  }
});

test('linguagem de obra: sem o jargão que a auditoria apontou', () => {
  for (const { arquivo, fonte } of todas) {
    assert.doesNotMatch(fonte, /Pareamento integral|ERP v2\.5|IDs vinculados|Fila de revisão|dry-run/i, arquivo);
  }
});

test('o link público usa o Modal direto do arquivo, sem puxar o resto do ERP', () => {
  assert.match(link, /from '\.\.\/shared\/ui\/Modal'/);
  assert.doesNotMatch(link, /from '\.\.\/shared\/ui'/);
  assert.doesNotMatch(link, /TicketsJazidaTab|exceljs|jspdf|\.\/jazida\//);
});

test('subtela que é tela inteira: TelaCheia de dentro ocupa a área e o título vira h2', () => {
  assert.match(ler('src/shared/ui/TelaCheia.tsx'), /renea-tela-cheia--embutida/);
  assert.match(ler('src/shared/ui/PageHeader.tsx'), /useDentroDaTelaCheia\(\) \? 'h2' : 'h1'/);
  assert.match(ler('src/index.css'), /\.renea-tela-cheia\.renea-tela-cheia--embutida \{ height: auto; min-height: 0;/);
});
