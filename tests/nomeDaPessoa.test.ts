import assert from 'node:assert/strict';
import { nomeDaPessoa } from '../src/auth/nomeDaPessoa';
assert.equal(nomeDaPessoa({ displayName: 'Deivid Brandão', email: 'x@y.com' }), 'Deivid Brandão');
assert.equal(nomeDaPessoa({ displayName: null, email: 'deivid.santana019@gmail.com' }), 'Deivid Santana');
assert.equal(nomeDaPessoa({ displayName: '  ', email: 'MARIA_silva@renea.com.br' }), 'Maria Silva');
assert.equal(nomeDaPessoa({ displayName: null, email: '123@x.com' }), 'Usuário');
assert.equal(nomeDaPessoa(null), 'Usuário');
console.log('nomeDaPessoa ok');
