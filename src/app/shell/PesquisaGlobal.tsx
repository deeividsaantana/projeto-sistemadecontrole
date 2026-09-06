/**
 * Pesquisa global (atalho "/" ou Ctrl+K). Trabalha sobre o que já está em
 * memória — nenhuma consulta nova ao banco — e leva até a tela de origem, sem
 * exibir uma cópia do registro. O atalho não dispara enquanto o foco está em
 * campo de texto, para não atrapalhar quem está digitando.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import { buscarGlobal, type FontesBusca } from '../../utils/buscaGlobal';

interface PesquisaGlobalProps {
  fontes: FontesBusca;
  onNavigate: (tab: string) => void;
}

const editando = (alvo: EventTarget | null) => {
  const elemento = alvo as HTMLElement | null;
  if (!elemento) return false;
  const tag = elemento.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || elemento.isContentEditable;
};

export function PesquisaGlobal({ fontes, onNavigate }: PesquisaGlobalProps) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState('');
  const [indice, setIndice] = useState(0);
  const campoRef = useRef<HTMLInputElement>(null);

  const resultados = useMemo(() => aberto ? buscarGlobal(termo, fontes) : [], [aberto, termo, fontes]);

  useEffect(() => {
    const abrirPorAtalho = (evento: KeyboardEvent) => {
      const atalhoBarra = evento.key === '/' && !editando(evento.target);
      const atalhoK = evento.key.toLowerCase() === 'k' && (evento.ctrlKey || evento.metaKey);
      if (atalhoBarra || atalhoK) {
        evento.preventDefault();
        setAberto(true);
        setTermo('');
        setIndice(0);
      }
    };
    document.addEventListener('keydown', abrirPorAtalho);
    return () => document.removeEventListener('keydown', abrirPorAtalho);
  }, []);

  useEffect(() => {
    if (aberto) campoRef.current?.focus();
  }, [aberto]);

  if (!aberto) return null;

  const escolher = (tab: string) => {
    setAberto(false);
    onNavigate(tab);
  };

  const aoTeclar = (evento: React.KeyboardEvent) => {
    if (evento.key === 'Escape') {
      setAberto(false);
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
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 px-4 pt-20" role="dialog" aria-label="Pesquisa global">
      <div className="absolute inset-0" onClick={() => setAberto(false)} aria-hidden />
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
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
          {termo.trim().length < 2 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-500">Digite ao menos duas letras. Use ↑ ↓ para navegar e Enter para abrir.</p>
          ) : resultados.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-500">Nada encontrado para “{termo}”.</p>
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
