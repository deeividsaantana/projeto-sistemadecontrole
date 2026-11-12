import { CLIENTE, PRODUTO } from '../../config/marca';
import logoClienteEscuro from '../../assets/images/logo-renea-dark.svg';
import logoClienteClaro from '../../assets/images/logo-renea-branco.png';

/**
 * Símbolo do produto: o C da Cintravyse recebe uma rota diagonal, como uma
 * frente de obra vista no mapa. Sem quadrado de fundo: o desenho fica direto
 * sobre a superfície (pedido de 11/11/2026). `claro` pinta o C de branco para
 * fundo escuro, como a foto da tela de entrada.
 */
export function SimboloProduto({ className = 'size-8', claro = false }: { className?: string; claro?: boolean }) {
  const traco = claro ? '#f4fff9' : '#0b4f3d';
  return (
    <svg viewBox="5 5 22 22" className={className} aria-hidden="true" focusable="false">
      <path d="M21.5 9.7A9 9 0 1 0 21.5 22.3" fill="none" stroke={traco} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M12.2 23.2 22.8 12.6" fill="none" stroke={claro ? '#79dfb0' : '#1f9d6a'} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="23" cy="12.4" r="2.1" fill={traco} />
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
      <SimboloProduto className="size-8 shrink-0" claro={claro} />
      <span className="min-w-0 leading-tight">
        <span className={`block text-[0.95rem] font-black tracking-[-0.02em] ${claro ? 'text-white' : 'text-slate-900'}`}>{PRODUTO.nome}</span>
        {cliente && <span className={`block truncate text-xs font-semibold ${claro ? 'text-[#8dc4ad]' : 'text-slate-500'}`}>{cliente}</span>}
      </span>
    </span>
  );
}

/**
 * Ambiente da empresa cliente: a palavra "Ambiente" e a logo da RENEA. Mostra
 * para quem entra de qual empresa é o espaço que está usando (pedido de
 * 11/11/2026). `claro` usa a logo branca, para o menu verde-escuro.
 */
export function AmbienteCliente({ claro = false, className = '' }: { claro?: boolean; className?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <span className={`text-xs font-semibold ${claro ? 'text-[#8dc4ad]' : 'text-slate-600'}`}>Ambiente</span>
      <img src={claro ? logoClienteClaro : logoClienteEscuro} alt={CLIENTE.nome} className="h-5 w-auto" />
    </span>
  );
}

/**
 * Cartão do ambiente no menu (barra lateral e gaveta do celular). A obra é
 * executada pela RENEA, então a logo dela ganha destaque: maior, num cartão
 * verde-claro, com "Ambiente" em cima (pedido de 11/11/2026).
 */
export function CartaoAmbiente({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-[#cfe3d8] bg-[#f3f8f5] px-3.5 py-3 ${className}`}>
      <span className="block text-xs font-semibold text-[#176b4d]">Ambiente</span>
      <img src={logoClienteEscuro} alt={CLIENTE.nome} className="mt-1.5 h-7 w-auto" />
    </div>
  );
}
