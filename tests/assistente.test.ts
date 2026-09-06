import assert from 'node:assert/strict';
import test from 'node:test';
import { responder } from '../src/utils/assistente';
import type { DocumentoArquivo, Equipamento, RegistroProducao } from '../src/types';

const contexto = { hoje: '2026-01-31', inicio: '2026-01-01', fim: '2026-01-31' };

const producao: RegistroProducao = {
  id: 'r1', data: '2026-01-10', servicoId: 's1', servicoDescricao: 'Escavação',
  unidade: 'm³', quantidade: 120, responsavel: 'D', ativo: true, criadoEm: '', atualizadoEm: '',
};

const equipamento = {
  id: 'e1', prefixo: 'ESC-01', nome: 'Escavadeira', tipo: 'Escavadeira', marca: 'CAT',
  modelo: '320D', seriePlaca: '', empresaId: 'emp1', localAtualId: 'o1', status: 'Ativo', observacao: '',
} as unknown as Equipamento;

const documentoVencido: DocumentoArquivo = {
  id: 'd1', titulo: 'CNH', tipo: 'CNH', vinculo: 'Colaborador', vinculoId: 'c1',
  validade: '2026-01-01', responsavel: 'D', ativo: true, criadoEm: '', atualizadoEm: '',
};

test('pergunta curta pede uma pergunta de verdade', () => {
  assert.match(responder('oi', contexto).titulo, /Pergunte/);
});

test('responde pendências com o que existe e some quando resolve', () => {
  const resposta = responder('o que está pendente?', { ...contexto, documentos: [documentoVencido] });
  assert.match(resposta.titulo, /pendência/);
  assert.equal(resposta.tab, 'pendencias');
  assert.match(responder('o que está pendente?', contexto).titulo, /Nada pendente/);
});

test('produção sem lançamento não inventa número', () => {
  assert.match(responder('como está a produção?', contexto).titulo, /Sem produção/);
  const resposta = responder('como está a produção?', { ...contexto, producao: [producao] });
  assert.match(resposta.titulo, /120/);
});

test('pergunta desconhecida cai na busca dos registros', () => {
  const resposta = responder('ESC-01', { ...contexto, equipamentos: [equipamento] });
  assert.match(resposta.titulo, /encontrado/);
  assert.equal(resposta.tab, 'frota');
});

test('sem resposta possível o assistente diz que não sabe', () => {
  const resposta = responder('quanto vou faturar no ano que vem', contexto);
  assert.match(resposta.titulo, /Não encontrei/);
  assert.match(resposta.linhas.join(' '), /não inventa/);
});
