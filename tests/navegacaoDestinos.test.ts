import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ROLE_ACCESS, destinoDaAba } from '../src/app/navigation/navigation';

const ler = (arquivo: string) => readFileSync(arquivo, 'utf8');
const app = ler('src/App.tsx');
const destinosLiterais = (codigo: string) => [
  ...[...codigo.matchAll(/onNavigate\('([^']+)'\)/g)].map(m => m[1]),
  ...[...codigo.matchAll(/target="([a-z-]+)"/g)].map(m => m[1]),
  ...[...codigo.matchAll(/aba="([^"]+)"/g)].map(m => m[1]),
];

test('destinoDaAba: aba do perfil, endereço antigo ou nada', () => {
  assert.equal(destinoDaAba('presenca', ROLE_ACCESS.admin), 'presenca');
  assert.equal(destinoDaAba('producao', ROLE_ACCESS.admin), 'meu-dia');
  assert.equal(destinoDaAba('tickets-jazida', ROLE_ACCESS.operador), 'materiais');
  assert.equal(destinoDaAba('fvs', ROLE_ACCESS.admin), null);
  assert.equal(destinoDaAba('cadastros', ROLE_ACCESS.operador), null);
  assert.equal(destinoDaAba('presenca', ROLE_ACCESS.leitura), null);
});

test('A10: todo cartão do Painel e do Meu dia leva a uma tela que existe', () => {
  for (const arquivo of [
    'src/components/Dashboard.tsx',
    'src/components/dashboard/TeamActivity.tsx',
    'src/components/dashboard/FieldReports.tsx',
    'src/components/meuDia/ObraNoDia.tsx',
  ]) {
    const destinos = destinosLiterais(ler(arquivo));
    assert.ok(destinos.length > 0, `${arquivo} tem destinos`);
    for (const destino of destinos) {
      const aberto = destinoDaAba(destino, ROLE_ACCESS.admin);
      assert.ok(aberto && aberto !== 'dashboard', `${arquivo}: "${destino}" não pode cair no Painel`);
    }
  }
});

test('M6: alerta do sino só aparece com tela para resolver, conforme o perfil', () => {
  assert.match(app, /alertasVisiveis\(alertasSistema, preferenciasNotificacao\)\s*\.filter\(alerta => destinoDaAba\(alerta\.tab, ROLE_ACCESS\[currentUserRole\]\) !== null\)/);
  // Alertas de telas que saíram do app (FVS, documentos, treinamentos…) não têm destino.
  for (const [, tab] of ler('src/utils/pendencias.ts').matchAll(/tab: '([^']+)'/g)) {
    if (['fvs', 'nao-conformidades', 'inspecoes', 'documentos', 'dds-treinamentos', 'medicoes', 'ocorrencias'].includes(tab)) {
      assert.equal(destinoDaAba(tab, ROLE_ACCESS.admin), null, tab);
    } else {
      assert.ok(destinoDaAba(tab, ROLE_ACCESS.admin), tab);
    }
  }
});

test('M7: atalho para Cadastros e Manutenção só para quem abre a aba', () => {
  assert.match(app, /\{allowedTabs\.includes\('cadastros'\) && \(\s*<button[\s\S]{0,120}navigateTo\('cadastros', true\)/);
  assert.match(app, /onOpenMaintenance=\{podeAbrir\('manutencao'\) \? /);
  assert.match(app, /onOpenEquipmentRegistration=\{podeAbrir\('cadastros'\) \? /);
  assert.match(ler('src/components/quadroFrota/QuadroFrota.tsx'), /podeAbrir\('cadastros'\) \? \(/);
  assert.match(ler('src/components/ColaboradoresTab.tsx'), /actions=\{podeAbrir\('cadastros'\) && /);
  assert.match(ler('src/components/ControleEquipamentosDiarioTab.tsx'), /onOpenEquipmentRegistry=\{onOpenEquipmentRegistration \? /);
});

test('M8: a busca só mostra o que o perfil abre e tem botão no celular', () => {
  assert.match(ler('src/app/shell/PesquisaGlobal.tsx'), /buscarGlobal\(termo, fontes\)\.filter\(resultado => podeAbrir\(resultado\.tab\)\)/);
  assert.match(app, /onClick=\{\(\) => setPesquisaAberta\(true\)\}/);
});

test('M9 e B6: a aba fica no endereço, o voltar troca de tela e a busca do menu limpa', () => {
  assert.match(app, /window\.history\[substituir \? 'replaceState' : 'pushState'\]/);
  assert.match(app, /addEventListener\('popstate', voltar\)/);
  assert.ok(app.indexOf("url.searchParams.set('tab', activeTab)") < app.indexOf('getCombustivelViewFromUrl() || isCombustivelListOnlyUrl()'),
    'o endereço é atualizado antes do efeito do Combustível ler a aba dele');
  const navegar = app.slice(app.indexOf('const navigateTo = ('), app.indexOf('const abrirRelatorio'));
  assert.match(navegar, /setMenuSearch\(''\)/);
  assert.match(navegar, /setActiveTab\(destinoDaAba\(tab, allowedTabs\) \|\| 'dashboard'\)/);
});
