/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

  const fechar = () => {
    setAberto(false);
    onFechado?.();
  };

  // Registra o listener para tecla 'n'
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

  // Atualiza a lista filtrada quando o termo muda
  useEffect(() => {
    if (!termo.trim()) {
      setFiltrados(Array.from(funcionarios).slice(0, 10));
      setSelecionadoIdx(0);
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
      if (filtrados.length > 0) {
        handleSelecion(filtrados[selecionadoIdx]);
      }
    } else if (e.key === 'Escape') {
      fechar();
    }
  };

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/20"
      onMouseDown={e => {
        if (e.target === e.currentTarget) fechar();
      }}
    >
      <div className="w-full max-w-md" role="dialog" aria-modal="true" aria-label="Buscar colaborador">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
          <div className="relative p-3 border-b border-slate-200">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
            <input
              ref={inputRef}
              type="text"
              value={termo}
              onChange={e => setTermo(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nome ou matrícula..."
              aria-label="Nome ou matrícula"
              className="w-full pl-10 pr-3 py-2 text-sm outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar busca"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {filtrados.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                Nenhum colaborador encontrado
              </div>
            ) : (
              <ul role="listbox">
                {filtrados.map((f, idx) => {
                  const isSelected = idx === selecionadoIdx;
                  return (
                    <li key={f.id} role="option" aria-selected={isSelected}>
                      <button
              type="button"
                        onClick={() => handleSelecion(f)}
                        className={`w-full px-4 py-2 text-left text-sm transition ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-900'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-medium">{f.nome}</div>
                        <div className="text-xs text-slate-500">{f.matricula || 'Sem matrícula'}</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
