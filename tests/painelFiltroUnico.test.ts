import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ler = (arquivo: string) => readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8');

test('Painel mostra a visão geral sem filtro redundante e todas as equipes na própria tela', async suite => {
  await suite.test('a visão geral não exibe filtro de período redundante', () => {
    assert.equal(ler('src/components/Dashboard.tsx').match(/<PeriodFilter\b/g)?.length ?? 0, 0);
    assert.doesNotMatch(ler('src/App.tsx'), /<PeriodFilter\b/);
    assert.doesNotMatch(ler('src/app/shell/DesktopTopBar.tsx'), /filtroDaTela/);
  });

  await suite.test('"Mostrar mais equipes" abre a lista inteira no lugar, sem trocar de aba', () => {
    const fonte = ler('src/components/dashboard/TeamActivity.tsx');
    assert.match(fonte, /Mostrar mais equipes/);
    assert.match(fonte, /aria-expanded=\{todasEquipes\}/);
    assert.match(fonte, /todasEquipes \? view\.teams\.items :/);
  });
});
