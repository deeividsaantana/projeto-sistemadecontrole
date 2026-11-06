# Frontend Audit Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Melhorar o frontend do RENEA ERP com foco em sincronização previsível, shell consistente, manutenção e recuperação de erros, preservando os fluxos operacionais.

**Architecture:** Primeiro separar a decisão de quando sincronizar da navegação. Depois extrair responsabilidades de `App.tsx` sem alterar contratos de domínio. Em seguida consolidar shell, estilos globais e carregamento/recuperação por módulo.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Supabase, Node test runner, Playwright.

**Spec:** Auditoria realizada em 2026-11-06 nesta conversa.

## Global Constraints

- Preservar Firebase/Supabase, rotas públicas, dados locais e sincronização operacional.
- Não apagar registros nem transformar ausência de dados em zero.
- Não importar SDK de nuvem diretamente em telas.
- Rodar `npm run verify` antes de concluir.
- Toda mudança de comportamento deve ter teste de regressão.

## Review Focus

- Troca rápida entre telas não deve criar sincronizações concorrentes.
- Reabrir o app com conexão lenta deve manter estados de carregamento e erro compreensíveis.
- Navegação mobile deve preservar foco e voltar ao topo sem reload desnecessário.
- Módulos lazy devem ter fallback visível e não quebrar o shell.
- Redução de movimento deve continuar respeitada.

---

### Task 1: Sincronização desacoplada da navegação

**Files:**
- Modify: `src/App.tsx` (`navigateTo`)
- Test: adicionar contrato em `tests/` para a política de sincronização de navegação

- [ ] Escrever teste que comprove que navegar entre módulos não chama sincronização remota automaticamente.
- [ ] Executar o teste e confirmar falha pela chamada atual em `navigateTo`.
- [ ] Remover a chamada direta de `pullRemoteChanges` da navegação e manter sincronização por pulso, reconexão, foco/visibilidade ou ação explícita já existente.
- [ ] Executar o teste específico e `npm test`.

### Task 2: Extrair sincronização do `App.tsx`

**Files:**
- Create: `src/hooks/useCloudSyncLifecycle.ts`
- Modify: `src/App.tsx`
- Test: `tests/cloudSyncLifecycle.test.ts`

- [ ] Escrever testes para montagem, cleanup, reconexão e evitar chamadas concorrentes.
- [ ] Implementar o hook com callbacks explícitos e cleanup completo.
- [ ] Substituir o bloco correspondente no `App.tsx` sem mudar o contrato dos dados.
- [ ] Executar testes unitários e lint.

### Task 3: Unificar navegação do shell SaaS

**Files:**
- Modify: `src/app/shell/SaaSShell.tsx`
- Modify: `src/app/routing/PrivateRouteApp.tsx`
- Test: testes de navegação existentes e novo contrato de troca de módulo

- [ ] Fixar comportamento esperado de navegação sem reload completo.
- [ ] Implementar navegação pelo roteador existente, preservando URL, escopo e `aria-current`.
- [ ] Validar voltar/avançar, mobile e foco no conteúdo.

### Task 4: Carregamento e recuperação por módulo

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/app/providers/AppProviders.tsx`
- Create/Modify: Error Boundary de módulo em `src/app/`
- Test: testes de fallback e recuperação

- [ ] Tornar Dashboard lazy.
- [ ] Criar fallback de carregamento consistente por módulo.
- [ ] Permitir recuperação local antes do fallback global.
- [ ] Validar erro, retry e retorno ao módulo.

### Task 5: Reduzir CSS global e consolidar tokens visuais

**Files:**
- Modify: `src/index.css`
- Modify: componentes compartilhados em `src/shared/ui/`
- Test: contratos visuais existentes e Playwright desktop/mobile

- [ ] Identificar regras globais duplicadas ou de compatibilidade.
- [ ] Mover regras compartilhadas para componentes/base classes sem alterar telas não relacionadas.
- [ ] Validar contraste, foco, toque, reduced motion e overflow horizontal.

### Task 6: Verificação final e revisão

- [ ] Rodar `npm run lint`.
- [ ] Rodar `npm test`.
- [ ] Rodar `npm run build`.
- [ ] Rodar `npm run check:bundle`.
- [ ] Rodar Playwright em desktop e mobile.
- [ ] Fazer revisão do diff e reportar limitações sem alegar deploy.
