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

      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={event => { event.preventDefault(); perguntar(pergunta); }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Pergunta</span>
          <input
            value={pergunta}
            onChange={event => setPergunta(event.target.value)}
            placeholder="O que está pendente? Como está a produção? Onde está o ESC-01?"
            className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-500"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800"
        >
          <Send className="h-4 w-4" /> Perguntar
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGESTOES_ASSISTENTE.map(sugestao => (
          <button
            key={sugestao}
            type="button"
            onClick={() => perguntar(sugestao)}
            className="min-h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700"
          >
            {sugestao}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {historico.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
            <Bot className="mx-auto h-6 w-6 text-slate-300" />
            <p className="mt-2 text-sm font-bold text-slate-700">Pergunte alguma coisa sobre a obra</p>
            <p className="mt-1 text-xs text-slate-500">
              O assistente lê pendências, produção, frota, presença, custos, qualidade e a linha do tempo do período
              selecionado. Ele não consulta nada fora do sistema.
            </p>
          </div>
        ) : (
          historico.map(troca => (
            <article key={troca.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{troca.pergunta}</p>
              <h2 className="mt-1 text-sm font-bold text-slate-800">{troca.resposta.titulo}</h2>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {troca.resposta.linhas.map(linha => <li key={linha}>{linha}</li>)}
              </ul>
              {troca.resposta.tab && (
                <button
                  type="button"
                  onClick={() => onNavigate(troca.resposta.tab!)}
                  className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700"
                >
                  Abrir a tela <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
