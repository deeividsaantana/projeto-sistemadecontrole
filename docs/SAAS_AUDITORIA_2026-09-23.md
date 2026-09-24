# RENEA SaaS — inventário e auditoria inicial

Data: 2026-09-23. Checkout: `codex/expandir-painel-erp-de-obra`. Escopo: código versionado deste checkout; dados de produção não foram consultados. Esta classificação é uma decisão de arquitetura inicial; a revisão de campos, operações e equivalência de cada fluxo será completada antes da respectiva migração.

## Estado encontrado

- `src/App.tsx` concentra estado, hidratação de `localStorage`, sincronização, handlers e renderização condicional de abas. `activeTab` é um ID em memória; não há URLs privadas canônicas para cada módulo.
- `src/app/navigation/navigation.ts` define 45 destinos de navegação, permissões visuais e uma seleção menor para sidebar. `src/app/shell` contém sidebar, topbar, busca e notificações. `src/shared/ui` já possui primitivas, mas não uma especificação de tokens, contratos de tabela/filtro ou formulário.
- Firebase Auth/Firestore e cache local seguem operacionais. `src/cloud/cloudSyncGateway.ts` separa provedores; `src/supabase` implementa o espelho. As migrations incluem organização, membros, projetos, centros de custo e tabelas piloto. `erp_snapshots` é transicional, não a base canônica final.
- `server/index.js` adapta Functions para Render. As Functions de links públicos, cadastros e telemetria vivem em `netlify/functions`; os caminhos `/ticket-link` e `/presenca-link` são resolvidos antes do ERP administrativo. Sua autenticação, token, idempotência e limites exigem testes próprios em cada migração.
- `src/masterData/centralRegistry.ts` contém validação e identidades de empresa, pessoa, equipamento e local. `src/shared/registry/RegistryScreen.tsx` é um protótipo compartilhado **sem consumidor em produção** neste checkout; a tela ativa é `src/components/CadastrosTab.tsx`. Materiais possuem cadastro e movimentos, com saldo derivado; a importação usa revisão por lote.

## Inventário de telas e destino

As 45 telas abaixo são todos os arquivos `src/components/*Tab.tsx`. "Destino" descreve o produto futuro, não autoriza remoção imediata. Cada linha requer ficha de fluxo com campos, consumidores, permissões e teste de equivalência antes de trocar a implementação.

| Tela atual | Classificação | Destino / questão a validar |
| --- | --- | --- |
| AdministracaoTab | dividir | Console: usuários, obras, integrações e configuração |
| ApontamentosTab | manter conceito e refazer | Operações > Apontamentos; lançamento rápido mobile |
| AssistenteTab | fundir | Busca/ajuda contextual no shell; confirmar utilidade das ações |
| AuditoriaTab | transformar em relatório | Administração > Auditoria, filtros e trilha imutável |
| CadastrosTab | dividir | Cadastros mestres por entidade; manter IDs e vínculos |
| CentralOperacionalTab | dividir | Pendências e atalhos dos domínios operacionais |
| ChecklistTab | transformar em fluxo operacional | Equipamentos > Inspeção/checklist |
| ColaboradoresTab | transformar em cadastro | Pessoas > Colaboradores, com histórico de situação |
| CombustivelInteligenteTab | dividir | Combustível: painel, lançamentos, divergências, importações |
| CombustivelOperacionalTab | fundir | Combustível; evitar segundo fluxo de lançamento |
| ConfiguracoesTab | dividir | Preferências de usuário e parâmetros da organização |
| ConsultaGeralTab | substituir | Busca global agrupada por entidade |
| ControleEquipamentosDiarioTab | transformar em fluxo operacional | Equipamentos > Parte diária |
| ControlePresencaTab | dividir | Presença: lançamento mobile, revisão e indicadores |
| CronogramaTab | manter conceito e refazer | Planejamento > Cronograma |
| CustosTab | transformar em relatório | Gestão > Custos, com drill-down para lançamentos |
| DdsTreinamentosTab | fundir | Pessoas > DDS e treinamentos |
| DiarioObraTab | substituir | RDO; mapear campos e histórico antes de migração |
| DocumentosTab | manter conceito e refazer | Documentos por entidade e catálogo transversal |
| EquipesTab | transformar em cadastro | Pessoas > Equipes e alocações |
| EstacasTab | dividir | Operações > Estacas: cadastro, avanço e importação |
| FrotaTab | fundir | Equipamentos/Frota: visão e cadastro mestre |
| FrentesTab | transformar em cadastro | Obras > Frentes e locais |
| FvsTab | transformar em fluxo operacional | Qualidade > FVS |
| HorasParadasTab | fundir | Equipamentos > Disponibilidade / manutenção |
| IndicadoresTab | transformar em dashboard | Visão geral/gestão; eliminar KPI duplicado |
| InspecoesTab | transformar em fluxo operacional | Qualidade > Inspeções |
| LancamentosTab | fundir | Combustível > Abastecimentos e entradas |
| ManutencaoTab | dividir | Ativos, OS, preventivas, peças e custos |
| MateriaisTab | dividir | Materiais: cadastro, estoque, movimentos, inventário, importação |
| MedicoesTab | transformar em fluxo operacional | Gestão > Medições e fechamento |
| ModoCampoTab | substituir | Entrada por tarefas móveis com contexto de obra |
| NaoConformidadesTab | transformar em fluxo operacional | Qualidade > Não conformidades |
| NotificacoesTab | fundir | Central de notificações do shell |
| OcorrenciasTab | fundir | RDO/Qualidade conforme origem e vínculo real |
| OrcamentoTab | manter conceito e refazer | Gestão > Orçamento |
| PendenciasTab | transformar em fluxo operacional | Central transversal com origem e ação de resolução |
| PeriodoTab | transformar em relatório | Histórico/fechamentos por período |
| PermissoesTab | dividir | Administração > Perfis e permissões; servidor decide acesso |
| PlanejamentoTab | dividir | Planejamento e programação de serviços |
| ProducaoTab | transformar em dashboard | Produção, com drill-down para registros |
| RelatoriosTab | dividir | Catálogo único de relatórios e exportações |
| TicketsJazidaTab | transformar em fluxo operacional | Viagens/Jazida: ticket e timeline de estados |
| TimelineTab | fundir | Timeline contextual por entidade e auditoria |
| UsuariosTab | transformar em cadastro | Administração > Usuários e convites |

`Dashboard.tsx` também será redesenhado como Início por perfil; não é um arquivo `*Tab.tsx`. Componentes de links públicos são fluxos separados e permanecerão acessíveis durante a transição.

## Domínios, dados e regras a preservar

| Domínio | Fontes/código atual | Invariantes e consumidores |
| --- | --- | --- |
| Cadastros | `centralRegistry.ts`, `CadastrosTab`, `ColaboradoresTab`, `FrotaTab` | IDs estáveis, deduplicação de matrícula/prefixo/CNPJ, inativação histórica; presença, combustível, tickets e manutenção consomem cadastros |
| Materiais | `MateriaisTab`, importação, `materialsDashboard.ts` | saldo derivado de movimentos; importação revisada e idempotente; não converter falta de saldo em zero |
| Equipamentos | `ControleEquipamentosDiarioTab`, `FrotaTab`, `ManutencaoTab` | medidores, status, parte diária, OS relacionada e histórico |
| Combustível | `LancamentosTab`, `CombustivelInteligenteTab` | identidade de abastecimento, bomba, divergência e auditoria |
| Viagens/estacas | `TicketsJazidaTab`, `EstacasTab`, Functions públicas | sequências, vínculos, token, idempotência e rastreio |
| Pessoas/presença | `ControlePresencaTab`, `ColaboradoresTab`, links públicos | estado de ausência não vira presença; histórico e autenticação dual preservados |
| RDO | `DiarioObraTab` e fontes operacionais | RDO é oficial; compor apenas dados presentes e manter autoria de complementos manuais |

## Rotas e interfaces atuais

- Privadas: seleção por `activeTab` em `App.tsx`; `navigation.ts` registra IDs e `ROLE_ACCESS`. A sidebar mostra um subconjunto. Não há `react-router` instalado.
- Públicas: `/ticket-link/:token`, query `tickets`, `/presenca-link/:token`, query `presenca`, conforme `src/app/routing/publicRoutes.ts`.
- Servidor Render: `server/index.js` expõe Functions adaptadas, `/health`, tarefa protegida de limpeza e fallback SPA. APIs de domínio estão espalhadas pelas Functions e acessos Firebase; não existe contrato REST uniforme para todos os módulos.
- Rotas privadas futuras: `/app/:organizationId/:projectId/:module/*`; rotas de administração por organização; links públicos mantêm seus caminhos. A URL é contexto de navegação, nunca prova de autorização.

### Mapa de APIs expostas pelo servidor Render

| Caminho | Métodos registrados | Responsabilidade atual |
| --- | --- | --- |
| `/.netlify/functions/public-presenca` | GET, POST, PATCH, DELETE | leitura/envio/correção do fluxo público de presença |
| `/.netlify/functions/public-tickets` | GET, POST | ticket público e ações associadas |
| `/.netlify/functions/master-data` | ALL, validação no handler | contrato de cadastros mestres |
| `/.netlify/functions/usage-telemetry` | ALL, validação no handler | telemetria de uso |
| `/tasks/cleanup-cloud-data` | POST | tarefa protegida por segredo de servidor |
| `/health` | GET | saúde do processo, não prova versão publicada |

As regras de acesso e payloads internos exigem revisão por endpoint antes da migração. O frontend também acessa Firebase por SDK e `cloudSyncGateway`, de modo que a lista acima não é inventário de todas as operações de dados.

### Mapa do esquema Supabase versionado

| Migration | Tabelas / contrato | Estado arquitetural |
| --- | --- | --- |
| `202609140001_initial_transition.sql` | `organizations`, `organization_members`, `erp_snapshots`, `publish_erp_snapshot` | escopo e retrato de transição; JSONB não é modelo final |
| `202609150001_pilot_projects_cost_centers.sql` | `projects`, `cost_centers`, funções de membership/role | piloto multiobra; conferir escopo de centro de custo |
| `202609150003_pilot_etapas_servicos.sql` | `etapas_servico`, `servicos_obra` | piloto de planejamento |
| `202609150004_pilot_parceiros_materiais.sql` | `parceiros`, `materiais` | piloto de cadastros; movimentos/estoque ainda exigem modelagem e reconciliação |
| `202609150005_pilot_orcamento_custos.sql` | `orcamento_itens`, `lancamentos_custo` | piloto financeiro |

`202609150002_revoke_anon_function_execute.sql` endurece execução anônima. As policies existentes usam membership e papéis `admin`/`editor` para os pilotos; a matriz final RBAC do produto e testes entre tenants ainda não estão completos. Não executar migrations em produção com base apenas neste inventário.

## Duplicações e dívida técnica priorizadas

1. `App.tsx` concentra estados e handlers entre domínios; extrair por contrato de módulo após identificar consumidores.
2. `CombustivelInteligenteTab`, `CombustivelOperacionalTab` e `LancamentosTab` sobrepõem entrada/visão de combustível; consolidar após matriz de equivalência.
3. `FrotaTab` e `ControleEquipamentosDiarioTab` misturam cadastro e operação; separar identidade do ativo e registro diário.
4. `Dashboard`, `IndicadoresTab`, painéis internos e `PendenciasTab` repetem sinais; definir consulta/indicador com fonte e drill-down.
5. Tabelas e filtros têm implementações locais, apesar de `TableShell`, `Pagination`, `RegistryScreen` e componentes de frota. Consolidar contratos antes de migrar visualmente.
   `RegistryScreen` não está conectado a `CadastrosTab`; não contar seus recursos como entregues ao usuário.
6. `localStorage` e snapshots dão resiliência, mas não oferecem isolamento SaaS por si. Toda nova escrita normalizada precisa de escopo, autorização e reconciliação.
7. `navigation.ts` contém destinos auxiliares sem uma semântica de rota única; medir alcançabilidade antes de retirar qualquer aba.
8. Dados históricos embutidos e imports pesados precisam de inventário de consumidores e medição de bundle antes da remoção.

O build local de 2026-09-23 mediu `seed-august-2026` em 1.362,85 kB, `vendor-excel` em 940,08 kB, `vendor-firebase` em 698,26 kB, `CadastrosTab` em 270,14 kB e `App` em 333,87 kB (tamanhos minificados antes de gzip). Isto define prioridades de investigação, não autoriza apagar as sementes nem trocar bibliotecas sem verificar consumidores e fluxo de importação.

## Critério para encerrar cada linha do inventário

Registrar fluxo atual e novo, mapa de campos, regra de negócio, fonte e destino dos dados, permissões servidor/UI, estados de erro/vazio, testes desktop/mobile, comparação dos registros e plano de retorno. Só então alterar o estado da linha para migrada e retirar a tela antiga se não houver consumidores.
