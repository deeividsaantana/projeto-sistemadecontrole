import { Fragment, type ReactNode } from 'react';
import { ALTERACOES, reajuste } from '../../../api/_shared/contratacao-regras.js';
import type { FormularioContratacao } from '../../services/contratacaoApi';
import { FOCO } from '../cadastros/estilos';
import { LinhaPapel, entradaPapel, type CorpoProps } from './papel';

const CELULA = 'border border-[#26302b] px-2 py-1.5';

/** Caixa com faixa de título, como "JUSTIFIQUE OS MOTIVOS..." no modelo. */
function CaixaTitulada({ titulo, children, id }: { titulo: string; children: ReactNode; id?: string }) {
  return (
    <section className="break-inside-avoid border border-[#26302b]" aria-labelledby={id}>
      <h3 id={id} className="border-b border-[#26302b] px-2 py-1 text-xs font-bold uppercase text-slate-900">{titulo}</h3>
      <div className="min-h-28 p-2">{children}</div>
    </section>
  );
}

/**
 * Promoção no desenho da planilha "Solicitação de cargo e salário"
 * (SGR-FRH-21-373-01-000-000-0011): tipo de alteração, dados do colaborador,
 * quadro Atual × Proposto (cargo, salário, nível), reajuste calculado,
 * justificativa e a avaliação do RH (escrita pelo RH ao assinar).
 */
export function CorpoPromocao({ form, novo, mudar, erroDe, mensagem, avaliacaoRh }: CorpoProps & { avaliacaoRh: ReactNode }) {
  const linha = { novo, mudar, erroDe, mensagem };
  const celula = (nome: keyof FormularioContratacao, rotulo: string) => (
    <div className={`${CELULA} min-w-0`}>
      {!novo ? <span className="block min-h-8 px-1 py-1 text-sm text-slate-900 [overflow-wrap:break-word] hyphens-auto">{String(form[nome] ?? '') || '—'}</span> : <input
        name={nome}
        aria-label={rotulo}
        readOnly={!novo}
        autoComplete="off"
        inputMode={nome.startsWith('salario') ? 'decimal' : undefined}
        placeholder={novo && nome.startsWith('salario') ? 'R$ 0,00' : undefined}
        value={String(form[nome] ?? '') || (novo ? '' : '—')}
        onChange={evento => mudar(nome, evento.target.value)}
        className={`${entradaPapel(novo)} border-b-0`}
        {...erroDe(nome)}
      />}
    </div>
  );

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      <div role="radiogroup" aria-label="Tipo de alteração" className="flex flex-wrap gap-x-8 gap-y-2" {...erroDe('alteracao')}>
        {Object.entries(ALTERACOES).map(([valor, nome]) => (
          <label key={valor} className="flex min-h-9 items-center gap-2 text-sm font-bold uppercase text-slate-900">
            <input type="radio" name="alteracao" value={valor} aria-readonly={!novo} checked={form.alteracao === valor} onChange={() => { if (novo) mudar('alteracao', valor); }} className={`size-5 shrink-0 accent-[#176b4d] ${FOCO}`} />
            {nome}
          </label>
        ))}
      </div>
      {mensagem('alteracao')}

      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-[1fr_auto]">
        <LinhaPapel nome="data" rotulo="DATA DA SOLICITAÇÃO:" valor={form.data} data {...linha} className="sm:col-span-2" />
        <LinhaPapel nome="candidato" rotulo="COLABORADOR:" valor={form.candidato} {...linha} />
        <LinhaPapel nome="registro" rotulo="REGISTRO:" valor={form.registro} {...linha} className="sm:w-60" />
        <LinhaPapel nome="admissao" rotulo="DATA DE ADMISSÃO:" valor={form.admissao} data {...linha} />
        <LinhaPapel nome="ultimaAlteracao" rotulo="DATA ÚLTIMA ALTERAÇÃO:" valor={form.ultimaAlteracao} data {...linha} className="sm:w-[22rem]" />
        <LinhaPapel nome="area" rotulo="SETOR / OBRA:" valor={form.area} {...linha} className="sm:col-span-2" />
      </div>

      {/* Quadro Atual × Proposto da planilha, em grade (não é lista). */}
      <div className="grid grid-cols-[6rem_1fr_1fr] text-sm sm:grid-cols-[7rem_1fr_1fr] [&>*]:-ml-px [&>*]:-mt-px">
        <span aria-hidden="true" />
        <span className={`${CELULA} text-center font-bold`}>ATUAL</span>
        <span className={`${CELULA} text-center font-bold`}>PROPOSTO</span>
        {([['cargo', 'CARGO'], ['salario', 'SALÁRIO'], ['nivel', 'NÍVEL']] as const).map(([chave, rotulo]) => (
          <Fragment key={chave}>
            <span className={`${CELULA} grid place-items-center font-bold`}>{rotulo}</span>
            {celula(`${chave}Atual` as keyof FormularioContratacao, `${rotulo} atual`)}
            {celula(`${chave}Proposto` as keyof FormularioContratacao, `${rotulo} proposto`)}
          </Fragment>
        ))}
      </div>
      {mensagem('cargoProposto')}

      <div className="grid grid-cols-[6rem_1fr] border border-[#26302b] text-sm sm:grid-cols-[7rem_1fr]">
        <span className="border-r border-[#26302b] px-2 py-1.5 font-bold">REAJUSTE:</span>
        <output className="px-2 py-1.5 text-center tabular-nums" aria-live="polite">{reajuste(form.salarioAtual, form.salarioProposto)}</output>
      </div>

      <CaixaTitulada titulo="Justifique os motivos da solicitação da alteração" id="ct-justificativa">
        {novo
          ? <textarea name="justificativa" aria-labelledby="ct-justificativa" rows={6} value={form.justificativa ?? ''} onChange={evento => mudar('justificativa', evento.target.value)} className={`w-full resize-y bg-transparent text-base outline-none sm:text-sm ${FOCO}`} {...erroDe('justificativa')} />
          : <p className="whitespace-pre-line text-sm text-slate-900">{form.justificativa || '—'}</p>}
        {mensagem('justificativa')}
      </CaixaTitulada>

      <CaixaTitulada titulo="Avaliação e comentários de Recursos Humanos" id="ct-avaliacao-rh">
        {avaliacaoRh}
      </CaixaTitulada>
    </div>
  );
}
