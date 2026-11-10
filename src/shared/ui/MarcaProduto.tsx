import { PRODUTO } from '../../config/marca';

/**
 * Símbolo do produto: um quadrado verde com um C aberto e uma estaca. Fica
 * no lugar onde antes ia o logo da RENEA (menu, topo do celular, entrada).
 */
export function SimboloProduto({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="#176b4d" />
      <path d="M21.5 10.2A8 8 0 1 0 21.5 21.8" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <rect x="18.6" y="14.4" width="5" height="3.2" rx="1.2" fill="#9be3c3" />
    </svg>
  );
}

interface MarcaProdutoProps {
  /** Fundo escuro (menu lateral, entrada): letras claras. */
  claro?: boolean;
  /** Mostra a linha da empresa cliente embaixo do nome. */
  cliente?: string;
  className?: string;
}

/** Símbolo + nome do produto, e opcionalmente a empresa cliente embaixo. */
export function MarcaProduto({ claro = false, cliente, className = '' }: MarcaProdutoProps) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}>
      <SimboloProduto className="size-8 shrink-0" />
      <span className="min-w-0 leading-tight">
        <span className={`block text-[0.95rem] font-black tracking-[-0.02em] ${claro ? 'text-white' : 'text-slate-900'}`}>{PRODUTO.nome}</span>
        {cliente && <span className={`block truncate text-xs font-semibold ${claro ? 'text-[#8dc4ad]' : 'text-slate-500'}`}>{cliente}</span>}
      </span>
    </span>
  );
}
