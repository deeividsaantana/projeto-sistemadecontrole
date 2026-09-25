import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { AlertTriangle, Lock } from 'lucide-react';
import type { UsoCadastro } from './CadastroDetalhe';
import { BOTAO_PERIGO, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, reduzMovimento } from './estilos';

export type AcaoConfirmacao = 'excluir' | 'inativar';

interface Props {
  acao: AcaoConfirmacao;
  nome: string;
  codigo: string;
  usos: UsoCadastro[];
  /** O tipo aceita inativar (colaborador, empresa, equipamento, local). */
  podeInativar: boolean;
  processando: boolean;
  onConfirmar: () => void;
  onInativarNoLugar: () => void;
  onCancelar: () => void;
}

/**
 * Confirmação com o nome do cadastro, o que vai acontecer e onde recuperar.
 * Cadastro usado em lançamento não é excluído: a janela mostra onde ele
 * aparece e oferece inativar, que mantém o nome no histórico.
 */
export default function CadastroConfirmacao({ acao, nome, codigo, usos, podeInativar, processando, onConfirmar, onInativarNoLugar, onCancelar }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const cancelar = useRef(onCancelar);
  cancelar.current = onCancelar;
  const travada = acao === 'excluir' && usos.length > 0;

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

  const titulo = travada
    ? `Não dá para excluir ${nome}`
    : acao === 'excluir' ? `Excluir ${nome}?` : `Inativar ${nome}?`;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/40 sm:items-center sm:p-5" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCancelar(); }}>
      <div
        ref={caixa}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cadastro-delete-title"
        aria-describedby="cadastro-delete-texto"
        data-testid="cadastro-confirmacao"
        className="w-full max-w-md space-y-4 rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <div className={`inline-flex size-11 items-center justify-center rounded-xl ${travada ? 'bg-amber-50 text-amber-700' : acao === 'excluir' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
          {travada ? <Lock className="size-5" aria-hidden="true" /> : <AlertTriangle className="size-5" aria-hidden="true" />}
        </div>
        <div className="space-y-2">
          <h2 id="cadastro-delete-title" className="break-words text-lg font-bold leading-snug text-slate-900">{titulo}</h2>
          <p id="cadastro-delete-texto" className="text-sm leading-relaxed text-slate-600">
            {travada
              ? podeInativar
                ? 'Ele aparece em lançamentos. Se sumir, esses lançamentos ficam sem nome no histórico e nos relatórios. Inative: ele sai das listas de escolha e o histórico continua certo.'
                : 'Ele aparece em lançamentos. Se sumir, esses lançamentos ficam sem nome no histórico e nos relatórios.'
              : acao === 'excluir'
                ? 'Ele sai deste aparelho, do Firebase e dos outros aparelhos. Fica na Lixeira desta aba, onde dá para restaurar.'
                : 'Ele sai das listas de escolha, mas continua no histórico e nos lançamentos antigos. Dá para reativar quando quiser.'}
          </p>
        </div>
        {travada && (
          <ul className="space-y-1.5" aria-label="Onde é usado">
            {usos.map(uso => (
              <li key={uso.collection} className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <span>{uso.collection}</span>
                <strong className="tabular-nums">{uso.count.toLocaleString('pt-BR')}</strong>
              </li>
            ))}
          </ul>
        )}
        {codigo && !travada && <p className="font-mono text-xs text-slate-500">Código {codigo}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" onClick={onCancelar} disabled={processando} className={`${BOTAO_SECUNDARIO} flex-1`} data-foco-inicial>
            {travada && !podeInativar ? 'Entendi' : 'Cancelar'}
          </button>
          {travada ? podeInativar && (
            <button type="button" onClick={onInativarNoLugar} disabled={processando} className={`${BOTAO_PRIMARIO} flex-1`}>
              Inativar
            </button>
          ) : (
            <button type="button" onClick={onConfirmar} disabled={processando} className={`${acao === 'excluir' ? BOTAO_PERIGO : BOTAO_PRIMARIO} flex-1`} data-testid="cadastro-confirmar">
              {processando ? 'Aguarde…' : acao === 'excluir' ? 'Excluir' : 'Inativar'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
