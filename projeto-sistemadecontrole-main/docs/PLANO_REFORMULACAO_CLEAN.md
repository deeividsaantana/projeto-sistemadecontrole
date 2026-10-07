# Plano de Reformulacao Clean do Sistema RENEA ERP

Data da analise: 2026-08-15

## Objetivo

Reformular o sistema de forma incremental, preservando os dados e as funcionalidades existentes, enquanto a base passa a ter uma arquitetura mais clara, manutencao mais simples, melhor experiencia operacional e validacao continua.

## Decisao tecnica atual

O caminho recomendado e manter a aplicacao atual em React/Vite/Firebase durante a reformulacao. A base ja funciona, possui dados operacionais, testes automatizados e build de producao valido. Uma reconstrucao imediata em Laravel/PostgreSQL seguiria uma arquitetura mais tradicional de ERP, mas teria custo maior, prazo maior e risco maior de perda de comportamento ja existente.

Laravel/PostgreSQL deve ficar como opcao futura para uma migracao planejada, com modelagem de banco, importadores, validacao paralela e corte de producao controlado. Neste momento, o melhor retorno tecnico e limpar a base atual por dentro, reduzir riscos e preservar continuidade operacional.

## Estado atual observado

- Aplicacao Vite + React + TypeScript.
- Versao do pacote: `3.4.1`.
- Entrada principal: `src/main.tsx`.
- Componente central: `src/App.tsx`, reduzido de 4581 para 4289 linhas nos primeiros ciclos de limpeza, com responsabilidades de auth, shell, storage e notificacoes ja separadas.
- Navegacao declarativa em `src/app/navigation/navigation.ts`.
- Providers globais em `src/app/providers/AppProviders.tsx`.
- Persistencia principal via `localStorage`, com espelhamento/resiliencia em `src/utils/resilientStorage.ts`.
- Integracoes com Firebase/Auth/Firestore/Storage, Netlify Functions e rotas publicas.
- Testes existentes: 65 testes passando.
- Build de producao passando.

## Principais problemas a resolver

1. `App.tsx` concentra responsabilidades demais:
   - autenticacao;
   - hidratacao de dados;
   - migracoes locais;
   - sincronizacao Firebase;
   - roteamento de links publicos;
   - estado de todos os modulos;
   - handlers de CRUD;
   - layout principal;
   - notificacoes.

2. Componentes de modulo estao grandes:
   - `TicketsJazidaTab.tsx`: cerca de 164 KB;
   - `CombustivelInteligenteTab.tsx`: cerca de 104 KB;
   - `CadastrosTab.tsx`: cerca de 97 KB;
   - `LancamentosTab.tsx`: cerca de 96 KB;
   - `RelatoriosTab.tsx`: cerca de 75 KB.

3. Dados seed muito grandes entram no projeto frontend:
   - `initialMateriaisData.ts`: cerca de 3.2 MB;
   - `importedAugust2026Seed.ts`: cerca de 1.7 MB;
   - `importedSpreadsheetSeed.ts`: cerca de 363 KB.

4. Firebase esta configurado diretamente em `src/firebase.ts`.
   A chave web do Firebase nao equivale a uma chave admin, mas a configuracao deve ir para variaveis de ambiente para facilitar ambientes, deploy e manutencao.

5. A UI usa uma camada global em `src/index.css` para converter tema escuro legado para claro.
   Isso funciona como ponte, mas dificulta previsibilidade visual e manutencao do design system.

6. A validacao visual mostrou:
   - login carrega em desktop e mobile;
   - mobile nao apresentou overflow horizontal no login;
   - console emite aviso de permissao Firestore antes do login: `Missing or insufficient permissions`.

## Arquitetura alvo

```text
src/
  app/
    AppShell.tsx
    providers/
    routing/
    navigation/
  auth/
    AuthGate.tsx
    authService.ts
    useAuthSession.ts
  data/
    localStore.ts
    storageKeys.ts
    migrations/
    backupService.ts
  modules/
    dashboard/
    cadastros/
    combustivel/
    equipamentos/
    tickets-jazida/
    materiais/
    presenca/
    apontamentos/
    estacas/
    relatorios/
    configuracoes/
  services/
    firebase/
    netlify/
    publicApi/
    telemetry/
  shared/
    components/
    hooks/
    ui/
    utils/
  domain/
    equipamentos/
    combustivel/
    tickets/
    materiais/
    presenca/
```

## Plano por fases

### Fase 1 - Base limpa sem mudanca funcional

- Criar `AppShell` para layout principal.
- Criar `AuthGate` para login, sessao e recuperacao de senha.
- Extrair chaves de storage para `src/data/storageKeys.ts`.
- Extrair operacoes de leitura/gravao local para `src/data/localStore.ts`.
- Manter comportamento atual identico.
- Validar com `npm run lint`, `npm test` e `npm run build`.

Progresso inicial:

- Criado `src/data/storageKeys.ts`.
- Criado `src/data/localStore.ts`.
- Iniciada substituicao de flags de `localStorage` no `src/App.tsx`.
- Criado `src/auth/LoginScreen.tsx` para isolar a tela de login.
- Criado `src/auth/authService.ts` para centralizar login, recuperacao de senha, logout e mensagens de erro.
- Criado `src/shared/components/feedback/ToastViewport.tsx` para remover a renderizacao de toasts do `App.tsx`.
- Criado `src/app/shell/NavigationMenu.tsx` para centralizar menu lateral, busca de modulos e drawer mobile.
- Criado `src/app/shell/NotificationCenter.tsx` para isolar dropdown de notificacoes e acoes de leitura.
- Criado `src/app/shell/DesktopTopBar.tsx` para separar barra superior, data, usuario e atalhos.
- Criado `src/app/shell/DesktopModuleTabs.tsx` para separar navegacao horizontal por modulo.
- A validacao Firestore deixou de rodar antes do login, evitando aviso normal de permissao na tela inicial.
- Validado com `npm.cmd run lint`, `npm.cmd test` e `npm.cmd run build`.

### Fase 2 - Estado e persistencia por dominio

- Criar hooks por dominio:
  - `useCadastrosData`;
  - `useCombustivelData`;
  - `useTicketsJazidaData`;
  - `usePresencaData`;
  - `useMateriaisData`;
  - `useEquipamentosData`.
- Mover handlers de CRUD para services ou hooks de dominio.
- Reduzir `App.tsx` para orquestracao, rotas e composicao.
- Adicionar testes de regressao para handlers extraidos.

Progresso inicial:

- Criado `src/notifications/notificationService.ts` para centralizar criacao, limite, marcacao de leitura e persistencia das notificacoes.
- Removido helper duplicado de parse JSON do `src/App.tsx`, reaproveitando `src/data/localStore.ts`.
- Padronizada a persistencia de notificacoes em fluxos locais, leitura individual, leitura em massa, limpeza e ingestao de envios publicos.
- Criado `tests/notificationService.test.ts` com regressao para ordenacao, limite de 50 notificacoes e marcacao de leitura.
- Criado `src/auth/sessionActivity.ts` para centralizar timeout de sessao, eventos monitorados e gravacao da ultima atividade.
- Atualizado `tests/sessionTimeout.test.ts` para validar o contrato do servico de sessao.
- Validado com `npm.cmd run lint`, `npm.cmd test` e `npm.cmd run build`.

### Fase 3 - Design system operacional

- Criar componentes compartilhados:
  - `Button`;
  - `IconButton`;
  - `Input`;
  - `Select`;
  - `Textarea`;
  - `Modal`;
  - `DataTable`;
  - `KpiTile`;
  - `EmptyState`;
  - `ErrorState`;
  - `Toolbar`;
  - `FilterBar`.
- Substituir estilos globais de conversao por tokens e componentes consistentes.
- Priorizar telas de maior uso operacional:
  1. Dashboard;
  2. Controle de Basculantes;
  3. Combustivel;
  4. Tickets Jazida;
  5. Presenca.

Progresso inicial:

- Criada a base `src/shared/ui` com `Button`, `IconButton`, `TextInput`, `Badge`, `EmptyState` e helper `cn`.
- Aplicado o design system inicial no shell do sistema:
  - busca e itens do menu lateral;
  - botao de cadastros da barra superior;
  - indicador de sistema conectado;
  - centro de notificacoes;
  - abas horizontais de modulos no desktop.
- Reduzido o uso de `rounded-xl` e superficies escuras legadas no shell, aproximando a interface de um ERP operacional claro, denso e previsivel.
- Criado `tests/sharedUi.test.tsx` para validar renderizacao basica dos componentes compartilhados.
- Validado com `npm.cmd run lint`, `npm.cmd test` e `npm.cmd run build`.

### Fase 4 - Performance e bundle

- Retirar seeds grandes do bundle principal quando possivel.
- Carregar dados historicos sob demanda ou por arquivos publicos versionados.
- Revisar chunks grandes apontados no build:
  - `index`;
  - `initialMateriaisData`;
  - `vendor-firebase`.
- Medir antes/depois por `npm run build`.

Progresso inicial:

- Ajustado `vite.config.ts` para particionar chunks por categoria:
  - `seed-august-2026`;
  - `seed-spreadsheet`;
  - `seed-materiais`;
  - `vendor-excel`;
  - `vendor-pdf`;
  - `vendor-canvas`;
  - `vendor-charts`;
  - `vendor-firebase-storage`.
- Separado Firebase Storage em `src/firebaseStorage.ts`, deixando `src/firebase.ts` carregar apenas App/Auth/Firestore no caminho principal.
- Atualizado `src/services/operationalAttachments.ts` para usar o storage isolado.
- Resultado medido no build:
  - chunk principal `index` caiu de aproximadamente 3118 KB para 407 KB minificado;
  - seed de agosto ficou isolado em aproximadamente 1363 KB;
  - seed de materiais permaneceu isolado em aproximadamente 2265 KB;
  - Excel, PDF, Canvas, Charts e Firebase Storage passaram a ter chunks nomeados.
- Observacao: parte desses chunks ainda pode ser pre-carregada por dependencias estaticas do `App.tsx`. O proximo ganho sera transformar seeds e exportadores pesados em carregamento sob demanda por fluxo.
- Validado com `npm.cmd run lint`, `npm.cmd test` e `npm.cmd run build`.

### Fase 5 - Firebase e ambientes

- Migrar configuracao Firebase para `.env`.
- Atualizar `.env.example`.
- Evitar validacoes Firestore protegidas antes de usuario autenticado.
- Padronizar erros de permissao com mensagens silenciosas ou acionaveis.
- Revisar regras em `firestore.rules` e `storage.rules`.

Progresso inicial:

- Criado `src/config/firebaseClientConfig.ts` para resolver a configuracao do Firebase Web SDK por variaveis `VITE_FIREBASE_*`, mantendo fallback local compativel com o projeto atual.
- Atualizado `src/firebase.ts` para usar o resolvedor central e emitir aviso quando uma configuracao futura vier incompleta.
- Criado `src/vite-env.d.ts` com tipagem das variaveis publicas usadas pelo Vite.
- Atualizado `.env.example` com `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` e `VITE_FIREBASE_MEASUREMENT_ID`.
- Atualizado `INSTRUCOES_PUBLICACAO_NETLIFY.md` para orientar o uso das variaveis `VITE_` no front-end e manter `FIREBASE_WEB_API_KEY` apenas como legado de scripts.
- Criado `tests/firebaseClientConfig.test.ts` para validar override por ambiente e fallback local.
- Criado `tests/firestoreRules.test.ts` para proteger default deny, staff claim, perfil leitura e bloqueios de acesso direto.
- Revisadas `firestore.rules` e `storage.rules`: as regras permanecem restritivas, com acesso direto limitado a usuarios autenticados com `staff`, escrita bloqueada para `leitura`, links publicos intermediados por Functions e delete direto bloqueado.
- Validado com `npm.cmd run lint`, `npm.cmd test` e `npm.cmd run build`.

### Fase 6 - Publicacao e hardening

- Revisar Netlify Functions.
- Rodar auditoria de dependencias e separar alertas reais de alertas transitivos.
- Criar checklist de deploy.
- Validar rotas publicas sem login.
- Validar login, logout, recuperacao de senha, backup, importacao e exportacao.

Progresso final:

- Criado `docs/RELATORIO_REFORMULACAO_CLEAN_FINAL.md` consolidando as 6 fases, validacoes, riscos restantes e checklist antes de producao.
- Executado `npm.cmd run verify` com lint, testes e build passando.
- Executado `npm.cmd audit --omit=dev`.
- Executado `npm.cmd audit fix` sem `--force`, reduzindo vulnerabilidades de 16 para 9 moderadas.
- Mantidas as 9 vulnerabilidades restantes sem `--force`, pois a correcao proposta pelo npm envolve mudanca quebravel de dependencias como `exceljs` e cadeia Firebase Admin/Google Cloud.
- Validacao final apos o audit fix:
  - `npm.cmd run lint`: passou;
  - `npm.cmd test`: passou com 70 testes;
  - `npm.cmd run build`: passou.

### Fase 7 - Backend profissional e seguranca de API

- Criar camada compartilhada de seguranca para Netlify Functions.
- Padronizar headers defensivos nas respostas JSON.
- Validar metodos HTTP antes de executar regras de negocio.
- Responder `OPTIONS` sem exigir login, preservando contrato de metodos permitidos.
- Validar identificadores usados em caminhos do Firestore.
- Preparar suporte gradual a chaves de idempotencia para operacoes mutaveis.

Progresso inicial:

- Criado `netlify/functions/_shared/api-security.js` com helpers puros de seguranca de API.
- Atualizado `netlify/functions/_shared/firebase-admin.js` para reutilizar extracao de bearer token e aplicar headers defensivos em `jsonResponse`.
- Atualizado `netlify/functions/master-data.js` para usar validacao centralizada de metodo, IDs e idempotencia opcional.
- Criado `tests/apiSecurity.test.ts` para proteger o contrato dos helpers.

### Fase 8 - Cache profissional e seguranca de publicacao

- Revisar service worker para evitar cache indevido de HTML, Functions e dados operacionais.
- Manter cache agressivo apenas para assets estaticos versionados.
- Evitar fallback offline para HTML antigo em ambiente de ERP.
- Criar teste de regressao para o contrato do service worker.

Progresso inicial:

- Atualizado `public/service-worker.js` para cachear somente manifest, favicon e assets estaticos seguros.
- Functions Netlify continuam excluidas do cache.
- Respostas `Cache-Control: no-store` nao sao gravadas no cache runtime.
- Criado `tests/serviceWorkerSecurity.test.ts`.

### Fase 9 - Observabilidade operacional

- Criar contexto de requisicao para Netlify Functions.
- Emitir logs estruturados com `requestId`, metodo, rota, duracao e status.
- Redigir dados sensiveis antes de escrever logs.
- Retornar `X-Request-Id` nas respostas para facilitar suporte e rastreio.

Progresso inicial:

- Criado `netlify/functions/_shared/observability.js`.
- Atualizado `netlify/functions/master-data.js` para envolver o handler com telemetria.
- Adicionado `X-Request-Id` nas respostas do gateway `master-data`.
- Criado `tests/observability.test.ts`.

### Fase 10 - Auditoria avancada

- Sanitizar snapshots de auditoria antes de gravar.
- Redigir campos sensiveis como tokens, senhas, cookies, secrets e API keys.
- Limitar profundidade, tamanho de strings e listas grandes nos logs de auditoria.
- Registrar `requestId`, perfil do usuario e campos alterados.
- Permitir filtros administrativos por acao, modulo, usuario, registro e periodo.

Progresso inicial:

- Criado `netlify/functions/_shared/audit-log.js`.
- Atualizado `writeAudit` do `master-data` para usar registros sanitizados e rastreaveis.
- Atualizada consulta de auditoria com filtros em memoria sobre os registros da organizacao.
- Criado `tests/auditLog.test.ts`.

### Fase 11 - Idempotencia real no backend

- Gravar chaves de idempotencia para operacoes mutaveis.
- Reutilizar a resposta gravada quando a mesma operacao for reenviada.
- Bloquear reutilizacao da mesma chave com payload diferente.
- Evitar duplicidade em cadastros, atualizacoes, inativacoes e importacoes protegidas.
- Enviar `X-Idempotency-Key` automaticamente pelo gateway do front-end.

Progresso inicial:

- Criado `netlify/functions/_shared/idempotency.js`.
- Atualizado `netlify/functions/master-data.js` para envolver mutacoes em `withIdempotency`.
- Atualizado `src/services/masterDataApi.ts` para gerar `X-Idempotency-Key` em chamadas mutaveis.
- Criado `tests/idempotency.test.ts`.

### Fase 12 - Refinamento operacional do front-end

- Substituir confirmacoes nativas do navegador por fluxos visuais do ERP.
- Dar mais contexto antes de acoes sensiveis.
- Preservar acessibilidade basica em modais e estados de decisao.
- Cobrir contratos visuais criticos com testes de regressao.

Progresso inicial:

- Atualizado `src/components/MasterDataReviewCenter.tsx` para usar modal proprio antes de aplicar a planilha mestre.
- Removido `window.confirm` do fluxo de aplicacao mestre.
- O modal mostra totais de linhas novas, atualizaveis, duplicadas e invalidas antes da confirmacao.
- Criado `tests/masterDataReviewCenterUi.test.ts`.
- Atualizado `src/components/CadastrosTab.tsx` para mostrar nome/codigo do registro antes de inativar ou desmobilizar.
- Modal de inativacao de cadastros ganhou `role="dialog"`, `aria-modal` e protecao contra clique repetido.
- Criado `tests/cadastrosTabUi.test.ts`.

### Fase 13 - Performance final

- Reduzir peso de assets grandes sem alterar os fluxos do ERP.
- Trocar imagens operacionais pesadas por variantes otimizadas.
- Proteger o contrato de performance com teste de regressao.

Progresso inicial:

- Criadas imagens otimizadas em `src/assets/equipment/optimized`.
- Atualizado `src/components/ManutencaoEquipamentosTab.tsx` para usar fotos `.jpg` otimizadas.
- As fotos de equipamentos cairam de aproximadamente 1,5-2,2 MB cada para cerca de 78-136 KB cada.
- Criado `tests/equipmentAssetPerformance.test.ts`.
- Removidos imports estaticos de `exceljs`, `excelCorporate` e `universalPdfReport` da aba de manutencao.
- Exportacao Excel/PDF da manutencao agora carrega dependencias pesadas apenas sob demanda.

### Fase 14 - Seeds operacionais sob demanda

- Reduzir acoplamento do `initialData.ts` com bases historicas pesadas.
- Evitar imports estaticos de seeds operacionais grandes no pacote inicial.
- Preservar migracao e reset da base local com os mesmos dados finais.

Progresso inicial:

- Criado `hydrateInitialOperationalSeedData` em `src/utils/initialData.ts`.
- `importedSpreadsheetSeed` e `importedAugust2026Seed` agora carregam por importacao dinamica.
- `App.tsx` passou a hidratar seeds operacionais e materiais em paralelo antes da leitura/migracao do `localStorage`.
- `tests/equipmentAssetPerformance.test.ts` passou a proteger a regra contra retorno de imports estaticos dos seeds grandes.

## Ordem recomendada de execucao

1. Extrair autenticacao e shell visual do `App.tsx`.
2. Extrair storage keys e local store.
3. Extrair dados/handlers de um modulo pequeno primeiro, por exemplo `estacas` ou `materiais`.
4. Aplicar o mesmo padrao aos modulos grandes.
5. Reformular design system e telas prioritarias.
6. Otimizar bundle e seeds.
7. Fechar Firebase, seguranca e deploy.

## Criterios de aceite

- Nenhuma funcionalidade atual removida sem decisao explicita.
- Dados locais existentes continuam legiveis.
- Rotas publicas continuam funcionando.
- Build de producao passa.
- TypeScript passa sem erros.
- Testes atuais continuam verdes.
- Novos services/hooks relevantes possuem testes.
- UI principal funciona em desktop e mobile sem overflow horizontal.
- Console nao mostra erros esperados como fluxo normal.

## Comandos de validacao

```bash
npm run lint
npm test
npm run build
```

## Primeiro incremento sugerido

Implementar a Fase 1:

- criar `src/auth/AuthGate.tsx`;
- criar `src/app/AppShell.tsx`;
- criar `src/data/storageKeys.ts`;
- criar `src/data/localStore.ts`;
- reduzir `src/App.tsx` gradualmente, sem alterar contratos dos modulos.

Esse incremento prepara o sistema para a reformulacao completa com baixo risco, porque muda organizacao interna antes de redesenhar regras criticas.
