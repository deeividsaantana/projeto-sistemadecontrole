/**
 * Pesquisa global (atalho "/" ou Ctrl+K). Trabalha sobre o que já está em
 * memória — nenhuma consulta nova ao banco — e leva até a tela de origem, sem
 * exibir uma cópia do registro. O atalho não dispara enquanto o foco está em
 * campo de texto, para não atrapalhar quem está digitando.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import { buscarGlobal, type FontesBusca } from '../../utils/buscaGlobal';
import type { NavigationGroupView } from './NavigationMenu';

interface PesquisaGlobalProps {
  fontes: FontesBusca;
  groups: NavigationGroupView[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (tab: string) => void;
}

const editando = (alvo: EventTarget | null) => {
  const elemento = alvo as HTMLElement | null;
  if (!elemento) return false;
  const tag = elemento.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || elemento.isContentEditable;
};

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR');

export function PesquisaGlobal({ fontes, groups, open, onOpenChange, onNavigate }: PesquisaGlobalProps) {
  const [termo, setTermo] = useState('');
  const [indice, setIndice] = useState(0);
  const campoRef = useRef<HTMLInputElement>(null);

  const registros = useMemo(() => open ? buscarGlobal(termo, fontes) : [], [open, termo, fontes]);
  const modulos = useMemo(() => {
    if (!open) return [];
    const query = normalize(termo.trim());
    const items = groups.flatMap(group => group.items.map(item => ({ ...item, grupo: group.label })));
    if (!query) return items.filter(item => ['dashboard', 'modo-campo', 'central-operacional', 'presenca', 'lancamentos', 'materiais', 'relatorios'].includes(item.id));
    return items.filter(item => normalize(`${item.label} ${item.grupo}`).includes(query));
  }, [groups, open, termo]);
  const resultados = useMemo(() => [
    ...modulos.map(item => ({ id: `modulo-${item.id}`, titulo: item.label, subtitulo: item.grupo, tipo: 'Módulo', tab: item.id })),
    ...registros,
  ], [modulos, registros]);

  useEffect(() => {
    const abrirPorAtalho = (evento: KeyboardEvent) => {
      const atalhoBarra = evento.key === '/' && !editando(evento.target);
      const atalhoK = evento.key.toLowerCase() === 'k' && (evento.ctrlKey || evento.metaKey);
      if (atalhoBarra || atalhoK) {
        evento.preventDefault();
        onOpenChange(true);
        setTermo('');
        setIndice(0);
      }
    };
    document.addEventListener('keydown', abrirPorAtalho);
    return () => document.removeEventListener('keydown', abrirPorAtalho);
  }, [onOpenChange]);

  useEffect(() => {
    if (open) campoRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const escolher = (tab: string) => {
    onOpenChange(false);
    onNavigate(tab);
  };

  const aoTeclar = (evento: React.KeyboardEvent) => {
    if (evento.key === 'Escape') {
      onOpenChange(false);
      return;
    }
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setIndice(atual => Math.min(atual + 1, resultados.length - 1));
    }
    if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setIndice(atual => Math.max(atual - 1, 0));
    }
    if (evento.key === 'Enter' && resultados[indice]) {
      evento.preventDefault();
      escolher(resultados[indice].tab);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-start justify-center px-4 pt-20" style={{ backgroundColor: 'rgb(19 33 28 / 0.36)' }} role="dialog" aria-label="Pesquisa global">
      <div className="absolute inset-0" onClick={() => onOpenChange(false)} aria-hidden />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <label className="flex items-center gap-2 border-b border-slate-100 px-4">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="sr-only">Pesquisar em todo o sistema</span>
          <input
            ref={campoRef}
            value={termo}
            onChange={event => { setTermo(event.target.value); setIndice(0); }}
            onKeyDown={aoTeclar}
            placeholder="Buscar equipamento, colaborador, OS, FVS, NC, documento…"
            className="min-h-12 w-full bg-transparent text-sm text-slate-800 outline-none"
          />
          <kbd className="shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">ESC</kbd>
        </label>

        <div className="max-h-80 overflow-y-auto">
          {resultados.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-500">{termo.trim().length < 2 ? 'Digite ao menos duas letras para pesquisar registros.' : `Nada encontrado para “${termo}”.`}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {resultados.map((resultado, posicao) => (
                <li key={resultado.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setIndice(posicao)}
                    onClick={() => escolher(resultado.tab)}
                    className={`flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${posicao === indice ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                  >
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                      {resultado.tipo}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-800">{resultado.titulo}</span>
                      {resultado.subtitulo && <span className="block truncate text-[11px] text-slate-500">{resultado.subtitulo}</span>}
                    </span>
                    {posicao === indice && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
