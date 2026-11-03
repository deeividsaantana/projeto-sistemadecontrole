/**
 * Cartão de uma máquina no quadro: desenho ou foto num fundo da cor da
 * situação, prefixo grande, modelo, horímetro e operador. O cartão inteiro é
 * o botão que abre o detalhe.
 */
import { Gauge } from 'lucide-react';
import { ROTULO_GRUPO, type CartaoFrota, type GrupoStatus } from '../../modules/frota/quadroFrota';
import { DesenhoMaquina } from './DesenhoMaquina';
import { FOCO } from '../cadastros/estilos';

/** Cor de cada situação: faixa, fundo do desenho, etiqueta e bolinha. */
export const TOM: Record<GrupoStatus, { faixa: string; fundo: string; etiqueta: string; ponto: string }> = {
  operando: { faixa: 'bg-emerald-600', fundo: 'from-emerald-100 to-emerald-50', etiqueta: 'bg-emerald-100 text-emerald-900 ring-emerald-300 font-semibold', ponto: 'bg-emerald-500' },
  manutencao: { faixa: 'bg-rose-700', fundo: 'from-rose-100 to-rose-50', etiqueta: 'bg-rose-100 text-rose-900 ring-rose-300 font-semibold', ponto: 'bg-rose-600' },
  parado: { faixa: 'bg-amber-600', fundo: 'from-amber-100 to-amber-50', etiqueta: 'bg-amber-100 text-amber-900 ring-amber-300 font-semibold', ponto: 'bg-amber-500' },
  'sem-lancamento': { faixa: 'bg-slate-400', fundo: 'from-slate-200 to-slate-100', etiqueta: 'bg-slate-200 text-slate-800 ring-slate-300 font-semibold', ponto: 'bg-slate-500' },
};

export const numero = (valor: number) => valor.toLocaleString('pt-BR');

const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map(parte => parte[0]).join('').toUpperCase();

export function CartaoEquipamento({ cartao, onAbrir }: { cartao: CartaoFrota; onAbrir: () => void }) {
  const tom = TOM[cartao.grupo];
  return (
    <button
      type="button"
      onClick={onAbrir}
      data-quadro-cartao
      data-testid={`quadro-cartao-${cartao.prefixo}`}
      aria-label={`${cartao.prefixo}, ${cartao.modelo}, ${ROTULO_GRUPO[cartao.grupo]}${cartao.operador ? `, operador ${cartao.operador}` : ', sem operador'}`}
      className={`group relative flex min-h-[8.5rem] flex-col overflow-hidden rounded-xl bg-white p-1.5 text-left shadow-[0_2px_8px_rgba(15,40,31,0.1)] ring-1.5 ring-slate-200 transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(15,40,31,0.4)] hover:ring-emerald-400 active:scale-[0.97] ${FOCO}`}
    >
      <span className={`relative grid h-11 place-items-center overflow-hidden rounded-lg bg-gradient-to-b ${tom.fundo}`}>
        <span className={`absolute inset-x-0 top-0 h-1 ${tom.faixa}`} aria-hidden="true" />
        {cartao.foto
          ? <img src={cartao.foto} alt="" className="h-full w-full object-cover" loading="lazy" />
          : <DesenhoMaquina tipo={cartao.silhueta} className="h-9 w-16 drop-shadow-[0_6px_6px_rgba(15,40,31,0.12)] transition duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-0.5 group-hover:scale-[1.06]" />}
      </span>
      <span className="flex flex-1 flex-col px-2 pb-1 pt-2">
        <strong className="font-mono text-sm font-extrabold leading-tight tracking-tighter text-slate-950">{cartao.prefixo}</strong>
        <span className="line-clamp-1 text-xs font-medium uppercase tracking-widest text-slate-600">{cartao.modelo}</span>
        <span className="mt-2 flex items-center gap-1.5 font-mono text-xs text-slate-600">
          <Gauge className="size-3.5 text-slate-500" aria-hidden="true" />
          <span className="font-semibold">{cartao.horimetro ? `${numero(cartao.horimetro)} h` : '—'}</span>
        </span>
        <span className="mt-2 flex min-w-0 items-center gap-1.5">
          {cartao.operador ? (
            <>
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white ring-1 ring-emerald-700" aria-hidden="true">{iniciais(cartao.operador)}</span>
              <span className="truncate text-xs font-semibold text-slate-800">{cartao.operador.split(' ')[0]}</span>
            </>
          ) : (
            <>
              <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-dashed border-rose-300 bg-rose-50 text-xs font-bold text-rose-700" aria-hidden="true">—</span>
              <span className="truncate text-xs font-medium text-slate-500">sem operador</span>
            </>
          )}
        </span>
        <span className="mt-auto pt-2">
          <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold uppercase ring-1 ring-inset ${tom.etiqueta}`}>
            <span className={`size-2 rounded-full ${tom.ponto} ${cartao.grupo === 'operando' ? 'animate-pulse motion-reduce:animate-none' : ''}`} aria-hidden="true" />
            {ROTULO_GRUPO[cartao.grupo]}
          </span>
        </span>
      </span>
    </button>
  );
}
