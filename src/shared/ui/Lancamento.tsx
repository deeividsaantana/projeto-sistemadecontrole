import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { CARTAO } from '../../components/cadastros/estilos';

/**
 * Peças do modelo de lançamento (10/11/2026): etapas numeradas na ordem em que
 * a pessoa pensa e, ao lado, a conferência do que vai ser salvo. Nasceu no
 * Lançar do Combustível e serve a todas as abas que lançam alguma coisa.
 */

/** Uma etapa do lançamento: número, pergunta e os campos dela. */
export function Etapa({ numero, titulo, ajuda, feita, children }: { numero: number; titulo: string; ajuda?: string; feita?: boolean; children: ReactNode }) {
  return (
    <section data-lanc-reveal aria-labelledby={`lanc-etapa-${numero}`} className={`${CARTAO} p-3 sm:p-4`}>
      <header className="mb-3 flex min-w-0 items-center gap-2">
        <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-black ${feita ? 'bg-[#176b4d] text-white' : 'bg-[#f7f8f6] text-slate-700 ring-1 ring-inset ring-slate-200'}`} aria-hidden="true">
          {feita ? <CheckCircle2 className="size-4" /> : numero}
        </span>
        <div className="min-w-0">
          <h2 id={`lanc-etapa-${numero}`} className="truncate text-base font-black text-slate-900">{titulo}</h2>
          {ajuda && <p className="truncate text-xs text-slate-600">{ajuda}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

/**
 * Campo com o nome em cima: lê de cima para baixo, igual no celular e no computador.
 * Com `erro`, o campo ganha aria-invalid e o aviso fica ligado a ele por
 * aria-describedby (precisa de `para`, o id do campo).
 */
export function Campo({ rotulo, para, dica, erro, obrigatorio, children, className }: { rotulo: string; para?: string; dica?: ReactNode; erro?: string | null; obrigatorio?: boolean; children: ReactNode; className?: string }) {
  const erroId = para && erro ? `${para}-erro` : undefined;
  const campo = erroId && isValidElement<{ 'aria-invalid'?: boolean; 'aria-describedby'?: string }>(children)
    ? cloneElement(children as ReactElement<{ 'aria-invalid'?: boolean; 'aria-describedby'?: string }>, { 'aria-invalid': true, 'aria-describedby': erroId })
    : children;
  const nome = <>{rotulo}{obrigatorio && <span aria-hidden="true" className="text-[#c2410c]"> *</span>}</>;
  return (
    <div className={`min-w-0 ${className ?? ''}`}>
      {para
        ? <label htmlFor={para} className="mb-1 block text-sm font-bold text-slate-700">{nome}</label>
        : <span className="mb-1 block text-sm font-bold text-slate-700">{nome}</span>}
      {campo}
      {erro && <p id={erroId} className="mt-1 text-sm font-semibold text-[#c2410c]">{erro}</p>}
      {dica && <p className="mt-1 text-sm text-slate-600">{dica}</p>}
    </div>
  );
}

/** Linha da conferência: o que vai ser salvo, com um sinal de pronto ou pendente. */
export function Conferido({ rotulo, valor, ok, testId }: { rotulo: string; valor: ReactNode; ok: boolean; testId?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        <span className={`size-2 shrink-0 rounded-full ${ok ? 'bg-[#176b4d]' : 'bg-slate-300'}`} aria-hidden="true" />
        {rotulo}
      </dt>
      <dd className="min-w-0 text-right text-sm font-black tabular-nums text-slate-900" data-testid={testId}>{valor}</dd>
    </div>
  );
}

/** Quadro da conferência, ao lado das etapas no computador e embaixo no celular. */
export function Conferencia({ titulo = 'Conferência', subtitulo, children }: { titulo?: string; subtitulo?: ReactNode; children: ReactNode }) {
  return (
    <aside data-lanc-reveal aria-label="Conferência antes de salvar" className={`${CARTAO} grid gap-3 p-4 sm:p-5 lg:sticky lg:top-0`}>
      <div>
        <h2 className="text-base font-black text-slate-900">{titulo}</h2>
        {subtitulo && <p className="text-sm text-slate-600">{subtitulo}</p>}
      </div>
      {children}
    </aside>
  );
}
