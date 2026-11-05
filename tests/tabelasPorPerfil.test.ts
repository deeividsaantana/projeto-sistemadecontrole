import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { NUVEM_RECUSOU_PERFIL, TABELAS_DE_CADASTRO, TABELAS_DE_GESTAO, comMarcasDaNuvem, comMarcasLocaisDaNuvem, comTabelasDaNuvem, marcasSoDaNuvem, recusadoPorPerfil, semTabelas, tabelasSoDaNuvem } from '../src/cloud/tabelasPorPerfil';
import { aplicarExclusoes, exclusoesAtivas } from '../src/cloud/exclusoes';
import { manterNovidadesLocais } from '../src/cloud/novidadesLocais';
import { protegerContraEncolhimento } from '../src/cloud/protecaoEncolhimento';

// O banco recusa o envio do operador que mexe em gestão (erp_recusar_por_perfil).
// Se o aparelho dele mandasse uma diferença local nessas tabelas, todo envio
// seria recusado, e presença e frota também não subiriam.

test('só o operador recebe as tabelas de gestão como somente da nuvem', () => {
  assert.deepEqual([...tabelasSoDaNuvem('operador')], [...TABELAS_DE_GESTAO]);
  for (const papel of ['admin', 'gestor', 'leitura'] as const) assert.deepEqual([...tabelasSoDaNuvem(papel)], []);
});

test('a lista do app é a mesma que o banco confere', () => {
  const pasta = new URL('../supabase/migrations/', import.meta.url);
  const sql = readdirSync(pasta).filter(nome => nome.endsWith('.sql')).sort().map(nome => readFileSync(new URL(nome, pasta), 'utf8')).join('\n');
  const definicoes = [...sql.matchAll(/create or replace function public\.erp_recusar_por_perfil[\s\S]*?\$\$([\s\S]*?)\$\$/g)];
  const corpo = definicoes.at(-1)?.[1] || '';
  const gestao = corpo.match(/v_tabelas_gestao\s+text\[\]\s*:=\s*array\[([^\]]+)\]/)?.[1] || '';
  assert.deepEqual(gestao.split(',').map(item => item.trim().replace(/'/g, '')), [...TABELAS_DE_GESTAO]);
});

test('envio inteiro do operador leva a gestão exatamente como está na nuvem', () => {
  const local = { medicoes: [{ id: 'm1', valor: 999 }], frentesServico: [{ id: 'f9' }], abastecimentos: [{ id: 'a1' }] };
  const nuvem = { medicoes: [{ id: 'm1', valor: 10 }], abastecimentos: [{ id: 'a0' }] };
  const enviado = comTabelasDaNuvem(local, nuvem, TABELAS_DE_GESTAO);
  assert.deepEqual(enviado.medicoes, [{ id: 'm1', valor: 10 }]);
  assert.equal('frentesServico' in enviado, false, 'tabela que a nuvem não tem não vai');
  assert.deepEqual(enviado.abastecimentos, [{ id: 'a1' }], 'o resto continua com o que é do aparelho');
  assert.deepEqual(local.medicoes, [{ id: 'm1', valor: 999 }], 'não altera o retrato recebido');
});

test('envio por mudança do operador nem olha as tabelas de gestão', () => {
  const retrato = { medicoes: [{ id: 'm1' }], orcamentoItens: [], listasPresenca: [{ id: 'p1' }] };
  assert.deepEqual(semTabelas(retrato, TABELAS_DE_GESTAO), { listasPresenca: [{ id: 'p1' }] });
  assert.equal(semTabelas(retrato, []), retrato);
});

test('marca de exclusão de gestão ou cadastro, no aparelho do operador, vale como está na nuvem', () => {
  const tabelas = marcasSoDaNuvem('operador');
  assert.deepEqual([...tabelas], [...TABELAS_DE_GESTAO, ...TABELAS_DE_CADASTRO]);
  assert.deepEqual([...marcasSoDaNuvem('gestor')], []);
  const local = [
    { tabela: 'equipamentos', registroId: 'e1', excluidoEm: '2026-11-04T10:00:00Z' },
    { tabela: 'abastecimentos', registroId: 'a1', excluidoEm: '2026-11-04T10:00:00Z' },
  ];
  const nuvem = [{ tabela: 'medicoes', registroId: 'm1', excluidoEm: '2026-11-03T10:00:00Z' }];
  assert.deepEqual(comMarcasDaNuvem(local, nuvem, tabelas), [local[1], nuvem[0]]);
  assert.deepEqual(comMarcasDaNuvem(local, nuvem, []), local);
});

test('restauradoEm vazio ou falso não restaura: app e banco usam a mesma regra', () => {
  const marca = (restauradoEm: unknown) => ({ id: 'x', tabela: 'medicoes', registroId: 'm1', excluidoEm: '2026-11-04T10:00:00Z', excluidoPor: 'Ana', restauradoEm });
  assert.equal(exclusoesAtivas([marca('')]).size, 1);
  assert.equal(exclusoesAtivas([marca(false)]).size, 1);
  assert.equal(exclusoesAtivas([marca('2026-11-04T11:00:00Z')]).size, 0);
});

test('download do operador: marca local de cadastro não volta e o registro da nuvem fica', () => {
  // Admin excluiu X sem rede neste aparelho; o operador entrou depois.
  const marca = { id: 'mk1', tabela: 'equipamentos', registroId: 'X', excluidoEm: '2026-11-04T10:00:00Z', excluidoPor: 'Admin' };
  const local = { equipamentos: [{ id: 'Y' }], exclusoes: [marca], listasPresenca: [{ id: 'p-novo' }] };
  const nuvem = { equipamentos: [{ id: 'X' }, { id: 'Y' }], exclusoes: [] as unknown[], listasPresenca: [] as unknown[] };
  const base = { equipamentos: ['X', 'Y'], exclusoes: [], listasPresenca: [] };
  const tabelas = marcasSoDaNuvem('operador');
  const localSemMarca = comMarcasLocaisDaNuvem(local, nuvem.exclusoes, tabelas);

  const comNovidades = manterNovidadesLocais(nuvem, localSemMarca, base).retrato;
  const { retrato } = protegerContraEncolhimento(localSemMarca, comNovidades);
  const final = aplicarExclusoes(retrato);
  assert.deepEqual((final.equipamentos as Array<{ id: string }>).map(item => item.id).sort(), ['X', 'Y'], 'X volta da nuvem');
  assert.deepEqual(final.exclusoes, [], 'a marca local não volta');
  assert.deepEqual(final.listasPresenca, [{ id: 'p-novo' }], 'presença do aparelho continua');

  assert.equal(comMarcasLocaisDaNuvem(local, nuvem.exclusoes, []), local, 'outros perfis não mudam');
});

test('recusa por perfil faz o aparelho baixar a nuvem na hora, com espera crescente', () => {
  assert.equal(recusadoPorPerfil(new Error(NUVEM_RECUSOU_PERFIL)), true);
  assert.equal(recusadoPorPerfil(new Error('CLOUD_VERSION_CONFLICT')), false);
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /if \(recusadoPorPerfil\(error\) && Date\.now\(\) - recuperacao\.quando > Math\.min\(3_600_000, 60_000 \* 2 \*\* recuperacao\.vezes\)\) \{\s*recuperacaoPorPerfilRef\.current = \{ quando: Date\.now\(\), vezes: recuperacao\.vezes \+ 1 \};\s*queueMicrotask\(\(\) => \{ void handleDownloadFromSupabase\(\); \}\);/);
  assert.match(app, /protegerContraEncolhimento\(comMarcasLocaisDaNuvem\(readLocalCloudTables\(\)/);
  assert.match(app, /manterNovidadesLocais\(data, comMarcasLocaisDaNuvem\(readStoredCloudTables\(\)/);
  const sync = readFileSync(new URL('../src/supabase/cloudSync.ts', import.meta.url), 'utf8');
  assert.match(sync, /remote\.data\?\.exclusoes/);
});

test('Lixeira e restauração usam a mesma regra de marca restaurada', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /!item\.restauradoEm/);
  assert.equal((app.match(/!marcaRestaurada\(item\)/g) || []).length, 3);
});

test('envio e download usam as tabelas e marcas da nuvem para o operador, pelo perfil atual', () => {
  const sync = readFileSync(new URL('../src/supabase/cloudSync.ts', import.meta.url), 'utf8');
  assert.match(sync, /calcularMudancas\(semTabelas\(data, tabelasDaNuvem\), assinaturas\)/);
  assert.match(sync, /payload = comTabelasDaNuvem\(payload, remote\.data, tabelasDaNuvem\);[\s\S]{0,400}comMarcasDaNuvem\([\s\S]{0,200}protegerContraEncolhimento\(remote\.data, payload\)/);
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /tabelasDaNuvem: tabelasSoDaNuvem\(currentUserRoleRef\.current\), marcasDaNuvem: marcasSoDaNuvem\(currentUserRoleRef\.current\)/);
  assert.match(app, /comMarcasDaNuvem\([^\n]*remoteExclusoes, marcasSoDaNuvem\(currentUserRoleRef\.current\)\)/);
  assert.match(app, /const soDaNuvem = tabelasSoDaNuvem\(currentUserRoleRef\.current\);/);
  assert.doesNotMatch(app, /tabelasSoDaNuvem\(currentUserRole\)/, 'handler antigo não pode usar o perfil do primeiro render');
  assert.match(app, /useRef<UserRole>\('leitura'\)/);
});
