import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './styles';

export type TomIndicador = 'neutro' | 'verde' | 'laranja' | 'vermelho';

type AtributosData = { [chave: `data-${string}`]: string | boolean | undefined };

interface CartaoIndicadorProps {
  rotulo: string;
  valor: ReactNode;
  /** Uma linha curta embaixo do número: de onde ele vem ou o que fazer. */
  detalhe?: ReactNode;
  icone?: LucideIcon;
  /** Cor do número. Verde = bom, laranja = atenção, vermelho = problema. */
  tom?: TomIndicador;
  /** Torna o cartão um botão que leva ao detalhe do número. */
  onClick?: () => void;
  /** Rótulo para o leitor de tela quando o cartão é botão. */
  ariaLabel?: string;
  className?: string;
  /** Atributos data-* da tela (entrada do GSAP, testes). */
  dados?: AtributosData;
}

const COR_DO_VALOR: Record<TomIndicador, string> = {
  neutro: 'text-slate-900',
  verde: 'text-[#176b4d]',
  laranja: 'text-[#c2410c]',
  vermelho: 'text-rose-700',
};

const COR_DO_ICONE: Record<TomIndicador, string> = {
  neutro: 'bg-[#f7f8f6] text-[#5b6870]',
  verde: 'bg-emerald-50 text-[#176b4d]',
  laranja: 'bg-orange-50 text-[#c2410c]',
  vermelho: 'bg-rose-50 text-rose-700',
};

/**
 * Cartão de número do topo das abas, no mesmo desenho do Painel de Controle:
 * rótulo à esquerda, ícone à direita, número grande e uma linha de detalhe.
 * Toda aba usa este cartão, para o mesmo tipo de informação ter a mesma cara
 * em qualquer tela.
 */
export function CartaoIndicador({ rotulo, valor, detalhe, icone: Icone, tom = 'neutro', onClick, ariaLabel, className, dados }: CartaoIndicadorProps) {
  const conteudo = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-sm font-bold leading-snug text-slate-600 [overflow-wrap:anywhere]">{rotulo}</span>
        {Icone && (
          <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', COR_DO_ICONE[tom])}>
            <Icone className="size-4" aria-hidden="true" />
          </span>
        )}
      </span>
      <strong className={cn('mt-1 block text-3xl font-black leading-tight tracking-tight tabular-nums', COR_DO_VALOR[tom])}>{valor}</strong>
      {detalhe && <span className="mt-1 block text-xs font-semibold text-[#5b6870]">{detalhe}</span>}
    </>
  );
  const classe = cn('renea-indicador block min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-left', className);
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      {...dados}
      className={cn(classe, 'w-full cursor-pointer transition duration-200 hover:border-emerald-300 hover:shadow-sm active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--renea-focus)')}
    >
      {conteudo}
    </button>
  ) : (
    <div {...dados} className={classe}>{conteudo}</div>
  );
}

/** Grade dos cartões de número: dois por linha no celular, quatro no computador. */
export function GradeIndicadores({ children, rotulo, className, colunas = 4 }: { children: ReactNode; rotulo?: string; className?: string; colunas?: 3 | 4 }) {
  return (
    <section aria-label={rotulo} className={cn('grid grid-cols-2 gap-3', colunas === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4', className)}>
      {children}
    </section>
  );
}
