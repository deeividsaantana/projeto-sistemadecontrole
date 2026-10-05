# Auditoria geral pós-v3.0 e roadmap de evolução

Data da revisão: 01/08/2026

## 1. Resumo executivo

O ERP v3.0 já reúne uma base operacional ampla e preserva boa parte dos fluxos das planilhas: combustível, equipamentos, parte diária, viagens de jazida, materiais, estacas, presença, apontamentos, manutenção, relatórios, fechamentos e inteligência documental.

A base não deve ser reescrita. A estratégia correta continua sendo evolução gradual, com homologação por módulo e preservação integral dos registros incompletos, duplicados ou ainda não relacionados a um cadastro mestre.

Situação técnica confirmada nesta auditoria:

- build de produção aprovado;
- 3.143 módulos transformados pelo Vite;
- 59 testes de negócio aprovados;
- nenhum teste reprovado;
- sincronização local do OneDrive configurada somente para agosto de 2026;
- último retrato confirmado com 383 lançamentos e 3 itens para conferência;
- três erros de tipagem TypeScript ainda impedem `npm run lint`;
- não existe pipeline de CI no GitHub;
- não existem testes automatizados de regras do Firestore, funções públicas ou navegação completa em navegador;
- os maiores riscos atuais estão em links públicos previsíveis, sincronização por retrato completo e fragmentação da fonte de verdade.

## 2. Escopo revisado

Foram analisados:

- arquitetura React/Vite;
- componente raiz e navegação;
- persistência em `localStorage` e espelho IndexedDB;
- sincronização segmentada com Firebase;
- fundação opcional PostgreSQL/Supabase;
- funções Netlify;
- regras do Firestore;
- PWA e fila offline;
- importações e exportações;
- módulos operacionais;
- regras extraídas das planilhas;
- testes automatizados;
- build de produção;
- agente local de combustível no OneDrive;
- documentação técnica existente.

## 3. Estado atual da arquitetura

### 3.1 Aplicação

- React 19, TypeScript e Vite.
- Navegação por módulos com perfis `admin`, `gestor`, `operador` e `leitura`.
- Telas carregadas de forma assíncrona.
- `App.tsx` ainda concentra hidratação, persistência, sincronização, regras de mutação e integração entre módulos.
- React Query está disponível, porém a maior parte do sistema ainda utiliza estado global manual.

### 3.2 Persistência

- `localStorage` é a fonte operacional imediata do navegador.
- IndexedDB mantém um espelho de recuperação a cada dez segundos.
- Firebase armazena um retrato segmentado em manifesto e blocos.
- O envio automático publica o retrato completo após alterações.
- Supabase possui migrations, RLS, filas de importação e tabelas canônicas, mas permanece como camada opcional e ainda não é a fonte operacional principal.

### 3.3 Integrações

- Links públicos usam funções Netlify e projeções reduzidas.
- Combustível é lido por um agente local Windows e enviado a uma função protegida por token.
- Manutenção externa ainda é obtida por leitura de HTML de outro site.
- Inteligência documental funciona localmente sem depender de IA externa.

### 3.4 PWA e offline

- Existe manifesto instalável e service worker.
- Dados já carregados continuam disponíveis localmente.
- Existe fila IndexedDB para repetir o backup Firebase quando a conexão retorna.
- Módulos assíncronos ainda não acessados não são pré-armazenados; portanto o primeiro uso totalmente offline pode não abrir todas as telas.

## 4. Pontos fortes preservados

- Dados de importação não são descartados silenciosamente.
- Combustível mantém linhas incompletas e alertas para conferência.
- Leituras retroativas respeitam data, hora e comboio.
- Junho e julho não participam mais da sincronização automática de combustível.
- Tickets separam liberação, recebimento, impressão e devolução física.
- Estacas possuem lote, NF, cravação, sobra, perda e saldo confirmado.
- Fechamentos possuem resumo, versão e checksum.
- Exportações Excel e PDF estão presentes em vários módulos.
- Firestore agora exige usuário de equipe para acesso administrativo.
- Chaves de serviço permanecem no servidor.
- A operação continua utilizável sem Supabase e sem IA.

## 5. Achados prioritários

### P1 — Segurança dos links públicos

Problemas:

- o apontamento usa o token fixo `apontamentos-renea`;
- vários tokens iniciais de presença são previsíveis e contêm nomes e áreas;
- a busca de tickets pendentes não exige token;
- a reserva de número de ticket também não exige token;
- o identificador de dispositivo protege somente contra sobrescrita casual e não funciona como autenticação.

Impacto:

- envio não autorizado de presença ou apontamento;
- enumeração de tickets, placas, prefixos, datas e materiais;
- consumo indevido da sequência de tickets;
- retrabalho de conferência e risco de dado operacional falso.

Ação:

- revogar e substituir os links existentes;
- gerar tokens aleatórios fortes no servidor;
- armazenar somente hash do token;
- permitir expiração, rotação e revogação;
- exigir convite assinado no fluxo público de tickets;
- trocar busca ampla por consulta exata de ticket mais segundo dado de confirmação;
- aplicar proteção anti-automação gratuita no envio público;
- manter rate limit como defesa adicional, não como autenticação.

### P1 — Fonte de verdade ainda fragmentada

Problemas:

- a operação ativa combina estado React, `localStorage`, IndexedDB e retratos Firebase;
- Supabase ainda não foi ativado como fonte canônica;
- materiais ainda relacionam material, fornecedor, origem e destino principalmente por texto;
- apontamentos e presenças guardam nomes duplicados junto aos identificadores;
- o histórico administrativo é mutável no cliente.

Impacto:

- conflito entre computadores;
- divergência de nomes;
- duplicidade de cadastros;
- custo elevado de conciliação;
- auditoria não totalmente confiável.

Ação:

- ativar a base canônica módulo por módulo;
- começar pelos cadastros mestres;
- manter o texto original importado para auditoria;
- relacionar operações por IDs;
- usar versionamento otimista por registro;
- gravar auditoria imutável no servidor;
- manter Firebase como ponte, backup e suporte aos links durante a transição.

### P1 — Sincronização por retrato completo

Problemas:

- cada alteração com sincronização automática pode publicar o banco operacional completo;
- o conflito é detectado no manifesto global, não por registro;
- a fila offline repete somente o backup completo;
- crescimento de materiais, combustível e anexos aumenta tempo, custo e chance de conflito.

Impacto:

- lentidão;
- maior consumo de Firestore;
- colisões entre usuários;
- dificuldade para identificar exatamente o que mudou.

Ação:

- adotar gravações por entidade e registro;
- usar `updated_at`, versão e chave idempotente;
- manter snapshot somente para backup e fechamento;
- implementar fila offline por comando operacional;
- reconciliar conflitos na tela em vez de substituir o conjunto inteiro.

### P1 — Qualidade sem bloqueio de publicação

Problemas:

- a checagem TypeScript falha em três pontos:
  - `ApplicationErrorBoundary` não reconhece `props`;
  - `ImportMeta.env` não está tipado;
  - leitura de hyperlink no Excel não estreita corretamente o tipo da célula;
- não há GitHub Actions;
- Netlify executa build, mas não exige testes e tipagem antes da publicação.

Impacto:

- regressões podem chegar à produção;
- erros de contrato podem ficar ocultos porque o Vite transpila sem validar tipos.

Ação:

- corrigir os três erros;
- criar CI com instalação reproduzível, tipagem, testes, build e inspeção das funções;
- bloquear publicação quando qualquer etapa falhar;
- adicionar verificação do bundle e smoke test da URL publicada.

### P1 — RDO não possui tela operacional própria

O estado, os tipos, a importação, a persistência, o arquivamento e os manipuladores de RDO existem. Porém não há item de navegação nem tela dedicada para criar e editar o RDO. Atualmente os dados aparecem somente em dashboard, relatórios e rotinas de backup.

Ação:

- criar módulo RDO sem recriar os cadastros existentes;
- preencher automaticamente efetivo, equipamentos, viagens, materiais, clima e produção;
- permitir revisão, aprovação e fechamento;
- gerar PDF e Excel compatíveis com o processo atual;
- vincular o RDO ao período arquivado.

### P2 — Funções agendadas sem proteção explícita

`sync-manutencao` e `cleanup-cloud-data` não validam usuário, segredo ou cabeçalho de execução agendada. Mesmo com ações internas controladas, os endpoints podem ser chamados externamente e consumir recursos.

Ação:

- validar assinatura ou segredo de agendamento;
- rejeitar chamadas manuais não autorizadas;
- registrar duração, quantidade processada e erro;
- criar alerta quando uma rotina deixar de executar.

### P2 — Integração de manutenção frágil

A integração externa interpreta HTML por expressões regulares. Uma mudança visual na página pode interromper ou distorcer os indicadores.

Ação:

- substituir o scraping por API autenticada ou documento de integração estável;
- armazenar o último valor válido e marcar a leitura como desatualizada;
- não substituir indicadores confirmados quando a estrutura da origem mudar.

### P2 — Escala e desempenho do frontend

Evidências do build:

- chunk principal aproximado de 663 kB;
- Firebase aproximado de 690 kB;
- ExcelJS aproximado de 940 kB;
- base histórica de materiais aproximada de 2,27 MB;
- `App.tsx` possui aproximadamente 4 mil linhas;
- telas de jazida e combustível possuem mais de 2 mil linhas cada.

Ação:

- retirar dados históricos do código-fonte;
- carregar históricos por API ou arquivo versionado sob demanda;
- importar ExcelJS, jsPDF e gráficos apenas na ação necessária;
- dividir `App.tsx` por domínio;
- criar hooks e gateways por módulo;
- aplicar virtualização nas tabelas extensas.

### P2 — Auditoria e fechamento ainda dependem do cliente

Históricos e períodos arquivados podem ser alterados por quem controla o armazenamento local. O checksum detecta mudança, mas não equivale a uma assinatura de servidor.

Ação:

- gravar eventos de auditoria no servidor;
- tornar fechamento publicado imutável;
- assinar o checksum no backend;
- permitir nova versão sem sobrescrever a anterior;
- registrar usuário, data, motivo e versão restaurada.

### P2 — Cobertura de testes incompleta

Os 59 testes atuais cobrem regras puras importantes, mas não cobrem:

- regras reais do Firestore em emulador;
- funções públicas com autenticação, rate limit e abuso;
- componentes React;
- acessibilidade;
- fluxo completo de login;
- importação real de todas as planilhas;
- sincronização simultânea entre dois usuários;
- service worker e operação offline;
- exportação visual de PDF e Excel;
- implantação e rollback.

### P3 — UX e acessibilidade

Melhorias:

- substituir `alert` e `confirm` por diálogos padronizados;
- adicionar foco controlado e `aria-label` em ações por ícone;
- impedir perda de formulário não salvo;
- salvar filtros por usuário;
- exibir claramente origem, versão e última sincronização de cada dado;
- permitir central de pendências única;
- criar modo de alta legibilidade para uso em campo.

## 6. Situação por módulo

| Módulo | Situação atual | Próxima evolução |
|---|---|---|
| Dashboard | consolidado e navegável | KPIs canônicos, metas, alertas e drill-down |
| Cadastros | amplo, com fila opcional Supabase | fonte mestre única, aliases, aprovação e deduplicação |
| Equipamentos | cadastro, parte diária e indicadores | histórico por evento, telemetria e custo total |
| Combustível | robusto, com conferência e OneDrive agosto | estoque de tanque, NF, custo, calibração e saúde do agente |
| Jazida | liberação, recebimento, impressão e devolução | segurança pública, workflow, pareamento e escala |
| Materiais | cadastro, importação, análise e exportação | estoque por movimento, IDs mestres, NF e custo por ramo |
| Estacas | lote, NF, cravação e saldo | rastreabilidade física, revisão de associação e inventário |
| Presença | listas, grupos, links e histórico | tokens seguros, aprovação, efetivo e custo gerencial |
| Apontamentos | ramos, produção, clima e equipes | token por link, revisão, vínculo com RDO e metas |
| Manutenção | OS e custos básicos | planos preventivos, peças, medidores e SLA |
| RDO | dados e handlers sem tela própria | módulo completo integrado ao campo |
| Relatórios | Excel, PDF, filtros e snapshots | catálogo governado, agendamento e fechamento assinado |
| Inteligência documental | extração local assistiva | OCR opcional, modelos por documento e feedback de revisão |

## 7. Roadmap recomendado

### v3.1 — Segurança, qualidade e operação confiável

Prioridade: imediata.

Escopo:

- corrigir os três erros TypeScript;
- rotacionar links públicos previsíveis;
- proteger busca e reserva de tickets;
- proteger funções agendadas;
- remover o perfil administrativo como fallback após reprovisionar usuários antigos;
- criar testes de Firestore e funções Netlify;
- criar CI no GitHub;
- adicionar monitor de funções, sincronizações e versão publicada;
- executar teste documentado de backup e restauração.

Critérios de aceite:

- `npm run lint`, `npm test` e `npm run build` aprovados;
- links antigos revogados;
- chamadas públicas sem convite rejeitadas;
- chamadas indevidas das rotinas agendadas rejeitadas;
- publicação bloqueada em caso de falha;
- relatório de restauração aprovado sem perda de dados.

### v3.2 — Cadastros mestres e banco canônico

Prioridade: estrutural.

Escopo:

- ativar Supabase primeiro para empresas, obras, equipamentos, veículos, colaboradores, fornecedores, materiais, locais e ramos;
- homologar aliases e deduplicação;
- promover importações somente após revisão;
- migrar vínculos textuais para IDs sem apagar o texto original;
- criar APIs por registro com versão;
- manter sincronização reversível com Firebase durante a transição.

Critérios de aceite:

- cada entidade possui uma única chave canônica;
- nenhuma linha importada é descartada;
- conflitos aparecem para revisão;
- módulos novos usam IDs mestres;
- reconciliação antes/depois fecha sem diferença não explicada;
- rollback da migração é testado.

### v3.3 — RDO, efetivo e campo integrado

Prioridade: ganho operacional diário.

Escopo:

- tela dedicada de RDO;
- preenchimento automático por presença, apontamento, parte diária, viagens e materiais;
- clima, ocorrências, fotos opcionais e pendências;
- aprovação por responsável;
- fechamento diário;
- PDF e Excel;
- vínculo com custo e produção.

Critérios de aceite:

- o RDO não exige redigitar dados já registrados;
- divergências continuam visíveis;
- alterações após aprovação criam nova revisão;
- fechamento entra no snapshot do período;
- exportação reproduz o documento operacional homologado.

### v3.4 — Materiais, estoque e estacas

Prioridade: controle físico e financeiro.

Escopo:

- razão de movimentos de materiais;
- recebimento por NF;
- transferência, consumo, devolução e ajuste;
- saldo por obra, ramo, material e fornecedor;
- densidade e conversão de unidade governadas;
- custo real e custo de referência;
- inventário de estacas por lote;
- associação assistida de cravação;
- divergência de NF e inventário físico.

Critérios de aceite:

- saldo sempre é explicável por movimentos;
- ajustes exigem motivo e responsável;
- estacas sem lote permanecem pendentes;
- custo por ramo reconcilia com as entradas;
- exportações preservam a lógica das planilhas atuais.

### v3.5 — Frota, manutenção e combustível

Prioridade: disponibilidade e custo.

Escopo:

- planos preventivos por data, KM e horímetro;
- geração de OS a partir da parte diária;
- peças, serviços, terceiros e tempo de indisponibilidade;
- substituição do scraping de manutenção por integração estável;
- estoque de combustível por tanque e comboio;
- entrada por NF e saída por abastecimento;
- calibração de bomba;
- metas de consumo por família;
- painel de saúde do agente OneDrive;
- seleção de competência configurável, mantendo agosto como único mês automático até aprovação explícita.

Critérios de aceite:

- nenhuma planilha de junho ou julho volta à sincronização sem autorização;
- manutenção preventiva gera aviso antes do vencimento;
- litros de entrada, saída e saldo reconciliam;
- leitura retroativa continua permitida;
- alerta nunca elimina lançamento.

### v3.6 — Jazida, comercial e fechamento

Prioridade: rastreabilidade e faturamento.

Escopo:

- workflow formal de viagem;
- eventos distintos para dados prontos, envio, recebimento, impressão, devolução física e cancelamento;
- consulta indexada sem varrer todos os tickets;
- contador transacional sem leitura completa do acervo;
- NF e conferência;
- relatório comercial SPMAR;
- pacotes de fechamento assinados;
- relatórios agendados.

Critérios de aceite:

- liberação e recebimento nunca são confundidos;
- ticket incompleto ou duplicado permanece para revisão;
- devolução física é um evento independente;
- consulta mantém desempenho com crescimento do acervo;
- fechamento não pode ser sobrescrito.

### v4.0 — ERP multiobra e offline-first

Prioridade: maturidade da plataforma.

Escopo:

- múltiplas obras e organizações isoladas;
- aplicação de campo offline por comandos;
- sincronização por registro;
- aplicativo instalável com todos os módulos essenciais pré-armazenados;
- SSO ou MFA;
- administração de usuários e permissões;
- API documentada;
- observabilidade;
- política de retenção e LGPD;
- plano de continuidade, backup externo e recuperação de desastre.

Critérios de aceite:

- operação de campo continua sem internet;
- conflitos são conciliados por registro;
- dados de uma obra não vazam para outra;
- permissões são validadas no servidor;
- recuperação completa é comprovada em teste periódico.

## 8. Ordem prática dos próximos 30 dias

1. Rotacionar e proteger todos os links públicos.
2. Corrigir a tipagem e criar CI.
3. Testar Firestore, funções e fluxo de login.
4. Criar painel de saúde das sincronizações.
5. Homologar cadastros mestres no Supabase.
6. Mapear vínculos textuais que serão convertidos para IDs.
7. Prototipar a tela de RDO usando os dados já existentes.
8. Executar uma restauração completa em ambiente de teste.

## 9. Regras obrigatórias para todas as versões

- Não substituir o sistema atual por uma reescrita total.
- Não ativar módulos de banco sem homologação.
- Não apagar linhas incompletas, duplicadas ou desconhecidas.
- Não promover importações automaticamente.
- Não alterar uma regra de planilha sem mapear consumidores e impacto.
- Não duplicar cadastros mestres.
- Não remover exportação Excel e PDF.
- Não reativar meses de combustível sem decisão operacional explícita.
- Toda migração deve ter reconciliação e rollback.
- Toda versão deve incluir checklist de campo, teste automatizado, build e plano de retorno.

## 10. Limites desta auditoria

- O build e os testes foram executados localmente.
- A checagem de dependências por vulnerabilidade não foi concluída porque o repositório usa `package-lock.json`, enquanto o executor local disponível exigia `pnpm-lock.yaml` para `pnpm audit`.
- A renderização visual completa em navegador não fez parte desta rodada.
- A ativação real das migrations Supabase e suas variáveis de produção não foi presumida.
- Nenhuma regra de negócio ou dado operacional foi alterado por esta auditoria.

## 11. Conclusão

O sistema está em uma boa posição funcional para continuar evoluindo, mas a próxima entrega não deve priorizar novas telas isoladas. A v3.1 deve fechar segurança, tipagem, CI e operação confiável. Em seguida, a v3.2 deve consolidar a fonte única de verdade. Somente depois disso os novos módulos de RDO, estoque, manutenção avançada e fechamento comercial devem ser ampliados.

A sequência recomendada reduz risco sem interromper o uso diário e transforma a base atual em um ERP sustentável, auditável e preparado para múltiplos usuários.
