import assert from 'node:assert/strict';
import test from 'node:test';
import gsapModulo from 'gsap';
import { encerrarAnimacoes as encerrar } from '../src/shared/motion/guardaDeMovimento';

// No Node o pacote chega como CommonJS: o gsap de verdade fica em .gsap.
const gsap = (gsapModulo as unknown as { gsap?: typeof gsapModulo }).gsap ?? gsapModulo;
const encerrarAnimacoes = () => encerrar(gsap.globalTimeline);

// Guarda global de movimento reduzido (auditoria de front, A8): com o
// aparelho pedindo menos movimento, nada fica no meio do caminho nem repete.
test('a guarda leva a animação ao estado final na hora', () => {
  const alvo = { x: 0, opacidade: 0 };
  gsap.to(alvo, { x: 100, opacidade: 1, duration: 5, delay: 1 });
  const linha = gsap.timeline().to(alvo, { x: 200, duration: 3 });
  encerrarAnimacoes();
  assert.equal(alvo.x, 200);
  assert.equal(alvo.opacidade, 1);
  assert.equal(linha.progress(), 1);
});

test('a animação que repete sem fim volta ao começo e para', () => {
  const martelo = { y: 0 };
  const batida = gsap.fromTo(martelo, { y: 0 }, { y: 6, duration: 0.3, repeat: -1, yoyo: true });
  batida.progress(0.5);
  encerrarAnimacoes();
  assert.equal(martelo.y, 0);
  assert.equal(gsap.globalTimeline.getChildren(false, true, true).includes(batida), false);
});

test('animação pausada fica como está até alguém dar play', () => {
  const alvo = { x: 0 };
  const pausada = gsap.to(alvo, { x: 50, duration: 2, paused: true });
  encerrarAnimacoes();
  assert.equal(alvo.x, 0);
  pausada.play();
  encerrarAnimacoes();
  assert.equal(alvo.x, 50);
});
