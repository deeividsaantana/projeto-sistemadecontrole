/**
 * Pesquisa global (atalho "/" ou Ctrl+K). Trabalha sobre o que já está em
 * memória — nenhuma consulta nova ao banco — e leva até a tela de origem, sem
 * exibir uma cópia do registro. O atalho não dispara enquanto o foco está em
 * campo de texto, para não atrapalhar quem está digitando. No celular, que não
 * tem teclado físico, abre pelo botão de lupa do topo. Só aparece resultado de
 * tela que o perfil abre (M8).
 *
 * É uma janela de verdade (A11): Esc fecha de qualquer ponto, o Tab fica
 * preso dentro dela e o foco volta para onde estava ao fechar. O campo segue
 * o padrão de caixa de combinação: as setas andam pela lista e o leitor de
 * tela ouve o resultado escolhido e quantos foram achados.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search, X } from 'lucide-react';
import { buscarGlobal, type FontesBusca } from '../../utils/buscaGlobal';

interface PesquisaGlobalProps {
  fontes: FontesBusca;
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  podeAbrir: (tab: string) => boolean;
  onNavigate: (tab: string) => void;
}

const editando = (alvo: EventTarget | null) => {
  const elemento = alvo as HTMLElement | null;
  if (!elemento) return false;
  const tag = elemento.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || elemento.isContentEditable;
};

export function PesquisaGlobal({ fontes, aberto, onAbertoChange: setAberto, podeAbrir, onNavigate }: PesquisaGlobalProps) {
  const [termo, setTermo] = useState('');
  const [indice, setIndice] = useState(0);
  const campoRef = useRef<HTMLInputElement>(null);
  const janelaRef = useRef<HTMLDivElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);
  const idLista = useId();
  const idOpcao = (posicao: number) => `${idLista}-opcao-${posicao}`;

  const resultados = useMemo(
    () => aberto ? buscarGlobal(termo, fontes).filter(resultado => podeAbrir(resultado.tab)) : [],
    [aberto, termo, fontes, podeAbrir],
  );

  useEffect(() => {
    const abrirPorAtalho = (evento: KeyboardEvent) => {
      const atalhoBarra = evento.key === '/' && !editando(evento.target);
      const atalhoK = evento.key.toLowerCase() === 'k' && (evento.ctrlKey || evento.metaKey);
      if (atalhoBarra || atalhoK) {
        evento.preventDefault();
        setAberto(true);
      }
    };
    document.addEventListener('keydown', abrirPorAtalho);
    return () => document.removeEventListener('keydown', abrirPorAtalho);
  }, [setAberto]);

  useEffect(() => {
    if (!aberto) return undefined;
    focoAnterior.current = document.activeElement as HTMLElement | null;
    setTermo('');
    setIndice(0);
    campoRef.current?.focus();
    const teclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        setAberto(false);
        return;
      }
      if (evento.key !== 'Tab' || !janelaRef.current) return;
      const focaveis = [...janelaRef.current.querySelectorAll<HTMLElement>('input, button:not([disabled])')];
      if (!focaveis.length) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo.focus(); }
      else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener('keydown', teclar);
    return () => {
      document.removeEventListener('keydown', teclar);
      focoAnterior.current?.focus?.();
    };
  }, [aberto, setAberto]);

  if (!aberto) return null;

  const escolher = (tab: string) => {
    setAberto(false);
    onNavigate(tab);
  };

  const aoTeclar = (evento: React.KeyboardEvent) => {
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

  const mostrandoLista = termo.trim().length >= 2 && resultados.length > 0;
  const aviso = termo.trim().length < 2
    ? 'Digite ao menos duas letras. Use ↑ ↓ para navegar e Enter para abrir.'
    : resultados.length === 0 ? `Nada encontrado para “${termo}”.` : `${resultados.length} resultado(s).`;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 px-4 pt-20">
      <div className="absolute inset-0" onClick={() => setAberto(false)} aria-hidden />
      <div ref={janelaRef} role="dialog" aria-modal="true" aria-label="Pesquisa global" className="relative w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <label className="flex items-center gap-2 border-b border-slate-100 px-4">
          <Search className="h-4 w-4 shrink-0 text-[#5b6870]" aria-hidden="true" />
          <span className="sr-only">Pesquisar em todo o sistema</span>
          <input
            ref={campoRef}
            value={termo}
            onChange={event => { setTermo(event.target.value); setIndice(0); }}
            onKeyDown={aoTeclar}
            role="combobox"
            aria-expanded={mostrandoLista}
            aria-controls={idLista}
            aria-autocomplete="list"
            aria-activedescendant={mostrandoLista && resultados[indice] ? idOpcao(indice) : undefined}
            placeholder="Buscar máquina, colaborador, OS, material…"
            className="min-h-12 w-full bg-transparent text-sm text-slate-800 outline-none"
          />
          <button type="button" onClick={() => setAberto(false)} aria-label="Fechar pesquisa" className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </label>

        <div className="max-h-80 overflow-y-auto">
          <p role="status" className={mostrandoLista ? 'sr-only' : 'px-4 py-6 text-center text-sm text-slate-600'}>{aviso}</p>
          {mostrandoLista && (
            <ul id={idLista} role="listbox" aria-label="Resultados da pesquisa" className="divide-y divide-slate-100">
              {resultados.map((resultado, posicao) => (
                <li
                  key={resultado.id}
                  id={idOpcao(posicao)}
                  role="option"
                  aria-selected={posicao === indice}
                  onMouseEnter={() => setIndice(posicao)}
                  onClick={() => escolher(resultado.tab)}
                  className={`flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors ${posicao === indice ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                >
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-600">
                    {resultado.tipo}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-800">{resultado.titulo}</span>
                    {resultado.subtitulo && <span className="block truncate text-xs text-slate-600">{resultado.subtitulo}</span>}
                  </span>
                  {posicao === indice && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
