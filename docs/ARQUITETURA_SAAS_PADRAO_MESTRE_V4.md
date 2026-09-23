# ARQUITETURA SaaS E PADRÃO MESTRE — RENEA ERP v4

Status: proposta normativa para revisão
Base: RENEA ERP v3.4.x
Objetivo: transformar a base atual em um SaaS multiempresa/multiobra sem reescrita total e sem perda das regras operacionais existentes.

---

## 1. Regra zero

A evolução para SaaS NÃO autoriza reescrever o sistema do zero.

A base atual deve ser evoluída por domínio, com migração gradual, reconciliação e rollback.

A partir da aprovação deste documento:

- toda nova tabela deve nascer multi-tenant;
- toda nova API deve conhecer o tenant;
- toda nova tela deve obedecer ao design system;
- todo novo módulo deve usar cadastros mestres;
- toda regra de negócio importante deve sair de fórmulas/telas e ir para domínio/serviço;
- todo dado operacional deve ser auditável;
- toda importação deve preservar origem;
- toda exclusão de dado histórico deve ser lógica;
- toda consulta volumosa deve ser paginada ou agregada no servidor;
- toda mudança estrutural deve possuir migration, teste e plano de reversão.

Nenhuma exceção deve ser feita por conveniência de curto prazo.

---

## 2. Modelo SaaS alvo

O RENEA deve evoluir para um SaaS B2B multiempresa com isolamento lógico forte.

Hierarquia canônica:

```
Plataforma RENEA
  -> Organização / Tenant
      -> Empresa(s)
      -> Projeto / Obra
          -> Centro(s) de custo
          -> Local(is)
          -> Ramo(s) / Trecho(s)
          -> Equipes
          -> Operações
```

### Conceitos obrigatórios

**platform**  
Ambiente global do produto RENEA.

**organization / tenant**  
Cliente isolado do SaaS. É a fronteira principal de segurança e cobrança.

**company / empresa**  
Pessoa jurídica existente dentro da organização. Pode atuar em múltiplos papéis.

**project / obra**  
Unidade operacional principal.

**cost_center / centro de custo**  
Dimensão financeira e gerencial.

**location / local**  
Origem, destino, canteiro, jazida, bota-fora, frente etc.

**branch_or_segment / ramo ou trecho**  
Dimensão operacional/geográfica vinculada a projeto/local.

---

## 3. Estratégia de tenancy

Modelo recomendado: banco compartilhado + schema compartilhado + `organization_id` obrigatório nas tabelas de domínio.

Não criar um banco separado por cliente na primeira fase.

### Regra obrigatória

Toda tabela com dados de cliente deve possuir:

- `organization_id uuid not null`;
- chave primária UUID;
- RLS;
- índices iniciados por `organization_id`;
- constraints que impeçam relacionamento entre tenants diferentes.

### Exemplo conceitual

```sql
primary key (id)

foreign key (organization_id, material_id)
  references materials (organization_id, id)
```

Sempre que viável, usar constraints compostas para impedir vazamento acidental entre organizações.

---

## 4. Fonte de verdade

Objetivo final:

**PostgreSQL/Supabase = fonte canônica dos dados estruturados do SaaS.**

Firebase poderá permanecer durante a transição para:

- autenticação enquanto homologada;
- compatibilidade com fluxos atuais;
- links públicos existentes;
- sincronização temporária;
- contingência controlada.

Não manter Firebase e Supabase indefinidamente como duas fontes equivalentes de verdade.

Cada domínio deve possuir uma data/versão formal de corte.

---

## 5. Autenticação e identidade

Usuário deve possuir identidade global.

Acesso ao tenant deve ser separado da identidade.

Modelo:

- `users`
- `organizations`
- `organization_members`
- `roles`
- `permissions`
- `member_roles`

Nunca gravar papel administrativo apenas em código cliente.

### Perfis iniciais

- platform_admin
- tenant_owner
- tenant_admin
- gestor
- supervisor
- operador
- conferente
- leitura
- auditor

O RBAC deve permitir evolução futura para permissões granulares.

Exemplo:

- materials.read
- materials.write
- materials.adjust_stock
- fuel.approve
- tickets.cancel
- reports.export
- billing.manage
- users.invite

---

## 6. Seleção de organização

O usuário poderá pertencer a uma ou mais organizações.

Após login:

1. carregar memberships válidos;
2. selecionar tenant;
3. emitir contexto de organização;
4. toda requisição subsequente usar o tenant autorizado;
5. servidor deve validar a membership;
6. cliente nunca pode escolher livremente um `organization_id` não autorizado.

Não confiar no organization_id enviado pelo navegador sem validação server-side.

---

## 7. Multiobra

Uma organização poderá possuir múltiplas obras.

Toda operação que pertence a obra deve possuir `project_id`.

Exemplos:

- estoque;
- combustível;
- viagens;
- tickets;
- presença;
- apontamentos;
- parte diária;
- RDO;
- manutenção quando vinculada;
- consumo;
- custos;
- recebimentos.

Cadastros globais da organização podem não possuir project_id.

Exemplos:

- empresas;
- fornecedores;
- catálogo mestre de materiais;
- usuários;
- equipamentos globais.

Para esses casos, vínculos por obra devem ficar em tabelas de alocação.

---

## 8. Padrão de banco

### Nomenclatura

Banco: snake_case.

TypeScript: camelCase.

Componentes: PascalCase.

Constantes: UPPER_SNAKE_CASE.

### Campos obrigatórios nas entidades principais

- id
- organization_id
- status
- created_at
- created_by
- updated_at
- updated_by
- archived_at quando aplicável
- version quando houver concorrência
- metadata somente para extensões não críticas

Não usar JSONB como desculpa para evitar modelagem.

Campos de negócio consultados, filtrados, validados ou relacionados devem possuir coluna própria.

---

## 9. IDs

Chave primária: UUID.

Chaves de negócio continuam existindo:

- prefixo;
- placa;
- matrícula;
- código do material;
- número do ticket;
- nota fiscal;
- código SGE.

Mas não são PK.

Campos legados:

- legacy_id
- source_system
- source_file
- source_sheet
- source_row

devem ser preservados quando dados vierem de fontes antigas.

---

## 10. Cadastros mestres

Devem existir serviços centrais para:

- organizações;
- empresas;
- projetos;
- centros de custo;
- locais;
- ramos/trechos;
- materiais;
- unidades;
- categorias;
- fornecedores;
- equipamentos;
- veículos;
- colaboradores;
- equipes;
- comboios;
- combustíveis;
- etapas de serviço.

Módulos operacionais referenciam IDs.

É proibido recriar cadastro interno dentro de cada módulo.

---

## 11. Empresas e papéis

Não duplicar a mesma pessoa jurídica em tabelas independentes.

Uma empresa pode possuir vários papéis:

- fornecedor;
- transportadora;
- cliente;
- contratada;
- prestadora;
- proprietária de equipamento;
- geradora;
- destinadora.

Modelo recomendado:

- companies
- company_roles
- company_project_links

CNPJ deve ser normalizado.

Unicidade deve considerar tenant e regras do domínio.

---

## 12. Materiais

Um único cadastro mestre.

Não criar tabelas por tipo de material.

Estrutura base:

- material
- categoria
- subcategoria
- unidade padrão
- código
- aliases
- propriedades técnicas
- status

Especializações podem existir em tabelas relacionadas.

Exemplo:

`material_steel_specs`

para perfil, aço, comprimento, peso etc.

Não poluir a tabela principal com dezenas de campos específicos de um único tipo.

---

## 13. Estoque por razão de movimentos

Saldo jamais deve ser fonte digitável.

Saldo = soma dos movimentos confirmados.

Modelo:

- inventory_movements
- inventory_locations
- inventory_balances (view/materialized/cache, não fonte primária)
- inventory_adjustments
- inventory_counts

Tipos:

- receipt
- issue
- consumption
- transfer_out
- transfer_in
- return
- positive_adjustment
- negative_adjustment

Toda correção deve gerar movimento compensatório ou ajuste auditável.

Não editar saldo histórico silenciosamente.

---

## 14. Conversões

É proibido manter fatores escondidos em planilha ou código como:

`quantidade * 1.28`

Criar regras versionadas:

- material_id
- from_unit_id
- to_unit_id
- factor
- valid_from
- valid_to
- source
- approved_by

Toda conversão deve ser rastreável.

---

## 15. Importações

Importação nunca grava diretamente nas tabelas canônicas sem revisão quando houver risco de ambiguidade.

Fluxo obrigatório:

1. import_batch
2. import_row raw
3. normalização
4. validação
5. classificação
6. resolução de aliases
7. revisão
8. promoção
9. reconciliação
10. auditoria

Status possíveis:

- pending
- valid
- warning
- invalid
- duplicate
- unmapped
- imported
- rejected

Nunca descartar automaticamente linha inválida.

---

## 16. Aliases

Dados antigos possuem variações textuais.

Criar aliases por entidade.

Exemplos:

```
"PÓ DE PEDRA" -> material UUID X
"PO DE PEDRA" -> material UUID X
"PO PEDRA"    -> material UUID X
```

O valor original deve permanecer disponível para auditoria.

---

## 17. APIs

Frontend não acessa lógica privilegiada diretamente.

Organização recomendada:

```
/api/v1/master-data
/api/v1/materials
/api/v1/inventory
/api/v1/fuel
/api/v1/equipment
/api/v1/trips
/api/v1/tickets
/api/v1/attendance
/api/v1/rdo
/api/v1/reports
/api/v1/admin
/api/v1/billing
```

Cada endpoint deve possuir:

- autenticação;
- tenant resolution;
- autorização;
- validação Zod;
- rate limit quando aplicável;
- correlation/request id;
- logs;
- tratamento uniforme de erro;
- versão de API.

---

## 18. Contrato de erro

Formato único:

```json
{
  "error": {
    "code": "MATERIAL_NOT_FOUND",
    "message": "Material não encontrado.",
    "details": {},
    "requestId": "..."
  }
}
```

Não retornar mensagens aleatórias por módulo.

---

## 19. Concorrência

Entidades editáveis por múltiplos usuários devem usar controle de versão.

Preferência:

- `version integer`; ou
- `updated_at` validado.

Update deverá exigir versão esperada em operações críticas.

Conflitos retornam 409.

Nunca permitir "última gravação vence" silenciosamente em processos críticos.

---

## 20. Idempotência

Operações críticas externas ou offline devem aceitar chave idempotente.

Exemplos:

- abastecimento;
- ticket;
- recebimento;
- movimento de estoque;
- importação;
- sincronização offline.

Evitar duplicidade causada por retry.

---

## 21. Auditoria imutável

Criar eventos server-side.

Campos:

- id
- organization_id
- actor_user_id
- action
- entity_type
- entity_id
- before
- after
- changed_fields
- source
- request_id
- created_at

Usuário comum não pode editar audit log.

---

## 22. Eventos de domínio

Eventos relevantes devem ser explícitos.

Exemplos:

- material.received
- inventory.adjusted
- fuel.dispensed
- ticket.released
- ticket.received
- ticket.cancelled
- rdo.closed
- equipment.status_changed

Permite integrações futuras sem acoplar módulos.

---

## 23. Frontend por domínio

O `App.tsx` não deve continuar crescendo como ponto central.

Estrutura alvo:

```
src/
  app/
  modules/
    materials/
    inventory/
    equipment/
    fuel/
    tickets/
    trips/
    attendance/
    rdo/
    maintenance/
    reports/
    admin/
    billing/
  shared/
    api/
    components/
    hooks/
    schemas/
    permissions/
    utils/
  design-system/
```

Cada módulo:

- pages
- components
- hooks
- api
- schemas
- types
- tests

Evitar dependência circular.

---

## 24. Design system obrigatório

Criar biblioteca única para:

- Button
- Input
- Select
- Combobox
- DatePicker
- MoneyInput
- QuantityInput
- Modal
- Drawer
- AlertDialog
- Badge
- Card
- DataTable
- FilterBar
- EmptyState
- LoadingState
- ErrorState
- PageHeader
- FormSection
- KPI
- Tabs
- Toast

Tela não pode criar variantes próprias sem entrar primeiro no design system.

---

## 25. Padrão de páginas

Toda página de gestão segue:

1. PageHeader
2. ações principais
3. KPIs quando necessários
4. FilterBar
5. conteúdo
6. paginação
7. estados loading/error/empty

Formulários:

1. identificação
2. classificação
3. relacionamentos
4. dados operacionais
5. financeiro
6. observações
7. auditoria somente leitura

---

## 26. Tabelas

TanStack Table será o motor padrão quando apropriado.

Obrigatório para tabelas grandes:

- paginação server-side;
- ordenação server-side;
- filtros server-side;
- busca debounced;
- seleção explícita;
- colunas persistidas por usuário quando útil;
- virtualização acima de volume definido;
- exportação por job/servidor para grandes volumes.

Proibido carregar dezenas de milhares de linhas para filtrar localmente.

---

## 27. Performance frontend

Metas iniciais:

- route-level code splitting;
- ExcelJS carregado apenas na ação de Excel;
- jsPDF carregado apenas na ação de PDF;
- gráficos carregados sob demanda;
- históricos fora do bundle;
- queries com stale/cache policy;
- listas extensas virtualizadas;
- imagens comprimidas e lazy;
- evitar rerender global por estado monolítico.

Bundle deverá ser monitorado em CI.

---

## 28. Performance banco

Toda consulta de listagem deve possuir índice alinhado ao filtro.

Padrões:

```
(organization_id, created_at)
(organization_id, project_id, created_at)
(organization_id, status)
(organization_id, code)
```

Índice deve ser criado por evidência de consulta, não indiscriminadamente.

Exigir EXPLAIN ANALYZE para endpoints lentos importantes.

---

## 29. Relatórios

Dashboard nunca é fonte primária.

Relatório deve consumir:

- views;
- queries agregadas;
- snapshots assinados para fechamentos.

Relatórios extensos não devem fazer centenas de cálculos no navegador.

Criar camada de reporting.

---

## 30. Fechamentos

Períodos fechados devem se tornar imutáveis.

Correção gera nova versão ou reabertura auditada.

Aplicável a:

- RDO;
- combustível;
- estoque;
- relatórios mensais;
- custos;
- viagens;
- faturamento.

---

## 31. Arquivos

Não persistir arquivos gigantes no banco relacional.

Usar storage.

Banco guarda:

- bucket/path;
- hash;
- mime type;
- tamanho;
- entidade;
- organização;
- usuário;
- timestamps;
- status.

Acesso por URL assinada.

---

## 32. Links públicos

Nenhum link operacional público deve depender de token previsível.

Usar tokens criptograficamente aleatórios.

Armazenar somente hash.

Campos:

- token_hash
- scope
- organization_id
- expires_at
- revoked_at
- max_uses quando aplicável

Aplicar rate limiting.

---

## 33. Segurança SaaS

Obrigatório:

- RLS em todas as tabelas tenant-scoped;
- testes automáticos de isolamento;
- service role apenas no backend;
- secrets fora do bundle;
- CSP;
- validação de upload;
- rate limits;
- logs de segurança;
- rotação de segredos;
- princípio do menor privilégio.

Teste crítico:

**Usuário do tenant A jamais pode ler, editar, inferir contagem ou acessar arquivo do tenant B.**

---

## 34. RLS

Política deve derivar tenant de identidade/membership confiável.

Não criar policy baseada apenas em valor arbitrário enviado pela aplicação.

Todas as migrations com nova tabela devem incluir RLS no mesmo PR.

Tabela tenant sem RLS = PR reprovado.

---

## 35. Billing

Preparar arquitetura para cobrança mesmo antes de integrar gateway.

Tabelas:

- plans
- plan_features
- subscriptions
- subscription_items
- usage_counters
- billing_events

Planos devem controlar limites sem ifs espalhados pelo frontend.

Exemplos de entitlement:

- max_users
- max_projects
- storage_gb
- advanced_reports
- api_access
- public_links
- premium_support

---

## 36. Feature flags

Criar serviço central de feature flags.

Escopos:

- plataforma;
- plano;
- organização;
- usuário.

Não usar variáveis soltas no código para ativar módulos comerciais.

---

## 37. White-label futuro

Preparar sem priorizar agora:

- logo;
- nome exibido;
- cores controladas;
- domínio customizado;
- template de PDF.

Não permitir CSS arbitrário do cliente.

---

## 38. Observabilidade

Padronizar logs estruturados.

Campos:

- timestamp
- level
- service
- environment
- request_id
- organization_id
- user_id
- module
- action
- duration_ms
- error_code

Não logar secrets nem dados sensíveis desnecessários.

---

## 39. Métricas

Monitorar:

- latência p50/p95/p99;
- taxa de erro;
- usuários ativos;
- tenants ativos;
- importações;
- jobs;
- falhas de sincronização;
- tamanho de filas;
- tempo de queries;
- storage;
- uso por módulo.

A função de telemetria existente deve evoluir para esse modelo.

---

## 40. Jobs e filas

Processos pesados devem sair da requisição síncrona.

Exemplos:

- importação grande;
- exportação grande;
- geração de pacote de fechamento;
- reconciliação;
- processamento documental;
- notificações.

Modelo:

- jobs
- job_attempts
- status
- progress
- error
- started_at
- finished_at

---

## 41. Offline

Offline deve evoluir de snapshot completo para comandos por registro.

Fila local:

- command_id
- entity
- action
- payload
- idempotency_key
- created_at
- retry_count

Servidor responde com versão canônica.

Conflitos são apresentados ao usuário.

---

## 42. Firebase -> Supabase

Migração por strangler pattern.

Nunca big bang.

Ordem sugerida:

1. organizações e memberships;
2. empresas;
3. projetos;
4. centros de custo;
5. materiais;
6. fornecedores;
7. locais e ramos;
8. equipamentos/veículos;
9. colaboradores;
10. estoque;
11. combustível;
12. tickets/viagens;
13. RDO;
14. manutenção;
15. relatórios/fechamento.

Para cada domínio:

- migration;
- importação;
- reconciliação;
- leitura paralela temporária;
- homologação;
- corte;
- rollback testado.

---

## 43. Planilhas

Planilha deixa de ser arquitetura.

Cada planilha deve ser classificada como:

- fonte de migração;
- layout de exportação;
- documento operacional;
- obsoleta.

Abas por material não serão reproduzidas.

Exemplo atual de materiais:

RACHÃO, MACADAME, SOLO REFORÇADO, BICA CORRIDA, BRITA, AREIA e similares convergem para:

- materials
- inventory_movements
- suppliers
- locations
- documents
- conversion_rules

RES_GERAL converge para relatório/dashboard.

---

## 44. Compatibilidade

Durante transição, exportar Excel em formatos aceitos pela operação.

Mas o formato Excel não deve ditar a modelagem interna.

Internamente normalizar.

Externamente adaptar no exportador.

---

## 45. Módulos SaaS alvo

### Núcleo

- organizações
- usuários
- permissões
- projetos
- centros de custo
- cadastros mestres

### Operações

- materiais/estoque
- equipamentos
- frota
- combustível
- viagens/jazida
- estacas
- presença
- apontamentos
- RDO
- manutenção

### Gestão

- custos
- orçamento
- indicadores
- relatórios
- auditoria
- fechamentos

### Plataforma

- billing
- planos
- feature flags
- integrações
- API
- webhooks
- storage
- jobs
- observabilidade

---

## 46. Contratos de domínio

Cada módulo deverá possuir documento curto contendo:

- propósito;
- entidades;
- estados;
- comandos;
- eventos;
- invariantes;
- permissões;
- integrações;
- relatórios;
- critérios de aceite.

Nenhuma regra importante deverá existir somente na cabeça do desenvolvedor.

---

## 47. Estados

Status sempre tipado.

Não usar texto livre.

Máquinas de estado para fluxos críticos.

Ticket, exemplo:

```
available
-> printed
-> released
-> received
-> reconciled
-> closed
```

Com caminhos explícitos para:

- cancelled
- divergent
- pending_review

Transições inválidas devem ser rejeitadas no servidor.

---

## 48. Testes

Pirâmide obrigatória:

### Unitários
- regras;
- schemas;
- cálculos;
- máquinas de estado.

### Integração
- banco;
- RLS;
- APIs;
- migrations.

### E2E
- login;
- tenant switch;
- cadastro;
- operação;
- importação;
- fechamento;
- exportação.

### Segurança
- acesso cross-tenant;
- permissões;
- links públicos;
- rate limit.

---

## 49. CI obrigatório

PR não poderá ser mergeado se falhar:

```
npm ci / instalação reproduzível
typecheck
lint
unit tests
integration tests
build
migration checks
RLS tests
selected E2E smoke
bundle budget
```

Adicionar verificações gradualmente sem interromper produção, mas o estado final é bloqueante.

---

## 50. Branch e release

Branches curtas.

PR pequeno por domínio.

Conventional commits ou padrão equivalente.

Release notes automáticas.

Ambientes:

- local
- dev
- staging
- production

Nunca testar migration destrutiva primeiro em produção.

---

## 51. Migrations

Migration publicada é imutável.

Correção = nova migration.

Toda migration destrutiva exige:

- backup;
- estratégia expand/contract;
- compatibilidade temporária;
- reconciliação;
- rollback lógico.

---

## 52. Expand/contract

Mudança de coluna crítica:

1. criar nova coluna;
2. suportar antiga e nova;
3. backfill;
4. validar;
5. migrar leitores;
6. migrar escritores;
7. observar;
8. remover antiga em release posterior.

Nunca renomear/remover campo crítico abruptamente.

---

## 53. Soft delete

Por padrão:

- archive;
- deactivate;
- cancel.

Delete físico somente quando:

- não há histórico;
- não há FK operacional;
- regra permitir;
- auditoria registrar.

---

## 54. LGPD e retenção

Classificar dados:

- operacional;
- pessoal;
- financeiro;
- sensível;
- anexo.

Definir retenção por categoria.

Implementar exportação e anonimização quando juridicamente aplicável.

Não guardar dado pessoal "porque pode ser útil".

---

## 55. Backup e recuperação

Definir:

- RPO;
- RTO;
- backups automáticos;
- teste periódico de restore;
- backup externo;
- procedimento de incidente.

Backup não testado não conta como estratégia de recuperação.

---

## 56. Critérios obrigatórios para nova feature

Nenhuma feature entra sem responder:

1. Qual domínio?
2. Qual tenant?
3. Qual entidade canônica?
4. Qual permissão?
5. Qual schema?
6. Qual regra?
7. Qual auditoria?
8. Qual comportamento offline?
9. Qual impacto de performance?
10. Qual teste?
11. Qual migração?
12. Qual rollback?
13. Qual relatório/exportação impactado?
14. Possui dado duplicado?
15. Existe componente do design system?

Se qualquer item crítico estiver indefinido, a feature não está pronta para implementação.

---

## 57. Definition of Done

Uma tarefa somente é concluída quando:

- código tipado;
- validação presente;
- tenant isolado;
- autorização aplicada;
- auditoria aplicada quando necessária;
- loading/error/empty tratados;
- acessibilidade mínima;
- teste criado;
- build aprovado;
- sem duplicar cadastro;
- sem query desnecessária;
- documentação atualizada;
- migration segura;
- rollback conhecido.

---

## 58. Proibições

A partir da adoção deste padrão fica proibido:

- tabela sem organization_id quando tenant-scoped;
- tabela tenant sem RLS;
- cadastro duplicado;
- status livre;
- saldo digitável;
- regra crítica apenas no frontend;
- service role no cliente;
- carregar banco inteiro no browser;
- intervalos fixos como substituto de modelagem;
- uma tabela por material;
- uma tela por aba de planilha;
- fórmula escondida;
- importação destrutiva;
- apagar divergência;
- apagar histórico para "corrigir";
- migration alterada após aplicada;
- endpoint sem autorização;
- componente visual duplicado sem justificativa;
- dependência pesada no bundle inicial sem necessidade.

---

## 59. Fases propostas

### Fase 0 — Congelamento de desorganização

Antes de novas features:

- aprovar este padrão;
- registrar ADRs;
- definir owners técnicos;
- impedir novos cadastros paralelos;
- mapear debt crítico.

### Fase 1 — Fundação SaaS

- organizations;
- memberships;
- roles/permissions;
- tenant context;
- RLS;
- projects;
- cost centers;
- tenant switch;
- testes cross-tenant.

### Fase 2 — Cadastros canônicos

- empresa;
- material;
- fornecedor;
- local;
- ramo;
- equipamento;
- veículo;
- colaborador.

### Fase 3 — Materiais e estoque

Primeiro grande domínio operacional migrado.

Converter abas de planilha para movimentos.

### Fase 4 — Demais operações

- combustível;
- jazida;
- RDO;
- equipamentos;
- presença;
- apontamentos;
- manutenção.

### Fase 5 — Plataforma comercial

- planos;
- assinatura;
- entitlements;
- billing;
- convite de usuários;
- limites;
- onboarding.

### Fase 6 — Escala

- jobs;
- filas;
- offline robusto;
- webhooks;
- API pública;
- observabilidade completa;
- multi-região somente se houver necessidade real.

---

## 60. Primeiro marco técnico

O primeiro marco não é "colocar Stripe".

O primeiro marco é provar isolamento SaaS.

Critérios:

1. duas organizações de teste;
2. usuários distintos;
3. mesmo módulo;
4. dados diferentes;
5. RLS bloqueia acesso cruzado;
6. API bloqueia acesso cruzado;
7. busca não vaza existência;
8. storage não vaza arquivo;
9. logs carregam organization_id;
10. testes automatizados comprovam.

Somente depois avançar comercialmente.

---

## 61. Decisão sobre o stack atual

Manter:

- React;
- TypeScript;
- Vite;
- TanStack Query;
- TanStack Table;
- Zod;
- Supabase/PostgreSQL;
- Playwright;
- ExcelJS e jsPDF sob demanda;
- Express/Functions durante transição.

Firebase deve ser reduzido gradualmente conforme cada domínio obtiver paridade no modelo canônico.

Não há justificativa arquitetural hoje para trocar o frontend ou reescrever a aplicação inteira.

---

## 62. Prioridade imediata no repositório atual

P0:

- formalizar tenant context;
- confirmar `organization_id` em todas as entidades novas;
- RLS e testes;
- roles/permissions;
- eliminar fallbacks administrativos;
- padronizar APIs;
- CI;
- segurança dos links públicos.

P1:

- modularizar frontend;
- design system;
- cadastros mestres canônicos;
- aliases;
- import pipeline;
- migrar materiais/estoque.

P2:

- jobs;
- billing foundation;
- entitlements;
- offline command queue;
- relatórios server-side;
- observabilidade avançada.

---

## 63. Regra de governança

Este documento deve ser tratado como norma de arquitetura.

Qualquer exceção exige ADR contendo:

- problema;
- padrão violado;
- motivo;
- alternativas;
- risco;
- prazo de remoção da exceção;
- responsável.

"É mais rápido" não é justificativa suficiente para criar dívida estrutural permanente.

---

## 64. Resultado esperado

Ao fim da transformação, o RENEA deixa de ser um sistema fortemente acoplado à operação de uma única obra e passa a ser uma plataforma SaaS capaz de atender múltiplas organizações e múltiplas obras, mantendo:

- isolamento;
- auditoria;
- desempenho;
- rastreabilidade;
- compatibilidade operacional;
- regras de negócio;
- importação e exportação;
- evolução contínua.

O objetivo não é copiar SAP, Oracle ou Dynamics.

O objetivo é adotar os mesmos princípios fundamentais de sistemas empresariais maduros:

- fonte única de verdade;
- domínio bem definido;
- processos rastreáveis;
- cadastros mestres;
- autorização;
- auditoria;
- isolamento;
- integração;
- dados normalizados;
- regras explícitas;
- evolução sem destruição do histórico.
