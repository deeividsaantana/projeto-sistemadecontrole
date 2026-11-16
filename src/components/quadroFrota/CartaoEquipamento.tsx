/**
 * Ficha de uma máquina no quadro: prefixo grande, operador embaixo e a cor da
 * situação na borda esquerda. Pequena de propósito, para caber a frota toda na
 * tela. A ficha inteira é o botão que abre o lançamento da máquina.
 */
import { ROTULO_GRUPO, type CartaoFrota, type GrupoStatus } from '../../modules/frota/quadroFrota';
import { FOCO } from '../cadastros/estilos';

/** Cor de cada situação: faixa, fundo, etiqueta, bolinha e borda da ficha. */
export const TOM: Record<GrupoStatus, { faixa: string; fundo: string; etiqueta: string; ponto: string; borda: string }> = {
  operando: { faixa: 'bg-[#176b4d]', fundo: 'bg-emerald-50', etiqueta: 'bg-emerald-50 text-emerald-800 ring-emerald-200', ponto: 'bg-emerald-500', borda: 'border-l-[#176b4d]' },
  manutencao: { faixa: 'bg-rose-600', fundo: 'bg-rose-50', etiqueta: 'bg-rose-50 text-rose-800 ring-rose-200', ponto: 'bg-rose-500', borda: 'border-l-rose-500' },
  parado: { faixa: 'bg-amber-400', fundo: 'bg-amber-50', etiqueta: 'bg-amber-50 text-amber-800 ring-amber-200', ponto: 'bg-amber-400', borda: 'border-l-amber-400' },
  'sem-lancamento': { faixa: 'bg-slate-300', fundo: 'bg-slate-100', etiqueta: 'bg-slate-100 text-slate-600 ring-slate-200', ponto: 'bg-slate-400', borda: 'border-l-slate-300' },
};

export const numero = (valor: number) => valor.toLocaleString('pt-BR');

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] || '';

export function CartaoEquipamento({ cartao, onAbrir, selecionado }: { cartao: CartaoFrota; onAbrir: () => void; selecionado?: boolean }) {
  const tom = TOM[cartao.grupo];
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-pressed={selecionado}
      data-quadro-cartao
      data-testid={`quadro-cartao-${cartao.prefixo}`}
      title={`${cartao.prefixo} · ${cartao.modelo}${cartao.frente ? ` · ${cartao.frente}` : ''}`}
      aria-label={`${cartao.prefixo}, ${cartao.modelo}, ${ROTULO_GRUPO[cartao.grupo]}${cartao.operador ? `, operador ${cartao.operador}` : ', sem operador'}`}
      className={`flex min-h-11 w-full min-w-0 flex-col justify-center rounded-lg border border-l-4 border-slate-200 ${tom.borda} bg-white py-1 pl-2 pr-8 text-left transition duration-150 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] ${selecionado ? 'bg-emerald-50 outline outline-2 outline-offset-1 outline-[#176b4d]' : ''} ${FOCO}`}
    >
      <strong className="truncate font-mono text-sm font-extrabold leading-tight text-slate-900">{cartao.prefixo}</strong>
      <span className={`truncate text-xs font-semibold leading-tight ${cartao.operador ? 'text-slate-500' : 'text-[#c2410c]'}`}>
        {cartao.operador ? primeiroNome(cartao.operador) : 'sem operador'}
      </span>
    </button>
  );
}
