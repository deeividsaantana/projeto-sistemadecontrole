# Auditoria Técnica — Base Oficial do ERP de Obras

Data da auditoria: 31/07/2026

## 1. Escopo e método

A auditoria foi executada sobre o ZIP oficial enviado pelo usuário, extraído sem alterar o pacote original. Foram inspecionados os 113 arquivos do projeto, incluindo todos os arquivos de código-fonte, componentes React, tipos TypeScript, utilitários, funções Netlify, scripts, regras Firebase, configuração de build, testes e documentação.

Evidências estruturais detalhadas estão em:

- docs/auditoria/inventario-codigo.json
- docs/auditoria/inventario-planilhas.json
- docs/AUDITORIA_PLANILHAS_OPERACIONAIS.md
- docs/PLANO_TECNICO_ERP.md

## 2. Resumo executivo

O sistema não é um protótipo. Ele já possui fluxos operacionais relevantes, dados históricos incorporados, autenticação Firebase, persistência local resiliente, backup segmentado no Firestore, funções serverless, importação e exportação Excel, PDF, links públicos e painéis analíticos.

A evolução deve ser incremental. O maior risco não está na ausência de telas, mas no alto acoplamento entre o componente principal, o estado global, o localStorage, o backup Firebase, os imports e os módulos operacionais.

Pontos fortes que devem ser preservados:

- Dados locais restaurados antes da montagem da aplicação.
- Espelhamento de localStorage para reduzir perda por limpeza ou quota.
- Gravação em lote com rollback em caso de falha parcial.
- Backup Firebase segmentado em blocos menores que o limite do Firestore.
- Compatibilidade com formatos antigos de backup.
- Importações operacionais com revisão humana.
- Regras específicas para sequência de bomba, tickets e duplicidades.
- Links públicos isolados para presença, apontamento e tickets.
- Lazy loading dos módulos principais.
- Regras Firestore com negação por padrão e claims de perfil.

## 3. Arquitetura atual

### 3.1 Frontend

- React 19 com Vite e TypeScript.
- Tailwind CSS 4 integrado pelo plugin do Vite.
- Componentes carregados com React.lazy e Suspense.
- Navegação interna controlada por estado, sem biblioteca de roteamento.
- Rotas públicas reconhecidas manualmente por window.location.pathname e query string.
- Recharts para gráficos.
- Lucide para ícones.
- Motion para animações.

### 3.2 Componente raiz

O arquivo src/App.tsx possui 3.954 linhas e concentra:

- autenticação;
- resolução de perfil;
- navegação;
- detecção de links públicos;
- hidratação de todos os conjuntos de dados;
- gravação no localStorage;
- upload e download Firebase;
- importação de backup;
- exportação de backup;
- reset do sistema;
- ingestão OneDrive;
- processamento de submissões públicas;
- notificações;
- renderização do shell e de todos os módulos.

Esse desenho preservou velocidade de evolução, mas tornou qualquer nova entidade um risco transversal. Um novo conjunto de dados precisa ser adicionado de forma consistente em hidratação, salvamento, exportação, importação, reset, arquivamento e sincronização em nuvem.

### 3.3 Estado e fonte de verdade atual

A fonte de verdade em execução é o estado React mantido no App. A persistência primária offline é o localStorage e a persistência compartilhada é o Firestore.

Conjuntos operacionais atuais:

- empresas;
- obras;
- equipamentos;
- funcionários;
- comboios;
- combustíveis;
- lubrificantes;
- etapas;
- abastecimentos;
- lubrificações;
- tickets de jazida;
- RDOs;
- listas de presença;
- ordens de serviço;
- grupos de equipe;
- presenças por link;
- histórico de presença;
- apontamentos por ramo;
- registros de apontamento;
- cadastro e registros de materiais;
- partes diárias de equipamentos;
- períodos arquivados;
- histórico geral;
- notificações.

O localStorage possui mais de 30 chaves renea_*. Há chaves operacionais adicionais para lotes impressos de tickets e sincronização OneDrive.

### 3.4 Firebase

O Firebase permanece essencial para:

- autenticação de usuários;
- claims de perfil;
- backup compartilhado;
- tickets públicos;
- submissões públicas;
- telemetria;
- sincronização de manutenção externa;
- rate limiting das funções.

O backup usa coleção sistemarenea_cloud, manifesto main_data_v2 e fallback para main_data. O formato v2 divide cada tabela em chunks e reutiliza blocos que não mudaram.

Risco técnico: FirebaseCloudData é Record<string, any>. O transporte é resiliente, mas não é fortemente tipado.

### 3.5 Netlify Functions

Funções existentes:

- analisar-combustivel-documento;
- cleanup-cloud-data;
- public-apontamento;
- public-presenca;
- public-tickets;
- sync-combustivel-onedrive;
- sync-manutencao;
- usage-telemetry.

Há utilitários compartilhados para Firebase Admin, autenticação, JSON, hashing, limites de uso e snapshots.

A IA de combustível é opcional no fluxo funcional: existe análise local e a chamada Gemini é feita somente quando configurada no servidor. Essa característica deve ser preservada.

### 3.6 Exportação e importação

ExcelJS é usado em vários componentes. Existe uma boa base reutilizável em src/utils/excelCorporate.ts para estilo corporativo, validação de arquivo, carregamento e download.

jsPDF e jspdf-autotable são usados em relatórios, presença, parte diária e tickets.

Há duplicação de lógica de importação e de montagem de relatórios nos componentes grandes. A refatoração deve extrair serviços por feature sem alterar formatos já aceitos.

### 3.7 Testes

A suíte atual cobre principalmente:

- sequência de bomba por comboio;
- lançamento retroativo de combustível;
- sequência e normalização de tickets;
- duplicidade de tickets;
- controle diário da jazida;
- analytics operacionais;
- segurança de localStorage e backup;
- leitura e inventário de planilhas de combustível.

Lacunas:

- navegação e perfis;
- hidratação completa do App;
- Firebase Cloud Sync;
- funções públicas;
- materiais;
- presença;
- parte diária;
- importação dos novos cadastros mestres;
- UI e acessibilidade;
- regras Firestore em emulator.

## 4. Módulos existentes

### Dashboard

Já apresenta indicadores, gráficos, filtros e consulta a equipamentos externos. Deve ser evoluído para consolidar cadastros mestres, custos, viagens, estacas, efetivo e materiais sem perder os painéis atuais.

### Cadastros

O módulo atual administra empresas, obras, equipamentos, funcionários, comboios, combustíveis, lubrificantes e etapas. Ainda não existe separação profissional para veículos, fornecedores, locais, ramos e materiais mestre com relacionamentos.

### Combustível

É o módulo mais maduro. Possui digitação, importação, validação, auditoria, sequência de bomba por comboio, tolerância a prefixos não cadastrados, análise local de documentos, IA opcional, OneDrive e Excel.

### Tickets de jazida e viagens

O módulo cobre liberação e recebimento, pares de ticket, impressão, assinatura, devolução, duplicidade, importação, exportação e links públicos. Ele já representa grande parte da planilha de viagens, embora a navegação use o nome Tickets Jazida.

### Materiais

Possui cadastro, registros, filtros, importação, exportação e análise operacional. O modelo ainda usa vários campos textuais onde deveriam existir chaves para fornecedor, local, ramo, veículo e material mestre.

### Presença e efetivo

Há presença administrativa, presença por link, grupos, histórico e controle consolidado. A planilha de efetivo contém dados adicionais de RH, liderança, divisão, seção, mobilização e situação que ainda não estão integralmente modelados.

### Parte diária e manutenção

A parte diária possui atividades, transportes, checklist, horas, indicadores, legado SGE e PDF. Manutenção possui ordens de serviço e integração externa.

### Estacas

Não existe módulo dedicado. Há campos de estaca em tickets e dados importados, mas não há recebimento, estoque, cravação, perdas e saldo por perfil como domínio próprio.

### RDO

O tipo e o estado existem no App, porém não há módulo principal visível na navegação atual. A implementação futura deve recuperar e evoluir o fluxo sem descartar os registros já suportados.

## 5. Problemas encontrados

### 5.1 Complexidade e acoplamento

- App.tsx é um agregador de responsabilidades.
- Dez componentes possuem mais de mil linhas.
- TicketsJazidaTab usa dezenas de estados locais.
- CadastrosTab, LancamentosTab e RelatoriosTab misturam formulário, tabela, importação, exportação e regras.
- types.ts centraliza quase 500 linhas de domínios diferentes.

### 5.2 Validação

- Formulários usam validação manual e estados individuais.
- React Hook Form e Zod ainda não estão instalados.
- Não há schemas compartilhados entre frontend, importação e backend.

### 5.3 Consulta e cache

- TanStack Query e TanStack Table não estão instalados.
- Firebase, API pública e OneDrive usam chamadas imperativas.
- Não há invalidação ou cache padronizado.

### 5.4 Banco e cadastro mestre

- Supabase não existe no projeto.
- Entidades operacionais referenciam nomes e textos em vez de IDs estáveis.
- Veículos, fornecedores, locais e ramos não são entidades centrais completas.
- Equipamento, veículo e comboio têm sobreposição conceitual.
- Não há soft delete padronizado.
- Auditoria existe em alguns fluxos, mas não como regra de persistência para todas as entidades.

### 5.5 Segurança e ambientes

- A configuração pública do Firebase está fixa em src/firebase.ts. Chaves de cliente Firebase não equivalem a uma service account, mas devem ser parametrizadas para separar ambientes.
- A configuração de servidor está corretamente prevista em variáveis de ambiente.
- A CSP atual precisará ser atualizada antes de habilitar Supabase.
- Perfis são aplicados na UI e nas regras Firebase, porém o backup agregado não oferece permissão por tabela.
- security_spec.md descreve testes de regras, mas a suíte não contém emulator tests correspondentes.

### 5.6 Performance

- O projeto contém arquivos de dados iniciais muito grandes, incluindo um arquivo de materiais com mais de 3 MB e 144 mil linhas.
- O lazy loading reduz o impacto inicial, mas a manutenção e o versionamento desses dados no código são caros.
- Componentes grandes dificultam memoização e virtualização seletiva.

### 5.7 Produto e UX

- Há boa base visual, mas os padrões de formulário, modal, botão, loading, empty state e tabela não estão centralizados.
- Alertas nativos ainda aparecem em alguns módulos.
- Dark mode não possui mecanismo formal de tema.
- Não há PWA, service worker ou fila offline.
- A navegação manual limita deep links administrativos.

### 5.8 Identidade do pacote

- package.json ainda usa nome react-example e versão 0.0.0.
- Não existe versionamento de produto alinhado ao roadmap ERP.
- tsconfig não ativa strict e usa alias para a raiz inteira, não apenas src.

## 6. Duplicações e componentes reaproveitáveis

Reaproveitar e fortalecer:

- SpreadsheetImportReview;
- OperationalAnalysisPanel;
- excelCorporate;
- importHelpers;
- resilientStorage;
- systemBackup;
- fuelPumpSequence;
- combustivelValidation;
- operationalAnalytics;
- ticketDuplicateDetection;
- ticketNumberSequence;
- ticketSpreadsheetExport;
- funções compartilhadas Firebase Admin.

Extrair gradualmente:

- componentes de formulário;
- tabelas filtráveis;
- modais e confirmações;
- cabeçalhos de módulo;
- filtros de período;
- upload e revisão de planilha;
- serviços de exportação;
- notificações e toasts;
- auditoria de alteração;
- repositórios de entidades mestres.

## 7. Estrutura alvo

A estrutura será introduzida sem mover tudo de uma vez:

- src/app: bootstrap, providers, navegação, roteamento e configuração;
- src/features: módulos por domínio;
- src/shared/components: componentes visuais reutilizáveis;
- src/shared/lib: utilitários transversais;
- src/shared/types: contratos compartilhados;
- src/services: integrações externas;
- src/repositories: portas de persistência;
- src/schemas: validações Zod;
- supabase/migrations: banco, RLS, views e auditoria;
- docs: decisões, regras e validação.

Os componentes atuais permanecerão funcionando enquanto cada feature for migrada.

## 8. Regras de compatibilidade obrigatórias

1. Nenhuma tabela operacional será removida do localStorage ou do backup Firebase.
2. Dados desconhecidos serão preservados para revisão, não descartados.
3. Importações não substituirão históricos por estimativas.
4. Firebase e Supabase coexistirão durante a migração.
5. Cada mudança de entidade será refletida em hidratação, persistência, backup, importação, exportação, reset e sincronização.
6. As telas atuais continuarão acessíveis durante a extração de componentes.
7. IA permanecerá opcional.
8. Exportações Excel e PDF manterão compatibilidade.

## 9. Linha de base de validação

O ZIP não contém node_modules. Neste computador, o PowerShell é bloqueado por política de grupo com erro CreateProcessAsUserW 1260 e o runtime persistente bloqueia subprocessos com spawn EPERM.

Consequências:

- npm install não pôde ser executado;
- npm run test não pôde ser executado;
- npm run lint não pôde ser executado;
- npm run build não pôde ser executado;
- navegador automatizado não pôde ser iniciado.

Foram executadas inspeções estáticas, leitura integral dos arquivos, análise OOXML das planilhas e verificações por transformação textual com assertivas. A validação executável deve ser repetida em CI, Codespace ou máquina sem a política restritiva.

