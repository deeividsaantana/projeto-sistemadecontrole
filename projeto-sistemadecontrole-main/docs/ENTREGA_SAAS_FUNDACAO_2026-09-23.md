# RENEA SaaS — registro da primeira fatia de fundação

## Escopo executado

- Auditoria estática e classificação inicial das 45 telas `*Tab.tsx`, rotas, fontes, APIs, sobreposições e dívida técnica.
- Especificação e plano da fundação e da migração Cadastros → Materiais/Estoque.
- Contrato puro de rota privada canônica e validação de escopo por membership explícita; ainda não conectado à navegação real.
- `ActiveScopeProvider` e hooks opcionais agora encapsulam o escopo autorizado; continuam sem conexão com a navegação até existir um gateway autenticado de memberships.
- O gateway `src/supabase/memberships.ts` lê memberships e projetos sob RLS, e `resolveScopeForPath` só autoriza rotas privadas quando a URL pertence a esse conjunto; links públicos continuam fora do escopo.
- `PrivateRouteApp` foi conectado ao entrypoint para rotas `/app/...`; ele valida o escopo antes de renderizar e mantém o `App` legado para URLs sem rota SaaS.
- Tokens semânticos iniciais e `FilterBar` compartilhado. Após revisão, foi aplicado à tela ativa `CadastrosTab` e sua busca recebeu rótulo acessível; a aplicação inicial em `RegistryScreen` isolado não alcançava usuários.
- Registro da decisão superveniente de incluir RDO.

## Arquitetura e arquivos

- Documentos: `docs/SAAS_AUDITORIA_2026-09-23.md`, `docs/superpowers/specs/2026-09-23-renea-saas-foundation-design.md`, `docs/superpowers/plans/2026-09-23-renea-saas-foundation.md`, nota em `docs/ARQUITETURA_SISTEMA_INTEGRADO_V3_5.md`.
- Contratos: `src/app/routing/privateRoutes.ts`, `src/app/context/activeScope.ts`, `tests/privateRoutes.test.ts`, `tests/run.ts`.
- UI: `src/index.css`, `src/shared/ui/FilterBar.tsx`, `src/shared/ui/DataTable.tsx`, `src/shared/ui/index.ts`, `src/shared/registry/RegistryScreen.tsx`, `src/components/CadastrosTab.tsx`, `src/components/MateriaisTab.tsx`, `tests/e2e/telas.spec.ts`, `docs/SAAS_DESIGN_SYSTEM.md`.
- Domínio: `src/modules/materials/materialCommands.ts`, `src/masterData/registryCommands.ts`, `src/masterData/registryDependencies.ts`, `src/utils/estoque.ts`, `src/App.tsx`, `tests/materialCommands.test.ts`, `tests/registryCommands.test.ts`, `tests/registryDependencies.test.ts`, `tests/estoque.test.ts`.
- Migration SQL: nenhuma nesta fatia; não há nova entidade persistida. Nenhuma operação de produção ou alteração de dados foi feita.

## Evidência local

- Teste novo executado em vermelho (módulo ausente) e depois verde: 3 casos, 3 passaram.
- `npm run verify`: código 0 em 2026-09-23; `tsc --noEmit`, suíte `npm test` e build Vite terminaram. O build transformou 2.379 módulos e avisou sobre chunks acima de 500 kB.
- Após a extração de comandos de Materiais, a otimização do estoque e os filtros ativos, `npm run verify` foi executado novamente sobre o código atual e terminou com código 0. O build transformou 2.380 módulos; o aviso de chunks acima de 500 kB permanece.
- Após a DataTable e seus estados de vazio/carregamento, `npm run verify` terminou novamente com código 0 sobre o código final desta fatia; o build transformou 2.381 módulos. O aviso de chunks grandes permanece.
- Após a extração de regras de Cadastros, `npm run verify` terminou com código 0: TypeScript, suíte e build Vite (2.382 módulos). Os chunks grandes continuam apontados pelo build.
- Após a inativação dos três mestres, `npm run verify` terminou novamente com código 0 em 2026-09-23. O build manteve o aviso de chunks acima de 500 kB (`vendor-firebase`, `vendor-excel`, `seed-august-2026`).
- Após os bloqueios de exclusão dos cadastros auxiliares, `npm run verify` terminou com código 0. A primeira execução do Playwright do novo diálogo falhou por um seletor que ignorava a contagem no nome da aba `Comboios (1)`; corrigido o seletor, desktop e Pixel 5 passaram (2/2).
- Após o bloqueio de exclusão de obra/local referenciado, `npm run verify` terminou novamente com código 0 (TypeScript, suíte e build). Avisos de chunks grandes permanecem.
- Playwright: `cadastros monta sem erro e cabe na tela` passou em desktop e Pixel 5 (2/2); o mesmo teste de Materiais passou em desktop e Pixel 5 (2/2). O harness monta telas com dados de exemplo, sem autenticação real; esta evidência não valida fluxo de gravação ou isolamento entre tenants.
- Playwright da busca acessível na tela ativa de Cadastros: falhou antes da correção e passou depois em desktop e Pixel 5 (2/2).
- Playwright da busca em Materiais: após selecionar Estoque, passou em desktop e Pixel 5; as duas buscas somaram 4/4 no último comando.
- Playwright de ordenação de saldo: falhou antes da DataTable e passou depois em desktop e Pixel 5 (2/2), conferindo os valores em ordem ascendente/descendente e `aria-sort`.
- Playwright da confirmação de desmobilização em Cadastros: desktop e Pixel 5 (2/2), validando texto e ação exibida; o harness usa callbacks vazios e não prova a gravação do aplicativo autenticado.
- Inspeção visual do preview local: imagens `C:/Users/deivids/.codex/visualizations/2026/09/23/01a0cedd-efe0-7d70-a7b6-7e0f8aaaee47/cadastros-fundacao-desktop.png`, `cadastros-fundacao-mobile.png` e `materiais-fundacao-mobile.png` na mesma pasta. Cadastros mobile ainda tem abas e tabelas densas; a reformulação de fluxo continua aberta. O único erro de console observado em Cadastros foi `favicon.ico` 404 no harness.
- `tests/materialCommands.test.ts`: 3/3; `tests/estoque.test.ts`: 10/10. `git diff --check` sem erro de whitespace.
- Revisão local: `git diff --check` sem erro de whitespace; aviso apenas de conversão LF/CRLF do checkout. Contagem do inventário conferida: 45 arquivos, 45 linhas de classificação.

## Impactos, riscos e rollback

- Impacto observável: a busca do cadastro recebe rótulo para leitor de tela; a barra de filtros usa um componente e espaçamento comuns. Regras de cadastro e persistência continuam no caminho anterior.
- Materiais ganhou o mesmo grupo de filtros na visão Estoque/Cadastro/Movimentos. `posicaoEstoque` agrega movimentos em um percurso, preservando recorte e cálculos. Comandos puros de cadastro, movimento e importação foram extraídos de `App.tsx`; IDs repetidos no lote de importação não geram nova inclusão nem contagem de auditoria inflada.
- A listagem de estoque/cadastro de Materiais agora usa DataTable compartilhada com ordenação e paginação local. O contrato ainda não inclui seleção, colunas salvas ou paginação remota; não é adequado, sozinho, para carregar um histórico completo de tenant.
- O contrato de rota não está ligado ao `App.tsx` porque ainda não há fonte de membership autenticada exposta ao shell. Ligar a rota usando o `VITE_SUPABASE_ORGANIZATION_ID` padrão ou o nome `OBRA` criaria uma falsa garantia de isolamento. Até a integração, o sistema segue com navegação por `activeTab`.
- Os testes de caracterização P0 imprimem cenários históricos de falha em texto, mas a suíte retorna sucesso; esta fatia não altera esses fluxos.
- A extração de comandos ainda usa os arrays capturados pelo `App.tsx` e o mesmo `saveAndLog`/cache local. Ela não resolve concorrência entre dispositivos nem falha de gravação remota; esses casos exigem contratos de comando no servidor e reconciliação antes de migrar o domínio.
- Empresas e colaboradores agora têm normalização pura testada; os quatro mestres centrais usam a mesma operação imutável de inclusão/edição. O risco de registros órfãos está registrado em `SAAS_FLUXOS_CADASTROS_MATERIAIS_2026-09-23.md`.
- A confirmação de Cadastros prometia inativação enquanto três comandos removiam a entidade. Empresas agora recebem `INATIVO`, colaboradores `DESMOBILIZADO` e `ativo=false`, equipamentos `Desmobilizado` e `mobilizado=false`; IDs e demais vínculos ficam intactos, com auditoria `UPDATE`. Obras e cadastros auxiliares ainda têm remoção física e o diálogo passou a dizer isso claramente. Testes puros de inativação: 3/3; confirmação visual de frota: Playwright desktop/celular 2/2. A alteração não atualiza vínculos operacionais ativos em outras coleções; essa reconciliação precisa ser definida por domínio antes de migração.
- Exclusões de comboio, tipo de combustível, lubrificante e etapa agora verificam referências tipadas no retrato local. Uma referência bloqueia o comando e deixa o diálogo aberto com alerta; sem referência, permanece a exclusão legada. Testes puros de dependências: 3/3. A checagem ainda precisa ser transacional no backend do SaaS para cobrir outras sessões e tenants.
- Obra/local também bloqueia exclusão quando `localAtualId` da frota ou algum `obraId` das 15 coleções operacionais tipadas aponta para ela. O teste de dependências passa (4/4 incluindo este caso). Isso protege somente dados carregados neste cliente; não é autorização nem integridade referencial no servidor.
- Rollback local: reverter os arquivos de contrato/UI e as exportações/testes associados; não há migração de dados nem alteração de schema para desfazer. A tela antiga de cadastro continua disponível.

## Aceite desta fatia e pendências da primeira entrega ampla

Esta fatia estabelece documentação e contratos iniciais com build/testes verdes. A fundação ampla da Etapa 2 **não está concluída**: faltam conectar contexto autenticado e rotas, DataTable/formulários compartilhados, revisão completa do AppShell, migração real de Cadastros e Materiais, permissões de servidor e testes de equivalência. As caixas abertas no plano representam esse trabalho.
