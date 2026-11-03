# Guia Rápido: Rastreamento de Ciclos

## 3 Passos para Começar

### 1️⃣ Testar a Página de Exemplo
```bash
# Desenvolva normalmente
npm run dev

# Abra no navegador
http://localhost:5173/?screen=ciclos
```

Verá:
- Form de registrar ciclo (4 botões coloridos)
- Timeline visual tipo Mercado Livre
- Histórico com filtros

### 2️⃣ Integrar com Controle de Frotas
Adicione aba "Ciclos" em `src/components/ControleFrotas.tsx`:

```tsx
import { RegistrarCiclo, HistoricoCiclos } from '@/components/ciclosEquipamento';
import { useCycleHistory } from '@/fleet/useCycleHistory';

export const ControleFrotas = () => {
  const { ciclos, registrarEvento, salvar } = useCycleHistory();
  const [aba, setAba] = useState<'quadro' | 'ciclos'>('quadro');

  return (
    <>
      {/* Abas */}
      <div className="flex gap-2 border-b border-slate-200">
        <button onClick={() => setAba('quadro')}>Quadro da Frota</button>
        <button onClick={() => setAba('ciclos')}>Ciclos</button>
      </div>

      {/* Conteúdo */}
      {aba === 'quadro' ? (
        <QuadroFrota />
      ) : (
        <>
          <RegistrarCiclo
            equipamentoId={selecionado?.id}
            prefixo={selecionado?.prefixo}
            usuarioAtual={usuario.nome}
            onSalvar={() => salvar()}
          />
          <HistoricoCiclos ciclos={ciclos} equipamentos={equipamentos} />
        </>
      )}
    </>
  );
};
```

### 3️⃣ Usar o Hook em Qualquer Lugar
```typescript
import { useCycleHistory } from '@/fleet/useCycleHistory';

const MeuComponente = () => {
  const {
    ciclos,                    // Array com todos os ciclos
    carregando,               // boolean
    registrarEvento,          // (evento) => void
    salvar,                   // () => void
    obterCiclosEquipamento,   // (id) => EquipmentCycle[]
    calcularMetricas,         // (ids?) => CycleMetrics
  } = useCycleHistory();

  // Registrar novo evento
  const handleRegistrar = () => {
    const agora = new Date();
    registrarEvento({
      id: `evt-${Date.now()}`,
      equipamentoId: 'eq-m31',
      prefixo: 'M31',
      status: 'Em operação',
      timestamp: agora.toISOString(),
      hora: `${agora.getHours()}:${agora.getMinutes()}`,
      responsavel: 'João',
    });
    salvar(); // Persiste em localStorage
  };

  return (
    <button onClick={handleRegistrar}>
      Registrar em Operação
    </button>
  );
};
```

## Estrutura de Arquivos

```
src/
├── fleet/
│   ├── cycleHistory.ts          ← Lógica de ciclos
│   └── useCycleHistory.ts       ← Hook React
├── components/
│   └── ciclosEquipamento/
│       ├── RegistrarCiclo.tsx   ← Form rápido
│       ├── CycleTimeline.tsx    ← Timeline visual GSAP
│       ├── HistoricoCiclos.tsx  ← Relatório completo
│       └── index.ts
└── pages/
    └── TelaExemploCiclos.tsx    ← Exemplo interativo

tests/
└── cycleHistory.test.ts         ← Testes unitários

docs/
└── RASTREAMENTO_CICLOS.md       ← Documentação completa
```

## localStorage (Automático)

Tudo salvo em `renea_ciclos_equipamentos`:
- Carrega ao abrir a página
- Salva ao registrar novo evento
- Persiste entre sessões

## Fluxo de Dados

```
RegistrarCiclo (UI)
    ↓
registrarEvento() (Hook)
    ↓
adicionarEventoAoCiclo() (Lógica)
    ↓
salvar() (localStorage)
    ↓
CycleTimeline + HistoricoCiclos (Visualização)
```

## Atalhos de Teclado

```
Enter      → Salvar no RegistrarCiclo
Ctrl+S     → Salvar no RegistrarCiclo (futura: quando integrado)
```

## Tipos Importantes

```typescript
// Status do equipamento
type CycleStatus = 
  | 'Em operação'
  | 'Em manutenção'
  | 'À disposição'
  | 'Aguardando manutenção';

// Um evento de transição
interface CycleEvent {
  equipamentoId: string;
  status: CycleStatus;
  timestamp: string; // ISO 8601
  hora: string;     // "HH:MM"
  responsavel: string;
  motivo?: string;
}

// Ciclo completo de um dia
interface EquipmentCycle {
  equipamentoId: string;
  prefixo: string;
  dataInicio: string; // "YYYY-MM-DD"
  eventos: CycleEvent[];
  statusAtual: CycleStatus;
  duracao?: number; // minutos
}

// Métricas calculadas
interface CycleMetrics {
  totalOperacao: number;    // minutos
  totalManutencao: number;  // minutos
  totalParado: number;      // minutos
  disponibilidade: number;  // 0-100%
}
```

## Cores (Padrão RENEA)

```
Em operação:          🟢 #10b981 (green-500)
Em manutenção:        🟠 #f97316 (orange-500)
À disposição:         🔵 #3b82f6 (blue-500)
Aguardando manutenção: 🟡 #eab308 (yellow-500)
```

## Animações (GSAP)

CycleTimeline automaticamente anima:
1. Linhas conectoras crescem (scaleY)
2. Bolinhas aparecem com pop (scale)
3. Conteúdo faz fade in

Respeita `prefers-reduced-motion`.

## Próximos (Scope Futuro)

- [ ] Sincronizar com Supabase
- [ ] Gráficos de disponibilidade
- [ ] Alertas de tempo em manutenção
- [ ] Integração com RDO
- [ ] Exportar para relatório semanal
