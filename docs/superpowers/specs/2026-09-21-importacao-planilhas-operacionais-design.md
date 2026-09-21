# Importação Auditável de Planilhas Operacionais — Design

**Data:** 2026-09-21  
**Status:** Aguardando revisão do usuário  
**Escopo de persistência nesta entrega:** somente dry-run e prévia; dados reais não serão gravados no cache local, Firebase ou Supabase sem nova autorização explícita.

## Objetivo

Ler integralmente e sem descarte silencioso quatro planilhas operacionais, transformando-as em prévias rastreáveis e em fluxos preparados para os módulos existentes de Materiais, Estacas e Tickets da Jazida:

1. `CONTROLE DE RECEBIMENTO DE MATERIAIS - COMPLEXO DO ALTO DO TIETÊ.xlsx`
2. `MATERIAIS COMPLEXO DO ALTO TIETÊ.xlsx`
3. `CRAVAÇÕES DE ESTACAS PRANCHA.xlsx`
4. `VIAGENS JAZIDA SABESP.xlsx`

O ERP continuará usando suas abas atuais. Não haverá módulos principais ou telas duplicadas para materiais, estacas ou viagens.

## Restrições e invariantes

- O app permanece React 19, TypeScript, Vite e Tailwind; nenhuma dependência nova ou migração de framework.
- Componentes React não importam SDKs Firebase ou Supabase.
- Cada reimportação da mesma fonte deve ser idempotente.
- Linhas incompletas, inválidas ou com referência não resolvida nunca serão excluídas ou convertidas em dados operacionais falsos; serão classificadas para conferência.
- Campo ausente continua `undefined` ou `null`; nenhum normalizador converte ausência em `0`.
- Registros anteriores não serão removidos por ausência em uma planilha; futuros fluxos de aplicação usarão inativação quando o domínio exigir histórico.
- Não serão armazenados arquivos XLSX inteiros, binários ou base64 em snapshots de sincronização. Apenas hash, referência do arquivo, mapeamento e dados normalizados necessários para rastreio serão preservados.
- A primeira rodada processa arquivos reais em memória somente. A ação de aplicar permanece bloqueada e explica que a persistência real exige aprovação posterior.

## Estado atual e reutilização

A implementação partirá de padrões existentes:

- `src/utils/excelCorporate.ts`: carregamento lazy e validado de workbooks, com fallback para objetos visuais problemáticos.
- `src/utils/importHelpers.ts`: normalização base e resolução de cabeçalhos por alias; funções que retornam zero para entradas ausentes não poderão ser usadas sem camada que preserve a ausência.
- `src/utils/importMerge.ts`: mesclagem idempotente e contagens de novos, atualizados, inalterados e duplicados.
- `src/fleet/importService.ts`: referência para o fluxo puro parse → classificação → preview → aplicação explícita.
- `src/components/SpreadsheetImportReview.tsx`: base visual para prévia e confirmação.
- `src/utils/estoque.ts`, `src/utils/recebimentoMaterial.ts`, `src/utils/stakeOperations.ts`, `src/utils/travelOperations.ts` e `src/utils/jazidaDailyControl.ts`: regras de domínio já testáveis.
- `src/components/MateriaisTab.tsx`, `src/components/EstacasTab.tsx` e `src/components/TicketsJazidaTab.tsx`: únicos destinos de interface por domínio.
- `src/shared/ui/PageHeader.tsx`: cabeçalho a evoluir, sem criar um segundo padrão.

## Arquitetura comum de importação

### Estrutura

Será criada uma camada `src/imports/` independente de React e de provedores de nuvem:

- `types.ts`: contratos de lote, origem, linha, issue, preview, status e aplicação.
- `workbookReader.ts`: leitura lazy por `excelCorporate.ts`, detecção da última linha com conteúdo real e extração de abas.
- `normalizers.ts`: datas/horas Excel, números com vírgula/ponto, unidades, prefixos, placas, notas fiscais e textos.
- `provenance.ts`: fingerprint SHA-256, identificação determinística do lote e linhagem por linha.
- `preview.ts`: consolidação das linhas por status e cálculo de contagens.
- `apply.ts`: fronteira para futura aplicação transacional. Na primeira rodada, devolve resultado bloqueado de dry-run e não grava nada.
- `adapters/`: adaptadores de recebimentos, materiais, estacas e viagens.

### Fluxo

```text
arquivo
  → validação e leitura lazy
  → identificação de abas e cabeçalhos
  → extração de linhas efetivamente usadas
  → normalização sem inventar valores
  → validação por linha
  → reconciliação/deduplicação contra estado atual
  → preview e relatório de inconsistências
  → dry-run
  → aplicação explícita futura (fora do escopo de persistência atual)
```

### Contratos

```ts
export type ImportValidationStatus =
  | 'ready'
  | 'review'
  | 'duplicate'
  | 'invalid'
  | 'deferred';

export interface ImportLineage {
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number;
  sourceHash: string;
  importedAt: string;
  importBatchId: string;
  validationStatus: ImportValidationStatus;
  validationMessages: readonly string[];
  originalData: Readonly<Record<string, string | number | boolean | null>>;
}

export interface ImportRow<T> {
  readonly lineage: ImportLineage;
  readonly value: T;
  readonly operationalKey?: string;
}

export type ImportDisposition =
  | 'new'
  | 'potential-update'
  | 'unchanged'
  | 'duplicate-in-file'
  | 'review'
  | 'invalid'
  | 'deferred';

export interface ImportPreview<T> {
  readonly batchId: string;
  readonly sourceHash: string;
  readonly rows: readonly ImportPreviewRow<T>[];
  readonly counts: Readonly<Record<ImportDisposition, number>>;
  readonly sheets: readonly ImportSheetPreview[];
  readonly dryRun: true;
}

export interface SpreadsheetImportAdapter<T, TCurrent> {
  readonly domain: 'materials-receipts' | 'materials-movements' | 'stakes' | 'travels';
  supports(sheetName: string): boolean;
  parse(context: ImportParseContext): readonly ImportRow<T>[];
  reconcile(rows: readonly ImportRow<T>[], current: TCurrent): ImportPreview<T>;
}
```

`originalData` mantém apenas valores normalizados/rastreáveis de cada linha, nunca o workbook inteiro. As mensagens explicam cada classificação e permitem localizar a origem por `arquivo › aba › linha`.

### Idempotência e reconciliação

A linhagem usa `sourceHash + sourceSheet + sourceRow` para rastrear origem, mas não é a chave operacional: uma mesma linha deslocada em versão posterior do arquivo não pode criar um registro duplicado automaticamente.

Cada adaptador define uma chave operacional conservadora:

- recebimentos: NF normalizada + material + data + unidade + quantidade, quando todos existirem;
- movimentações: data + item + origem + destino + quantidade + placa/prefixo quando presente;
- estacas: NF/lote + item/perfil + data + tipo de evento;
- viagens: ticket normalizado + tipo de via.

Sem uma chave operacional completa, a linha ficará em `review`, jamais será tratada como duplicada ou aplicada.

## Fase 1 — Fundação, prévia e dry-run

### Escopo

- Implementar os contratos compartilhados e leitores reutilizáveis.
- Ler os quatro arquivos reais em memória e detectar abas, cabeçalhos e última linha com dados.
- Implementar adaptadores de reconhecimento e prévia para os quatro domínios.
- Evoluir `SpreadsheetImportReview` para exibir linhagem, status por linha, mapeamento de colunas, abas deferidas, contagens e dry-run.
- Expor o fluxo primeiro dentro de Materiais e reutilizá-lo por Estacas e Tickets.
- Manter a ação de aplicar desabilitada nesta rodada.

### Abas reconhecidas

- Recebimentos: Tubos de concreto; Tubos PEAD/PVC; Madeiras e Formas; Ferramentas e Materiais de Apoio; Resumo Geral.
- Materiais: Rachão; Macadame; Solo reforçado; Bica corrida; Areia industrial; BGS; Brita 02; Bota-fora Lara; Bota-fora Itaquareia; Q.E. São Bento; Faixa; lançamentos RENEA; resumo geral.
- Estacas: cadastro de materiais; veículos/implementos; lançamentos; cravações; conferência; listas auxiliares; resumo.
- Viagens: Liberação; Recebimento; Cadastro; Conferência; Resumo.

Abas desconhecidas serão exibidas como `deferred`, incluindo nome, quantidade de linhas encontradas e motivo de não mapeamento.

### Testes

- Leitura e reconhecimento de cada arquivo/aba.
- Limite na última linha efetivamente preenchida, inclusive em abas formatadas até 1.048.576 linhas.
- Datas, horas, ponto/vírgula decimal, unidades, placas, prefixos e notas.
- Hash/lote/linhagem por linha.
- Dry-run sem alteração em armazenamento, estado ou gateway de nuvem.
- Preservação de valores incompletos para conferência.
- Reimportação idempotente no nível da prévia.
- Playwright para modal de prévia, atalhos, mobile e desktop.

## Fase 2 — Materiais e recebimentos

### Destino e navegação

`MateriaisTab` será evoluído com subabas internas, sem criar tela paralela:

1. Visão geral
2. Estoque
3. Recebimentos
4. Movimentações
5. Custos
6. Conferência
7. Importações

### Recebimentos

Os recebimentos preservam data, material, especificação, código, quantidade, unidade, classe, diâmetro, altura, solicitação de compra, NF, local de aplicação, quantidade de nota, quantidade recebida, quantidade faltante e status.

Indicadores: previsto, recebido, faltante e pendente, sempre agrupados por unidade compatível. Acompanhamento por pedido/NF suporta recebimento parcial e aponta divergência entre quantidade da nota e recebida sem editar o valor de origem.

### Movimentações e custos

Entradas, saídas, transferências e descarte continuam como movimentos imutáveis. O estoque é derivado dos movimentos ativos. Ausência de custo não gera custo zero. Notas duplicadas, referências não resolvidas e valores incompletos aparecem em Conferência.

O dashboard deve separar unidades (`MT`, `TON`, `M³`, `UN`, `PC` e outras normalizadas), evitando totais heterogêneos. Métricas incluem entradas/saídas por período, material por destino/fornecedor, custo acumulado, ranking de locais e série diária/semanal.

Tabelas terão paginação e colunas configuráveis; no mobile, cada linha torna-se cartão de dados, sem perda de ações.

### Persistência futura

Após autorização posterior, a aplicação será acionada por handlers de domínio no `App.tsx`, em batch no armazenamento resiliente. Nenhum SDK será importado no componente. A aplicação não excluirá itens ausentes da fonte.

## Fase 3 — Estacas-prancha

### Destino

`EstacasTab` será ampliado e passará a usar a camada comum, substituindo sua importação direta por parser + prévia + dry-run.

### Domínio

O adaptador reconhecerá:

- cadastro de materiais: código, descrição, tipo, perfil/modelo, aço, comprimento, NCM, unidade, peso unitário e observação;
- veículos e implementos;
- lotes/movimentos logísticos: data/hora, movimento, NF, material, peso, custo, cavalo, carreta, transportadora, destino, carregamento e status;
- cravações: data, item, serviço, identificação, perfil, comprimento da peça e comprimento cravado;
- conferência/listas/resumo como evidências e análises derivadas.

### Regras

Peso recebido, movimentado e disponível são calculados apenas entre linhas compatíveis. Indicadores apresentam custo por lote, peças por perfil/comprimento, metros cravados, saldo não cravado, produtividade diária e pendências de NF/veículo/status.

A relação entre movimentação e cravação sem chave inequívoca é sempre uma sugestão para revisão; não será confirmada automaticamente. Divergências entre material movimentado e cravação ficam visíveis em Conferência. Fórmulas do Excel permanecem evidência e não definem cálculos operacionais.

## Fase 4 — Viagens da Jazida SABESP

### Destino

`TicketsJazidaTab` continua a ser a tela oficial, mantendo links públicos, impressão, sequência, devolução e histórico existentes.

### Importação e reconciliação

`LIBERAÇÃO` e `RECEBIMENTO` serão processadas como vias distintas por ticket. `CADASTRO`, `CONFERÊNCIA` e `RESUMO` alimentam reconciliação e evidência, sem substituir vias operacionais.

A comparação ocorre por ticket normalizado e pelos campos: prefixo, placa, material/quantidade, destino, ramo, horários e devolução física. Uma viagem é `complete` somente quando ambas as vias existem e os campos conferíveis não divergem.

Estados obrigatórios:

- completo;
- somente liberado;
- somente recebido;
- prefixo divergente;
- placa divergente;
- quantidade divergente;
- duplicado na liberação;
- duplicado no recebimento;
- sem horário;
- sem destino;
- sem ramo;
- conferência necessária.

Nenhuma via some por divergência ou duplicidade. Duração somente será calculada com horários válidos; chegada menor que saída na mesma data representa virada de meia-noite.

### Dashboard

O painel de tickets apresentará analisados, completos, pendentes, vias isoladas, volume em `m³` quando informado, duração média válida, viagens por equipamento/ramo, divergências e série diária.

## Fase 5 — Cabeçalho operacional e padronização

### Componente

`PageHeader` será evoluído em vez de duplicado:

```tsx
<PageHeader
  context="Materiais"
  title="Recebimentos"
  description="Acompanhe pedidos, notas e divergências."
  actions={actions}
  filters={filters}
  tabs={tabs}
  status={status}
/>
```

### Comportamento

- O cabeçalho fica logo abaixo da topbar e ocupa no máximo duas faixas compactas.
- A primeira faixa contém breadcrumb/contexto discreto, título opcional, descrição curta e ações principais alinhadas à direita.
- A segunda, quando necessária, contém filtros, período, status e subtabs.
- Quando a navegação já dá contexto suficiente, o título continua acessível semanticamente, mas a faixa visual mostra apenas toolbar/filtros.
- Ações têm alvo mínimo de 44 px; no mobile, empilham ou entram em menu acessível.
- Subtabs podem rolar horizontalmente apenas no mobile e apenas quando inevitável.
- Não usar hero, logo repetido, blur, backdrop-filter, gradientes ou sombras pesadas.
- Aplicar full white, bordas finas e fundos tonais leves; verde para ação/positivo/ativo, laranja para atenção, vermelho para erro/crítico e azul para informação.
- Respeitar `prefers-reduced-motion`.

### Formulários e estados

Módulos alterados devem usar modais via portal em `document.body`, foco inicial correto, scroll interno com altura limitada e bloqueio de scroll da página. Atalhos: `N` abre lançamento fora de campos editáveis, `Ctrl+Enter` salva e `Esc` fecha. Todos os fluxos apresentam loading, erro recuperável, vazio orientativo, offline compreensível, sincronização pendente, confirmação de sucesso e contagem de linhas enviadas à conferência.

A migração acontece primeiro em Materiais, Estacas e Tickets; as demais páginas migram gradualmente conforme forem alteradas.

## Observabilidade, segurança e auditoria

- Toda prévia terá `importBatchId`, fonte, hash, data/hora e contagem por status.
- Em futura persistência, o lote e as decisões do usuário produzirão `HistoryLog`/auditoria por domínio sem gravar workbook bruto em snapshots.
- Aplicação real deverá ser transacional no limite do armazenamento local e preservar qualquer linha nova de outro aparelho durante a sincronização existente.
- Qualquer extensão futura de persistência normalizada no Supabase requer `organization_id`, RLS, autoria, migration versionada, tipos e teste de reconciliação, mantendo Firebase autoritativo durante o primeiro dual-write.

## Sequência de execução e quality gates

Para cada fase:

1. escrever testes antes da implementação do comportamento correspondente;
2. executar testes focalizados;
3. executar `npm run verify`;
4. revisar `git diff --check` e o diff funcional;
5. verificar que nenhum registro pré-existente desapareceu;
6. validar visualmente no navegador, desktop e mobile;
7. registrar contagens de novos, atualizações potenciais, duplicados, inválidos e itens em conferência;
8. revisar o código antes de commit;
9. apenas então preparar commit/deploy, mediante autorização de ação externa.

## Fora de escopo desta entrega de importação

- Persistir dados reais das quatro planilhas no cache, Firebase ou Supabase.
- Exclusão ou substituição de registros já existentes.
- Nova infraestrutura de banco, permissões, SDKs ou provedores.
- Armazenar arquivos XLSX completos dentro de snapshots operacionais.
