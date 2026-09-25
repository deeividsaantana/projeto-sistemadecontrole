import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';

/**
 * Trava do padrão das abas (CONTRIBUTING.md, seção 4). Toda tela em
 * src/components/*Tab.tsx e o Painel precisam de:
 * - pageHeader: cabeçalho com o PageHeader comum (o Painel é a referência e
 *   tem cabeçalho próprio);
 * - gsap: animação de entrada com GSAP;
 * - movimentoReduzido: respeito a prefers-reduced-motion;
 * - corForaDaPaleta: nenhuma cor hex solta fora da paleta RENEA.
 *
 * PENDENCIAS guarda o que cada aba ainda deve na data da trava. A lista só
 * diminui: aba nova precisa nascer no padrão, uma aba não pode perder um
 * item que já cumpre, e quando uma aba passa a cumprir um item o teste pede
 * para tirar esse item da lista.
 */
type Regra = 'pageHeader' | 'gsap' | 'movimentoReduzido' | 'corForaDaPaleta';

const PALETA = new Set(['#176b4d', '#f26a2e', '#718087', '#f7f8f6']);

const PENDENCIAS: Record<string, readonly Regra[]> = {
  ConfiguracoesTab: ['pageHeader', 'gsap', 'movimentoReduzido'],
  AdministracaoTab: ['gsap', 'movimentoReduzido'],
  ApontamentosTab: ['gsap', 'movimentoReduzido'],
  AssistenteTab: ['gsap', 'movimentoReduzido'],
  AuditoriaTab: ['gsap', 'movimentoReduzido'],
  CentralOperacionalTab: ['gsap', 'movimentoReduzido'],
  ChecklistTab: ['gsap', 'movimentoReduzido'],
  ColaboradoresTab: ['gsap', 'movimentoReduzido'],
  CombustivelOperacionalTab: ['pageHeader', 'gsap', 'movimentoReduzido'],
  ConsultaGeralTab: ['gsap', 'movimentoReduzido'],
  ControleEquipamentosDiarioTab: ['corForaDaPaleta'],
  ControlePresencaTab: ['corForaDaPaleta'],
  CronogramaTab: ['gsap', 'movimentoReduzido'],
  CustosTab: ['gsap', 'movimentoReduzido'],
  DdsTreinamentosTab: ['gsap', 'movimentoReduzido'],
  DiarioObraTab: ['gsap', 'movimentoReduzido'],
  DocumentosTab: ['gsap', 'movimentoReduzido'],
  EquipesTab: ['gsap', 'movimentoReduzido'],
  EstacasTab: ['gsap', 'movimentoReduzido'],
  FrentesTab: ['gsap', 'movimentoReduzido'],
  FrotaTab: ['gsap', 'movimentoReduzido'],
  FvsTab: ['gsap', 'movimentoReduzido'],
  HorasParadasTab: ['gsap', 'movimentoReduzido'],
  IndicadoresTab: ['gsap', 'movimentoReduzido', 'corForaDaPaleta'],
  InspecoesTab: ['gsap', 'movimentoReduzido'],
  ManutencaoTab: ['gsap', 'movimentoReduzido'],
  MateriaisTab: ['movimentoReduzido', 'corForaDaPaleta'],
  MedicoesTab: ['gsap', 'movimentoReduzido'],
  ModoCampoTab: ['gsap', 'movimentoReduzido'],
  NaoConformidadesTab: ['gsap', 'movimentoReduzido'],
  NotificacoesTab: ['gsap', 'movimentoReduzido'],
  OcorrenciasTab: ['gsap', 'movimentoReduzido'],
  OrcamentoTab: ['gsap', 'movimentoReduzido'],
  PendenciasTab: ['gsap', 'movimentoReduzido'],
  PeriodoTab: ['gsap', 'movimentoReduzido', 'corForaDaPaleta'],
  PermissoesTab: ['gsap', 'movimentoReduzido'],
  PlanejamentoTab: ['gsap', 'movimentoReduzido'],
  ProducaoTab: ['gsap', 'movimentoReduzido'],
  RelatoriosTab: ['gsap', 'movimentoReduzido'],
  TicketsJazidaTab: ['pageHeader', 'gsap', 'movimentoReduzido', 'corForaDaPaleta'],
  TimelineTab: ['gsap', 'movimentoReduzido'],
  UsuariosTab: ['pageHeader', 'gsap', 'movimentoReduzido', 'corForaDaPaleta'],
};

const components = new URL('../src/components/', import.meta.url);
const telas = ['Dashboard', ...readdirSync(components)
  .filter(file => file.endsWith('Tab.tsx'))
  .map(file => file.replace(/\.tsx$/, ''))];

const regrasQueFaltam = (tela: string): Regra[] => {
  const source = readFileSync(new URL(`${tela}.tsx`, components), 'utf8');
  const faltam: Regra[] = [];
  if (tela !== 'Dashboard' && !source.includes('PageHeader')) faltam.push('pageHeader');
  if (!/useGSAP|gsap\./.test(source)) faltam.push('gsap');
  if (!/prefers-reduced-motion|matchMedia\(|useReducedMotion|reducedMotion/.test(source)) faltam.push('movimentoReduzido');
  const cores = (source.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map(cor => cor.toLowerCase());
  if (cores.some(cor => !PALETA.has(cor))) faltam.push('corForaDaPaleta');
  return faltam;
};

for (const tela of telas) {
  test(`${tela} segue o padrão das abas`, () => {
    const faltam = regrasQueFaltam(tela);
    const pendente = new Set(PENDENCIAS[tela] ?? []);
    const novas = faltam.filter(regra => !pendente.has(regra));
    assert.deepEqual(novas, [], `${tela} saiu do padrão em: ${novas.join(', ')}. Veja CONTRIBUTING.md, seção 4.`);
    const resolvidas = [...pendente].filter(regra => !faltam.includes(regra));
    assert.deepEqual(resolvidas, [], `${tela} já cumpre ${resolvidas.join(', ')}: tire da lista PENDENCIAS.`);
  });
}

test('a lista de pendências só cita telas que existem', () => {
  const sobrando = Object.keys(PENDENCIAS).filter(tela => !telas.includes(tela));
  assert.deepEqual(sobrando, []);
});

test('toda aba do menu abre uma tela e toda aba principal tem permissão', async () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const { NAVIGATION_GROUPS, PRIMARY_MODULE_IDS, ROLE_ACCESS } = await import('../src/app/navigation/navigation');
  const semTela = NAVIGATION_GROUPS
    .flatMap(group => group.items.map(item => item.id))
    .filter(id => !app.includes(`activeTab === '${id}'`));
  assert.deepEqual(semTela, [], 'aba no menu sem tela no App.tsx');
  const semPermissao = PRIMARY_MODULE_IDS.filter(id => !ROLE_ACCESS.admin.includes(id));
  assert.deepEqual(semPermissao, [], 'aba principal sem permissão em ROLE_ACCESS');
});

// Telas que só aparecem no preview/ e nenhum usuário abre no app. Esperam
// decisão: voltar para o menu ou sair do projeto. A lista só diminui.
const TELAS_SEM_CAMINHO = new Set(['ConfiguracoesTab']);

test('toda tela *Tab.tsx é aberta por algum arquivo', () => {
  const fontes = ['../src/App.tsx', ...readdirSync(components)
    .filter(file => file.endsWith('.tsx'))
    .map(file => `../src/components/${file}`)]
    .map(path => readFileSync(new URL(path, import.meta.url), 'utf8'))
    .join('\n');
  const orfas = telas
    .filter(tela => tela !== 'Dashboard' && !TELAS_SEM_CAMINHO.has(tela))
    .filter(tela => !new RegExp(`['/]${tela}['"]`).test(fontes));
  assert.deepEqual(orfas, [], 'tela que nenhum arquivo abre: remova ou ligue ao menu');
});
