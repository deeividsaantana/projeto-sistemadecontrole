import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { AlertTriangle, Lock } from 'lucide-react';
import type { UsoCadastro } from './CadastroDetalhe';
import { BOTAO_PERIGO, BOTAO_SECUNDARIO, reduzMovimento } from './estilos';

export interface ItemTravado {
  id: string;
  titulo: string;
  usos: UsoCadastro[];
}

interface Props {
  tipo: string;
  livres: number;
  travados: ItemTravado[];
  processando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

const MOSTRAR_TRAVADOS = 6;

const plural = (total: number, um: string, varios: string) => `${total.toLocaleString('pt-BR')} ${total === 1 ? um : varios}`;

/**
 * Confirmação da exclusão em lote. Diz quantos saem e quais ficam por estar
 * em uso, antes de gravar qualquer coisa. Os que ficam não são tocados.
 */
export default function CadastroConfirmacaoLote({ tipo, livres, travados, processando, onConfirmar, onCancelar }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const cancelar = useRef(onCancelar);
  cancelar.current = onCancelar;

  useEffect(() => {
    caixa.current?.querySelector<HTMLElement>('[data-foco-inicial]')?.focus();
    const tecla = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelar.current();
    };
    document.addEventListener('keydown', tecla);
    if (!reduzMovimento() && caixa.current) {
      gsap.fromTo(caixa.current, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.28, ease: 'power3.out', clearProps: 'transform,opacity' });
    }
    return () => document.removeEventListener('keydown', tecla);
  }, []);

  const nada = livres === 0;
  const titulo = nada
    ? 'Nenhum dos marcados pode ser excluído'
    : `Excluir ${plural(livres, 'cadastro', 'cadastros')} de ${tipo.toLowerCase()}?`;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/40 sm:items-center sm:p-5" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCancelar(); }}>
      <div
        ref={caixa}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cadastro-lote-titulo"
        aria-describedby="cadastro-lote-texto"
        data-testid="cadastro-confirmacao-lote"
        className="max-h-[92dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <div className={`inline-flex size-11 items-center justify-center rounded-xl ${nada ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
          {nada ? <Lock className="size-5" aria-hidden="true" /> : <AlertTriangle className="size-5" aria-hidden="true" />}
        </div>
        <div className="space-y-2">
          <h2 id="cadastro-lote-titulo" className="break-words text-lg font-bold leading-snug text-slate-900">{titulo}</h2>
          <p id="cadastro-lote-texto" className="text-sm leading-relaxed text-slate-600">
            {nada
              ? 'Todos aparecem em lançamentos. Para tirar da lista sem quebrar o histórico, abra cada um e use Inativar.'
              : 'Eles saem deste aparelho, do Firebase e dos outros aparelhos. Ficam na Lixeira desta aba, onde dá para restaurar.'}
          </p>
        </div>
        {travados.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-bold text-amber-900">
              {nada ? 'Onde aparecem' : `${plural(travados.length, 'fica', 'ficam')} de fora por estar em uso`}
            </p>
            <ul className="space-y-1.5" aria-label="Ficam de fora">
              {travados.slice(0, MOSTRAR_TRAVADOS).map(item => (
                <li key={item.id} className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <span className="block truncate font-semibold">{item.titulo}</span>
                  <span className="block text-amber-800">{item.usos.map(uso => `${uso.collection} (${uso.count.toLocaleString('pt-BR')})`).join(', ')}</span>
                </li>
              ))}
            </ul>
            {travados.length > MOSTRAR_TRAVADOS && (
              <p className="text-sm text-amber-800">e mais {plural(travados.length - MOSTRAR_TRAVADOS, 'outro', 'outros')}.</p>
            )}
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" onClick={onCancelar} disabled={processando} className={`${BOTAO_SECUNDARIO} flex-1`} data-foco-inicial>
            {nada ? 'Entendi' : 'Cancelar'}
          </button>
          {!nada && (
            <button type="button" onClick={onConfirmar} disabled={processando} className={`${BOTAO_PERIGO} flex-1`} data-testid="cadastro-confirmar-lote">
              {processando ? 'Excluindo…' : `Excluir ${livres.toLocaleString('pt-BR')}`}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
