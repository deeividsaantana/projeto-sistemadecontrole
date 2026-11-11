import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

// O banco é a última linha: o operador publica o retrato inteiro como "editor",
// e só o app escondia o que ele não podia mexer (achado 005 da auditoria de 04/11/2026).
const pasta = new URL('../supabase/migrations/', import.meta.url);
const migrations = readdirSync(pasta).filter(nome => nome.endsWith('.sql')).sort()
  .map(nome => ({ nome, sql: readFileSync(new URL(nome, pasta), 'utf8').replace(/--[^\n]*/g, '') }));

/** Corpo da última definição de uma função, entre os $$. */
const ultimaDefinicao = (funcao: string) => {
  const definicoes = migrations.flatMap(({ nome, sql }) => [...sql.matchAll(new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${funcao}\\s*\\(([\\s\\S]*?)\\$\\$([\\s\\S]*?)\\$\\$`, 'gi'))]
    .map(achado => ({ nome, cabecalho: achado[1], corpo: achado[2] })));
  return definicoes.at(-1);
};

const GESTAO = ['planejamentoItens', 'naoConformidades', 'medicoes', 'documentos', 'lancamentosCusto', 'orcamentoItens', 'frentesServico'];
const CADASTROS = ['empresas', 'obras', 'equipamentos', 'funcionarios', 'motoristasOperacionais', 'comboios', 'canteiros', 'combustiveis', 'lubrificantes', 'etapas', 'materiaisCadastro'];

test('as duas funções que gravam o retrato recusam pelo perfil, depois da trava de encolhimento', () => {
  for (const funcao of ['publish_erp_snapshot', 'apply_erp_snapshot_changes']) {
    const definicao = ultimaDefinicao(funcao);
    assert.ok(definicao, funcao);
    const corpo = definicao.corpo;
    assert.match(corpo, /perform\s+public\.erp_recusar_por_perfil\(\s*p_organization_id\s*,/, `${funcao} chama a regra`);
    assert.ok(corpo.indexOf('erp_recusar_encolhimento') < corpo.indexOf('erp_recusar_por_perfil'), `${funcao}: perfil depois do encolhimento`);
  }
});

test('a regra vale só para editor com perfil operador e cobre gestão e exclusão de cadastro', () => {
  const definicao = ultimaDefinicao('erp_recusar_por_perfil');
  assert.ok(definicao);
  const corpo = definicao.corpo;
  assert.match(corpo, /auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'role'/);
  assert.match(corpo, /'operador'/);
  assert.match(corpo, /member\.role\s*=\s*'editor'/);
  for (const tabela of [...GESTAO, ...CADASTROS]) assert.match(corpo, new RegExp(`'${tabela}'`), tabela);
  assert.match(corpo, /raise\s+exception\s+'ROLE_WRITE_DENIED'/);
});

test('sem brechas: tabela ausente conta como vazia, marca nova vale para gestão e cadastro, duplicata conta', () => {
  const corpo = ultimaDefinicao('erp_recusar_por_perfil')?.corpo || '';
  assert.match(corpo, /v_d := case when jsonb_typeof\(p_depois -> v_tabela\) = 'array' then p_depois -> v_tabela else '\[\]'::jsonb end;/, 'tabela que falta não pode escapar da comparação');
  assert.match(corpo, /any\(v_tabelas_gestao \|\| v_tabelas_cadastro\)/, 'marca de exclusão em gestão também é barrada');
  assert.match(corpo, /count\(\*\) filter \(where no_antes\)/, 'gestão compara quantas vezes cada registro aparece');
});

test('desempenho: medido em produção, a regra roda segurando a fila de envios', () => {
  const corpo = ultimaDefinicao('erp_recusar_por_perfil')?.corpo || '';
  assert.match(corpo, /continue when v_a = v_d;/, 'tabela igual sai na hora');
  assert.ok(corpo.indexOf("<> 'operador'") < corpo.indexOf('v_marcas_antes :='), 'quem não é operador não paga a leitura das marcas');
  assert.match(corpo, /if v_marcas_antes <> v_marcas_depois then/, 'marcas iguais nem são comparadas');
  assert.match(corpo, /except\s+select marca from jsonb_array_elements\(v_marcas_antes\)/, 'comparar marca com marca levava 13 s com 8377 marcas');
  assert.doesNotMatch(corpo, /not exists \(\s*select 1\s+from jsonb_array_elements/, 'sem varredura aninhada de marcas');
});

test('marca ativa: a mais recente do registro, restaurada só com data; ela isenta só a saída', () => {
  const corpo = ultimaDefinicao('erp_recusar_por_perfil')?.corpo || '';
  assert.equal((corpo.match(/distinct on \(marca ->> 'tabela', marca ->> 'registroId'\)/g) || []).length, 1, 'marca ativa antes, calculada uma vez só');
  assert.match(corpo, /order by marca ->> 'tabela', marca ->> 'registroId', marca ->> 'excluidoEm' collate "C" desc nulls last/, 'mesma ordem do app: texto byte a byte, sem data por último');
  assert.doesNotMatch(corpo, /@> jsonb_build_array\(marca\)/, 'contenção aceitaria marca sem restauradoEm');
  assert.match(corpo, /not coalesce\(jsonb_typeof\(restaurado\) = 'string' and restaurado #>> '\{\}' <> '', false\)/);
  assert.doesNotMatch(corpo, /->> 'restauradoEm' is null/, 'texto vazio não pode contar como restaurado');
  assert.match(corpo, /and not \(depois < antes and v_ativas \? /, 'a marca isenta só a saída do registro');
});

// Era 25 s (202610280001). Em 11/11/2026 a espera longa segurava as poucas conexões da API e
// derrubava login e leitura; a 202611110001 baixou para 5 s e o app tenta de novo sozinho.
test('o lock_timeout de 5 s das duas funções sobrevive à redefinição', () => {
  const ultimo = (funcao: string) => migrations.map(({ nome, sql }, indice) => ({ nome, indice, sql }))
    .filter(({ sql }) => new RegExp(`(create\\s+or\\s+replace\\s+function|alter\\s+function)\\s+public\\.${funcao}\\b`, 'i').test(sql)).at(-1);
  for (const funcao of ['publish_erp_snapshot', 'apply_erp_snapshot_changes']) {
    const migration = ultimo(funcao);
    assert.ok(migration);
    assert.match(migration.sql, new RegExp(`alter\\s+function\\s+public\\.${funcao}\\([^)]*\\)\\s+set\\s+lock_timeout\\s*=\\s*'5s'`, 'i'), `${funcao} em ${migration.nome}`);
  }
});

test('a recusa por perfil vira uma mensagem que diz o que fazer', () => {
  const sync = readFileSync(new URL('../src/supabase/cloudSync.ts', import.meta.url), 'utf8');
  assert.match(sync, /texto\.includes\('ROLE_WRITE_DENIED'\)\) return new Error\(NUVEM_RECUSOU_PERFIL/);
});

test('o app começa em leitura até o vínculo com a organização chegar', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /useState<UserRole>\('leitura'\)/);
  assert.doesNotMatch(app, /useState<UserRole>\('admin'\)/);
});
