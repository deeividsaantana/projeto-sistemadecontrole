import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Search, Save } from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  TextInput,
} from '../src/shared/ui';

test('componentes base do design system renderizam contratos essenciais', () => {
  const html = renderToStaticMarkup(
    <div>
      <Button icon={Save} variant="primary">Salvar</Button>
      <IconButton icon={Search} label="Pesquisar" badge={2} />
      <TextInput icon={Search} aria-label="Busca" defaultValue="obra" />
      <Badge tone="success">Ativo</Badge>
      <EmptyState icon={Search} title="Sem dados" description="Nenhum registro localizado." />
    </div>,
  );

  assert.match(html, /Salvar/);
  assert.match(html, /aria-label="Pesquisar"/);
  assert.match(html, /value="obra"/);
  assert.match(html, /Ativo/);
  assert.match(html, /Sem dados/);
});
