# Front-end Premium Roadmap

## Direção do produto

RENEA será uma aplicação white de gestão de obras orientada à decisão. A sidebar
verde existente permanece como navegação institucional. O conteúdo deve funcionar
como um workspace por obra: leitura executiva no desktop e lançamento rápido no
campo, sem perder continuidade entre módulos.

## Auditoria inicial

- A aplicação possui módulos operacionais consolidados e dados reais para frota,
  campo, planejamento, medições, custos, materiais e qualidade.
- A camada visual acumula regras globais de diferentes fases do produto. Isso cria
  superfícies, raios, sombras e ritmos inconsistentes entre abas.
- O Painel de Controle tem dados úteis, mas distribui a atenção em muitos blocos
  de igual peso e não prioriza decisão executiva.
- Formulários e tabelas de lançamento/cadastro não compartilham ainda uma mesma
  linguagem de fluxo, estado vazio, erro e confirmação.
- Movimento contínuo na sidebar foi removido. Motion futuro fica restrito a
  transform e opacity, com prefers-reduced-motion e sem bloquear interação.

## Fases de entrega

### Fase 1 - Fundação white premium

- Consolidar tokens de cor, tipografia, espaçamento, bordas, tabelas e formulários.
- Definir motion de interface com duração curta e foco em feedback.
- Garantir navegação por teclado, foco visível e layouts mobile sem overflow.

### Fase 2 - Painel de Controle

- Tratar a obra como contexto principal.
- Reorganizar KPIs, curva físico-financeira, frentes, riscos e alertas em uma
  leitura executiva única.
- Conectar cada card e alerta a uma ação real no módulo de origem.

### Fase 3 - Lançamentos

- Padronizar Combustível, Diário de Obra, Produção, Custos e Medições.
- Priorizar lançamento rápido, rascunho, validação inline, filtros e conferência.

### Fase 4 - Cadastros e Operação

- Recriar cadastros de frota, pessoas, materiais, fornecedores e frentes.
- Aplicar pesquisa, visão de detalhe, ações em lote e estados vazios úteis.

### Fase 5 - Gestão da obra

- Evoluir planejamento, cronograma, financeiro, qualidade e relatórios como
  dashboards de domínio, todos conectados à obra ativa.

### Fase 6 - Produção

- Validar desktop/mobile, Firebase, concorrência, estados offline, build e E2E.
- Publicar cada fase somente após checagem técnica e revisão visual.
