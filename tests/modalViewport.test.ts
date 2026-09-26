import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const modalSource = readFileSync('src/shared/ui/Modal.tsx', 'utf8');
const presenceSource = readFileSync('src/components/ControlePresencaTab.tsx', 'utf8');
const styles = readFileSync('src/index.css', 'utf8');

test('modal compartilhado renderiza na viewport fora da árvore animada', () => {
  assert.match(modalSource, /createPortal\s*\(/);
  assert.match(modalSource, /document\.body/);
});

test('editores de presença usam o mesmo portal de viewport', () => {
  assert.match(presenceSource, /createPortal\s*\(/);
});

test('animação de entrada não mantém transform no ancestral dos diálogos', () => {
  const reveal = styles.match(/@keyframes renea-white-reveal\s*\{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(reveal, /to\s*\{[^}]*transform:\s*none/);
});

test('digitar num campo do modal não devolve o foco ao primeiro botão', () => {
  // onSubmit e onClose mudam a cada digitação de quem usa o Modal; se entrarem
  // nas dependências do efeito, o foco volta ao botão de fechar a cada letra.
  const dependencias = modalSource.match(/\}, \[([^\]]*)\]\);/)?.[1] ?? '';
  assert.doesNotMatch(dependencias, /onSubmit|onClose/);
  assert.match(modalSource, /acoes\.current = \{ onSubmit, onClose \}/);
});
