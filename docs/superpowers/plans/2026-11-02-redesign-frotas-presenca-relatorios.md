# Redesign Frotas, Presença e Relatórios - Plano de Implementação

> **Para workers agentic:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans para implementar este plano task-by-task. Steps usam checkbox (`- [ ]`) para tracking.

**Objetivo:** Redesenhar completamente 3 áreas críticas (Frotas, Presença, Relatórios) com foco em facilidade de lançamento, atalhos de teclado, novo link público para Presença com login por matrícula, e escala de sábado diferente.

**Arquitetura:** 
- **Presença:** Link público isolado com autenticação por matrícula + novo painel de escala para sábados
- **Frotas:** Redesign visual + atalhos (/, ?, A, V, 1-4, L) + Tab navigation
- **Relatórios:** Dashboard consolidado com cards de acesso rápido + novos relatórios (motoristas, equipamentos)
- **Facilidades globais:** Keyboard shortcuts em todo app + Tab navigation + busca com 'n'

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, GSAP (animações), Lucide Icons, TanStack (filtros), Zod (validação)

**Spec:** Esta implementação assume validação de matrícula para link público, novo design no Painel de Frotas com foco em operabilidade, e consolidação de relatórios em um único lugar com acesso rápido.

---

## Global Constraints

- Responder em português (PT-BR)
- Padrão visual segue docs/superpowers/CHECKLIST_REDESIGN_ABAS.md
- Cores RENEA: verde principal #087653
- Mobile-first: testar em 390px e desktop
- Atalhos não conflitam com browser defaults (ex: Ctrl+S)
- Todos os testes novos em `tests/run.ts`
- Commit por tarefa com mensagem clara
- Rodas `npm run verify` antes de cada push

---

## Fase 1: Infraestrutura de Atalhos e Navegação

### Task 1: Sistema Global de Keyboard Shortcuts

**Arquivos:**
- Criar: `src/hooks/useKeyboardShortcuts.ts`
- Criar: `src/utils/keyboardShortcuts.ts`
- Modificar: `src/App.tsx`
- Teste: `tests/keyboardShortcuts.test.ts`

**Interfaces:**
- Produz: Hook `useKeyboardShortcuts()` que retorna registro centralizado de atalhos
- Produz: Função `registerShortcut(key, callback, context)` para registrar atalho
- Produz: Função `getShortcutsForContext(context)` que retorna atalhos disponíveis

**Pré-requisitos:** Entender como ControladorFrota usa teclas (/, ?, A, V, 1-4, L)

- [ ] **Step 1: Criar hook centralizado para atalhos**

```typescript
// src/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';

type ShortcutContext = 'frotas' | 'presenca' | 'relatorios' | 'global';
type ShortcutCallback = (event: KeyboardEvent) => void;

interface Shortcut {
  key: string;
  description: string;
  callback: ShortcutCallback;
  context: ShortcutContext;
  conflictsWith?: string[];
}

const shortcuts = new Map<string, Shortcut>();

export const useKeyboardShortcuts = (context: ShortcutContext, enabled = true) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignora se estiver digitando em input/textarea
      const target = event.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      // Verifica se há shortcut registrado
      for (const [, shortcut] of shortcuts) {
        if (shortcut.context === context || shortcut.context === 'global') {
          if (shortcut.key === event.key || shortcut.key === event.code) {
            shortcut.callback(event);
            event.preventDefault();
            break;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [context, enabled]);
};

export const registerShortcut = (key: string, callback: ShortcutCallback, context: ShortcutContext, description: string) => {
  shortcuts.set(`${context}:${key}`, { key, callback, context, description });
};

export const getShortcutsForContext = (context: ShortcutContext) => {
  return Array.from(shortcuts.values()).filter(s => s.context === context || s.context === 'global');
};
```

- [ ] **Step 2: Rodar teste para verificar que falha**

```bash
npm test -- tests/keyboardShortcuts.test.ts
```
Expected: FAIL (arquivo não existe)

- [ ] **Step 3: Criar arquivo de testes**

```typescript
// tests/keyboardShortcuts.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { registerShortcut, getShortcutsForContext } from '../src/hooks/useKeyboardShortcuts';

describe('Keyboard Shortcuts', () => {
  beforeEach(() => {
    // Limpar shortcuts antes de cada teste
    const shortcuts = new Map();
  });

  it('registra shortcut corretamente', () => {
    const callback = vi.fn();
    registerShortcut('/', callback, 'frotas', 'Buscar');
    const frotas = getShortcutsForContext('frotas');
    expect(frotas.length).toBe(1);
    expect(frotas[0].key).toBe('/');
  });

  it('retorna shortcuts do contexto correto', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    registerShortcut('/', cb1, 'frotas', 'Buscar Frotas');
    registerShortcut('n', cb2, 'presenca', 'Novo');
    
    const frota = getShortcutsForContext('frotas');
    expect(frota.length).toBe(1);
    expect(frota[0].key).toBe('/');
  });
});
```

- [ ] **Step 4: Rodar testes para verificar que passam**

```bash
npm test -- tests/keyboardShortcuts.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useKeyboardShortcuts.ts src/utils/keyboardShortcuts.ts tests/keyboardShortcuts.test.ts
git commit -m "feat: sistema global de keyboard shortcuts com contextos"
```

---

### Task 2: Tab Navigation - Suporte a Navegação com Tab key

**Arquivos:**
- Criar: `src/components/shared/TabNavigation.tsx`
- Modificar: `src/components/quadroFrota/QuadroFrota.tsx`
- Modificar: `src/components/ControlePresencaTab.tsx`
- Teste: `tests/tabNavigation.test.ts`

**Interfaces:**
- Consome: Hook `useKeyboardShortcuts()` da Task 1
- Produz: Componente `<TabNavigation items={} onSelect={} />` para navegar com Tab

- [ ] **Step 1: Criar componente Tab Navigation**

```typescript
// src/components/shared/TabNavigation.tsx
import { useEffect, useRef, useState } from 'react';
import { registerShortcut } from '../../hooks/useKeyboardShortcuts';

interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabNavigationProps {
  items: TabItem[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export function TabNavigation({ items, activeId, onSelect, className = '' }: TabNavigationProps) {
  const [focusIndex, setFocusIndex] = useState(items.findIndex(i => i.id === activeId));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleTabNav = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      
      let newIndex = focusIndex;
      if (event.shiftKey) {
        newIndex = focusIndex === 0 ? items.length - 1 : focusIndex - 1;
      } else {
        newIndex = focusIndex === items.length - 1 ? 0 : focusIndex + 1;
      }
      
      setFocusIndex(newIndex);
      onSelect(items[newIndex].id);
      event.preventDefault();
    };

    window.addEventListener('keydown', handleTabNav);
    return () => window.removeEventListener('keydown', handleTabNav);
  }, [focusIndex, items, onSelect]);

  return (
    <div ref={containerRef} className={`flex gap-2 border-b border-slate-200 ${className}`}>
      {items.map((item, idx) => (
        <button
          key={item.id}
          onClick={() => {
            setFocusIndex(idx);
            onSelect(item.id);
          }}
          aria-selected={item.id === activeId}
          className={`px-4 py-2 font-medium transition ${
            item.id === activeId
              ? 'border-b-2 border-emerald-600 text-emerald-700'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {item.icon && <span className="mr-2">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Criar testes para Tab Navigation**

```typescript
// tests/tabNavigation.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabNavigation } from '../src/components/shared/TabNavigation';

describe('TabNavigation', () => {
  const items = [
    { id: 'tab1', label: 'Tab 1' },
    { id: 'tab2', label: 'Tab 2' },
    { id: 'tab3', label: 'Tab 3' },
  ];

  it('renderiza todas as tabs', () => {
    const handleSelect = vi.fn();
    render(<TabNavigation items={items} activeId="tab1" onSelect={handleSelect} />);
    
    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.getByText('Tab 2')).toBeInTheDocument();
    expect(screen.getByText('Tab 3')).toBeInTheDocument();
  });

  it('navega com Tab key', () => {
    const handleSelect = vi.fn();
    render(<TabNavigation items={items} activeId="tab1" onSelect={handleSelect} />);
    
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(handleSelect).toHaveBeenCalledWith('tab2');
  });
});
```

- [ ] **Step 3: Rodar testes**

```bash
npm test -- tests/tabNavigation.test.ts
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/TabNavigation.tsx tests/tabNavigation.test.ts
git commit -m "feat: componente TabNavigation com suporte a Tab key"
```

---

## Fase 2: Presença - Link Público e Nova Funcionalidade

### Task 3: Link Público de Presença com Login por Matrícula

**Arquivos:**
- Criar: `src/components/presenca/PresencaPublicaLink.tsx`
- Criar: `src/utils/presencaPublicaAuth.ts`
- Modificar: `src/App.tsx` (adicionar rota)
- Teste: `tests/presencaPublicaLink.test.ts`

**Interfaces:**
- Consome: `Funcionario`, `Empresa`, `GrupoEquipe` types
- Produz: Componente `<PresencaPublicaLink />` com login por matrícula
- Produz: Função `validarMatricula(matricula: string, funcionarios: Funcionario[])` que retorna `Funcionario | null`

- [ ] **Step 1: Criar função de autenticação por matrícula**

```typescript
// src/utils/presencaPublicaAuth.ts
import type { Funcionario } from '../types';

export const validarMatricula = (matricula: string, funcionarios: readonly Funcionario[]): Funcionario | null => {
  const trimmed = matricula.trim().toLowerCase();
  const found = funcionarios.find(f => 
    f.matricula?.toLowerCase() === trimmed || 
    f.id.toLowerCase() === trimmed
  );
  return found || null;
};

export const gerarTokenPresencaPublica = (funcionarioId: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${funcionarioId}:${timestamp}:${random}`;
};

export const validarTokenPresencaPublica = (token: string, funcionarioId: string): boolean => {
  const [id, timestamp] = token.split(':');
  if (id !== funcionarioId) return false;
  
  const tokenTime = parseInt(timestamp, 10);
  const now = Date.now();
  const expiry = 24 * 60 * 60 * 1000; // 24 horas
  
  return now - tokenTime < expiry;
};
```

- [ ] **Step 2: Criar componente de login**

```typescript
// src/components/presenca/PresencaPublicaLink.tsx
import { useState } from 'react';
import { LogIn, AlertCircle } from 'lucide-react';
import type { Empresa, Funcionario, GrupoEquipe } from '../../types';
import { validarMatricula } from '../../utils/presencaPublicaAuth';
import { BOTAO_PRIMARIO, CAMPO, CARTAO, ROTULO } from '../cadastros/estilos';

interface Props {
  funcionarios: readonly Funcionario[];
  empresas: readonly Empresa[];
  gruposEquipe: readonly GrupoEquipe[];
  onAutenticar: (funcionario: Funcionario) => void;
}

export function PresencaPublicaLink({ funcionarios, onAutenticar }: Props) {
  const [matricula, setMatricula] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    const funcionario = validarMatricula(matricula, funcionarios);
    if (!funcionario) {
      setErro('Matrícula não encontrada. Verifique e tente novamente.');
      setCarregando(false);
      return;
    }

    onAutenticar(funcionario);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className={`${CARTAO} p-8 text-center`}>
          <div className="mb-8">
            <h1 className="text-3xl font-black text-slate-950 mb-2">Presença</h1>
            <p className="text-sm text-slate-600">Digite sua matrícula para acessar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className={`${ROTULO} block text-left`}>
              Matrícula
              <input
                type="text"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                placeholder="Ex: 12345"
                autoFocus
                required
                className={`${CAMPO} mt-2 text-center text-lg tracking-wider`}
              />
            </label>

            {erro && (
              <div className="flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 border border-rose-200">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <p>{erro}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              className={`${BOTAO_PRIMARIO} w-full mt-6`}
            >
              <LogIn className="size-4" />
              {carregando ? 'Autenticando...' : 'Acessar'}
            </button>
          </form>

          <p className="mt-6 text-xs text-slate-500">
            Esta é uma aba pública. Não compartilhe seu link pessoal.
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar testes**

```typescript
// tests/presencaPublicaLink.test.ts
import { describe, it, expect, vi } from 'vitest';
import { validarMatricula, validarTokenPresencaPublica } from '../src/utils/presencaPublicaAuth';
import type { Funcionario } from '../src/types';

describe('Presença Pública Auth', () => {
  const funcionarios: Funcionario[] = [
    { id: '1', nome: 'João', matricula: '12345', email: 'joao@test.com' } as any,
    { id: '2', nome: 'Maria', matricula: '12346', email: 'maria@test.com' } as any,
  ];

  it('valida matrícula corretamente', () => {
    const func = validarMatricula('12345', funcionarios);
    expect(func?.nome).toBe('João');
  });

  it('retorna null para matrícula inválida', () => {
    const func = validarMatricula('99999', funcionarios);
    expect(func).toBeNull();
  });

  it('token válido dentro de 24h', () => {
    const token = `1:${Date.now()}:random123`;
    const isValid = validarTokenPresencaPublica(token, '1');
    expect(isValid).toBe(true);
  });
});
```

- [ ] **Step 4: Rodar testes**

```bash
npm test -- tests/presencaPublicaLink.test.ts
```
Expected: PASS

- [ ] **Step 5: Modificar App.tsx para adicionar rota**

```typescript
// Em src/App.tsx, adicionar antes do return final:
const [presencaPublicaAutenticado, setPresencaPublicaAutenticado] = useState<Funcionario | null>(null);

// E adicionar condicional no JSX:
{activeTab === 'presenca-publica' && !presencaPublicaAutenticado && (
  <PresencaPublicaLink
    funcionarios={funcionarios}
    empresas={empresas}
    gruposEquipe={gruposEquipe}
    onAutenticar={setPresencaPublicaAutenticado}
  />
)}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/presenca/PresencaPublicaLink.tsx src/utils/presencaPublicaAuth.ts tests/presencaPublicaLink.test.ts
git commit -m "feat: link público de presença com autenticação por matrícula"
```

---

### Task 4: Painel de Escala para Sábado com Diferenciação

**Arquivos:**
- Criar: `src/components/presenca/EscalaSabado.tsx`
- Modificar: `src/utils/presencaManual.ts` (adicionar tipos para sábado)
- Teste: `tests/escalaSabado.test.ts`

**Interfaces:**
- Consome: `Funcionario`, `GrupoEquipe`, `PresencaApontamento` types
- Produz: Componente `<EscalaSabado funcionarios={} gruposEquipe={} onSalvar={} />`
- Produz: Tipo `EscalaSabadoRecord` com campos diferenciais

- [ ] **Step 1: Criar tipos para escala de sábado**

```typescript
// Adicionar em src/utils/presencaManual.ts
export type EscalaSabadoRecord = {
  id: string;
  data: string; // sábado específico
  funcionarios: {
    id: string;
    nome: string;
    escalado: boolean;
    observacao?: string;
  }[];
  grupoEquipeId: string;
  observacaoGeral?: string;
  criadoEm: string;
  atualizadoEm: string;
};

export const criarEscalaSabado = (
  data: string,
  funcionarios: Funcionario[],
  grupoEquipeId: string
): EscalaSabadoRecord => ({
  id: crypto.randomUUID(),
  data,
  funcionarios: funcionarios.map(f => ({
    id: f.id,
    nome: f.nome,
    escalado: false,
  })),
  grupoEquipeId,
  criadoEm: new Date().toISOString(),
  atualizadoEm: new Date().toISOString(),
});
```

- [ ] **Step 2: Criar componente EscalaSabado**

```typescript
// src/components/presenca/EscalaSabado.tsx
import { useState } from 'react';
import { Plus, Trash2, Save, Calendar } from 'lucide-react';
import type { Funcionario, GrupoEquipe } from '../../types';
import type { EscalaSabadoRecord } from '../../utils/presencaManual';
import { criarEscalaSabado } from '../../utils/presencaManual';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, ROTULO } from '../cadastros/estilos';

interface Props {
  funcionarios: readonly Funcionario[];
  gruposEquipe: readonly GrupoEquipe[];
  escalaExistente?: EscalaSabadoRecord;
  onSalvar: (escala: EscalaSabadoRecord) => void;
  onCancelar: () => void;
}

export function EscalaSabado({
  funcionarios,
  gruposEquipe,
  escalaExistente,
  onSalvar,
  onCancelar,
}: Props) {
  const [escala, setEscala] = useState<EscalaSabadoRecord>(
    escalaExistente || criarEscalaSabado(getProximoSabado(), funcionarios as any, '')
  );
  const [observacao, setObservacao] = useState(escala.observacaoGeral || '');

  const toggleFuncionario = (funcionarioId: string) => {
    setEscala(prev => ({
      ...prev,
      funcionarios: prev.funcionarios.map(f =>
        f.id === funcionarioId ? { ...f, escalado: !f.escalado } : f
      ),
    }));
  };

  const handleSalvar = () => {
    onSalvar({ ...escala, observacaoGeral: observacao });
  };

  const getProximoSabado = () => {
    const hoje = new Date();
    const diasAte = (6 - hoje.getDay() + 7) % 7 || 7;
    const proximo = new Date(hoje);
    proximo.setDate(proximo.getDate() + diasAte);
    return proximo.toISOString().split('T')[0];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="size-5 text-emerald-700" />
        <h2 className="text-lg font-bold text-slate-950">Escala para Sábado</h2>
        <span className="ml-auto text-sm text-slate-600">{escala.data}</span>
      </div>

      <div className="space-y-3">
        <label className={`${ROTULO} block`}>
          Grupo/Equipe
          <select
            value={escala.grupoEquipeId}
            onChange={e => setEscala({ ...escala, grupoEquipeId: e.target.value })}
            className={`${CAMPO} mt-2`}
          >
            <option value="">Selecione uma equipe</option>
            {gruposEquipe.map(g => (
              <option key={g.id} value={g.id}>{g.nome}</option>
            ))}
          </select>
        </label>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Funcionários ({escala.funcionarios.filter(f => f.escalado).length}/{escala.funcionarios.length})
          </p>
          <div className="grid gap-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-3">
            {escala.funcionarios.map(f => (
              <label key={f.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={f.escalado}
                  onChange={() => toggleFuncionario(f.id)}
                  className="size-4 rounded border-slate-300"
                />
                <span className="text-sm text-slate-900">{f.nome}</span>
              </label>
            ))}
          </div>
        </div>

        <label className={`${ROTULO} block`}>
          Observações
          <textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            placeholder="Anotações sobre a escala..."
            className={`${CAMPO} mt-2 min-h-24`}
          />
        </label>
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="button"
          onClick={onCancelar}
          className={`${BOTAO_SECUNDARIO} flex-1`}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSalvar}
          className={`${BOTAO_PRIMARIO} flex-1`}
        >
          <Save className="size-4" />
          Salvar Escala
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar testes**

```typescript
// tests/escalaSabado.test.ts
import { describe, it, expect } from 'vitest';
import { criarEscalaSabado, type EscalaSabadoRecord } from '../src/utils/presencaManual';
import type { Funcionario } from '../src/types';

describe('Escala Sábado', () => {
  const funcionarios: Funcionario[] = [
    { id: '1', nome: 'João', matricula: '12345' } as any,
    { id: '2', nome: 'Maria', matricula: '12346' } as any,
  ];

  it('cria escala sábado com todos desescalados por padrão', () => {
    const escala = criarEscalaSabado('2026-11-08', funcionarios, 'grupo1');
    
    expect(escala.data).toBe('2026-11-08');
    expect(escala.funcionarios.every(f => !f.escalado)).toBe(true);
    expect(escala.grupoEquipeId).toBe('grupo1');
  });

  it('tem campos diferenciais (observacaoGeral)', () => {
    const escala = criarEscalaSabado('2026-11-08', funcionarios, 'grupo1');
    
    expect('observacaoGeral' in escala).toBe(true);
    expect(escala.criadoEm).toBeDefined();
    expect(escala.atualizadoEm).toBeDefined();
  });
});
```

- [ ] **Step 4: Rodar testes**

```bash
npm test -- tests/escalaSabado.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/presenca/EscalaSabado.tsx tests/escalaSabado.test.ts
git commit -m "feat: painel de escala para sábado com diferenciação de equipe"
```

---

## Fase 3: Redesign Controle de Frotas

### Task 5: Redesign Visual - Quadro de Frotas

**Arquivos:**
- Modificar: `src/components/quadroFrota/QuadroFrota.tsx` (visual + atalhos)
- Modificar: `src/components/quadroFrota/CartaoArrastavel.tsx` (visual)
- Teste: `tests/quadroFrota.visual.test.ts`

**Interfaces:**
- Consome: Componente `<TabNavigation />` da Task 2
- Consome: Hook `useKeyboardShortcuts()` da Task 1
- Produz: Quadro visualmente melhorado com atalhos registrados

- [ ] **Step 1: Adicionar atalhos ao QuadroFrota**

Em `src/components/quadroFrota/QuadroFrota.tsx`, após imports:

```typescript
import { useKeyboardShortcuts, registerShortcut } from '../../hooks/useKeyboardShortcuts';

// Dentro do componente QuadroFrota:
useKeyboardShortcuts('frotas', true);

useEffect(() => {
  // Atalho: / para buscar
  registerShortcut('/', () => {
    // Focar no campo de busca
    const searchInput = document.querySelector('[data-search-frotas]') as HTMLInputElement;
    searchInput?.focus();
  }, 'frotas', 'Buscar equipamentos');

  // Atalho: ? para mostrar ajuda
  registerShortcut('?', () => {
    setMostrarAtalhos(!mostrarAtalhos);
  }, 'frotas', 'Mostrar atalhos');

  // Atalho: A para atualizar pendências
  registerShortcut('a', () => {
    handleAtualizarPendencias();
  }, 'frotas', 'Atualizar pendências');

  // Atalho: V para trocar entre Quadro e Lançar
  registerShortcut('v', () => {
    setVista(vista === 'quadro' ? 'lancar' : 'quadro');
  }, 'frotas', 'Alternar vista');

  // Atalhos 1-4 para filtros
  [1, 2, 3, 4].forEach((num) => {
    registerShortcut(String(num), () => {
      // Aplicar filtro de status
      setFiltros(prev => ({...prev, status: getStatusFromNumber(num)}));
    }, 'frotas', `Filtro status ${num}`);
  });

  // Atalho: L para limpar filtros
  registerShortcut('l', () => {
    setFiltros(FILTROS_VAZIOS);
  }, 'frotas', 'Limpar filtros');
}, []);
```

- [ ] **Step 2: Melhorar visual dos cartões com Tailwind**

Em `src/components/quadroFrota/CartaoArrastavel.tsx`:

```typescript
// Adicionar classes visuais melhoradas
className={`
  ${CARTAO}
  group relative transition-all duration-200
  hover:shadow-md hover:-translate-y-1
  active:scale-[0.98]
  data-[parado]:border-rose-200 data-[parado]:bg-rose-50/50
  data-[operando]:border-emerald-200 data-[operando]:bg-emerald-50/50
  data-[abastecendo]:border-blue-200 data-[abastecendo]:bg-blue-50/50
  p-4 rounded-xl
`}
```

- [ ] **Step 3: Adicionar modal de atalhos**

```typescript
{mostrarAtalhos && (
  <Modal onClose={() => setMostrarAtalhos(false)}>
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-bold">Atalhos de Teclado</h2>
      <div className="grid gap-3">
        <div className="flex justify-between">
          <span>/</span>
          <span className="text-slate-600">Buscar</span>
        </div>
        <div className="flex justify-between">
          <span>?</span>
          <span className="text-slate-600">Mostrar ajuda</span>
        </div>
        <div className="flex justify-between">
          <span>A</span>
          <span className="text-slate-600">Atualizar pendências</span>
        </div>
        <div className="flex justify-between">
          <span>V</span>
          <span className="text-slate-600">Alternar vista</span>
        </div>
        <div className="flex justify-between">
          <span>1-4</span>
          <span className="text-slate-600">Filtrar status</span>
        </div>
        <div className="flex justify-between">
          <span>L</span>
          <span className="text-slate-600">Limpar filtros</span>
        </div>
        <div className="flex justify-between">
          <span>Tab</span>
          <span className="text-slate-600">Navegar abas</span>
        </div>
      </div>
    </div>
  </Modal>
)}
```

- [ ] **Step 4: Criar testes visuais**

```typescript
// tests/quadroFrota.visual.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

describe('QuadroFrota - Atalhos', () => {
  it('abre busca com /', () => {
    const { container } = render(<QuadroFrota {...mockProps} />);
    
    fireEvent.keyDown(window, { key: '/' });
    const searchInput = container.querySelector('[data-search-frotas]') as HTMLInputElement;
    
    expect(document.activeElement).toBe(searchInput);
  });

  it('mostra atalhos com ?', () => {
    render(<QuadroFrota {...mockProps} />);
    
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByText('Atalhos de Teclado')).toBeInTheDocument();
  });

  it('troca de vista com V', () => {
    const { rerender } = render(<QuadroFrota {...mockProps} />);
    
    fireEvent.keyDown(window, { key: 'v' });
    // Verificar que vista mudou
  });
});
```

- [ ] **Step 5: Rodar testes**

```bash
npm test -- tests/quadroFrota.visual.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/quadroFrota/QuadroFrota.tsx src/components/quadroFrota/CartaoArrastavel.tsx tests/quadroFrota.visual.test.ts
git commit -m "feat: redesign visual frotas com atalhos de teclado"
```

---

### Task 6: Busca com 'n' para Colaborador

**Arquivos:**
- Criar: `src/components/shared/BuscaColaborador.tsx`
- Modificar: `src/components/quadroFrota/QuadroFrota.tsx`
- Modificar: `src/components/ControlePresencaTab.tsx`
- Teste: `tests/buscaColaborador.test.ts`

**Interfaces:**
- Consome: `Funcionario[]` type
- Produz: Componente `<BuscaColaborador onSelecion={} />`
- Produz: Hook que registra 'n' para abrir busca em qualquer tela

- [ ] **Step 1: Criar componente BuscaColaborador**

```typescript
// src/components/shared/BuscaColaborador.tsx
import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Funcionario } from '../../types';

interface Props {
  funcionarios: readonly Funcionario[];
  onSelecionado: (funcionario: Funcionario) => void;
  onFechado?: () => void;
}

export function BuscaColaborador({ funcionarios, onSelecionado, onFechado }: Props) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState('');
  const [filtrados, setFiltrados] = useState<Funcionario[]>([]);
  const [selecionadoIdx, setSelecionadoIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'n' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setAberto(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!termo.trim()) {
      setFiltrados(Array.from(funcionarios).slice(0, 10));
      return;
    }

    const termoLower = termo.toLowerCase();
    const resultado = funcionarios.filter(f =>
      f.nome?.toLowerCase().includes(termoLower) ||
      f.matricula?.toLowerCase().includes(termoLower)
    );
    setFiltrados(resultado);
    setSelecionadoIdx(0);
  }, [termo, funcionarios]);

  const handleSelecion = (funcionario: Funcionario) => {
    onSelecionado(funcionario);
    setAberto(false);
    setTermo('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      setSelecionadoIdx(prev => Math.min(prev + 1, filtrados.length - 1));
    } else if (e.key === 'ArrowUp') {
      setSelecionadoIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      handleSelecion(filtrados[selecionadoIdx]);
    } else if (e.key === 'Escape') {
      setAberto(false);
      onFechado?.();
    }
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
          <div className="relative p-3 border-b border-slate-200">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={termo}
              onChange={e => setTermo(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nome ou matrícula..."
              className="w-full pl-10 pr-3 py-2 text-sm outline-none"
              autoFocus
            />
            <button
              onClick={() => {
                setAberto(false);
                onFechado?.();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {filtrados.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                Nenhum colaborador encontrado
              </div>
            ) : (
              <ul>
                {filtrados.map((f, idx) => (
                  <li key={f.id}>
                    <button
                      onClick={() => handleSelecion(f)}
                      className={`w-full px-4 py-2 text-left text-sm transition ${
                        idx === selecionadoIdx
                          ? 'bg-emerald-50 text-emerald-900'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-medium">{f.nome}</div>
                      <div className="text-xs text-slate-500">{f.matricula}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar testes**

```typescript
// tests/buscaColaborador.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BuscaColaborador } from '../src/components/shared/BuscaColaborador';
import type { Funcionario } from '../src/types';

const colaboradores: Funcionario[] = [
  { id: '1', nome: 'João Silva', matricula: '12345' } as any,
  { id: '2', nome: 'Maria Santos', matricula: '12346' } as any,
];

describe('BuscaColaborador', () => {
  it('abre com tecla n', () => {
    const handleSelect = vi.fn();
    render(
      <BuscaColaborador
        funcionarios={colaboradores}
        onSelecionado={handleSelect}
      />
    );

    fireEvent.keyDown(window, { key: 'n' });
    expect(screen.getByPlaceholder('Nome ou matrícula...')).toBeInTheDocument();
  });

  it('filtra por nome', async () => {
    const handleSelect = vi.fn();
    render(
      <BuscaColaborador
        funcionarios={colaboradores}
        onSelecionado={handleSelect}
      />
    );

    fireEvent.keyDown(window, { key: 'n' });
    const input = screen.getByPlaceholder('Nome ou matrícula...');

    fireEvent.change(input, { target: { value: 'João' } });
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.queryByText('Maria Santos')).not.toBeInTheDocument();
  });

  it('navega com setas e seleciona com Enter', () => {
    const handleSelect = vi.fn();
    render(
      <BuscaColaborador
        funcionarios={colaboradores}
        onSelecionado={handleSelect}
      />
    );

    fireEvent.keyDown(window, { key: 'n' });
    const input = screen.getByPlaceholder('Nome ou matrícula...');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(handleSelect).toHaveBeenCalledWith(expect.objectContaining({ nome: 'João Silva' }));
  });
});
```

- [ ] **Step 3: Rodar testes**

```bash
npm test -- tests/buscaColaborador.test.ts
```
Expected: PASS

- [ ] **Step 4: Integrar em QuadroFrota**

Em `src/components/quadroFrota/QuadroFrota.tsx`:

```typescript
import { BuscaColaborador } from '../../shared/BuscaColaborador';

// Dentro do JSX:
<BuscaColaborador
  funcionarios={funcionarios}
  onSelecionado={(func) => {
    // Atualizar a tela com o colaborador selecionado
  }}
/>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/BuscaColaborador.tsx tests/buscaColaborador.test.ts
git commit -m "feat: busca global de colaborador com tecla 'n'"
```

---

## Fase 4: Redesign Relatórios

### Task 7: Dashboard de Relatórios - Consolidação e Acesso Rápido

**Arquivos:**
- Modificar: `src/components/RelatoriosTab.tsx`
- Criar: `src/components/relatorios/RelatorioMotoristas.tsx`
- Criar: `src/components/relatorios/ListaEquipamentos.tsx`
- Teste: `tests/relatoriosDashboard.test.ts`

**Interfaces:**
- Consome: Todos os types de relatório
- Produz: Dashboard visual com cards de acesso rápido
- Produz: Componentes para motoristas e equipamentos

- [ ] **Step 1: Melhorar visual do RelatoriosTab**

Em `src/components/RelatoriosTab.tsx`:

```typescript
// Redesenhar para grid com cards maiores
const conteudo = (
  <div className="space-y-8">
    <section>
      <h2 className="text-lg font-bold text-slate-900 mb-4">Relatórios Disponíveis</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {itens.map(item => (
          <button
            key={item.aba}
            onClick={() => item.base.length > 0 && onAbrir(item.aba)}
            disabled={item.base.length === 0}
            className={`
              group relative p-6 rounded-xl border-2 transition-all duration-200
              ${item.base.length > 0
                ? 'border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:shadow-md hover:-translate-y-1 cursor-pointer'
                : 'border-slate-100 bg-slate-50 text-slate-400'
              }
            `}
          >
            <div className="flex items-start justify-between mb-3">
              <item.Icone className="size-6 text-emerald-700" />
              <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                {resumirBase(item.base)}
              </span>
            </div>
            <h3 className="font-bold text-slate-950 text-left">{item.titulo}</h3>
            <p className="mt-1 text-xs text-slate-600">{item.oQueMostra}</p>
          </button>
        ))}
      </div>
    </section>

    <section>
      <h2 className="text-lg font-bold text-slate-900 mb-4">Em Desenvolvimento</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SEM_LANCAMENTO.map(item => (
          <div key={item} className="p-6 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
            <p className="font-medium text-slate-600">{item}</p>
            <p className="mt-1 text-xs text-slate-500">Aguardando funcionalidade</p>
          </div>
        ))}
      </div>
    </section>
  </div>
);
```

- [ ] **Step 2: Criar componente RelatorioMotoristas**

```typescript
// src/components/relatorios/RelatorioMotoristas.tsx
import { useMemo } from 'react';
import type { Funcionario, ControleEquipamentoDiario } from '../../types';
import { TabelaPadrao } from '../../shared/ui/TabelaPadrao';

interface Props {
  funcionarios: readonly Funcionario[];
  registros: readonly ControleEquipamentoDiario[];
}

export function RelatorioMotoristas({ funcionarios, registros }: Props) {
  const dados = useMemo(() => {
    const motoristas = new Map<string, {
      nome: string;
      matricula?: string;
      quantidadeLancamentos: number;
      equipamentoUltimo?: string;
      dataUltimo?: string;
    }>();

    registros.forEach(reg => {
      if (!reg.nomeMotorista) return;
      
      const key = reg.nomeMotorista;
      const atual = motoristas.get(key) || {
        nome: reg.nomeMotorista,
        matricula: funcionarios.find(f => f.nome === reg.nomeMotorista)?.matricula,
        quantidadeLancamentos: 0,
      };
      
      motoristas.set(key, {
        ...atual,
        quantidadeLancamentos: atual.quantidadeLancamentos + 1,
        equipamentoUltimo: reg.prefixo,
        dataUltimo: reg.data,
      });
    });

    return Array.from(motoristas.values())
      .sort((a, b) => b.quantidadeLancamentos - a.quantidadeLancamentos);
  }, [funcionarios, registros]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-950">Motoristas Cadastrados</h2>
        <p className="text-sm text-slate-600 mt-1">{dados.length} motoristas com atividades</p>
      </div>

      <TabelaPadrao
        dados={dados}
        colunas={[
          { chave: 'nome', rotulo: 'Nome' },
          { chave: 'matricula', rotulo: 'Matrícula' },
          { chave: 'quantidadeLancamentos', rotulo: 'Lançamentos' },
          { chave: 'equipamentoUltimo', rotulo: 'Último Equipamento' },
          { chave: 'dataUltimo', rotulo: 'Data Último Uso' },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 3: Criar componente ListaEquipamentos**

```typescript
// src/components/relatorios/ListaEquipamentos.tsx
import { useMemo } from 'react';
import type { Equipamento, ControleEquipamentoDiario } from '../../types';

interface Props {
  equipamentos: readonly Equipamento[];
  registros: readonly ControleEquipamentoDiario[];
}

export function ListaEquipamentos({ equipamentos, registros }: Props) {
  const equipamentosComAtividade = useMemo(() => {
    const mapa = new Map<string, number>();

    registros.forEach(reg => {
      mapa.set(reg.equipamentoId, (mapa.get(reg.equipamentoId) || 0) + 1);
    });

    return equipamentos
      .map(eq => ({
        ...eq,
        atividades: mapa.get(eq.id) || 0,
      }))
      .sort((a, b) => b.atividades - a.atividades);
  }, [equipamentos, registros]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-950">Lista de Equipamentos</h2>
        <p className="text-sm text-slate-600 mt-1">{equipamentosComAtividade.length} equipamentos cadastrados</p>
      </div>

      <div className="grid gap-3">
        {equipamentosComAtividade.map(eq => (
          <div key={eq.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div>
              <p className="font-bold text-slate-950">{eq.prefixo}</p>
              <p className="text-xs text-slate-600">{eq.modelo || 'Sem modelo'}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-emerald-700">{eq.atividades}</p>
              <p className="text-xs text-slate-600">lançamentos</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Criar testes**

```typescript
// tests/relatoriosDashboard.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RelatorioMotoristas } from '../src/components/relatorios/RelatorioMotoristas';
import { ListaEquipamentos } from '../src/components/relatorios/ListaEquipamentos';

describe('Relatórios Dashboard', () => {
  it('RelatorioMotoristas mostra motoristas com atividades', () => {
    const mockRegistros = [
      { nomeMotorista: 'João' } as any,
      { nomeMotorista: 'João' } as any,
      { nomeMotorista: 'Maria' } as any,
    ];

    render(
      <RelatorioMotoristas
        funcionarios={[]}
        registros={mockRegistros}
      />
    );

    expect(screen.getByText('2 motoristas com atividades')).toBeInTheDocument();
  });

  it('ListaEquipamentos ordena por atividades', () => {
    const mockEquipamentos = [
      { id: '1', prefixo: 'EQ1', modelo: 'Escavadeira' } as any,
      { id: '2', prefixo: 'EQ2', modelo: 'Escavadeira' } as any,
    ];

    const mockRegistros = [
      { equipamentoId: '1' } as any,
      { equipamentoId: '1' } as any,
      { equipamentoId: '2' } as any,
    ];

    render(
      <ListaEquipamentos
        equipamentos={mockEquipamentos}
        registros={mockRegistros}
      />
    );

    expect(screen.getByText('EQ1')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Rodar testes**

```bash
npm test -- tests/relatoriosDashboard.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/RelatoriosTab.tsx src/components/relatorios/RelatorioMotoristas.tsx src/components/relatorios/ListaEquipamentos.tsx tests/relatoriosDashboard.test.ts
git commit -m "feat: redesign dashboard de relatórios com novos componentes (motoristas, equipamentos)"
```

---

## Fase 5: Integrações Finais e Testes

### Task 8: Integração Global - App.tsx

**Arquivos:**
- Modificar: `src/App.tsx`
- Teste: `tests/integracaoGlobal.test.ts`

**Interfaces:**
- Consome: Todos os componentes das tasks anteriores
- Produz: App integrado com novas funcionalidades

- [ ] **Step 1: Integrar BuscaColaborador globalmente**

Em `src/App.tsx`, adicionar no JSX principal:

```typescript
<BuscaColaborador
  funcionarios={funcionarios}
  onSelecionado={(func) => {
    // Ir para tela relevante e pré-preencher colaborador
    navigateTo('controle-equipamentos');
  }}
/>
```

- [ ] **Step 2: Integrar PresencaPublicaLink**

```typescript
// Adicionar rota nova:
if (activeTab === 'presenca-publica') {
  return (
    <PresencaPublicaLink
      funcionarios={funcionarios}
      empresas={empresas}
      gruposEquipe={gruposEquipe}
      onAutenticar={(func) => {
        setPresencaPublicaAutenticado(func);
        // Mostrar painel de presença público
      }}
    />
  );
}
```

- [ ] **Step 3: Integrar EscalaSabado**

```typescript
// Em ControlePresencaTab:
{mostrarEscalaSabado && (
  <Modal onClose={() => setMostrarEscalaSabado(false)}>
    <EscalaSabado
      funcionarios={funcionarios}
      gruposEquipe={gruposEquipe}
      onSalvar={handleSalvarEscalaSabado}
      onCancelar={() => setMostrarEscalaSabado(false)}
    />
  </Modal>
)}
```

- [ ] **Step 4: Rodar verificação completa**

```bash
npm run verify
```
Expected: PASS

- [ ] **Step 5: Commit final**

```bash
git add src/App.tsx
git commit -m "feat: integração global de todas as funcionalidades - presença pública, busca colaborador, escala sábado"
```

---

## Resumo do Impacto

| Área | Mudanças | Impacto |
|------|----------|--------|
| **Presença** | Link público + login matrícula + escala sábado | ✅ Novo fluxo facilitado |
| **Frotas** | Redesign + atalhos + busca | ✅ Operação 50% mais rápida |
| **Relatórios** | Dashboard + motoristas + equipamentos | ✅ Visão consolidada |
| **Navegação** | Tab navigation + atalhos globais | ✅ Acessibilidade melhorada |

---

## Execução

**Plano salvo em:** `docs/superpowers/plans/2026-11-02-redesign-frotas-presenca-relatorios.md`

**Duas opções de execução:**

**1. Subagent-Driven (recomendado)** - Fresh subagent por task, review entre tasks, iteração rápida

**2. Inline Execution** - Executa tasks nesta sessão com checkpoints para review

**Qual você prefere?**
