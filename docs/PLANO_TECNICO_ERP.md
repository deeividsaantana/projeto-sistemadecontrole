# Plano Técnico — Evolução para ERP de Controle de Obras

Data: 31/07/2026

## Situação da entrega

- v2.1 a v2.5 concluídas;
- v2.6 Estacas concluída;
- v2.7 Painel executivo concluída;
- v2.8 Relatórios e snapshots concluída;
- v2.9 Resiliência offline concluída;
- v3.0 Inteligência documental concluída com operação local independente de IA externa.

## 1. Estratégia

A evolução será feita por estrangulamento progressivo do monólito atual. Nenhum módulo será reescrito ou desligado de uma só vez.

Cada versão deve:

1. manter os fluxos existentes;
2. adicionar contratos e componentes reutilizáveis;
3. migrar apenas um domínio por vez;
4. preservar localStorage e Firebase durante a transição;
5. importar históricos sem descarte;
6. permitir rollback por feature flag;
7. registrar impactos e testes.

## 2. Arquitetura alvo

### Camada app

Responsável por:

- bootstrap;
- providers;
- roteamento;
- navegação;
- autenticação;
- permissões;
- tema;
- configuração.

### Camada features

Cada módulo conterá:

- components;
- pages;
- hooks;
- schemas;
- services;
- repositories;
- types;
- tests.

### Camada shared

Responsável por:

- componentes UI;
- utilitários;
- exportação;
- importação;
- auditoria;
- feedback;
- paginação;
- filtros;
- datas e números.

### Camada de dados

- interfaces de repositório no domínio;
- implementação local e Firebase para compatibilidade;
- implementação Supabase por feature;
- TanStack Query como orquestrador de cache e sincronização remota;
- fila de revisão para dados importados.

## 3. Coexistência Firebase e Supabase

### Firebase continuará inicialmente com

- autenticação;
- claims e usuários atuais;
- links públicos;
- submissões públicas;
- backup legado;
- sincronização de manutenção;
- telemetria;
- recuperação de compatibilidade.

### Supabase começará com

- empresas;
- equipamentos;
- veículos;
- colaboradores;
- materiais;
- fornecedores;
- locais;
- ramos;
- auditoria desses cadastros.

### Regra de ativação

A implementação Supabase será opcional por variável de ambiente. Sem configuração, o sistema continuará funcionando com os dados atuais.

Não haverá dual-write automático irrestrito. O fluxo será:

1. importar e reconciliar;
2. validar contagens e chaves;
3. habilitar leitura Supabase para usuários-piloto;
4. habilitar gravação Supabase;
5. manter exportação para o formato legado;
6. só depois retirar a escrita antiga daquele domínio.

## 4. Modelo inicial do banco

Todas as tabelas usarão UUID, organization_id, created_at, updated_at, deleted_at e metadados de origem quando aplicável.

### tenancy e segurança

- organizations;
- user_profiles;
- roles;
- permissions;
- role_permissions;
- user_roles.

### cadastros

- companies;
- company_roles;
- projects;
- locations;
- branches;
- suppliers;
- materials;
- material_aliases;
- material_conversion_rules;
- equipment;
- equipment_identifiers;
- vehicles;
- vehicle_implements;
- collaborators;
- employment_links;
- collaborator_assignments;
- equipment_assignments.

### governança de importação

- import_batches;
- import_rows;
- import_issues;
- import_decisions;
- source_files.

### auditoria

- audit_events;
- entity_history.

## 5. Regras de banco

### Chaves e constraints

- CNPJ normalizado único por organização quando informado;
- prefixo de equipamento único por organização e período ativo;
- placa normalizada única por organização e período ativo;
- matrícula única por vínculo e empresa;
- código de material único por fonte quando informado;
- quantidades e capacidades não negativas;
- intervalos de vigência sem inversão;
- soft delete por deleted_at.

### Índices

- organization_id;
- status;
- prefixo;
- placa;
- CNPJ;
- matrícula;
- data operacional;
- foreign keys;
- campos de busca normalizados.

### Views

- equipamentos ativos;
- efetivo ativo por obra;
- materiais por ramo;
- viagens pareadas;
- saldo de estacas confirmado;
- consumo mensal de combustível;
- divergências de importação;
- indicadores do dashboard.

### Auditoria

Triggers registrarão INSERT, UPDATE e soft DELETE em entidades relevantes, incluindo usuário, timestamp, valor anterior, valor novo e origem.

## 6. RLS

Políticas mínimas:

- usuário só acessa sua organização;
- visualização não altera dados;
- operador grava apenas módulos autorizados;
- supervisor revisa e corrige operações;
- administrador gerencia cadastros e permissões;
- service role somente em Netlify Functions;
- nenhuma service role no frontend.

## 7. Importação profissional

Fluxo padrão:

1. upload Excel ou CSV;
2. identificação de formato;
3. leitura sem descarte;
4. normalização;
5. associação por alias;
6. validação Zod;
7. classificação em válido, alerta ou erro;
8. revisão em tabela;
9. decisão do usuário;
10. commit transacional;
11. relatório de importação;
12. possibilidade de desfazer o lote.

Campos desconhecidos permanecem no payload original.

## 8. Componentes compartilhados

Prioridade de criação:

- Button;
- Input;
- Select e Autocomplete;
- FormField;
- Card;
- Modal e Dialog;
- ConfirmDialog;
- DataTable;
- SearchInput;
- FilterBar;
- Pagination;
- UploadDropzone;
- LoadingState;
- Skeleton;
- EmptyState;
- ErrorState;
- Toast;
- AuditTimeline;
- ImportReviewTable.

Shadcn/ui será adotado de forma incremental, preservando o visual atual até cada tela ser migrada.

## 9. Roadmap versionado

### v2.0 — Arquitetura

Objetivo:

- documentar a base;
- criar fronteiras app, features e shared;
- extrair navegação e roteamento público do App;
- adicionar provider raiz e boundary de erro;
- criar contratos de versão;
- ampliar testes das fundações;
- não alterar regras operacionais.

Critério de aceite:

- telas e links públicos continuam acessíveis;
- perfis mantêm o mesmo acesso;
- nenhuma chave de dados muda;
- backup e Firebase não mudam;
- documentação e mapa de riscos disponíveis.

### v2.1 — Banco

Objetivo:

- adicionar Supabase opcional;
- migrations PostgreSQL;
- RLS;
- auditoria;
- repositórios;
- import_batches;
- feature flags;
- TanStack Query.

Critério de aceite:

- sistema funciona sem Supabase;
- ambiente configurado consegue ler e gravar entidade piloto;
- nenhuma service role aparece no bundle.

### v2.2 — Cadastros

Objetivo:

- empresas;
- fornecedores;
- materiais;
- locais;
- ramos;
- colaboradores;
- React Hook Form;
- Zod;
- TanStack Table;
- importação mestre.

Critério de aceite:

- cadastro único refletido nos módulos;
- aliases preservam textos históricos;
- duplicidades vão para revisão.

### v2.3 — Equipamentos

Objetivo:

- equipamento;
- veículo;
- implemento;
- mobilização;
- operador responsável;
- disponibilidade;
- integração com parte diária e manutenção.

Situação:

- implementado de forma aditiva;
- cadastro local existente preservado como fonte operacional;
- `CAD_EQUIPAMENTOS`, `CAD_VEICULOS` e `SGE` integrados à fila revisável;
- aba `CBs` preservada para conciliação com Parte Diária;
- fundação Supabase criada para identificadores, mobilizações, operadores e eventos.

Critérios de aceite:

- registros antigos continuam válidos;
- código SGE resolve o prefixo sem duplicar equipamento;
- placas repetidas ficam em revisão;
- veículo sem placa não é promovido;
- disponibilidade usa cadastro ou partes diárias;
- ordens de serviço abertas aparecem no Centro Operacional;
- nenhuma promoção ocorre sem homologação.

### v2.4 — Combustível

Status em 31/07/2026: fundação implementada para homologação gradual, mantendo a base local oficial.

Objetivo:

- persistência gradual no Supabase;
- competência por data real;
- custo por litro;
- capacidade de tanque;
- fila de conferência;
- continuidade de bomba;
- OneDrive;
- IA opcional.

### v2.5 — Viagens

Status: implementada no código-base, pendente de homologação operacional e aplicação da migration.

Objetivo:

- entidade ticket;
- eventos de liberação e recebimento;
- pareamento;
- divergências;
- lotes de impressão;
- devolução;
- duração;
- material, equipamento, local e ramo por ID.

### v2.6 — Estacas

Objetivo:

- recebimento;
- lote;
- item físico;
- cravação;
- sobra e perda;
- associação assistida;
- saldo confirmado;
- conferência de NF.

### v2.7 — Dashboard

Objetivo:

- KPIs consolidados;
- resumo diário e mensal;
- equipamentos;
- combustível;
- viagens;
- estacas;
- produção;
- efetivo;
- materiais;
- custos;
- filtros globais.

### v2.8 — Relatórios

Objetivo:

- catálogo de relatórios;
- Excel;
- PDF;
- CSV;
- impressão;
- relatório comercial;
- snapshots imutáveis de período.

### v3.0 — IA

Objetivo:

- OCR;
- leitura de PDFs e tickets;
- preenchimento assistido;
- inconsistências;
- sugestões;
- modelos locais ou gratuitos;
- funcionamento completo sem IA.

## 10. PWA e offline

A PWA será introduzida depois que os repositórios estiverem separados do App.

Estratégia:

- cache do shell;
- IndexedDB para fila operacional;
- comandos offline com idempotency key;
- sincronização ao recuperar internet;
- resolução explícita de conflito;
- localStorage mantido durante a transição;
- aviso visível de status offline.

## 11. Performance

- lazy loading por feature;
- chunks de exportação separados;
- dados iniciais removidos do bundle apenas após migração segura;
- TanStack Query para cache remoto;
- TanStack Table e virtualização para listas grandes;
- memoização orientada por medição;
- importação em worker quando necessário;
- paginação server-side após Supabase.

## 12. Qualidade e testes

Pirâmide proposta:

- unitários para regras de domínio;
- contratos de importação;
- integração de repositórios;
- testes de RLS;
- testes de funções Netlify;
- componentes críticos;
- fluxos end-to-end;
- validação de exportações;
- reconciliação de contagens entre planilha e banco.

Nenhuma versão será considerada concluída sem:

- lint;
- typecheck;
- testes;
- build;
- checklist manual dos fluxos impactados;
- relatório de arquivos alterados;
- plano de rollback.

## 13. Riscos e mitigação

### Perda de dados

Mitigação: importação por lote, backup antes de commit, rollback, origem preservada e comparação de contagem.

### Duplicidade entre Firebase e Supabase

Mitigação: feature flags, IDs de origem, reconciliação e migração por entidade.

### Mudança de regra operacional

Mitigação: regra codificada com teste, aprovação por módulo e manutenção do valor original.

### Crescimento do escopo

Mitigação: uma versão por domínio e critérios de aceite objetivos.

### Dependência de IA

Mitigação: toda IA opcional e sempre acompanhada de fluxo manual.

### Plano gratuito

Mitigação: monitorar limites de Netlify, Firebase e Supabase, evitar processamento desnecessário e manter exportação local.

## 14. Ordem imediata de implementação

1. concluir v2.0 sem alterar dados;
2. criar CI em ambiente que permita processos;
3. instalar e travar dependências obrigatórias;
4. criar migrations e RLS v2.1;
5. importar somente os cadastros mestres;
6. validar com usuários-piloto;
7. iniciar v2.2.
