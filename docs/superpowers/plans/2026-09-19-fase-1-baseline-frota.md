# Fase 1 — Baseline, Navegação e Frota Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restaurar os gates de qualidade, formalizar a sidebar compacta com nove módulos e garantir que a importação de controle diário crie ou vincule automaticamente as OS de manutenção sem perder dados ou fluxos existentes.

**Architecture:** Preservar a navegação enxuta atual como fonte de verdade em `navigation.ts`; ajustar o teste que ainda descreve uma variante de 13 módulos. Para a frota, extrair uma função pura que percorre os registros importados, reutiliza `garantirOrdemAutomaticaDaFrota` e retorna tanto os controles vinculados quanto a lista final de OS, para que os fluxos manual e de importação compartilhem a mesma regra. Corrigir o contrato de `CentralOperacionalTab` pelo seu contrato de props atual, sem modificar regras operacionais.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Node test runner, tsx, Firebase local-first sync existente.

**Spec:** `ARCHITECTURE_AUDIT.md`

## Global Constraints

- Não reescrever o ERP nem alterar bancos, regras Firebase, Supabase, Render ou deploy.
- Preservar todos os módulos auxiliares e suas permissões; a sidebar primária terá exatamente 9 módulos.
- Não adicionar dependências.
- Não remover ou mutar dados existentes durante importação; usar o merge atual como etapa anterior à regra de OS.
- Uma OS já aberta para o mesmo equipamento deve ser reutilizada, nunca duplicada.
- Usar testes antes da implementação e rodar `npm run lint`, `npm test` e `npm run build` antes de concluir.
- Não versionar `.agents/`, `.claude/worktrees/`, arquivos ZIP, logs, backups ou artefatos de preview nesta fase.

---

### Task 1: Formalizar a navegação primária de nove módulos

**Files:**
- Modify: `src/app/navigation/navigation.ts:135-194`
- Modify: `tests/sidebarNavigation.test.ts`
- Modify: `tests/run.ts` somente se o teste ainda não estiver registrado

**Interfaces:**
- Consumes: `PRIMARY_MODULE_IDS`, `SIDEBAR_NAVIGATION_GROUPS`, `isPrimaryModule` de `src/app/navigation/navigation.ts`.
- Produces: contrato testado de 9 IDs primários, na mesma ordem da sidebar; destinos auxiliares continuam fora da sidebar.

- [ ] **Step 1: Reescrever o teste para descrever a decisão de produto atual**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PRIMARY_MODULE_IDS,
  SIDEBAR_NAVIGATION_GROUPS,
  isPrimaryModule,
} from '../src/app/navigation/navigation';

test('sidebar expõe os 9 módulos primários do ERP', () => {
  const rendered = SIDEBAR_NAVIGATION_GROUPS.flatMap(group => group.items.map(item => item.id));

  assert.deepEqual(rendered, [...PRIMARY_MODULE_IDS]);
  assert.equal(rendered.length, 9);
  assert.equal(isPrimaryModule('manutencao'), true);
  assert.equal(isPrimaryModule('tickets-jazida'), false);
  assert.equal(isPrimaryModule('frota'), false);
});
```

- [ ] **Step 2: Rodar o teste para verificar que está vermelho antes do ajuste**

Run: `npx tsx tests/sidebarNavigation.test.ts`

Expected: FAIL porque o teste atual exige 13 módulos.

- [ ] **Step 3: Manter a lista de nove módulos como contrato explícito em `navigation.ts`**

Conservar a lista nesta ordem e acrescentar apenas um comentário de intenção se ela ainda não deixar o produto explícito:

```ts
export const PRIMARY_MODULE_IDS = [
  'dashboard',
  'central-operacional',
  'controle-equipamentos',
  'manutencao',
  'colaboradores',
  'presenca',
  'materiais',
  'relatorios',
  'administracao',
] as const;
```

Não mover destinos de `AUXILIARY_MODULE_DESTINATIONS` para a sidebar.

- [ ] **Step 4: Rodar o teste unitário e a suite para verificar a decisão**

Run: `npx tsx tests/sidebarNavigation.test.ts && npm test`

Expected: o teste de navegação e a suíte completa passam.

- [ ] **Step 5: Revisar o diff e criar commit focado**

```bash
git diff --check
git add src/app/navigation/navigation.ts tests/sidebarNavigation.test.ts tests/run.ts
git commit -m "test: alinhar contrato da sidebar compacta"
```


### Task 2: Corrigir o contrato TypeScript da Central Operacional

**Files:**
- Modify: `src/components/CentralOperacionalTab.tsx:1-320`
- Test: `tests/centralOperacional.test.ts` (criar se não existir e registrar em `tests/run.ts`)

**Interfaces:**
- Consumes: props já fornecidas em `src/App.tsx:4624-4646`: `frentes: FrenteServico[]`, `apontamentos`, `movimentosMaterial`, `servicos`, `producao`, `ocorrencias`, `funcionarios` e os cinco callbacks `onSave*`.
- Produces: `CentralOperacionalTabProps` que declara todos os valores usados na renderização e permite `tsc --noEmit` passar.

- [ ] **Step 1: Criar o teste de contrato de props da Central**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/CentralOperacionalTab.tsx', import.meta.url), 'utf8');

test('Central Operacional declara os dados que entrega às subabas', () => {
  for (const prop of [
    'apontamentos:',
    'movimentosMaterial:',
    'servicos:',
    'producao:',
    'ocorrencias:',
    'funcionarios:',
    'onSaveFrente:',
    'onSaveServico:',
    'onSaveProducao:',
    'onSaveOcorrencia:',
  ]) {
    assert.match(source, new RegExp(prop));
  }
});
```

- [ ] **Step 2: Rodar o novo teste e o typecheck para confirmar a falha atual**

Run: `npx tsx tests/centralOperacional.test.ts && npm run lint`

Expected: o typecheck falha por nomes não declarados e incompatibilidade de `FrenteServico[]`.

- [ ] **Step 3: Corrigir somente a interface e os encaminhamentos já fornecidos pelo App**

No `CentralOperacionalTab.tsx`:

1. Importar os tipos de domínio já existentes usados pelas subabas (`ApontamentoOperacional`, `MovimentoMaterial`, `ServicoObra`, `RegistroProducao`, `Ocorrencia`, `Funcionario`, `FrenteServico`).
2. Declarar no tipo de props as coleções que já chegam em `App.tsx`.
3. Declarar os quatro callbacks de save com as assinaturas equivalentes aos handlers atuais do `App.tsx`.
4. Passar `frentes` diretamente às subabas que exigem `FrenteServico[]`; não usar a projeção resumida como substituta de entidade.
5. Manter qualquer resumo `{ nome, equipes, pessoas, presentes }` apenas para cartões/visualizações que realmente aceitem a projeção resumida.

Use o padrão abaixo para o trecho de interface, adaptando apenas tipos já existentes no projeto:

```ts
interface CentralOperacionalTabProps {
  equipamentos: Equipamento[];
  controlesEquipamentos: ControleEquipamentoDiario[];
  gruposEquipe: GrupoEquipe[];
  presencasLink: PresencaApontamento[];
  ordensServico: OrdemServico[];
  ticketsJazida: TicketJazida[];
  obras: ObraLocal[];
  frentes: FrenteServico[];
  apontamentos: ApontamentoOperacional[];
  movimentosMaterial: MovimentoMaterial[];
  servicos: ServicoObra[];
  producao: RegistroProducao[];
  ocorrencias: Ocorrencia[];
  funcionarios: Funcionario[];
  podeAtualizar: boolean;
  responsavel: string;
  onSaveControleEquipamento: (registro: ControleEquipamentoDiario, isNew: boolean) => void;
  onSaveFrente: (frente: FrenteServico, isNew: boolean) => void;
  onSaveServico: (servico: ServicoObra, isNew: boolean) => void;
  onSaveProducao: (registro: RegistroProducao, isNew: boolean) => void;
  onSaveOcorrencia: (ocorrencia: Ocorrencia, isNew: boolean) => void;
  onNavigate: (tab: string) => void;
}
```

- [ ] **Step 4: Verificar a correção do contrato**

Run: `npx tsx tests/centralOperacional.test.ts && npm run lint`

Expected: PASS; nenhum erro TypeScript em `CentralOperacionalTab.tsx`.

- [ ] **Step 5: Rodar a suíte completa e fazer commit**

```bash
npm test
git diff --check
git add src/components/CentralOperacionalTab.tsx tests/centralOperacional.test.ts tests/run.ts
git commit -m "fix: restaurar contrato da Central Operacional"
```


### Task 3: Aplicar a regra de OS automática à importação de frota

**Files:**
- Modify: `src/utils/manutencao.ts`
- Modify: `src/App.tsx:3563-3576`
- Modify: `tests/manutencao.test.ts`
- Modify: `tests/run.ts` somente se `manutencao.test.ts` não estiver registrado

**Interfaces:**
- Consumes: `garantirOrdemAutomaticaDaFrota(registro, ordens, responsavel)` já existente.
- Produces: `garantirOrdensAutomaticasDaFrota(registros, ordens, responsavel)` que retorna `{ registros, ordens, criadas }`.
- Consumers: `handleImportControleEquipamentosDiario` deve usar o retorno após `mergeImportedRecords` e persistir ambos os conjuntos em memória/localStorage.

- [ ] **Step 1: Adicionar dois testes de regra de importação**

Em `tests/manutencao.test.ts`, importar `garantirOrdensAutomaticasDaFrota` e adicionar testes com fixtures mínimas já usadas no arquivo:

```ts
test('importação cria uma OS para o basculante que entrou em manutenção', () => {
  const result = garantirOrdensAutomaticasDaFrota([
    {
      id: 'controle-cb-01',
      equipamentoId: 'equipamento-cb-01',
      prefixo: 'CB-01',
      data: '2026-09-19',
      status: 'Em manutenção',
      motivoManutencao: 'Pneu danificado',
    } as ControleEquipamentoDiario,
  ], [], 'Operação');

  assert.equal(result.criadas, 1);
  assert.equal(result.ordens.length, 1);
  assert.equal(result.ordens[0].equipamentoId, 'equipamento-cb-01');
  assert.equal(result.registros[0].ordemServicoId, result.ordens[0].id);
});

test('importação reutiliza OS aberta e não duplica ordem para o mesmo equipamento', () => {
  const aberta = {
    id: 'os-existente',
    numero: 'OS-0007',
    equipamentoId: 'equipamento-cb-01',
    status: 'Em Andamento',
  } as OrdemServico;

  const result = garantirOrdensAutomaticasDaFrota([
    {
      id: 'controle-cb-02',
      equipamentoId: 'equipamento-cb-01',
      prefixo: 'CB-01',
      data: '2026-09-19',
      status: 'Aguardando manutenção',
    } as ControleEquipamentoDiario,
  ], [aberta], 'Operação');

  assert.equal(result.criadas, 0);
  assert.equal(result.ordens.length, 1);
  assert.equal(result.registros[0].ordemServicoId, 'os-existente');
});
```

- [ ] **Step 2: Rodar o teste para confirmar que a nova função ainda não existe**

Run: `npx tsx tests/manutencao.test.ts`

Expected: FAIL com erro de exportação/identificador inexistente.

- [ ] **Step 3: Implementar a função pura de processamento em lote**

Adicionar em `src/utils/manutencao.ts`, logo após `garantirOrdemAutomaticaDaFrota`:

```ts
export const garantirOrdensAutomaticasDaFrota = (
  registros: ControleEquipamentoDiario[],
  ordens: OrdemServico[],
  responsavel: string,
) => registros.reduce(
  (result, registro) => {
    const maintenance = garantirOrdemAutomaticaDaFrota(registro, result.ordens, responsavel);
    return {
      registros: [...result.registros, maintenance.registro],
      ordens: maintenance.ordens,
      criadas: result.criadas + Number(maintenance.criada),
    };
  },
  {
    registros: [] as ControleEquipamentoDiario[],
    ordens,
    criadas: 0,
  },
);
```

Não usar `Date.now()` adicional e não criar OS fora de `garantirOrdemAutomaticaDaFrota`; ela continua sendo a única regra que decide criar/reutilizar uma ordem.

- [ ] **Step 4: Integrar após o merge da importação no `App.tsx`**

Adicionar a importação da função e transformar o handler em:

```ts
const result = mergeImportedRecords(/* parâmetros atuais */);
const maintenance = garantirOrdensAutomaticasDaFrota(result.next, ordensServico, activeUserName);
```

No callback de `saveAndLog`:

```ts
setControleEquipamentosDiario(maintenance.registros);
writeStorageValue(localStorage, 'renea_controle_equipamentos_diario', JSON.stringify(maintenance.registros));

if (maintenance.ordens !== ordensServico) {
  setOrdensServico(maintenance.ordens);
  writeStorageValue(localStorage, 'renea_ordens_servico', JSON.stringify(maintenance.ordens));
}
```

Atualizar a descrição da auditoria sem inventar números:

```ts
const automaticOrders = maintenance.criadas
  ? ` ${maintenance.criadas} OS automática(s) aberta(s) para equipamentos em manutenção.`
  : '';
```

Acrescentar `automaticOrders` ao texto já existente. Não alterar o merge/import preview e não apagar OS que não tenham relação com os registros importados.

- [ ] **Step 5: Rodar testes específicos e typecheck**

Run: `npx tsx tests/manutencao.test.ts && npm run lint`

Expected: PASS. A importação compartilha a regra de OS do salvamento manual.

- [ ] **Step 6: Rodar suite e commit focado**

```bash
npm test
git diff --check
git add src/utils/manutencao.ts src/App.tsx tests/manutencao.test.ts tests/run.ts
git commit -m "fix: criar OS automática na importação de frota"
```


### Task 4: Verificação de entrega e revisão de alterações

**Files:**
- Modify: nenhum arquivo de aplicação; corrigir somente falhas confirmadas originadas pelas Tasks 1–3.

**Interfaces:**
- Consumes: alterações das Tasks 1–3.
- Produces: baseline validado para iniciar extração de domínio de Frota/Manutenção na próxima fase.

- [ ] **Step 1: Executar todos os quality gates locais**

```bash
npm run lint
npm test
npm run build
```

Expected: todos retornam código 0.

- [ ] **Step 2: Executar E2E do projeto se o ambiente local estiver disponível**

Run: `npm run e2e`

Expected: Playwright passa usando o harness local configurado. Se o navegador/servidor local falhar por infraestrutura, registrar a saída exata e não alegar aprovação.

- [ ] **Step 3: Fazer revisão de código das mudanças da fase**

Usar `pr-review-toolkit:code-reviewer` no diff não enviado, com foco em:

- preservação da regra de não duplicar OS aberta;
- persistência equivalente de controle e OS após importação;
- contrato completo de props da Central;
- não inclusão de arquivos gerados/artefatos.

- [ ] **Step 4: Revisar status e preparar o resumo**

```bash
git status --short
git log --oneline -n 4
git diff origin/main...HEAD --stat
```

Expected: somente arquivos intencionais da fase, commits pequenos e nenhum segredo/artefato novo rastreado.
