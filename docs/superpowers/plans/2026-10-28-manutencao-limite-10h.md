# Manutenção com limite de 10 h: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** contar horas paradas por dia a partir da linha do tempo de eventos, com DDS e almoço descontados e limite de 10 h, fechar a OS no limite, conferir e relatar o dia.

**Architecture:** um módulo puro (`src/utils/horasParadasDoDia.ts`) transforma os eventos de um `ControleEquipamentoDiario` em períodos e horas. Outros módulos puros usam esse cálculo para fechar OS, aplicar as decisões da conferência e montar o relatório. A tela de Manutenção só exibe e chama esses módulos.

**Tech Stack:** React 19 + TypeScript, Tailwind, testes `node:test` rodados por `tsx` (`npm test` lê `tests/run.ts`), exportação Excel do projeto (`src/utils/fleetExcelExport.ts` como referência).

**Spec:** `docs/superpowers/specs/2026-10-28-manutencao-limite-10h-design.md`

## Global Constraints

- Limite: 10 h paradas por equipamento por dia (`LIMITE_HORAS_DIA = 10`).
- DDS, código 15: 07:00 às 07:15. Almoço, código 13: 12:00 às 13:00. Desconto só da parte sobreposta.
- Dia que começa com o equipamento ainda parado (marcado "continua parado amanhã"): período começa às 07:00.
- Fuso de todo horário de relógio: `America/Sao_Paulo`.
- Dado errado não vira número: situação `INCONSISTENTE`.
- Nada é apagado. Toda mudança automática ou da conferência registra evento ou `historyLogs` com responsável.
- Responder e escrever textos de tela em português. Telas seguem `docs/superpowers/CHECKLIST_REDESIGN_ABAS.md`, botões com no mínimo 44 px no celular.
- Todo teste novo entra em `tests/run.ts`. `tests/padraoAbas.test.ts` e `tests/repoHygiene.test.ts` não podem ser afrouxados.

## Mapa de arquivos

| Arquivo | Papel |
|---|---|
| `src/types.ts` | `EventoControleEquipamentoDiario.hora?` e `ControleEquipamentoDiario.conferenciaManutencao?` |
| `src/utils/horasParadasDoDia.ts` (novo) | cálculo puro do dia |
| `src/utils/manutencaoLimite.ts` (novo) | fechar OS no limite e decisões da conferência |
| `src/utils/relatorioManutencaoDia.ts` (novo) | linhas e totais do relatório, grupos da conferência |
| `src/modules/frota/quadroFrota.ts`, `src/components/fleet/DailyRecordForm.tsx`, `src/utils/manutencao.ts` | gravar `hora` nos eventos |
| `src/components/manutencao/` (novo) | `ManutencaoHoje.tsx`, `CartaoParada.tsx`, `ConferenciaManutencao.tsx`, `RelatorioManutencaoDia.tsx` |
| `src/components/ManutencaoTab.tsx` | subtelas novas, props novas |
| `src/App.tsx` | passa registros e callbacks, roda o fechamento automático |
| `tests/horasParadasDoDia.test.ts`, `tests/manutencaoLimite.test.ts`, `tests/relatorioManutencaoDia.test.ts` (novos) | testes |

---

### Task 1: Cálculo das horas paradas do dia

**Files:**
- Modify: `src/types.ts` (interface `EventoControleEquipamentoDiario`, por volta da linha 1307)
- Create: `src/utils/horasParadasDoDia.ts`
- Create: `tests/horasParadasDoDia.test.ts`
- Modify: `tests/run.ts`

**Interfaces:**
- Produces:
  - `LIMITE_HORAS_DIA = 10`, `PAUSAS_DO_DIA: Pausa[]`
  - `type SituacaoParada = 'LIBERADO' | 'PARADO' | 'LIMITE_ATINGIDO' | 'INCONSISTENTE'`
  - `interface PeriodoParado { inicio: string; fim: string | null; descontoMin: number; liquidoMin: number }` (horas `HH:MM`, `fim: null` = em aberto)
  - `interface ParadaDoDia { data: string; periodos: PeriodoParado[]; totalMin: number; brutoMin: number; situacao: SituacaoParada; limiteAtingidoAs: string | null; motivoInconsistencia?: string }`
  - `horasParadasDoDia(registro: ControleEquipamentoDiario, agora: Date, opcoes?: { vemParadoDeOntem?: boolean }): ParadaDoDia`
  - `horaLocal(iso: string): string` (`HH:MM` em America/Sao_Paulo)
  - `formatarMinutos(min: number): string` (`5 h 45`)

- [ ] **Step 1: tipo do evento ganha a hora informada**

Em `src/types.ts`, dentro de `EventoControleEquipamentoDiario`, depois de `ocorridoEm`:

```ts
  /** Hora informada do fato (HH:MM, horário de Brasília). ocorridoEm é quando foi digitado. */
  hora?: string;
```

- [ ] **Step 2: escrever o teste que falha**

`tests/horasParadasDoDia.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { formatarMinutos, horasParadasDoDia } from '../src/utils/horasParadasDoDia';
import type { ControleEquipamentoDiario, EventoControleEquipamentoDiario } from '../src/types';

const DIA = '2026-10-28';
const agoraEm = (hora: string) => new Date(`${DIA}T${hora}:00-03:00`);
const ONTEM_DEPOIS = new Date('2026-10-29T08:00:00-03:00');

const ev = (tipo: EventoControleEquipamentoDiario['tipo'], hora: string, n: number): EventoControleEquipamentoDiario => ({
  id: `evt-${n}`,
  ocorridoEm: `${DIA}T15:00:00.000Z`,
  hora,
  tipo,
  statusNovo: tipo === 'ENTRADA_MANUTENCAO' ? 'Em manutenção' : 'Disponível',
});

const registro = (eventos: EventoControleEquipamentoDiario[], extra: Partial<ControleEquipamentoDiario> = {}): ControleEquipamentoDiario => ({
  id: 'r1', chave: `${DIA}|eq1`, data: DIA, funcionarioId: '', codigoFuncionario: '', nomeMotorista: '',
  equipamentoId: 'eq1', prefixo: 'CB767', familia: 'Basculantes', status: 'Em manutenção',
  horaSaida: '', horaEntradaManutencao: '', horaLiberacao: '', observacao: '', origem: 'SISTEMA',
  revisao: [], criadoEm: `${DIA}T10:00:00.000Z`, atualizadoEm: `${DIA}T10:00:00.000Z`,
  eventos, ...extra,
});

const E = 'ENTRADA_MANUTENCAO' as const;
const L = 'LIBERACAO_MANUTENCAO' as const;

test('07:00 a 14:00 desconta DDS e almoço: 5 h 45', () => {
  const r = horasParadasDoDia(registro([ev(E, '07:00', 1), ev(L, '14:00', 2)]), agoraEm('18:00'));
  assert.equal(r.totalMin, 345);
  assert.equal(r.situacao, 'LIBERADO');
  assert.equal(formatarMinutos(r.totalMin), '5 h 45');
});

test('07:30 a 10:00 sem pausa no meio: 2 h 30', () => {
  const r = horasParadasDoDia(registro([ev(E, '07:30', 1), ev(L, '10:00', 2)]), agoraEm('18:00'));
  assert.equal(r.totalMin, 150);
});

test('entrada 10:00 sem liberação, agora 15:00: 4 h e segue parado', () => {
  const r = horasParadasDoDia(registro([ev(E, '10:00', 1)]), agoraEm('15:00'));
  assert.equal(r.totalMin, 240);
  assert.equal(r.situacao, 'PARADO');
  assert.equal(r.periodos[0].fim, null);
});

test('entrada 07:00 sem liberação em dia passado: 10 h e limite', () => {
  const r = horasParadasDoDia(registro([ev(E, '07:00', 1)]), ONTEM_DEPOIS);
  assert.equal(r.totalMin, 600);
  assert.equal(r.situacao, 'LIMITE_ATINGIDO');
  assert.equal(r.limiteAtingidoAs, '18:15');
});

test('dois períodos no dia somam: 3 h 30', () => {
  const r = horasParadasDoDia(registro([ev(E, '09:30', 1), ev(L, '11:00', 2), ev(E, '14:00', 3), ev(L, '16:00', 4)]), agoraEm('18:00'));
  assert.equal(r.totalMin, 210);
  assert.equal(r.periodos.length, 2);
});

test('entrada às 12:30 desconta só meia hora de almoço', () => {
  const r = horasParadasDoDia(registro([ev(E, '12:30', 1), ev(L, '14:00', 2)]), agoraEm('18:00'));
  assert.equal(r.totalMin, 60);
});

test('entrada repetida com o equipamento já parado não abre outro período', () => {
  const r = horasParadasDoDia(registro([ev(E, '09:16', 1), ev(E, '09:20', 2), ev(E, '09:25', 3), ev(L, '11:16', 4)]), agoraEm('18:00'));
  assert.equal(r.periodos.length, 1);
  assert.equal(r.totalMin, 120);
});

test('liberação antes da entrada é inconsistente e não vira número', () => {
  const r = horasParadasDoDia(registro([ev(L, '08:00', 1), ev(E, '09:00', 2), ev(L, '08:30', 3)]), agoraEm('18:00'));
  assert.equal(r.situacao, 'INCONSISTENTE');
});

test('hora em branco ou inválida é inconsistente', () => {
  const r = horasParadasDoDia(registro([ev(E, '25:99', 1)]), agoraEm('18:00'));
  assert.equal(r.situacao, 'INCONSISTENTE');
});

test('registro antigo sem hora nos eventos usa horaEntradaManutencao e horaLiberacao', () => {
  const antigo = registro([{ id: 'x', ocorridoEm: `${DIA}T12:12:00.000Z`, tipo: E, statusNovo: 'Em manutenção' }], {
    horaEntradaManutencao: '07:00', horaLiberacao: '14:00', status: 'Disponível',
  });
  assert.equal(horasParadasDoDia(antigo, agoraEm('18:00')).totalMin, 345);
});

test('vem parado de ontem: começa às 07:00', () => {
  const r = horasParadasDoDia(registro([ev(L, '09:00', 1)]), agoraEm('18:00'), { vemParadoDeOntem: true });
  assert.equal(r.periodos[0].inicio, '07:00');
  assert.equal(r.totalMin, 105);
});

test('equipamento que não parou no dia dá zero e liberado', () => {
  const r = horasParadasDoDia(registro([], { status: 'Em operação' }), agoraEm('18:00'));
  assert.equal(r.totalMin, 0);
  assert.equal(r.periodos.length, 0);
});
```

Em `tests/run.ts`, depois de `import './manutencaoHistorico.test';` (ou ao fim da lista, se essa linha não existir):

```ts
import './horasParadasDoDia.test';
```

- [ ] **Step 3: confirmar que falha**

Run: `node node_modules/tsx/dist/cli.mjs tests/horasParadasDoDia.test.ts`
Expected: FAIL com `Cannot find module '../src/utils/horasParadasDoDia'`.

- [ ] **Step 4: implementar**

`src/utils/horasParadasDoDia.ts`:

```ts
import type { ControleEquipamentoDiario, EventoControleEquipamentoDiario } from '../types';

export const LIMITE_HORAS_DIA = 10;
const LIMITE_MIN = LIMITE_HORAS_DIA * 60;
const INICIO_DO_DIA = '07:00';
const FIM_DO_DIA_MIN = 24 * 60;

export interface Pausa { codigo: string; nome: string; inicio: string; fim: string }

/** Pausas fixas da obra: só a parte que cai dentro do período parado é descontada. */
export const PAUSAS_DO_DIA: readonly Pausa[] = [
  { codigo: '15', nome: 'DDS', inicio: '07:00', fim: '07:15' },
  { codigo: '13', nome: 'Almoço', inicio: '12:00', fim: '13:00' },
];

export type SituacaoParada = 'LIBERADO' | 'PARADO' | 'LIMITE_ATINGIDO' | 'INCONSISTENTE';

export interface PeriodoParado {
  inicio: string;
  /** null enquanto não houve liberação. */
  fim: string | null;
  descontoMin: number;
  liquidoMin: number;
}

export interface ParadaDoDia {
  data: string;
  periodos: PeriodoParado[];
  /** Já com descontos e limite. */
  totalMin: number;
  /** Com descontos, antes do limite. */
  brutoMin: number;
  situacao: SituacaoParada;
  limiteAtingidoAs: string | null;
  motivoInconsistencia?: string;
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const paraMin = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
const paraHora = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const horaLocal = (iso: string): string => new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date(iso));

const dataLocal = (momento: Date): string => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(momento);

export const formatarMinutos = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
};

const descontoDoPeriodo = (inicio: number, fim: number) => PAUSAS_DO_DIA.reduce((total, pausa) => {
  const sobreposto = Math.min(fim, paraMin(pausa.fim)) - Math.max(inicio, paraMin(pausa.inicio));
  return total + Math.max(0, sobreposto);
}, 0);

type Marco = { tipo: 'entrada' | 'liberacao'; hora: string };

/** Eventos com hora informada; registro antigo sem hora usa os campos do dia. */
const marcosDoRegistro = (registro: ControleEquipamentoDiario): Marco[] | string => {
  const relevantes = (registro.eventos || []).filter(evento =>
    evento.tipo === 'ENTRADA_MANUTENCAO' || evento.tipo === 'LIBERACAO_MANUTENCAO');
  const comHora = relevantes.filter((evento): evento is EventoControleEquipamentoDiario & { hora: string } => Boolean(evento.hora));
  if (comHora.length === 0) {
    const marcos: Marco[] = [];
    if (registro.horaEntradaManutencao) marcos.push({ tipo: 'entrada', hora: registro.horaEntradaManutencao });
    if (registro.horaLiberacao) marcos.push({ tipo: 'liberacao', hora: registro.horaLiberacao });
    return marcos;
  }
  const invalida = comHora.find(evento => !HORA.test(evento.hora));
  if (invalida) return `Hora inválida no lançamento: "${invalida.hora}".`;
  return comHora.map(evento => ({
    tipo: evento.tipo === 'ENTRADA_MANUTENCAO' ? 'entrada' as const : 'liberacao' as const,
    hora: evento.hora,
  }));
};

export const horasParadasDoDia = (
  registro: ControleEquipamentoDiario,
  agora: Date,
  opcoes: { vemParadoDeOntem?: boolean } = {},
): ParadaDoDia => {
  const base = { data: registro.data, periodos: [] as PeriodoParado[], totalMin: 0, brutoMin: 0, limiteAtingidoAs: null };
  const marcos = marcosDoRegistro(registro);
  if (typeof marcos === 'string') return { ...base, situacao: 'INCONSISTENTE', motivoInconsistencia: marcos };

  const hoje = dataLocal(agora);
  const ateMin = registro.data === hoje ? paraMin(horaLocal(agora.toISOString())) : FIM_DO_DIA_MIN;

  const periodos: Array<{ inicio: number; fim: number | null }> = [];
  let aberto: number | null = opcoes.vemParadoDeOntem ? paraMin(INICIO_DO_DIA) : null;
  for (const marco of marcos) {
    const minuto = paraMin(marco.hora);
    if (marco.tipo === 'entrada') {
      // Entrada repetida com o equipamento já parado não abre outro período.
      if (aberto === null) aberto = minuto;
      continue;
    }
    if (aberto === null) {
      return { ...base, situacao: 'INCONSISTENTE', motivoInconsistencia: `Liberação às ${marco.hora} sem entrada antes.` };
    }
    if (minuto < aberto) {
      return { ...base, situacao: 'INCONSISTENTE', motivoInconsistencia: `Liberação às ${marco.hora} antes da entrada às ${paraHora(aberto)}.` };
    }
    periodos.push({ inicio: aberto, fim: minuto });
    aberto = null;
  }
  if (aberto !== null) periodos.push({ inicio: aberto, fim: null });

  let acumulado = 0;
  let limiteAtingidoAs: string | null = null;
  const detalhados = periodos.map(periodo => {
    const fimEfetivo = Math.max(periodo.inicio, periodo.fim ?? ateMin);
    const descontoMin = descontoDoPeriodo(periodo.inicio, fimEfetivo);
    const liquidoMin = fimEfetivo - periodo.inicio - descontoMin;
    if (limiteAtingidoAs === null && acumulado + liquidoMin >= LIMITE_MIN) {
      // Caminha minuto a minuto só dentro do período que cruzou o limite.
      let falta = LIMITE_MIN - acumulado;
      let minuto = periodo.inicio;
      while (falta > 0 && minuto < fimEfetivo) {
        if (descontoDoPeriodo(minuto, minuto + 1) === 0) falta -= 1;
        minuto += 1;
      }
      limiteAtingidoAs = paraHora(minuto);
    }
    acumulado += liquidoMin;
    return {
      inicio: paraHora(periodo.inicio),
      fim: periodo.fim === null ? null : paraHora(periodo.fim),
      descontoMin,
      liquidoMin,
    };
  });

  const brutoMin = acumulado;
  const totalMin = Math.min(brutoMin, LIMITE_MIN);
  const situacao: SituacaoParada = brutoMin >= LIMITE_MIN
    ? 'LIMITE_ATINGIDO'
    : detalhados.some(periodo => periodo.fim === null) ? 'PARADO' : 'LIBERADO';
  return { data: registro.data, periodos: detalhados, totalMin, brutoMin, situacao, limiteAtingidoAs };
};
```

- [ ] **Step 5: confirmar que passa**

Run: `node node_modules/tsx/dist/cli.mjs tests/horasParadasDoDia.test.ts`
Expected: `# pass 12`, `# fail 0`.

- [ ] **Step 6: commit**

```bash
git add src/types.ts src/utils/horasParadasDoDia.ts tests/horasParadasDoDia.test.ts tests/run.ts
git commit -m "feat(manutencao): calcula horas paradas do dia com DDS, almoço e limite de 10 h"
```

---

### Task 2: Gravar a hora informada nos eventos

**Files:**
- Modify: `src/modules/frota/quadroFrota.ts` (função `registroDaEdicao`, evento por volta da linha 440)
- Modify: `src/components/fleet/DailyRecordForm.tsx` (onde monta o evento com `eventTypeForStatus`)
- Modify: `src/utils/manutencao.ts` (`liberarMaquinasDaOrdemConcluida`, evento da linha 133)
- Test: `tests/quadroFrota.test.ts`, `tests/manutencao.test.ts`

**Interfaces:**
- Consumes: `EventoControleEquipamentoDiario.hora` (Task 1).
- Produces: todo evento novo de `ENTRADA_MANUTENCAO` e `LIBERACAO_MANUTENCAO` tem `hora` igual à hora informada no formulário (a mesma gravada em `horaEntradaManutencao`/`horaLiberacao`).

- [ ] **Step 1: teste que falha (Quadro)**

Em `tests/quadroFrota.test.ts`, usando o mesmo montador de entrada dos testes de `registroDaEdicao` já existentes no arquivo:

```ts
test('evento de entrada em manutenção guarda a hora informada', () => {
  const resultado = registroDaEdicao({ ...entradaBase, hora: '07:30', edicao: { ...entradaBase.edicao, status: 'Em manutenção', motivoManutencao: 'Pneu' } });
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;
  const evento = resultado.registro.eventos?.at(-1);
  assert.equal(evento?.tipo, 'ENTRADA_MANUTENCAO');
  assert.equal(evento?.hora, '07:30');
});
```

(`entradaBase` é o objeto de entrada que o arquivo já usa; se tiver outro nome, use o nome existente.)

- [ ] **Step 2: teste que falha (liberação pela OS)**

Em `tests/manutencao.test.ts`:

```ts
test('liberação pela OS concluída grava a hora no evento', () => {
  const ordem = { ...ordemBase, status: 'Concluída' as const };
  const { registros } = liberarMaquinasDaOrdemConcluida(ordem, [registroBasculante({ ordemServicoId: ordem.id })], 'oficina', '2026-09-18T17:40:00.000Z');
  assert.equal(registros[0].eventos?.at(-1)?.hora, '14:40');
});
```

(`ordemBase`: a OS de teste já usada no arquivo.)

- [ ] **Step 3: confirmar que falham**

Run: `node node_modules/tsx/dist/cli.mjs tests/quadroFrota.test.ts` e `node node_modules/tsx/dist/cli.mjs tests/manutencao.test.ts`
Expected: FAIL nos dois testes novos (`hora` undefined; na OS, `'17:40'` ≠ `'14:40'` se usar `slice` de UTC).

- [ ] **Step 4: implementar**

`src/modules/frota/quadroFrota.ts`, no objeto do evento dentro de `registroDaEdicao`, depois de `ocorridoEm: agora,`:

```ts
      hora: tipo === 'ENTRADA_MANUTENCAO' || tipo === 'LIBERACAO_MANUTENCAO' ? hora : undefined,
```

`src/components/fleet/DailyRecordForm.tsx`, no evento montado ao salvar, depois de `ocorridoEm`:

```ts
      hora: tipo === 'ENTRADA_MANUTENCAO' ? form.maintenanceEntryTime : tipo === 'LIBERACAO_MANUTENCAO' ? form.releaseTime : undefined,
```

(use os nomes de campo do `FormState` do arquivo para entrada e liberação; são os mesmos que alimentam `horaEntradaManutencao` e `horaLiberacao`.)

`src/utils/manutencao.ts`, em `liberarMaquinasDaOrdemConcluida`: trocar `const hora = agora.slice(11, 16);` por `const hora = horaLocal(agora);` (import de `./horasParadasDoDia`) e acrescentar `hora` ao evento:

```ts
      hora,
```

- [ ] **Step 5: confirmar que passam**

Run os dois arquivos do Step 3. Expected: PASS, sem quebrar os testes antigos.

- [ ] **Step 6: commit**

```bash
git add src/modules/frota/quadroFrota.ts src/components/fleet/DailyRecordForm.tsx src/utils/manutencao.ts tests/quadroFrota.test.ts tests/manutencao.test.ts
git commit -m "feat(frota): eventos de manutenção guardam a hora informada"
```

---

### Task 3: Fechar OS no limite e decisões da conferência

**Files:**
- Modify: `src/types.ts` (interface `ControleEquipamentoDiario`)
- Create: `src/utils/manutencaoLimite.ts`
- Create: `tests/manutencaoLimite.test.ts`
- Modify: `tests/run.ts`

**Interfaces:**
- Consumes: `horasParadasDoDia`, `horaLocal` (Task 1); `isOrdemEncerrada` (`src/utils/manutencao.ts`).
- Produces:
  - tipo `ConferenciaManutencao = { decisao: 'CONFIRMADO_10H' | 'LIBERACAO_INFORMADA' | 'CONTINUA_AMANHA'; decididoEm: string; decididoPor: string; observacao?: string }`
  - `ControleEquipamentoDiario.conferenciaManutencao?: ConferenciaManutencao`
  - `OBSERVACAO_LIMITE = 'Encerrada pelo limite de 10 h paradas no dia.'`
  - `encerrarOrdensNoLimite(registros, ordens, agora: Date, responsavel): { ordens: OrdemServico[]; encerradas: OrdemServico[] }`
  - `confirmarDezHoras(registro, responsavel, agoraIso): ControleEquipamentoDiario`
  - `informarLiberacaoReal(registro, hora: string, responsavel, agoraIso): ControleEquipamentoDiario`
  - `continuaParadoAmanha(registro, responsavel, agoraIso): ControleEquipamentoDiario`
  - `vemParadoDeOntem(registros, registro): boolean`: o registro do dia anterior do mesmo equipamento tem `conferenciaManutencao.decisao === 'CONTINUA_AMANHA'`.

- [ ] **Step 1: tipo**

Em `src/types.ts`, antes de `export interface ControleEquipamentoDiario`:

```ts
export interface ConferenciaManutencao {
  decisao: 'CONFIRMADO_10H' | 'LIBERACAO_INFORMADA' | 'CONTINUA_AMANHA';
  decididoEm: string;
  decididoPor: string;
  observacao?: string;
}
```

E dentro de `ControleEquipamentoDiario`, depois de `aprovacao?`:

```ts
  /** Decisão da conferência quando o dia bateu 10 h ou ficou inconsistente. */
  conferenciaManutencao?: ConferenciaManutencao;
```

- [ ] **Step 2: testes que falham**

`tests/manutencaoLimite.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OBSERVACAO_LIMITE, confirmarDezHoras, continuaParadoAmanha, encerrarOrdensNoLimite, informarLiberacaoReal, vemParadoDeOntem,
} from '../src/utils/manutencaoLimite';
import { horasParadasDoDia } from '../src/utils/horasParadasDoDia';
import type { ControleEquipamentoDiario, OrdemServico } from '../src/types';

const DIA = '2026-10-28';
const registro = (extra: Partial<ControleEquipamentoDiario> = {}): ControleEquipamentoDiario => ({
  id: 'r1', chave: `${DIA}|eq1`, data: DIA, funcionarioId: '', codigoFuncionario: '', nomeMotorista: '',
  equipamentoId: 'eq1', prefixo: 'CB767', familia: 'Basculantes', status: 'Em manutenção',
  horaSaida: '', horaEntradaManutencao: '07:00', horaLiberacao: '', observacao: '', origem: 'SISTEMA',
  revisao: [], criadoEm: '', atualizadoEm: '', ordemServicoId: 'os1',
  eventos: [{ id: 'e1', ocorridoEm: `${DIA}T10:00:00.000Z`, hora: '07:00', tipo: 'ENTRADA_MANUTENCAO', statusNovo: 'Em manutenção' }],
  ...extra,
});
const ordem: OrdemServico = {
  id: 'os1', numero: 'OS-0041', equipamentoId: 'eq1', tipo: 'Corretiva', prioridade: 'Média', descricao: '',
  status: 'Aberta', dataAbertura: DIA, horaAbertura: '07:00', responsavel: 'frota', observacao: '',
};

test('OS aberta de um dia que bateu 10 h fecha na hora do limite', () => {
  const { ordens, encerradas } = encerrarOrdensNoLimite([registro()], [ordem], new Date('2026-10-29T08:00:00-03:00'), 'sistema');
  assert.equal(encerradas.length, 1);
  assert.equal(ordens[0].status, 'Concluída');
  assert.equal(ordens[0].dataConclusao, DIA);
  assert.equal(ordens[0].horaConclusao, '18:15');
  assert.match(ordens[0].observacao, new RegExp(OBSERVACAO_LIMITE));
});

test('OS abaixo do limite continua aberta', () => {
  const { encerradas } = encerrarOrdensNoLimite([registro()], [ordem], new Date(`${DIA}T15:00:00-03:00`), 'sistema');
  assert.equal(encerradas.length, 0);
});

test('OS já encerrada não é tocada de novo', () => {
  const fechada = { ...ordem, status: 'Concluída' as const };
  const { encerradas } = encerrarOrdensNoLimite([registro()], [fechada], new Date('2026-10-29T08:00:00-03:00'), 'sistema');
  assert.equal(encerradas.length, 0);
});

test('informar liberação real grava evento e recalcula', () => {
  const r = informarLiberacaoReal(registro(), '11:00', 'deivid', '2026-10-29T11:00:00.000Z');
  assert.equal(r.horaLiberacao, '11:00');
  assert.equal(r.status, 'Disponível');
  assert.equal(r.eventos?.at(-1)?.hora, '11:00');
  assert.equal(r.conferenciaManutencao?.decisao, 'LIBERACAO_INFORMADA');
  assert.equal(horasParadasDoDia(r, new Date('2026-10-29T08:00:00-03:00')).totalMin, 225);
});

test('confirmar 10 h só registra a decisão', () => {
  const r = confirmarDezHoras(registro(), 'deivid', '2026-10-29T11:00:00.000Z');
  assert.equal(r.conferenciaManutencao?.decisao, 'CONFIRMADO_10H');
  assert.equal(r.status, 'Em manutenção');
});

test('continua parado amanhã faz o dia seguinte começar às 07:00', () => {
  const hoje = continuaParadoAmanha(registro(), 'deivid', '2026-10-29T11:00:00.000Z');
  const amanha = registro({ id: 'r2', data: '2026-10-29', chave: '2026-10-29|eq1', eventos: [], horaEntradaManutencao: '' });
  assert.equal(vemParadoDeOntem([hoje, amanha], amanha), true);
  assert.equal(vemParadoDeOntem([registro(), amanha], amanha), false);
});
```

Em `tests/run.ts`: `import './manutencaoLimite.test';`

- [ ] **Step 3: confirmar que falha**

Run: `node node_modules/tsx/dist/cli.mjs tests/manutencaoLimite.test.ts`
Expected: FAIL com módulo inexistente.

- [ ] **Step 4: implementar**

`src/utils/manutencaoLimite.ts`:

```ts
import type { ConferenciaManutencao, ControleEquipamentoDiario, EventoControleEquipamentoDiario, OrdemServico } from '../types';
import { horasParadasDoDia } from './horasParadasDoDia';
import { isOrdemEncerrada } from './manutencao';

export const OBSERVACAO_LIMITE = 'Encerrada pelo limite de 10 h paradas no dia.';

const diaAnterior = (data: string) => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export const vemParadoDeOntem = (registros: readonly ControleEquipamentoDiario[], registro: ControleEquipamentoDiario): boolean => {
  const ontem = diaAnterior(registro.data);
  return registros.some(item => item.equipamentoId === registro.equipamentoId && item.data === ontem
    && item.conferenciaManutencao?.decisao === 'CONTINUA_AMANHA');
};

/**
 * OS aberta cujo dia bateu 10 h fecha na hora do limite. O cálculo é o mesmo em
 * qualquer aparelho, então quem chegar primeiro grava e o resultado não muda.
 */
export const encerrarOrdensNoLimite = (
  registros: readonly ControleEquipamentoDiario[],
  ordens: readonly OrdemServico[],
  agora: Date,
  responsavel: string,
): { ordens: OrdemServico[]; encerradas: OrdemServico[] } => {
  const encerradas: OrdemServico[] = [];
  const proximas = ordens.map(ordem => {
    if (isOrdemEncerrada(ordem.status)) return ordem;
    const registro = registros.find(item => item.ordemServicoId === ordem.id
      && horasParadasDoDia(item, agora, { vemParadoDeOntem: vemParadoDeOntem(registros, item) }).situacao === 'LIMITE_ATINGIDO');
    if (!registro) return ordem;
    const parada = horasParadasDoDia(registro, agora, { vemParadoDeOntem: vemParadoDeOntem(registros, registro) });
    const fechada: OrdemServico = {
      ...ordem,
      status: 'Concluída',
      dataConclusao: registro.data,
      horaConclusao: parada.limiteAtingidoAs || undefined,
      horasParadas: parada.totalMin / 60,
      observacao: [ordem.observacao, OBSERVACAO_LIMITE].filter(Boolean).join(' '),
      atualizadoEm: agora.toISOString(),
    };
    encerradas.push(fechada);
    return fechada;
  });
  return { ordens: encerradas.length ? proximas : [...ordens], encerradas };
};

const decidir = (
  registro: ControleEquipamentoDiario,
  decisao: ConferenciaManutencao['decisao'],
  responsavel: string,
  agoraIso: string,
): ControleEquipamentoDiario => ({
  ...registro,
  conferenciaManutencao: { decisao, decididoEm: agoraIso, decididoPor: responsavel },
  atualizadoEm: agoraIso,
});

export const confirmarDezHoras = (registro: ControleEquipamentoDiario, responsavel: string, agoraIso: string) =>
  decidir(registro, 'CONFIRMADO_10H', responsavel, agoraIso);

export const continuaParadoAmanha = (registro: ControleEquipamentoDiario, responsavel: string, agoraIso: string) =>
  decidir(registro, 'CONTINUA_AMANHA', responsavel, agoraIso);

export const informarLiberacaoReal = (
  registro: ControleEquipamentoDiario,
  hora: string,
  responsavel: string,
  agoraIso: string,
): ControleEquipamentoDiario => {
  const evento: EventoControleEquipamentoDiario = {
    id: `evt-${agoraIso}-${registro.equipamentoId}-conferencia`,
    ocorridoEm: agoraIso,
    hora,
    tipo: 'LIBERACAO_MANUTENCAO',
    statusAnterior: registro.status,
    statusNovo: 'Disponível',
    observacao: 'Liberação informada na conferência.',
    responsavel,
  };
  return decidir({
    ...registro,
    status: 'Disponível',
    horaLiberacao: hora,
    eventos: [...(registro.eventos || []), evento],
  }, 'LIBERACAO_INFORMADA', responsavel, agoraIso);
};
```

- [ ] **Step 5: confirmar que passa**

Run: `node node_modules/tsx/dist/cli.mjs tests/manutencaoLimite.test.ts`
Expected: `# pass 6`, `# fail 0`.

- [ ] **Step 6: commit**

```bash
git add src/types.ts src/utils/manutencaoLimite.ts tests/manutencaoLimite.test.ts tests/run.ts
git commit -m "feat(manutencao): fecha OS no limite de 10 h e aplica decisões da conferência"
```

---

### Task 4: Relatório do dia e grupos da conferência

**Files:**
- Create: `src/utils/relatorioManutencaoDia.ts`
- Create: `tests/relatorioManutencaoDia.test.ts`
- Modify: `tests/run.ts`

**Interfaces:**
- Consumes: `horasParadasDoDia`, `ParadaDoDia`, `formatarMinutos` (Task 1); `vemParadoDeOntem` (Task 3).
- Produces:
  - `interface LinhaRelatorioManutencao { registroId: string; equipamentoId: string; prefixo: string; tipo: string; ordemNumero: string; parada: ParadaDoDia; grupo: 'OK' | 'LIMITE' | 'INCONSISTENTE'; conferido: boolean }`
  - `interface RelatorioManutencaoDia { data: string; linhas: LinhaRelatorioManutencao[]; totalMin: number; equipamentos: number; emConferencia: number; conferidos: number; aConferir: number; porTipo: Array<{ tipo: string; totalMin: number; equipamentos: number }>; fechado: boolean }`
  - `montarRelatorioManutencaoDia(data: string, registros, ordens, agora: Date): RelatorioManutencaoDia`
  - `linhasExcelManutencaoDia(relatorio): Array<Record<string, string | number>>` (um período por linha)

- [ ] **Step 1: testes que falham**

`tests/relatorioManutencaoDia.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { linhasExcelManutencaoDia, montarRelatorioManutencaoDia } from '../src/utils/relatorioManutencaoDia';
import type { ControleEquipamentoDiario, EventoControleEquipamentoDiario } from '../src/types';

const DIA = '2026-10-28';
const ev = (tipo: EventoControleEquipamentoDiario['tipo'], hora: string, n: string): EventoControleEquipamentoDiario => ({
  id: n, ocorridoEm: `${DIA}T15:00:00.000Z`, hora, tipo, statusNovo: tipo === 'ENTRADA_MANUTENCAO' ? 'Em manutenção' : 'Disponível',
});
const reg = (id: string, prefixo: string, familia: string, eventos: EventoControleEquipamentoDiario[], extra: Partial<ControleEquipamentoDiario> = {}): ControleEquipamentoDiario => ({
  id, chave: `${DIA}|${id}`, data: DIA, funcionarioId: '', codigoFuncionario: '', nomeMotorista: '', equipamentoId: id,
  prefixo, familia, status: 'Em manutenção', horaSaida: '', horaEntradaManutencao: '', horaLiberacao: '', observacao: '',
  origem: 'SISTEMA', revisao: [], criadoEm: '', atualizadoEm: '', eventos, ...extra,
});

const registros = [
  reg('a', 'CB767', 'Basculantes', [ev('ENTRADA_MANUTENCAO', '07:00', '1'), ev('LIBERACAO_MANUTENCAO', '14:00', '2')]),
  reg('b', 'CB929', 'Basculantes', [ev('ENTRADA_MANUTENCAO', '07:00', '3')]),
  reg('c', 'EH010', 'Escavadeiras', [ev('LIBERACAO_MANUTENCAO', '08:00', '4')]),
  reg('d', 'CB100', 'Basculantes', [], { status: 'Em operação' }),
];
const DEPOIS = new Date('2026-10-29T08:00:00-03:00');

test('relatório separa ok, limite e inconsistente e soma o dia', () => {
  const r = montarRelatorioManutencaoDia(DIA, registros, [], DEPOIS);
  assert.equal(r.linhas.length, 3);
  assert.deepEqual(r.linhas.map(l => [l.prefixo, l.grupo]), [['CB929', 'LIMITE'], ['EH010', 'INCONSISTENTE'], ['CB767', 'OK']]);
  assert.equal(r.totalMin, 345 + 600);
  assert.equal(r.aConferir, 2);
  assert.equal(r.fechado, false);
  assert.deepEqual(r.porTipo.find(t => t.tipo === 'Basculantes'), { tipo: 'Basculantes', totalMin: 945, equipamentos: 2 });
});

test('dia fecha quando limite e inconsistente estão conferidos', () => {
  const conferidos = registros.map(item => item.id === 'b' || item.id === 'c'
    ? { ...item, conferenciaManutencao: { decisao: 'CONFIRMADO_10H' as const, decididoEm: '', decididoPor: 'deivid' } }
    : item);
  const r = montarRelatorioManutencaoDia(DIA, conferidos, [], DEPOIS);
  assert.equal(r.aConferir, 0);
  assert.equal(r.fechado, true);
});

test('excel tem uma linha por período', () => {
  const linhas = linhasExcelManutencaoDia(montarRelatorioManutencaoDia(DIA, registros, [], DEPOIS));
  assert.equal(linhas.filter(l => l.Prefixo === 'CB767').length, 1);
  assert.equal(linhas.find(l => l.Prefixo === 'CB767')?.['Horas paradas'], '5 h 45');
});
```

Em `tests/run.ts`: `import './relatorioManutencaoDia.test';`

- [ ] **Step 2: confirmar que falha**

Run: `node node_modules/tsx/dist/cli.mjs tests/relatorioManutencaoDia.test.ts`
Expected: FAIL com módulo inexistente.

- [ ] **Step 3: implementar**

`src/utils/relatorioManutencaoDia.ts`:

```ts
import type { ControleEquipamentoDiario, OrdemServico } from '../types';
import { formatarMinutos, horasParadasDoDia, type ParadaDoDia } from './horasParadasDoDia';
import { vemParadoDeOntem } from './manutencaoLimite';

export interface LinhaRelatorioManutencao {
  registroId: string;
  equipamentoId: string;
  prefixo: string;
  tipo: string;
  ordemNumero: string;
  parada: ParadaDoDia;
  grupo: 'OK' | 'LIMITE' | 'INCONSISTENTE';
  conferido: boolean;
}

export interface RelatorioManutencaoDia {
  data: string;
  linhas: LinhaRelatorioManutencao[];
  totalMin: number;
  equipamentos: number;
  emConferencia: number;
  conferidos: number;
  aConferir: number;
  porTipo: Array<{ tipo: string; totalMin: number; equipamentos: number }>;
  fechado: boolean;
}

const ORDEM_GRUPO = { LIMITE: 0, INCONSISTENTE: 1, OK: 2 } as const;

export const montarRelatorioManutencaoDia = (
  data: string,
  registros: readonly ControleEquipamentoDiario[],
  ordens: readonly OrdemServico[],
  agora: Date,
): RelatorioManutencaoDia => {
  const numeroDa = new Map(ordens.map(ordem => [ordem.id, ordem.numero]));
  const linhas = registros
    .filter(registro => registro.data === data)
    .map(registro => {
      const parada = horasParadasDoDia(registro, agora, { vemParadoDeOntem: vemParadoDeOntem(registros, registro) });
      const grupo: LinhaRelatorioManutencao['grupo'] = parada.situacao === 'LIMITE_ATINGIDO'
        ? 'LIMITE' : parada.situacao === 'INCONSISTENTE' ? 'INCONSISTENTE' : 'OK';
      return {
        registroId: registro.id,
        equipamentoId: registro.equipamentoId,
        prefixo: registro.prefixo,
        tipo: registro.familia || registro.tipoEquipamento || 'Sem tipo',
        ordemNumero: (registro.ordemServicoId && numeroDa.get(registro.ordemServicoId)) || '',
        parada,
        grupo,
        conferido: grupo === 'OK' || Boolean(registro.conferenciaManutencao),
      };
    })
    .filter(linha => linha.parada.periodos.length > 0 || linha.grupo === 'INCONSISTENTE')
    .sort((a, b) => ORDEM_GRUPO[a.grupo] - ORDEM_GRUPO[b.grupo] || a.prefixo.localeCompare(b.prefixo));

  const porTipoMapa = new Map<string, { tipo: string; totalMin: number; equipamentos: number }>();
  linhas.forEach(linha => {
    const atual = porTipoMapa.get(linha.tipo) || { tipo: linha.tipo, totalMin: 0, equipamentos: 0 };
    atual.totalMin += linha.parada.totalMin;
    atual.equipamentos += 1;
    porTipoMapa.set(linha.tipo, atual);
  });

  const emConferencia = linhas.filter(linha => linha.grupo !== 'OK').length;
  const aConferir = linhas.filter(linha => !linha.conferido).length;
  return {
    data,
    linhas,
    totalMin: linhas.reduce((total, linha) => total + linha.parada.totalMin, 0),
    equipamentos: linhas.length,
    emConferencia,
    conferidos: linhas.length - aConferir,
    aConferir,
    porTipo: [...porTipoMapa.values()].sort((a, b) => b.totalMin - a.totalMin),
    fechado: aConferir === 0,
  };
};

const SITUACAO_TEXTO = { LIBERADO: 'Liberado', PARADO: 'Parado', LIMITE_ATINGIDO: 'Limite 10 h', INCONSISTENTE: 'Inconsistente' } as const;

export const linhasExcelManutencaoDia = (relatorio: RelatorioManutencaoDia): Array<Record<string, string | number>> =>
  relatorio.linhas.flatMap(linha => {
    const base = {
      Data: relatorio.data,
      Prefixo: linha.prefixo,
      Tipo: linha.tipo,
      OS: linha.ordemNumero,
      Situação: SITUACAO_TEXTO[linha.parada.situacao],
      Conferido: linha.conferido ? 'Sim' : 'Não',
    };
    if (linha.parada.periodos.length === 0) {
      return [{ ...base, Entrada: '', Liberação: '', Descontos: '', 'Horas do período': '', 'Horas paradas': '', Observação: linha.parada.motivoInconsistencia || '' }];
    }
    return linha.parada.periodos.map((periodo, indice) => ({
      ...base,
      Entrada: periodo.inicio,
      Liberação: periodo.fim ?? 'em aberto',
      Descontos: formatarMinutos(periodo.descontoMin),
      'Horas do período': formatarMinutos(periodo.liquidoMin),
      'Horas paradas': indice === 0 ? formatarMinutos(linha.parada.totalMin) : '',
      Observação: '',
    }));
  });
```

- [ ] **Step 4: confirmar que passa**

Run: `node node_modules/tsx/dist/cli.mjs tests/relatorioManutencaoDia.test.ts`
Expected: `# pass 3`, `# fail 0`.

- [ ] **Step 5: commit**

```bash
git add src/utils/relatorioManutencaoDia.ts tests/relatorioManutencaoDia.test.ts tests/run.ts
git commit -m "feat(manutencao): relatório do dia com períodos, totais e grupos da conferência"
```

---

### Task 5: Tela de Manutenção reformulada

**Files:**
- Create: `src/components/manutencao/CartaoParada.tsx`, `ManutencaoHoje.tsx`, `ConferenciaManutencao.tsx`, `RelatorioManutencaoDia.tsx`
- Modify: `src/components/ManutencaoTab.tsx` (props e subtelas, linhas 46-63 e 421-431)
- Modify: `src/App.tsx` (onde renderiza `<ManutencaoTab`, linha ~4744)
- Test: `tests/padraoAbas.test.ts` precisa continuar passando sem mudança

**Interfaces:**
- Consumes: Tasks 1, 3 e 4.
- Produces, em `ManutencaoTabProps`:
  - `controlesEquipamentos: ControleEquipamentoDiario[]` (deixa de ser opcional)
  - `onSaveControle: (registro: ControleEquipamentoDiario) => void`
  - Subtelas: `'hoje' | 'conferencia' | 'relatorio' | 'ordens' | 'historico'`, com `'hoje'` como padrão.

Antes de começar: ler `docs/superpowers/CHECKLIST_REDESIGN_ABAS.md` e `CONTRIBUTING.md` seção 7, carregar as skills de design listadas, e abrir o Painel de Controle (`src/components/Dashboard.tsx`) para copiar cartões, cores e espaçamentos (`CARTAO`, `FOCO` de `src/components/cadastros/estilos.ts`).

- [ ] **Step 1: `CartaoParada`.** Recebe `{ registro, parada: ParadaDoDia, ordemNumero, podeEditar, onLiberar(hora), onEntrar(hora) }`. Mostra prefixo grande, selo de situação (Parado rose, Liberado emerald, Conferir amber), `formatarMinutos(parada.totalMin)` com barra `totalMin / 600`, linha do tempo vertical dos eventos do dia (`evento.hora || horaLocal(evento.ocorridoEm)`, texto do tipo, OS, `responsavel`). Botões "Liberar agora" e "Entrou em manutenção" abrem um campo de hora preenchido com a hora atual. Altura mínima 44 px no celular.
- [ ] **Step 2: `ManutencaoHoje`.** Quatro contadores (Parados agora, Horas paradas hoje, Para conferir, Liberados hoje) e a grade de `CartaoParada` dos registros do dia com algum período ou situação `INCONSISTENTE`. "Liberar" e "Entrar" usam `registroDaEdicao` de `src/modules/frota/quadroFrota.ts`, o mesmo caminho do Quadro, para que a OS automática e os eventos sigam iguais. Os números são recalculados a cada minuto (`setInterval` de 60 s com limpeza).
- [ ] **Step 3: `ConferenciaManutencao`.** Lista `relatorio.linhas` com grupo `LIMITE` ou `INCONSISTENTE`, mostrando quem decidiu quando já conferido. Três botões chamam `confirmarDezHoras`, `informarLiberacaoReal` (pede a hora) e `continuaParadoAmanha`. Cada decisão também grava `historyLogs` com o valor antes e depois, pelo `saveAndLog` que o `App` já usa.
- [ ] **Step 4: `RelatorioManutencaoDia`.** Seletor de data (hoje por padrão), tabela com uma linha por equipamento e os períodos embaixo, totais no rodapé, quadro por tipo, "X de Y conferidos" e botão "Exportar Excel" com `linhasExcelManutencaoDia`, usando o mesmo utilitário de planilha de `src/utils/fleetExcelExport.ts`.
- [ ] **Step 5: `ManutencaoTab`.** Trocar `type Subtela` e a lista `subtelas` pelas cinco novas. "Fila de oficina" e "Motivos" passam a ser blocos dentro de "Hoje" e "Relatório"; não podem sumir. Na lista de OS, um selo "Pelo limite de 10 h" quando `observacao` contém `OBSERVACAO_LIMITE`.
- [ ] **Step 6: `App.tsx`.** Passar `controlesEquipamentos` e `onSaveControle` (o mesmo salvamento do Controle de Frotas). Num `useEffect` com intervalo de 60 s, só para quem `podeEditar`: rodar `encerrarOrdensNoLimite(controleEquipamentosDiario, ordensServico, new Date(), activeUserName)` e, para cada OS em `encerradas`, salvar pela mesma função que a tela usa para salvar OS (`onSave(ordem, false)`), com log "Encerrada pelo limite de 10 h". Não rodar enquanto `uploadsInFlightRef.current > 0`.
- [ ] **Step 7: verificar.** `npm test`, `npm run lint` e `npm run build`. Os testes desta entrega precisam passar. As falhas que já existiam (Pessoas & Presença e navegação) ficam anotadas no PR, sem esconder.
- [ ] **Step 8: prints.** Pelo skill `run` ou Playwright, abrir a aba Manutenção a 390 px e a 1440 px em Hoje, Conferência e Relatório, e mandar os prints ao Deivid antes de dar a tela por pronta. Conferir também as abas ocultas (Ordens, Histórico).
- [ ] **Step 9: commit**

```bash
git add src/components/manutencao src/components/ManutencaoTab.tsx src/App.tsx
git commit -m "feat(manutencao): tela com linha do tempo, conferência e relatório do dia"
```

---

### Task 6: Corrigir as OS abertas que já existem

**Files:** nenhum arquivo de código. Operação de dados com aprovação.

**Interfaces:**
- Consumes: `encerrarOrdensNoLimite` (Task 3).

- [ ] **Step 1: simulação.** Com os dados atuais da nuvem (`erp_snapshots.payload` → `ordensServico` e `controleEquipamentosDiario`), rodar `encerrarOrdensNoLimite` localmente num script em `/tmp/claude-0/.../scratchpad` e listar, para cada OS que fecharia: número, prefixo, dia e hora do limite.
- [ ] **Step 2: aprovação.** Mostrar a lista ao Deivid. Sem o "pode", nada é gravado.
- [ ] **Step 3: aplicar pelo app.** Com o "pode", a mudança da Task 5 Step 6 fecha as OS na próxima abertura do ERP por um administrador. Não gravar direto no banco: as gravações diretas de 28/10 causaram conflito de versão em todos os aparelhos.
- [ ] **Step 4: conferir.** Contar no banco as OS ainda abertas e as fechadas com `OBSERVACAO_LIMITE`, e comparar com a simulação.
