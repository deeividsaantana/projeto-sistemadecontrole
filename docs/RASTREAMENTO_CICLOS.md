# Rastreamento de Ciclos em Frotas e Manutenção

Histórico de transições operacionais de equipamentos com timeline visual (tipo Mercado Livre) e métricas agregadas.

## Estrutura

### Tipos (src/fleet/cycleHistory.ts)

```typescript
type CycleStatus = 'Em operação' | 'Em manutenção' | 'À disposição' | 'Aguardando manutenção';

interface CycleEvent {
  id: string;
  equipamentoId: string;
  status: CycleStatus;
  timestamp: string; // ISO 8601 completo (2026-11-03T08:37:00Z)
  hora: string; // HH:MM local
  responsavel: string; // usuário que registrou
  motivo?: string; // motivo da manutenção ou observação
}

interface EquipmentCycle {
  id: string;
  equipamentoId: string;
  prefixo: string;
  dataInicio: string; // YYYY-MM-DD
  eventos: CycleEvent[];
  statusAtual: CycleStatus;
  duracao?: number; // minutos total do ciclo
}

interface CycleTimelineEntry {
  status: CycleStatus;
  timestamp: string;
  hora: string;
  duracao?: string; // "58 min", "2 h 15 min"
  responsavel: string;
  motivo?: string;
  icone: 'play' | 'wrench' | 'check' | 'clock';
}

interface CycleMetrics {
  totalOperacao: number; // minutos
  totalManutencao: number; // minutos
  totalParado: number; // minutos
  ciclosCompletos: number;
  ultimaAtualizacao: string;
  disponibilidade: number; // 0-100%
}
```

### Componentes

#### 1. RegistrarCiclo
Interface de entrada rápida para registrar transições durante o dia.

```tsx
<RegistrarCiclo
  equipamentoId="eq-m31"
  prefixo="M31"
  usuarioAtual="João Silva"
  onSalvar={() => console.log('Registrado!')}
/>
```

- 4 botões coloridos para seleção rápida de status
- Campo de motivo (obrigatório para manutenção)
- Salva em localStorage automaticamente

#### 2. CycleTimeline
Timeline visual tipo Mercado Livre com GSAP.

```tsx
<CycleTimeline
  ciclo={equipmentCycle}
  prefixo="M31"
/>
```

- Bolinhas coloridas conectadas por linhas
- Duração de cada fase (ex: "58 min")
- Responsável e motivo
- Animações GSAP respeitando `prefers-reduced-motion`

#### 3. HistoricoCiclos
Relatório completo com filtros e métricas.

```tsx
<HistoricoCiclos
  ciclos={allCiclos}
  equipamentos={equipamentosMap}
/>
```

- 4 cartões de métricas (operação, manutenção, disponível, disponibilidade %)
- Filtros: equipamento, período, status, busca
- Tabela densa com resumo de cada ciclo
- Expansão para ver timeline completa

### Hook (src/fleet/useCycleHistory.ts)

```typescript
const { 
  ciclos,               // Array de todos os ciclos
  carregando,          // boolean
  registrarEvento,     // (evento) => void
  salvar,              // () => void
  obterCiclosEquipamento, // (id) => EquipmentCycle[]
  obterFases,          // (ciclo) => CyclePhase[]
  calcularMetricas,    // (ids?) => CycleMetrics
} = useCycleHistory();
```

## Persistência

### localStorage
- Key: `renea_ciclos_equipamentos`
- Formato: JSON array de ciclos
- Sincroniza automaticamente ao registrar evento

### Supabase (opcional)
Schema para integração com nuvem:

```sql
CREATE TABLE IF NOT EXISTS public.cycle_history (
  id TEXT PRIMARY KEY,
  equipamento_id TEXT NOT NULL REFERENCES public.equipamentos(id),
  status TEXT NOT NULL CHECK (status IN ('Em operação', 'Em manutenção', 'À disposição', 'Aguardando manutenção')),
  timestamp TIMESTAMPTZ NOT NULL,
  hora TEXT NOT NULL,
  responsavel TEXT NOT NULL,
  motivo TEXT,
  data_criacao TIMESTAMPTZ DEFAULT NOW(),
  data_atualizacao TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cycle_equipamento_timestamp ON public.cycle_history(equipamento_id, timestamp);
CREATE INDEX idx_cycle_status ON public.cycle_history(status);
```

## Integração com Controle de Frotas

### Exemplo: Adicionar aba "Ciclos"

```tsx
import { RegistrarCiclo, HistoricoCiclos } from '@/components/ciclosEquipamento';
import { useCycleHistory } from '@/fleet/useCycleHistory';

export const ControleFrotasComCiclos = () => {
  const { ciclos, registrarEvento, salvar } = useCycleHistory();
  const [abaAtiva, setAbaAtiva] = useState<'quadro' | 'ciclos'>('quadro');

  const handleNovoEvento = (evento: CycleEvent) => {
    registrarEvento(evento);
    salvar();
  };

  return (
    <div>
      <div className="flex gap-2 border-b border-slate-200 mb-4">
        <button
          onClick={() => setAbaAtiva('quadro')}
          className={`px-4 py-2 font-medium ${
            abaAtiva === 'quadro'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-slate-600'
          }`}
        >
          Quadro da Frota
        </button>
        <button
          onClick={() => setAbaAtiva('ciclos')}
          className={`px-4 py-2 font-medium ${
            abaAtiva === 'ciclos'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-slate-600'
          }`}
        >
          Ciclos
        </button>
      </div>

      {abaAtiva === 'quadro' ? (
        <QuadroFrotaOriginal />
      ) : (
        <>
          <RegistrarCiclo
            equipamentoId={selecionado?.id}
            prefixo={selecionado?.prefixo}
            usuarioAtual={usuario.nome}
            onSalvar={handleNovoEvento}
          />
          <HistoricoCiclos ciclos={ciclos} equipamentos={equipamentos} />
        </>
      )}
    </div>
  );
};
```

## Fluxo de Uso Diário

1. **Manhã**: Campo abre RegistrarCiclo com M31 já selecionada
   - Clica "Em operação" → Operador: João
   - Salva com Enter ou botão

2. **Durante o dia**: Transições rápidas
   - Pneu furou → clica "Em manutenção" → motivo: "Pneu furado" → Salva
   - Liberada → clica "À disposição" → Salva
   - Volta → clica "Em operação" → Operador: Maria

3. **Tarde**: Verifica histórico
   - Abre HistoricoCiclos
   - Filtra por período, equipamento
   - Vê timeline completa com durações
   - Exporta para relatório

## Cálculos de Duração

- Cada transição marca timestamp ISO exato (2026-11-03T08:37:00Z)
- Duração = próximo timestamp - timestamp atual
- Métricas agregam por status:
  - Em operação: soma de durações
  - Em manutenção: soma de durações
  - À disposição: soma de durações
  - Disponibilidade % = em_operacao / (em_operacao + manutencao + disposicao) * 100

## Testes

```bash
npm run test -- cycleHistory.test.ts
```

Cobertura:
- ✓ calcularDuracao
- ✓ formatarDuracao
- ✓ extrairFasesCiclo
- ✓ montarTimeline
- ✓ calcularMetricasCiclos

## Animações GSAP

Timeline de entrada quando ciclo é expandido:

1. **Linha conectora**: cresce de cima para baixo (scaleY)
2. **Bolinha**: aparece com "pop" (scale + opacity)
3. **Conteúdo**: fade in com slide

Respeita `prefers-reduced-motion` desabilitando animações.

## Próximos Passos

- [ ] Sync com Supabase para relatórios offline
- [ ] Gráficos de disponibilidade ao longo do tempo
- [ ] Alertas quando equipamento passa muito tempo em manutenção
- [ ] Integração com RDO (Relatório Diário de Obra)
- [ ] Relatório semanal de ciclos por canteiro
