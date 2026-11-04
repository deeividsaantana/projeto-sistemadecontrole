import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PresencaPublicaLink } from '../src/components/presenca/PresencaPublicaLink';
import {
  gerarTokenPresencaPublica,
  validarMatricula,
  validarTokenPresencaPublica,
} from '../src/utils/presencaPublicaAuth';
import type { Funcionario } from '../src/types';

const funcionario = (id: string, nome: string, matricula?: string): Funcionario => ({
  id, nome, matricula, cargo: 'Operador', telefone: '', empresaId: 'e1', ativo: true,
});

const funcionarios: Funcionario[] = [
  funcionario('1', 'João', '12345'),
  funcionario('2', 'Maria', 'AB12'),
  funcionario('3', 'Sem Matrícula'),
];

test('presencaPublicaAuth: valida matrícula corretamente', () => {
  assert.equal(validarMatricula('12345', funcionarios)?.nome, 'João');
  assert.equal(validarMatricula('  12345 ', funcionarios)?.nome, 'João');
});

test('presencaPublicaAuth: case-insensitive para matrícula', () => {
  assert.equal(validarMatricula('ab12', funcionarios)?.nome, 'Maria');
});

test('presencaPublicaAuth: retorna null para matrícula inválida ou vazia', () => {
  assert.equal(validarMatricula('99999', funcionarios), null);
  assert.equal(validarMatricula('   ', funcionarios), null);
});

test('presencaPublicaAuth: token gerado é válido para o mesmo funcionário', () => {
  const token = gerarTokenPresencaPublica('1');
  assert.equal(validarTokenPresencaPublica(token, '1'), true);
});

test('presencaPublicaAuth: token válido dentro de 24h', () => {
  assert.equal(validarTokenPresencaPublica(`1:${Date.now()}:random123`, '1'), true);
});

test('presencaPublicaAuth: token inválido com ID errado', () => {
  assert.equal(validarTokenPresencaPublica(`1:${Date.now()}:random123`, '2'), false);
});

test('presencaPublicaAuth: token inválido expirado, no futuro ou malformado', () => {
  const hora = 60 * 60 * 1000;
  assert.equal(validarTokenPresencaPublica(`1:${Date.now() - 25 * hora}:r`, '1'), false);
  assert.equal(validarTokenPresencaPublica(`1:${Date.now() + hora}:r`, '1'), false);
  assert.equal(validarTokenPresencaPublica('1:abc:r', '1'), false);
});

test('PresencaPublicaLink: mostra campo de matrícula com rótulo e botão Acessar', () => {
  const html = renderToStaticMarkup(createElement(PresencaPublicaLink, {
    funcionarios, empresas: [], gruposEquipe: [], onAutenticar: () => undefined,
  }));
  assert.match(html, /<h1[^>]*>Presença<\/h1>/);
  assert.match(html, /<label[^>]*>Matrícula<input[^>]*type="text"/);
  assert.match(html, /aria-label="Entrar na presença pela matrícula"/);
  assert.match(html, /<button type="submit"[^>]*>.*Acessar<\/button>/);
  assert.doesNotMatch(html, /role="alert"/);
});
