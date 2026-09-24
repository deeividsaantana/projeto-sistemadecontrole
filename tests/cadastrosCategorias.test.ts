import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  CADASTRO_CATEGORIAS,
  CADASTRO_GRUPOS,
  categoriaCadastro,
  categoriasDoGrupo,
} from '../src/utils/cadastrosCategorias';

const tabSource = readFileSync(new URL('../src/components/CadastrosTab.tsx', import.meta.url), 'utf8');
const pickerSource = readFileSync(new URL('../src/components/cadastros/CadastroCategoryPicker.tsx', import.meta.url), 'utf8');

test('todo tipo de cadastro aparece em exatamente um grupo', () => {
  const agrupados = CADASTRO_GRUPOS.flatMap(grupo => categoriasDoGrupo(grupo.id).map(item => item.id));
  assert.equal(agrupados.length, CADASTRO_CATEGORIAS.length);
  assert.equal(new Set(agrupados).size, CADASTRO_CATEGORIAS.length);
  CADASTRO_GRUPOS.forEach(grupo => assert.ok(categoriasDoGrupo(grupo.id).length > 0, `${grupo.label} vazio`));
});

test('botão principal diz o que será criado, nunca "Novo registro"', () => {
  CADASTRO_CATEGORIAS.forEach(item => {
    assert.match(item.acaoNovo, /^(Novo|Nova) /);
    assert.notEqual(item.acaoNovo, 'Novo registro');
  });
  assert.equal(categoriaCadastro('funcionarios').acaoNovo, 'Novo colaborador');
  assert.equal(categoriaCadastro('obras').acaoNovo, 'Novo local');
});

test('os 11 tipos que a aba grava continuam disponíveis', () => {
  assert.deepEqual(
    CADASTRO_CATEGORIAS.map(item => item.id).sort(),
    ['comboios', 'combustiveis', 'empresas', 'equipamentos', 'etapas', 'fornecedores', 'funcionarios', 'lubrificantes', 'obras', 'terceiras', 'veiculos'],
  );
});

test('aba Cadastros segue o padrão: cabeçalho, ação principal no topo e GSAP', () => {
  assert.match(tabSource, /<PageHeader[\s\S]*title="Cadastros"/);
  assert.match(tabSource, /data-testid="cadastro-acao-principal"/);
  assert.match(tabSource, /categoriaAtual\.acaoNovo/);
  assert.match(tabSource, /useGSAP\(/);
  assert.match(tabSource, /prefers-reduced-motion: reduce/);
  assert.match(tabSource, /\[data-cadastros-reveal\]/);
  // Lista vem antes das ferramentas de base (visão geral e planilha mestre)
  assert.ok(tabSource.indexOf('id="database-lists-viewport"') < tabSource.indexOf('<CentralRegistryOverview'));
  assert.ok(tabSource.indexOf('<CadastroCategoryPicker') < tabSource.indexOf('label="Filtros de cadastros"'));
});

test('seletor de tipos é acessível ao toque e ao teclado', () => {
  assert.match(pickerSource, /aria-pressed=\{ativo\}/);
  assert.match(pickerSource, /min-h-12/);
  assert.match(pickerSource, /focus-visible:ring-\[#f26a2e\]\/60/);
  assert.match(pickerSource, /aria-label="Tipos de cadastro"/);
});
