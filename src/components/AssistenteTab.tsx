/**
 * Assistente operacional. Responde apenas com dado que já está no sistema — sem
 * serviço externo e sem palpite: quando não há informação ele diz que não há, em
 * vez de devolver um número que ninguém conseguiria conferir.
 */
import { useMemo, useState } from 'react';
import { ArrowRight, Bot, Send } from 'lucide-react';
import {
  responder,
  SUGESTOES_ASSISTENTE,
  type ContextoAssistente,
  type RespostaAssistente,
} from '../utils/assistente';
import { PageHeader, PeriodFilter, buildPeriod, type PeriodValue } from '../shared/ui';

interface AssistenteTabProps {
  dados: Omit<ContextoAssistente, 'hoje' | 'inicio' | 'fim'>;
  onNavigate: (tab: string) => void;
}

interface Troca {
  id: string;
  pergunta: string;
  resposta: RespostaAssistente;
}

export default function AssistenteTab({ dados, onNavigate }: AssistenteTabProps) {
  const [period, setPeriod] = useState<PeriodValue>(() => buildPeriod('mes'));
  const [pergunta, setPergunta] = useState('');
  const [historico, setHistorico] = useState<Troca[]>([]);

  const contexto = useMemo(() => ({
    ...dados,
    hoje: new Date().toISOString().slice(0, 10),
    inicio: period.from,
    fim: period.to,
  }), [dados, period.from, period.to]);

  const perguntar = (texto: string) => {
    const limpo = texto.trim();
    if (!limpo) return;
    setHistorico(atual => [{ id: `${Date.now()}`, pergunta: limpo, resposta: responder(limpo, contexto) }, ...atual].slice(0, 12));
    setPergunta('');
  };

  return (
    <div id="assistente-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Assistente"
        description="Pergunte sobre a obra. A resposta vem dos registros do sistema, nunca de estimativa."
        actions={<PeriodFilter value={period} onChange={setPeriod} />}
      />

      <section className="mt-4 grid min-h-[31rem] overflow-hidden rounded-[3px] border border-slate-200 bg-white xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 p-4 xl:border-b-0 xl:border-r">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="grid size-10 place-items-center rounded-[3px] border border-emerald-200 bg-emerald-50"><Bot className="h-5 w-5 text-emerald-700" /></span>
            <div><h2 className="text-sm font-black text-slate-900">Perguntas sugeridas</h2><p className="text-[11px] text-slate-500">Consultas rápidas da operação</p></div>
          </div>
          <div className="mt-3 space-y-1.5">
            {SUGESTOES_ASSISTENTE.map(sugestao => (
              <button key={sugestao} type="button" onClick={() => perguntar(sugestao)} className="group flex min-h-12 w-full items-center gap-3 rounded-[3px] border border-transparent px-2.5 text-left text-xs font-bold text-slate-600 transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800">
                <span className="flex-1">{sugestao}</span><ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </aside>

        <div className="flex min-h-[31rem] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
            {historico.length === 0 ? (
              <div className="grid min-h-[20rem] place-items-center text-center">
                <div className="max-w-lg">
                  <Bot className="mx-auto h-9 w-9 text-emerald-600" />
                  <p className="mt-4 text-2xl font-black tracking-[-.035em] text-slate-900">Pergunte sobre a operação</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">O assistente lê pendências, produção, frota, presença, custos, qualidade e a linha do tempo. Ele responde somente com informações verificáveis do sistema.</p>
                </div>
              </div>
            ) : historico.map(troca => (
              <article key={troca.id} className="rounded-[3px] border border-slate-200 bg-white p-4 sm:p-5">
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-emerald-700">{troca.pergunta}</p>
                <h2 className="mt-2 text-xl font-black tracking-[-.025em] text-slate-900">{troca.resposta.titulo}</h2>
                <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-slate-600">{troca.resposta.linhas.map(linha => <li key={linha}>{linha}</li>)}</ul>
                {troca.resposta.tab && <button type="button" onClick={() => onNavigate(troca.resposta.tab!)} className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-[3px] border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-700">Abrir a tela <ArrowRight className="h-3.5 w-3.5" /></button>}
              </article>
            ))}
          </div>
          <form className="flex flex-col gap-2 border-t border-slate-200 bg-white p-3 sm:flex-row sm:p-4" onSubmit={event => { event.preventDefault(); perguntar(pergunta); }}>
            <label className="min-w-0 flex-1"><span className="sr-only">Pergunta</span><input value={pergunta} onChange={event => setPergunta(event.target.value)} placeholder="O que está pendente? Como está a produção?" className="min-h-12 w-full rounded-[3px] border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none focus:border-emerald-500" /></label>
            <button type="submit" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[3px] bg-emerald-700 px-5 text-xs font-bold text-white hover:bg-emerald-800"><Send className="h-4 w-4" /> Perguntar</button>
          </form>
        </div>
      </section>
    </div>
  );
}
