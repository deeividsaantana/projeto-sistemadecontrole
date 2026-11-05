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
  assert.doesNotMatch(corpo, /where\s+jsonb_typeof\(\s*p_depois\s*->\s*tabela\s*\)\s*=\s*'array'/, 'tabela que falta não pode escapar da comparação');
  assert.match(corpo, /case when jsonb_typeof\(p_depois -> tabela\) = 'array' then p_depois -> tabela else '\[\]'::jsonb end as depois/);
  assert.match(corpo, /any\(v_tabelas_gestao \|\| v_tabelas_cadastro\)/, 'marca de exclusão em gestão também é barrada');
  assert.match(corpo, /count\(\*\) filter \(where i\.no_antes\)/, 'gestão compara quantas vezes cada registro aparece');
  assert.match(corpo, /antes is distinct from depois/, 'tabela igual nem entra na conta');
});

test('marca ativa: a mais recente do registro, restaurada só com data; ela isenta só a saída', () => {
  const corpo = ultimaDefinicao('erp_recusar_por_perfil')?.corpo || '';
  assert.equal((corpo.match(/distinct on \(marca ->> 'tabela', marca ->> 'registroId'\)/g) || []).length, 2, 'marca ativa antes, em gestão e cadastro');
  assert.match(corpo, /order by marca ->> 'tabela', marca ->> 'registroId', marca ->> 'excluidoEm' collate "C" desc nulls last/, 'mesma ordem do app: texto byte a byte, sem data por último');
  assert.match(corpo, /p_antes -> 'exclusoes' else '\[\]'::jsonb end\) anterior\s+where anterior = marca/, 'marca de gestão ou cadastro só passa idêntica à de antes');
  assert.doesNotMatch(corpo, /@> jsonb_build_array\(marca\)/, 'contenção aceitaria marca sem restauradoEm');
  assert.match(corpo, /not coalesce\(jsonb_typeof\(restaurado\) = 'string' and restaurado #>> '\{\}' <> '', false\)/);
  assert.doesNotMatch(corpo, /->> 'restauradoEm' is null/, 'texto vazio não pode contar como restaurado');
  assert.match(corpo, /where antes <> depois and not \(marcado and depois < antes\)/);
});

test('o lock_timeout de 25 s das duas funções sobrevive à redefinição', () => {
  const ultimo = (funcao: string) => migrations.map(({ nome, sql }, indice) => ({ nome, indice, sql }))
    .filter(({ sql }) => new RegExp(`(create\\s+or\\s+replace\\s+function|alter\\s+function)\\s+public\\.${funcao}\\b`, 'i').test(sql)).at(-1);
  for (const funcao of ['publish_erp_snapshot', 'apply_erp_snapshot_changes']) {
    const migration = ultimo(funcao);
    assert.ok(migration);
    assert.match(migration.sql, new RegExp(`alter\\s+function\\s+public\\.${funcao}\\([^)]*\\)\\s+set\\s+lock_timeout\\s*=\\s*'25s'`, 'i'), `${funcao} em ${migration.nome}`);
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
