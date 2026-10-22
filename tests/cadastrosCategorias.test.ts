import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { companiesForTeams, isEquipmentRentalSupplier, isSubSupplier, isSupplier } from '../src/masterData/centralRegistry';
import type { Empresa, Funcionario } from '../src/types';
import {
  TIPOS_POR_CATEGORIA_EMPRESA,
  isCategoriaEmpresa,
  CADASTRO_CATEGORIAS,
  CADASTRO_GRUPOS,
  categoriaCadastro,
  categoriasDoGrupo,
} from '../src/utils/cadastrosCategorias';

const tabSource = readFileSync(new URL('../src/components/CadastrosTab.tsx', import.meta.url), 'utf8');
const abasSource = readFileSync(new URL('../src/components/cadastros/abasCadastros.ts', import.meta.url), 'utf8');
const estilosSource = readFileSync(new URL('../src/components/cadastros/estilos.ts', import.meta.url), 'utf8');

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

test('os tipos que a aba grava continuam disponíveis, com as subáreas de fornecedor', () => {
  assert.deepEqual(
    CADASTRO_CATEGORIAS.map(item => item.id).sort(),
    ['canteiros', 'comboios', 'combustiveis', 'empresas', 'equipamentos', 'etapas', 'fornecedores', 'fornecedores-locacao', 'fornecedores-materiais', 'frentes', 'funcionarios', 'lubrificantes', 'obras', 'servicos', 'subfornecedores', 'terceiras', 'veiculos'],
  );
});

test('aba Cadastros segue o padrão: cabeçalho, ação principal no topo e GSAP', () => {
  assert.match(tabSource, /<PageHeader[\s\S]*title="Cadastros"/);
  assert.match(tabSource, /data-testid="cadastro-acao-principal"/);
  assert.match(tabSource, /categoriaAtual\.acaoNovo/);
  assert.match(tabSource, /useGSAP\(/);
  assert.match(tabSource, /prefers-reduced-motion: reduce/);
  assert.match(tabSource, /\[data-cadastros-reveal\]/);
  // Tipos (abas no topo) e filtros vêm antes da lista; a central de planilha mestre saiu da tela
  assert.ok(tabSource.indexOf('label="Filtros de cadastros"') < tabSource.indexOf('<TelaCheia'));
  assert.ok(tabSource.indexOf('<AbasDaTela id="cadastros"') < tabSource.indexOf('faixa={emLixeira ? cabecalhoDaLixeira : filtrosDaLista}'));
  assert.ok(tabSource.indexOf('faixa={emLixeira ? cabecalhoDaLixeira : filtrosDaLista}') < tabSource.indexOf('id="database-lists-viewport"'));
  assert.doesNotMatch(tabSource, /MasterDataReviewCenter|Baixar base completa/);
});

test('tipos de cadastro são abas no topo, agrupadas, acessíveis ao toque e ao teclado', () => {
  // AbasDaTela traz role=tab, aria-selected, setas e 44 px no toque (moldeTelaCheia.test.ts).
  assert.match(tabSource, /<AbasDaTela id="cadastros" rotulo="Tipos de cadastro"/);
  assert.match(abasSource, /CADASTRO_GRUPOS\.map/);
  assert.match(abasSource, /categoriasDoGrupo\(grupo\.id\)/);
  assert.match(abasSource, /testId: `cadastro-categoria-\$\{categoria\.id\}`/);
  assert.match(abasSource, /testId: 'cadastro-categoria-lixeira'/);
  assert.doesNotMatch(tabSource, /CadastroTipos|lg:grid-cols-\[14rem/, 'sem menu lateral interno');
  assert.match(estilosSource, /focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-\(--renea-focus\)/);
});

const empresa = (id: string, tipos?: Empresa['tipos']): Empresa => ({ id, nome: id, cnpj: '', telefone: '', responsavel: '', tipos });

test('subárea de fornecedor nasce também como fornecedor', () => {
  assert.deepEqual([...TIPOS_POR_CATEGORIA_EMPRESA['fornecedores-locacao']], ['FORNECEDOR', 'LOCACAO_EQUIPAMENTOS']);
  assert.deepEqual([...TIPOS_POR_CATEGORIA_EMPRESA['fornecedores-materiais']], ['FORNECEDOR', 'MATERIAIS']);
  assert.deepEqual([...TIPOS_POR_CATEGORIA_EMPRESA.subfornecedores], ['FORNECEDOR', 'SUBFORNECEDOR']);
  assert.deepEqual([...TIPOS_POR_CATEGORIA_EMPRESA.terceiras], ['TERCEIRA']);
  // Registro antigo gravado só com a subárea continua na lista de fornecedores
  assert.equal(isSupplier(empresa('loc', ['LOCACAO_EQUIPAMENTOS'])), true);
  assert.equal(isEquipmentRentalSupplier(empresa('loc', ['FORNECEDOR', 'LOCACAO_EQUIPAMENTOS'])), true);
  assert.equal(isSubSupplier(empresa('sub', ['FORNECEDOR'])), false);
});

test('toda aba de empresa importa como empresa, inclusive Terceiras', () => {
  ['empresas', 'terceiras', 'fornecedores', 'fornecedores-locacao', 'fornecedores-materiais', 'subfornecedores']
    .forEach(id => assert.equal(isCategoriaEmpresa(id as never), true, id));
  ['etapas', 'obras', 'funcionarios'].forEach(id => assert.equal(isCategoriaEmpresa(id as never), false, id));
});

test('equipes da Presença listam só empresas de mão de obra, sem sumir com ninguém', () => {
  const empresas = [
    empresa('grupo', ['EMPRESA']),
    empresa('terceira', ['TERCEIRA']),
    empresa('sem-classe', []),
    empresa('sem-tipos'),
    empresa('locadora', ['FORNECEDOR', 'LOCACAO_EQUIPAMENTOS']),
    empresa('pedreira', ['FORNECEDOR', 'MATERIAIS']),
    empresa('locadora-com-operador', ['FORNECEDOR', 'LOCACAO_EQUIPAMENTOS']),
  ];
  const funcionarios = [{ id: 'f1', empresaId: 'locadora-com-operador' } as Funcionario];
  assert.deepEqual(
    companiesForTeams(empresas, funcionarios).map(item => item.id),
    ['grupo', 'terceira', 'sem-classe', 'sem-tipos', 'locadora-com-operador'],
  );
});
