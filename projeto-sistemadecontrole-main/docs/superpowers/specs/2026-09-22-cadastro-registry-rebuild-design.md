# Reconstrução do Cadastro — Componente de Registro Único — Design

**Data:** 2026-09-22
**Status:** Aguardando revisão do usuário
**Escopo desta entrega:** as 10 categorias hoje dentro de `CadastrosTab.tsx` (empresas, fornecedores, terceiras, obras, equipamentos, veículos, colaboradores, comboios, combustíveis, lubrificantes, etapas). Nenhuma outra tela do sistema é tocada nesta entrega — elas ficam registradas como trabalho futuro que reaproveita a mesma base.

## Objetivo

`src/components/CadastrosTab.tsx` (1725 linhas, 1 componente, 48 `useState`, 0 `useMemo`/`useCallback`) trava/buga ao digitar ou trocar de sub-aba, porque recalcula 10 listas filtradas e várias contagens do zero a cada render. Além disso, cada categoria tem seu próprio jeito de fazer a mesma coisa (formulário, exclusão, contagem), sem nenhum padrão comum de cabeçalho, filtro ou lançamento — e não existe hoje nenhuma verificação de duplicidade por categoria (o que já causou uma discrepância real de ~700 registros de frota duplicados, achado numa investigação separada).

Este design substitui o arquivo único por um componente de registro genérico e configurável, usado pelas 10 categorias, resolvendo de uma vez: performance, padrão visual único, lançamento em lote e detecção de duplicidade — sem mudar nenhum contrato já existente entre `App.tsx` e a tela (mesmas props de entrada/saída por categoria).

## Restrições e invariantes

- Nenhuma mudança de framework, dependência nova, ou reescrita de outras telas.
- `App.tsx` continua chamando os mesmos handlers (`onSaveEmpresa`, `onDeleteEquipamento`, etc.) com a mesma assinatura — a reconstrução é interna ao componente de tela, não ao contrato de dados.
- Nenhum dado é apagado ou reescrito automaticamente: a checagem de duplicidade **avisa e, quando a chave é inerentemente única (ex.: CNPJ), bloqueia a criação** — nunca funde ou remove registros existentes sozinha.
- Ausência de campo continua `undefined`/vazio — nenhuma config pode inventar valor padrão para um campo que a pessoa não preencheu (mesmo invariante de `AGENTS.md` já seguido na importação de planilhas).
- Compatível com o guard de "nome de pessoa" já existente (`src/utils/equipmentOperations.ts`) — a config de Equipamentos continua chamando essa validação.

## Estado atual e reutilização

- `src/shared/ui/PageHeader.tsx`: será corrigido nesta entrega (título/descrição hoje são `sr-only`, ou seja, invisíveis — ver "Correções incluídas" abaixo), não recriado.
- `src/shared/ui/{Modal,TableShell,Pagination,EmptyState,Badge,ConfirmDialog}.tsx`: reaproveitados como blocos internos do novo componente.
- `src/masterData/centralRegistry.ts`: já tem `isSupplier`, `isThirdPartyContractor`, `isVehicle`, `nextMasterId`, `registrySummary` — viram a base das configs, não são reescritos.
- Padrão de referência para lançamento em lote: `src/components/ControleEquipamentosDiarioTab.tsx` (edição inline por linha + ação que lança várias linhas de uma vez), confirmado com o usuário como modelo.
- `src/utils/equipmentOperations.ts` (`validateEquipmentMasterRecord`, guard de nome de pessoa): reaproveitado pela config de Equipamentos.

## Arquitetura

```text
src/shared/registry/
  RegistryScreen.tsx        — componente único (cabeçalho, dashboard, filtro, tabela, lançamento em lote, exclusão)
  registryTypes.ts          — RegistryConfig<T>, RegistryField<T>, contratos
  useRegistryState.ts       — hook: filtro + memoização + paginação + duplicidade, genérico por T
  duplicateDetection.ts     — checagem de chave operacional repetida (genérica, reaproveita o mesmo princípio já usado em Estacas/Viagens/Materiais)

src/registryConfigs/
  empresaConfig.ts          — Empresas (inclui Fornecedores e Terceiras como filtros do mesmo config, não 3 configs)
  obraConfig.ts
  equipamentoConfig.ts      — Equipamentos e Veículos como filtro do mesmo config
  funcionarioConfig.ts
  comboioConfig.ts
  combustivelConfig.ts
  lubrificanteConfig.ts
  etapaConfig.ts

src/components/CadastrosTab.tsx   — vira um orquestrador fino: escolhe a config pela sub-aba ativa e renderiza <RegistryScreen config={...} items={...} onSave={...} onDelete={...} />
```

### `RegistryConfig<T>` (contrato por categoria)

Cada config declara, sem JSX:
- `label`, `icon`, `idPrefix` (para `nextMasterId`).
- `fields`: lista de campos do formulário (chave, rótulo, tipo — texto/número/data/select/checkbox —, obrigatório, validação).
- `columns`: quais campos aparecem na tabela e como formatar (reaproveita os `fields`, não duplica).
- `operationalKey(item): string | undefined` — a mesma ideia já usada em `stakesAdapter`/`travelsAdapter`: a chave que identifica "isto é o mesmo registro do mundo real" (CNPJ para empresa; prefixo/placa normalizados para equipamento). Retornar `undefined` quando a chave está incompleta — nunca inventar.
- `keyUniqueness: 'bloqueia' | 'avisa'` — CNPJ duplicado bloqueia; um caso mais solto (ex.: dois colaboradores com nome parecido) só avisa.
- `quickEditFields?`: campos editáveis direto na linha da tabela (ex.: status), no espírito do Controle de Frotas.
- `extraValidation?(item): string | undefined` — ponto de extensão para regras como o guard de nome de pessoa em Equipamentos.
- `subFilter?(item): boolean` — para Fornecedores/Terceiras/Veículos, que são o mesmo cadastro (`Empresa`/`Equipamento`) filtrado por tipo, e não uma tabela própria.

### `RegistryScreen`

Recebe `config`, `items: T[]`, `onSave`, `onDelete`, `responsavel`. Por dentro:
1. **Cabeçalho** — `PageHeader` (corrigido) + cards de resumo: total, ativos, e **possíveis duplicados** (contagem de `operationalKey` repetida entre os itens atuais — mesmo princípio, sem re-explicar, de `duplicate-in-file` na importação de planilhas).
2. **Filtro** — busca textual genérica sobre os `fields` marcados como pesquisáveis, mais filtros de select para campos do tipo `select`.
3. **Tabela** — `TableShell` + `Pagination` (sempre, para toda categoria — hoje só Colaboradores pagina). Campos `quickEditFields` editam inline; os demais abrem o formulário completo.
4. **Lançamento** — botão "Adicionar linhas" cria N linhas em branco na própria tabela (usando os `fields` da config para os inputs); um botão "Salvar todas" valida e chama `onSave` para cada linha válida, e mantém em edição as que falharem validação — nenhuma linha é descartada em silêncio.
5. **Exclusão** — `ConfirmDialog` compartilhado (troca o modal artesanal com fundo branco/opaco do Cadastro atual).

### Fluxo de dados

Sem mudança de contrato: `App.tsx` continua sendo o dono do estado (`empresas`, `equipamentos`, etc.) e dos handlers de gravação/exclusão/`saveAndLog`. `CadastrosTab.tsx` só decide qual config usar pela sub-aba e repassa os dados — exatamente como hoje repassa para o formulário único, só que a lógica de filtro/memoização/duplicidade agora mora uma vez dentro de `useRegistryState`, não repetida em 10 blocos de código.

### Detecção de duplicidade

`useRegistryState` calcula `operationalKey(item)` para cada item e agrupa. Isso alimenta:
- O card "possíveis duplicados" no cabeçalho de cada categoria.
- O aviso/bloqueio ao salvar um novo registro cuja chave já existe.

Isso não corrige os ~700 registros de frota já duplicados em produção hoje (é um problema de dados existentes, tratado à parte, com plano próprio de reconciliação) — mas impede que o problema.

### Chave operacional por categoria

| Config | Categorias que usa (via `subFilter`) | `operationalKey` | `keyUniqueness` |
|---|---|---|---|
| `empresaConfig` | Empresas, Fornecedores, Terceiras | CNPJ normalizado (só dígitos) | bloqueia (CNPJ vazio → sem chave, cai em conferência, não bloqueia) |
| `obraConfig` | Obras/Locais | nome normalizado | avisa |
| `equipamentoConfig` | Equipamentos, Veículos | prefixo normalizado (mesma normalização já usada em `centralRegistry.ts`) | bloqueia |
| `funcionarioConfig` | Colaboradores | matrícula | bloqueia (matrícula vazia → sem chave, não bloqueia) |
| `comboioConfig` | Comboios | placa normalizada | bloqueia |
| `combustivelConfig` | Combustíveis | nome normalizado | avisa |
| `lubrificanteConfig` | Lubrificantes | nome normalizado | avisa |
| `etapaConfig` | Ramos/Trechos | nome normalizado | avisa |

Regra geral: chave baseada em identificador formal e único por natureza (CNPJ, prefixo de frota, matrícula, placa) bloqueia; chave baseada só em nome (que duas pessoas podem digitar de forma levemente diferente de propósito) avisa e deixa a pessoa decidir.

## Correções incluídas nesta entrega

- **`PageHeader` deixa de ser `sr-only`**: título e descrição do módulo passam a aparecer visualmente (hoje só existem para leitor de tela, então nenhuma tela que usa `PageHeader` mostra o nome do módulo abaixo de telas grandes). Ajuste isolado no componente compartilhado, testado para não quebrar as ~40 telas que já o usam.
- **Modal de confirmação de exclusão do Cadastro** passa a usar `ConfirmDialog` compartilhado (hoje é um `<div>` artesanal com fundo quase opaco, diferente do usado em `LancamentosTab`).

## Erros e casos de borda

- Linha em lançamento em lote sem campo obrigatório: fica destacada, não é salva, não trava as demais.
- Duplicidade com chave incompleta (`operationalKey` retorna `undefined`): item nunca conta como duplicado — evita falso positivo.
- Falha de gravação na nuvem (`onError`): mesmo padrão já usado hoje (`saveErrorRef`, mensagem de validação) — `RegistryScreen` só chama o `onError` recebido, não inventa tratamento novo.

## Testes

- `tests/registryState.test.ts` (novo): `useRegistryState`/lógica de filtro+duplicidade testada com 1-2 configs de exemplo sintéticas (não as 10 reais) — cobre filtro, paginação, detecção de duplicidade (bloqueia vs avisa), lançamento em lote com linha inválida.
- Um teste leve por config real (`empresaConfig.test.ts`, etc.) conferindo que `fields`/`columns`/`operationalKey` referenciam chaves de verdade do tipo (`Empresa`, `Equipamento`, ...) — pega erro de digitação de campo sem precisar montar UI.
- `tests/pageHeaderVisibility.test.ts` (novo, pequeno): confirma que o título do `PageHeader` não fica mais `sr-only`.
- Testes atuais que dependem da estrutura interna de `CadastrosTab.tsx` (se houver) são adaptados; testes de comportamento observável (contagens, permissões) continuam válidos porque o contrato com `App.tsx` não muda.
- `npx tsx tests/run.ts`, `npx tsc --noEmit`, `npm run build` e o E2E de Cadastros antes de considerar concluído.

## Fora de escopo (registrado para depois)

- Aplicar o mesmo `RegistryScreen` em outras telas do sistema (Materiais, Estacas, Tickets Jazida, etc.) — vira trabalho futuro que reaproveita esta base.
- Dashboard/cards/gráficos/exportação em PDF de **materiais** (fornecedor, resumo tipo planilha) — item separado do backlog, não faz parte do cadastro reconstruído.
- Limpeza dos ~700 registros de frota já duplicados em produção — precisa de um plano de reconciliação de dados à parte, com confirmação explícita antes de qualquer exclusão em massa.
- Indicador de colaborador ativo/inativo na tela de Equipes (fora do Cadastro).
