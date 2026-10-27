import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { ArrowLeft, CalendarDays, Check, Save, Users } from 'lucide-react';
import { ConfirmDialog } from '../../shared/ui';
import { reduzMovimento } from '../../shared/motion/reduzMovimento';
import { resumirLancamento, type SituacaoLancada } from '../../utils/presencaManual';
import type { Funcionario, GrupoEquipe, PresencaStatus } from '../../types';

/**
 * Lançamento manual de presença no modelo do formulário de apropriação do SGE:
 * cabeçalho com Voltar, Cancelar e Salvar (Ctrl+S ou F2), uma seção de dados do
 * dia e da equipe, a tabela de colaboradores e os totais em destaque. Quem
 * guarda o estado é a aba; aqui só se desenha e se confirma.
 */

interface Props {
  grupo: GrupoEquipe;
  pessoas: Funcionario[];
  /** Hoje (aaaa-mm-dd): não se lança presença de dia futuro. */
  hoje: string;
  data: string;
  observacaoDia: string;
  situacoes: Record<string, SituacaoLancada>;
  opcoesStatus: readonly PresencaStatus[];
  onData: (data: string) => void;
  onObservacaoDia: (texto: string) => void;
  onSituacao: (pessoaId: string, status: PresencaStatus | '', observacao?: string) => void;
  onTodosPresentes: () => void;
  onSalvar: () => void;
  onFechar: () => void;
}

const CAMPO = 'min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10 disabled:bg-slate-50 disabled:text-slate-600';
const ROTULO = 'block text-xs font-bold uppercase tracking-wide text-[#5b6870]';
const FOCO = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--renea-focus)';
const BOTAO = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-emerald-700 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-45 ${FOCO}`;
const BOTAO_PRINCIPAL = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#176b4d] px-4 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45 ${FOCO}`;

const dataBr = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');

export default function FormularioLancamentoPresenca({
  grupo, pessoas, hoje, data, observacaoDia, situacoes, opcoesStatus,
  onData, onObservacaoDia, onSituacao, onTodosPresentes, onSalvar, onFechar,
}: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const primeiroCampo = useRef<HTMLInputElement>(null);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  // Foto do que veio ao abrir: só pergunta antes de sair se algo mudou.
  const inicial = useRef(JSON.stringify([data, observacaoDia, situacoes]));
  const mudou = JSON.stringify([data, observacaoDia, situacoes]) !== inicial.current;

  const resumo = useMemo(
    () => resumirLancamento(pessoas.map(pessoa => pessoa.id), situacoes),
    [pessoas, situacoes],
  );
  const conferidos = resumo.total - resumo.semConferencia;
  const dataValida = Boolean(data) && data <= hoje;
  const podeSalvar = conferidos > 0 && dataValida;

  const sair = () => (mudou ? setConfirmandoSaida(true) : onFechar());
  const salvar = () => { if (podeSalvar) onSalvar(); };

  // Os atalhos leem sempre a versão mais nova das funções, sem religar o ouvinte.
  const atalhos = useRef({ salvar, sair, confirmandoSaida });
  atalhos.current = { salvar, sair, confirmandoSaida };
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 's') {
        evento.preventDefault();
        atalhos.current.salvar();
      } else if (evento.key === 'F2') {
        evento.preventDefault();
        atalhos.current.salvar();
      } else if (evento.key === 'Escape' && !atalhos.current.confirmandoSaida) {
        atalhos.current.sair();
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  useEffect(() => {
    primeiroCampo.current?.focus();
    const alvo = raiz.current;
    if (!alvo || reduzMovimento()) return undefined;
    const animacao = gsap.fromTo(alvo, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out', clearProps: 'opacity,transform' });
    return () => { animacao.kill(); };
  }, []);

  const campoSituacao = (pessoa: Funcionario) => (
    <select
      aria-label={`Situação de ${pessoa.nome}`}
      value={situacoes[pessoa.id]?.status || ''}
      onChange={evento => onSituacao(pessoa.id, evento.target.value as PresencaStatus | '', situacoes[pessoa.id]?.observacao)}
      className={`${CAMPO} md:min-h-10`}
    >
      <option value="">Sem conferência</option>
      {opcoesStatus.map(status => <option key={status} value={status}>{status}</option>)}
    </select>
  );
  const campoObservacao = (pessoa: Funcionario) => {
    const atual = situacoes[pessoa.id];
    return (
      <input
        aria-label={`Observação de ${pessoa.nome}`}
        value={atual?.observacao || ''}
        disabled={!atual?.status}
        onChange={evento => atual?.status && onSituacao(pessoa.id, atual.status, evento.target.value)}
        placeholder={atual?.status ? 'Anotação opcional' : 'Escolha a situação primeiro'}
        className={`${CAMPO} md:min-h-10`}
      />
    );
  };

  const totais = [
    { rotulo: 'Presentes', valor: resumo.presentes, classe: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
    { rotulo: 'Ausentes', valor: resumo.ausentes, classe: 'border-rose-200 bg-rose-50 text-rose-900' },
    { rotulo: 'Justificados', valor: resumo.justificados, classe: 'border-amber-200 bg-amber-50 text-amber-900' },
    { rotulo: 'Outras situações', valor: resumo.outras, classe: 'border-slate-200 bg-slate-50 text-slate-800' },
    { rotulo: 'Sem conferência', valor: resumo.semConferencia, classe: 'border-slate-200 bg-white text-slate-700' },
  ];

  return createPortal(
    <div
      ref={raiz}
      role="dialog"
      aria-modal="true"
      aria-label={`Lançar presença da ${grupo.nome}`}
      data-testid="presenca-lancamento"
      className="fixed inset-0 z-[90] overflow-y-auto bg-[#f3f6f4] px-4 py-5 md:px-8"
    >
      <div className="mx-auto w-full max-w-[1500px] space-y-4">
        <header className="space-y-3">
          <button type="button" onClick={sair} className={`${BOTAO} min-h-9 px-3`}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar</button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-slate-900">Lançar presença</h1>
              <p className="mt-1 text-sm text-[#5b6870]">Dica: use [Tab] para avançar e [Ctrl + S] ou [F2] para salvar.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={sair} className={BOTAO}>Cancelar</button>
              <button type="button" onClick={salvar} disabled={!podeSalvar} className={BOTAO_PRINCIPAL} data-testid="presenca-lancamento-salvar">
                <Save className="h-4 w-4" aria-hidden="true" /> Salvar (Ctrl+S / F2)
              </button>
            </div>
          </div>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white" aria-labelledby="lanc-dados">
          <h2 id="lanc-dados" className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 text-sm font-bold text-slate-900">
            <CalendarDays className="h-4 w-4 text-[#176b4d]" aria-hidden="true" /> Dados do dia e da equipe
          </h2>
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5">
              <span className={ROTULO}>Dia *</span>
              <input ref={primeiroCampo} type="date" max={hoje} value={data} onChange={evento => onData(evento.target.value)} className={CAMPO} aria-invalid={!dataValida} aria-describedby="lanc-dia-erro" />
              {!dataValida && <span id="lanc-dia-erro" className="block text-xs font-semibold text-rose-700">Escolha um dia até hoje.</span>}
            </label>
            <label className="space-y-1.5">
              <span className={ROTULO}>Equipe</span>
              <input value={grupo.nome} disabled className={CAMPO} />
            </label>
            <label className="space-y-1.5">
              <span className={ROTULO}>Responsável · Frente</span>
              <input value={`${grupo.responsavel || 'Sem responsável'} · ${grupo.frenteServico || 'Sem frente'}`} disabled className={CAMPO} />
            </label>
            <label className="space-y-1.5">
              <span className={ROTULO}>Observação do dia</span>
              <input value={observacaoDia} onChange={evento => onObservacaoDia(evento.target.value)} placeholder="Chuva, parada de frente…" className={CAMPO} />
            </label>
          </div>
          <p className="mx-5 mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            O lançamento fica marcado como feito pelo painel, com o seu nome. Relançar o mesmo dia corrige as situações escolhidas e não duplica ninguém.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white" aria-labelledby="lanc-pessoas">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
            <h2 id="lanc-pessoas" className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Users className="h-4 w-4 text-[#176b4d]" aria-hidden="true" /> Colaboradores da equipe
            </h2>
            <button type="button" onClick={onTodosPresentes} disabled={pessoas.length === 0} className={`${BOTAO} min-h-9 px-3`}>
              <Check className="h-4 w-4" aria-hidden="true" /> Marcar quem falta como Presente
            </button>
          </div>
          {pessoas.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[#5b6870]">Esta equipe não tem colaboradores vinculados. Vincule em Equipes › Editar.</p>
          ) : (
            <>
              <ul className="divide-y divide-slate-100 md:hidden">
                {pessoas.map((pessoa, indice) => (
                  <li key={pessoa.id} className="space-y-2 px-4 py-3">
                    <p className="text-sm font-bold text-slate-900">{indice + 1}. {pessoa.nome}</p>
                    <p className="text-xs text-[#5b6870]">{pessoa.cargo || 'Sem função'} · Mat. {pessoa.matricula || '—'}</p>
                    {campoSituacao(pessoa)}
                    {campoObservacao(pessoa)}
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left text-[13px]">
                  <caption className="sr-only">Situação de cada colaborador em {dataBr(data)}</caption>
                  <thead className="bg-[#f3f6f4] text-[11px] uppercase tracking-wide text-[#5b6870]">
                    <tr>
                      <th scope="col" className="w-10 px-4 py-2 font-bold">#</th>
                      <th scope="col" className="px-3 py-2 font-bold">Matrícula</th>
                      <th scope="col" className="px-3 py-2 font-bold">Colaborador</th>
                      <th scope="col" className="px-3 py-2 font-bold">Função</th>
                      <th scope="col" className="w-56 px-3 py-2 font-bold">Situação</th>
                      <th scope="col" className="px-3 py-2 font-bold">Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pessoas.map((pessoa, indice) => (
                      <tr key={pessoa.id} className="border-t border-slate-100">
                        <td className="px-4 py-1.5 tabular-nums text-[#5b6870]">{indice + 1}</td>
                        <td className="px-3 py-1.5 tabular-nums">{pessoa.matricula || '—'}</td>
                        <td className="px-3 py-1.5 font-bold text-slate-900">{pessoa.nome}</td>
                        <td className="px-3 py-1.5 text-[#5b6870]">{pessoa.cargo || '—'}</td>
                        <td className="px-3 py-1.5">{campoSituacao(pessoa)}</td>
                        <td className="px-3 py-1.5">{campoObservacao(pessoa)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-slate-200 bg-white px-4 py-3 md:-mx-8" aria-live="polite">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {totais.map(item => (
              <span key={item.rotulo} className={`inline-flex items-baseline gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold ${item.classe}`}>
                {item.rotulo}: <strong className="text-base font-black tabular-nums">{item.valor}</strong>
              </span>
            ))}
            <span className="inline-block rounded-lg border border-[#176b4d] px-4 py-1 text-sm font-bold text-slate-900">
              TOTAL CONFERIDO: <span className="tabular-nums text-[#176b4d]">{conferidos} de {resumo.total}</span>
            </span>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmandoSaida}
        title="Sair sem lançar?"
        description="O que você preencheu neste lançamento ainda não foi salvo e será descartado."
        confirmLabel="Sair sem salvar"
        cancelLabel="Continuar preenchendo"
        tone="warning"
        onConfirm={() => { setConfirmandoSaida(false); onFechar(); }}
        onCancel={() => setConfirmandoSaida(false)}
      />
    </div>,
    document.body,
  );
}
