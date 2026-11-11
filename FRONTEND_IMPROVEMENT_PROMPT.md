# Prompt rigoroso — auditoria e melhoria completa do front-end RENEA/Cintravyse

## Papel

Você é um engenheiro de produto sênior, especialista em React, TypeScript, UX para ERP de obras, acessibilidade, performance web e operações offline-first. Trabalhe no repositório existente. Não reescreva a aplicação, não troque a stack e não crie uma interface paralela.

## Produto e objetivo

O produto é o Cintravyse, um ERP de obras usado pelo ambiente RENEA. Ele precisa parecer e funcionar como uma ferramenta operacional profissional: simples para quem lança dados rapidamente em campo, completa para gestores e administradores, responsiva, leve e confiável mesmo com internet instável.

O objetivo desta rodada é auditar e melhorar o front-end inteiro, aba por aba, preservando regras de negócio, dados, permissões, sincronização e links existentes.

## Contexto técnico confirmado

- React 19, TypeScript, Vite 6, Tailwind via `@tailwindcss/vite`, Supabase e Render.
- Entrada principal e parte relevante da orquestração estão em `src/App.tsx`.
- As telas são carregadas com `lazy()` e `Suspense`.
- Existe uma tabela compartilhada em `src/shared/ui/TabelaPadrao.tsx`.
- Existem componentes compartilhados para cabeçalho, filtros, botões, campos, estados, modal, alertas e indicadores em `src/shared/ui/`.
- O estado local e a sincronização em nuvem ainda têm forte acoplamento com `src/App.tsx`.
- O build já separa Excel, PDF, Supabase e alguns ícones em chunks.
- O projeto exige `npm run verify`, que executa TypeScript, testes, build e verificação de bundle.

## Achados da auditoria inicial

Use estes achados como hipóteses verificadas para orientar a execução:

1. `src/App.tsx` é o maior ponto de acoplamento: concentra navegação, estado de domínio, persistência local, sincronização, auditoria, ações de várias telas e regras de negócio. Não fazer uma migração gigante; extrair por domínio e validar a cada fatia.
2. Telas críticas ainda são arquivos muito grandes, especialmente presença, frota, lançamentos, cadastros, manutenção e combustível. Dividir por responsabilidade, não apenas por tamanho.
3. Há 204 ocorrências de armazenamento/sincronização/telemetria relacionadas ao fluxo principal em `src`, com forte concentração no `App.tsx`. Toda operação de salvar precisa ter estado visível: salvo localmente, pendente, sincronizando, sincronizado, falhou e tentar novamente.
4. A aplicação possui componentes visuais compartilhados, mas ainda há muitos `<button>`, `select`, `textarea` e classes locais nas telas. Substituir duplicação somente quando o comportamento for realmente comum.
5. O CSS global `src/index.css` é grande e possui camadas históricas de compatibilidade. Antes de remover qualquer regra, medir quais telas dependem dela. Consolidar tokens, eliminar conflitos e documentar exceções.
6. O padrão de cabeçalho, filtros, tabelas, estados de vazio/carregamento/erro e campos já começou a ser unificado. Não regredir esse padrão.
7. A navegação atual está centralizada em `src/app/navigation/navigation.ts`; qualquer tela nova precisa estar ligada a navegação, permissões, rota antiga/redirect quando necessário, título, estado ativo e mobile.
8. A aba Pluviômetro ainda é uma lacuna funcional. Não criar apenas um mock visual: definir modelo, cadastro/lançamento, consulta por período/obra, auditoria, offline e sincronização antes de implementar.
9. O fluxo de Solicitações e Compras precisa ser tratado como processo: criar, revisar, cotar, aprovar, comprar/despachar, receber, cancelar, reagendar e auditar, com permissões claras por etapa.
10. O cadastro de usuários precisa ter criação, edição, ativação/inativação, perfil, permissões, avatar/fallback e exclusão protegida. Nunca remover o último administrador ativo e nunca apagar histórico de auditoria.

## Regras inegociáveis

1. Não remover dados, tabelas, histórico, permissões, rotas ou funcionalidades sem confirmação explícita.
2. Não alterar contratos de dados silenciosamente. Se um contrato precisar mudar, criar compatibilidade e teste de migração.
3. Não usar `any`, casts sem justificativa, `catch` amplo, fallback silencioso ou sucesso falso.
4. Toda falha de sincronização deve ser visível e acionável. O dado local pode permanecer salvo, mas a interface deve explicar que ainda não chegou à nuvem.
5. Não disparar múltimos uploads concorrentes para o mesmo snapshot. Usar a fila existente e testar lançamentos rápidos.
6. Não bloquear a interface enquanto uma operação de nuvem ocorre. Usar atualização otimista somente com estado de pendência e reconciliação.
7. Não carregar Excel, PDF, canvas ou bibliotecas pesadas no caminho inicial sem necessidade.
8. Não usar gradientes, excesso de sombras, cartões decorativos, números inventados, ícones sem rótulo ou textos pequenos ilegíveis.
9. Usar o português do produto de forma consistente. Preferir frases de ação: “Salvar lançamento”, “Tentar novamente”, “Nenhum registro encontrado”.
10. Preservar foco de teclado, `aria-label`, `aria-live`, `aria-busy`, foco em modal, fechamento com Esc e navegação sem mouse.
11. A interface precisa funcionar em 1440px, 1024px, 768px e 390px sem overflow horizontal acidental.
12. Não publicar até `npm run verify` passar e o diff ser revisado.

## Plano de execução obrigatório

### Fase 1 — inventário e baseline

1. Mapear todas as telas acessíveis em `PRIMARY_MODULE_IDS`, `ROLE_ACCESS` e `SIDEBAR_NAVIGATION_GROUPS`.
2. Para cada tela, registrar:
   - pergunta principal que a tela responde;
   - ação principal;
   - dados carregados;
   - operação de escrita;
   - estados loading, vazio, erro, pendente/offline e sucesso;
   - permissões;
   - comportamento em 390px;
   - dependências pesadas;
   - problemas encontrados.
3. Executar baseline:
   - `npm run lint`
   - `npm test`
   - `npm run build`
   - `npm run check:bundle`
   - `npm run e2e` quando o ambiente estiver disponível.
4. Não mascarar testes antigos quebrados. Separar regressão existente, falha causada pela mudança e falha corrigida.

### Fase 2 — shell e navegação

1. Manter a sidebar com grupos claros e item ativo evidente.
2. Conferir desktop expandido, desktop recolhido, mobile aberto, mobile fechado, Esc, clique fora, scroll lock, foco e logout.
3. Cada tela deve ter um título único. Não repetir rótulo de grupo no cabeçalho.
4. O topo deve conter somente título, contexto indispensável, filtros e ação principal.
5. Garantir que o título da tela e o título acessível existam mesmo quando a tela usa abas.

### Fase 3 — padrão de listas e tabelas

1. Usar `TabelaPadrao` como base de listas, salvo justificativa documentada.
2. Uniformizar busca, filtro, ordenação, seleção, ações da linha, total, exportação e paginação.
3. No celular, transformar cada linha em cartão legível com campos prioritários primeiro.
4. Não esconder Editar, Excluir, Aprovar ou Receber atrás de ícone sem rótulo quando a ação for crítica.
5. Garantir estados honestos:
   - carregando: não mostrar lista antiga como se fosse atual;
   - vazio: explicar por que está vazio e indicar próximo passo;
   - erro: dizer o que falhou e oferecer retry;
   - offline/pendente: mostrar que está salvo no aparelho e aguardando nuvem.

### Fase 4 — padrão de formulários e lançamentos

1. Todos os formulários devem ter:
   - labels visíveis;
   - ordem operacional natural;
   - campos obrigatórios identificados;
   - validação próxima ao campo;
   - `aria-invalid` e descrição ligada ao campo;
   - botão primário e Cancelar no mesmo lugar;
   - confirmação antes de ação destrutiva;
   - proteção contra duplo clique;
   - feedback de salvamento local e nuvem.
2. Para lançamentos rápidos de frota, combustível, presença, diário e estacas:
   - priorizar teclado e Enter;
   - manter foco no próximo campo;
   - evitar modais desnecessários;
   - aceitar vários lançamentos sem uploads concorrentes;
   - preservar rascunho quando houver falha;
   - permitir retry sem redigitar tudo.

### Fase 5 — compras e solicitações

Auditar e completar o fluxo sem pular etapas:

1. solicitação inicial com obra, centro de custo, prioridade, solicitante, itens, quantidade, unidade, justificativa e anexos quando suportados;
2. revisão com pendências claras;
3. cotação com fornecedor, preço, prazo, frete, condição e comparação;
4. aprovação conforme permissão;
5. compra/ordem e despacho;
6. recebimento parcial ou total, divergência e observação;
7. cancelamento/reagendamento com motivo;
8. timeline/auditoria completa;
9. filtros por estado, obra, responsável, prioridade e período;
10. estados offline e falha de nuvem sem perder a solicitação.

### Fase 6 — cadastros e usuários

1. Organizar Cadastros por categorias pesquisáveis.
2. Permitir criar, editar, ativar/inativar e excluir somente onde for seguro.
3. Usuários:
   - nome completo, nome de perfil, e-mail, cargo, área, matrícula e telefone;
   - perfil e permissões granulares;
   - avatar por inicial/cor como fallback;
   - editar, restaurar e remover avatar;
   - bloquear exclusão do último administrador;
   - confirmação explícita;
   - auditoria antes/depois;
   - atualização da lista sem reload total.
4. Nunca exibir permissão que o backend não aplica. A autorização real deve ser conferida no servidor.

### Fase 7 — Pluviômetro

Antes de codificar, definir e documentar:

- entidade e chave por obra/data/local;
- leitura, unidade, horário e observação;
- edição e correção auditada;
- consulta diária, semanal, mensal e acumulada;
- impacto no diário de obra e relatórios;
- permissões de lançamento e consulta;
- persistência local, fila offline, retry e conflitos;
- validação contra valores impossíveis;
- acessibilidade e operação rápida no celular.

Depois implementar a fatia completa: modelo, API, tela, navegação, permissões, estados, testes e exportação necessária.

### Fase 8 — performance

1. Medir bundle inicial e chunks antes/depois.
2. Manter lazy loading por tela.
3. Remover imports pesados de caminhos iniciais.
4. Evitar re-render global ao editar um único registro.
5. Usar memoização apenas onde medição justificar.
6. Virtualizar ou paginar listas grandes.
7. Debounce em busca e filtros que consultam dados.
8. Nunca serializar/regravar um snapshot grande a cada tecla.
9. Consolidar lançamentos e usar fila de uma publicação por vez.
10. Medir tempo até interação, tamanho inicial, chamadas de rede e memória em uma sessão de lançamento rápido.

### Fase 9 — auditoria visual e acessibilidade

Para cada tela primária, revisar:

- hierarquia visual;
- título e ação principal;
- densidade adequada para ERP;
- contraste;
- foco;
- leitura por teclado;
- labels e nomes acessíveis;
- modal e drawer;
- mobile 390px;
- tablet 768px;
- desktop 1440px;
- redução de movimento;
- nenhum overflow horizontal.

Usar screenshots reais do app, não mockups. Corrigir os três problemas de maior impacto de cada tela antes de detalhes cosméticos.

## Critérios de aceite

O trabalho só está concluído quando:

1. Todas as telas de `PRIMARY_MODULE_IDS` foram percorridas e possuem registro de auditoria.
2. Todas as telas usam cabeçalho, estados, filtros e tabela/formulário padronizados quando aplicável.
3. Nenhuma operação de salvar fecha o formulário silenciosamente quando a nuvem falha.
4. Lançamentos rápidos não produzem uploads concorrentes nem perdem rascunhos.
5. Solicitações e Compras têm fluxo completo e auditável.
6. Pluviômetro está implementado como fluxo real ou possui especificação aprovada separada; nunca deixar mock sem aviso.
7. Usuários têm edição, permissões, avatar e ciclo de vida protegido.
8. Não existe erro TypeScript.
9. `npm test`, `npm run build` e `npm run check:bundle` passam.
10. `git diff --check` passa.
11. Não há artefatos de `dist` adicionados ao commit por acidente.
12. O relatório final lista arquivos alterados, riscos restantes, testes executados e screenshots conferidos.

## Formato obrigatório da entrega

Entregue:

1. resumo executivo com os problemas encontrados;
2. tabela de auditoria por tela com severidade, evidência, correção e teste;
3. mudanças implementadas por fase;
4. riscos e decisões que exigem aprovação;
5. comandos executados e resultado;
6. lista de arquivos alterados;
7. pendências que não devem ser escondidas;
8. recomendação objetiva para deploy.

Não diga “está tudo pronto” se alguma tela, fluxo, estado de erro, teste ou resolução de mobile não tiver sido verificada.
