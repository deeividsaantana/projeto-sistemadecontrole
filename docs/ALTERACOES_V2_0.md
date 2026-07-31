# Alterações da v2.0 — Arquitetura

Data: 31/07/2026

## Objetivo

Iniciar a evolução para ERP sem alterar dados, regras operacionais, chaves de persistência, contratos Firebase ou telas existentes.

## O que foi feito

### Navegação

A configuração de grupos, itens, ícones, perfis e normalização de role saiu de src/App.tsx e foi centralizada em src/app/navigation/navigation.ts.

Por quê:

- reduzir responsabilidade do App;
- criar uma fonte única para menu e permissões visuais;
- permitir testes sem percorrer o componente raiz.

Impacto:

- os mesmos IDs de módulo foram preservados;
- os mesmos grupos e rótulos foram preservados;
- os mesmos acessos de admin, gestor, operador e leitura foram preservados.

### Rotas públicas

A leitura de tokens de presença, apontamento e ticket saiu do App e foi centralizada em src/app/routing/publicRoutes.ts.

Por quê:

- evitar roteamento manual espalhado;
- permitir testes determinísticos;
- preparar a adoção futura de roteamento formal sem quebrar links existentes.

Impacto:

- /presenca-link/* permanece compatível;
- /apontamento-link/* permanece compatível;
- /ticket-link* permanece compatível;
- query strings presenca, apontamento e tickets permanecem compatíveis.

### Provider raiz e boundary de erro

src/main.tsx passou a montar o App dentro de AppProviders.

AppProviders adiciona um boundary de erro visual. Em uma falha de renderização, a aplicação oferece recarregamento sem executar reset, limpeza de localStorage ou alteração de dados.

Por quê:

- criar a fronteira para futuros QueryClient, tema, autenticação e toasts;
- evitar tela totalmente branca em erro de componente.

### Feedback compartilhado

ScreenLoadingFallback saiu do App e foi movido para src/shared/components/feedback.

Por quê:

- iniciar a camada shared;
- preservar exatamente os fallbacks dos módulos lazy.

### Versão

Foi criado src/app/version.ts. O bootstrap registra data-app-version="2.0.0" no elemento html para suporte e diagnóstico sem alterar a interface.

### Testes

Foram adicionados testes para:

- tokens de rotas públicas;
- reconhecimento de ticket público;
- acesso administrativo completo;
- restrições dos demais perfis;
- compatibilidade de claims antigas.

## Arquivos alterados

- src/App.tsx
- src/main.tsx
- tests/run.ts
- README.md

## Arquivos criados

- src/app/navigation/navigation.ts
- src/app/routing/publicRoutes.ts
- src/app/providers/AppProviders.tsx
- src/app/version.ts
- src/shared/components/feedback/ScreenLoadingFallback.tsx
- tests/navigation.test.ts
- tests/publicRoutes.test.ts
- docs/AUDITORIA_TECNICA_V2_0.md
- docs/AUDITORIA_PLANILHAS_OPERACIONAIS.md
- docs/PLANO_TECNICO_ERP.md
- docs/ALTERACOES_V2_0.md
- docs/VALIDACAO_V2_0.md
- docs/auditoria/inventario-codigo.json
- docs/auditoria/inventario-planilhas.json

## Dados e regras não alterados

- localStorage;
- IndexedDB de espelhamento;
- seeds;
- tipos de domínio;
- importadores;
- exportadores;
- backup Firebase;
- regras Firestore;
- funções Netlify;
- fórmulas operacionais;
- telas e formulários;
- reset;
- sincronização OneDrive;
- IA.

## Riscos

### Import de tipo LucideIcon

Deve ser confirmado pelo typecheck com as dependências do package-lock.

### Boundary de erro

O boundary captura erros de renderização React. Ele não captura erros assíncronos fora da árvore; esses continuam com os tratamentos atuais.

### Ambiente local restrito

Build e testes executáveis não puderam ser rodados neste computador. A validação obrigatória está descrita em docs/VALIDACAO_V2_0.md.

## Como testar

1. npm install
2. npm run lint
3. npm run test
4. npm run build
5. abrir login;
6. validar perfis;
7. abrir todos os módulos;
8. abrir links públicos;
9. validar upload e download Firebase;
10. validar importação e exportação;
11. validar console sem erros novos.

