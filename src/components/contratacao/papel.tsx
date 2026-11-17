import type { ReactNode } from 'react';
import logoCliente from '../../assets/images/logo-renea-dark.svg';
import { CLIENTE } from '../../config/marca';
import { FOCO } from '../cadastros/estilos';
import type { FormularioContratacao } from '../../services/contratacaoApi';

/**
 * Peças dos documentos em papel (promoção e desligamento), no desenho dos
 * modelos da RENEA: cabeçalho com a logo numa caixa e o título ao lado,
 * campos com linha embaixo, quadradinhos para marcar. A mesma folha aparece
 * na tela, no link e no PDF: o que muda é só se o campo aceita digitar.
 */

/** O que cada corpo de documento recebe da folha. */
export interface CorpoProps {
  form: FormularioContratacao;
  /** Folha em branco (aceita digitar) ou travada (pedido salvo). */
  novo: boolean;
  mudar: (campo: keyof FormularioContratacao, valor: string) => void;
  /** Marca ou desmarca um item de uma lista (convênios, procedimentos...). */
  alternar: (campo: keyof FormularioContratacao, item: string) => void;
  erroDe: (nome: string) => Record<string, unknown>;
  mensagem: (nome: string) => ReactNode;
}

export function CabecalhoPapel({ codigo, titulo }: { codigo: string; titulo: string }) {
  return (
    <header className="px-4 pt-4 sm:px-6">
      <p className="mb-1 text-xs uppercase text-[#5b6870]">{codigo}</p>
      <div className="grid grid-cols-[96px_1fr] border border-[#26302b] sm:grid-cols-[140px_1fr]">
        <div className="grid place-items-center border-r border-[#26302b] p-3">
          <img src={logoCliente} alt={CLIENTE.nome} className="h-8 w-auto" />
        </div>
        <h2 className="grid place-items-center p-3 text-center text-lg font-bold text-slate-900 sm:text-xl">{titulo}</h2>
      </div>
    </header>
  );
}

/** Campo do papel: o traço embaixo é o mesmo digitando ou já preenchido. */
export const entradaPapel = (novo: boolean) => `ct-campo-papel min-h-10 w-full min-w-0 flex-1 basis-28 rounded-none border-0 border-b bg-transparent px-1 text-base text-slate-900 outline-none sm:text-sm ${novo ? `focus:border-[#176b4d] focus:bg-emerald-50/40 aria-[invalid=true]:border-rose-600 ${FOCO}` : ''}`;

export const valorData = (novo: boolean, valor?: string) => (novo ? valor ?? '' : (valor || '').split('-').reverse().join('/') || '—');

interface LinhaProps extends Pick<CorpoProps, 'novo' | 'mudar' | 'erroDe' | 'mensagem'> {
  nome: keyof FormularioContratacao;
  rotulo: string;
  valor?: string;
  data?: boolean;
  className?: string;
}

/** "COLABORADOR: ________" numa linha, como no modelo. */
export function LinhaPapel({ nome, rotulo, valor, data = false, novo, mudar, erroDe, mensagem, className = '' }: LinhaProps) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="flex min-w-0 flex-wrap items-end gap-x-2">
        <span className="pb-2 text-sm font-semibold text-slate-800">{rotulo}</span>
        {!novo ? (
          // Travado: texto que quebra linha, para o valor nunca ficar cortado.
          <span className={`${entradaPapel(false)} flex items-end pb-1.5 [overflow-wrap:break-word]`}>{data ? valorData(false, valor) : valor || '—'}</span>
        ) : <input
          name={nome}
          type={data ? 'date' : 'text'}
          autoComplete="off"
          value={valor ?? ''}
          onChange={evento => mudar(nome, evento.target.value)}
          className={entradaPapel(novo)}
          {...erroDe(nome)}
        />}
      </span>
      {mensagem(nome)}
    </label>
  );
}

interface MarcasProps extends Pick<CorpoProps, 'novo' | 'erroDe' | 'mensagem'> {
  nome: keyof FormularioContratacao;
  opcoes: Record<string, string>;
  /** Uma só (radio) ou várias (checkbox). */
  marcados: string[];
  onMarcar: (valor: string) => void;
  unica?: boolean;
  colunas?: string;
  rotulo: string;
  /** Texto ao lado de uma opção (ex.: "Uniforme / outros: ____"). */
  extra?: Partial<Record<string, ReactNode>>;
}

/** Lista de quadradinhos do modelo. Travado, só mostra o que foi marcado. */
export function MarcasPapel({ nome, opcoes, marcados, onMarcar, unica = false, colunas = '', rotulo, extra = {}, novo, erroDe, mensagem }: MarcasProps) {
  return (
    <div role={unica ? 'radiogroup' : 'group'} aria-label={rotulo} {...erroDe(nome)}>
      <div className={`grid gap-x-6 gap-y-0.5 ${colunas}`}>
        {Object.entries(opcoes).map(([valor, texto]) => (
          <label key={valor} className="flex min-h-9 min-w-0 items-center gap-2.5 text-base text-slate-900 sm:min-h-8 sm:text-[15px]">
            <input
              type={unica ? 'radio' : 'checkbox'}
              name={nome}
              value={valor}
              aria-readonly={!novo}
              checked={marcados.includes(valor)}
              onChange={() => { if (novo) onMarcar(valor); }}
              className={`size-[18px] shrink-0 accent-[#176b4d] ${FOCO}`}
            />
            <span className="min-w-0">{texto}</span>
            {extra[valor]}
          </label>
        ))}
      </div>
      {mensagem(nome)}
    </div>
  );
}

/** Título de seção do modelo de desligamento ("Motivo / Solicitação..."). */
export function SecaoPapel({ titulo, children, linha = false }: { titulo: string; children: ReactNode; linha?: boolean }) {
  return (
    <section className={`break-inside-avoid px-4 py-3 sm:px-6 ${linha ? 'border-t border-slate-300' : ''}`}>
      <h3 className="mb-2 text-base font-bold text-slate-900">{titulo}</h3>
      {children}
    </section>
  );
}
