/**
 * Assistente operacional. Responde apenas com dado que já está no sistema — sem
 * serviço externo e sem palpite: quando não há informação ele diz que não há, em
 * vez de devolver um número que ninguém conseguiria conferir.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Bot, FileBarChart, History, MessageCircle, Search, Send, Users } from 'lucide-react';
import {
  responder,
  SUGESTOES_ASSISTENTE,
  type ContextoAssistente,
  type RespostaAssistente,
} from '../utils/assistente';
import { Button, PageHeader, PeriodFilter, QuickAction, buildPeriod, type PeriodValue } from '../shared/ui';

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

  const ACOES_RAPIDAS = [
    { titulo: 'Consultar equipamento', descricao: 'Busque informações', icone: Search, pergunta: 'Qual a disponibilidade da frota?' },
    { titulo: 'Ver pendências', descricao: 'Itens que precisam de atenção', icone: AlertTriangle, pergunta: 'O que está pendente?' },
    { titulo: 'Relatório rápido', descricao: 'Gere um resumo', icone: FileBarChart, pergunta: 'Como está a produção?' },
    { titulo: 'Buscar colaborador', descricao: 'Encontre um colaborador', icone: Users, pergunta: 'Como está a presença?' },
  ];

  return (
    <div id="assistente-tab" className="min-h-full w-full bg-[#f6f7f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Assistente Operacional"
        description="Como posso te ajudar hoje?"
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter value={period} onChange={setPeriod} />
            <Button variant="secondary" icon={History} onClick={() => setHistorico([])}>Histórico de conversas</Button>
          </div>
        )}
      />

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ACOES_RAPIDAS.map(acao => (
          <QuickAction
            key={acao.titulo}
            titulo={acao.titulo}
            descricao={acao.descricao}
            icone={acao.icone}
            estado="operacao"
            onClick={() => perguntar(acao.pergunta)}
          />
        ))}
      </section>

      <form
        className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2"
        onSubmit={event => { event.preventDefault(); perguntar(pergunta); }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Pergunta</span>
          <input
            value={pergunta}
            onChange={event => setPergunta(event.target.value)}
            placeholder="Digite sua pergunta..."
            className="h-10 w-full rounded-lg border-0 bg-transparent px-2 text-[14px] text-slate-800 outline-none"
          />
        </label>
        <button
          type="submit"
          aria-label="Enviar pergunta"
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#087353] text-white transition-colors hover:bg-[#065f44]"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-slate-500">Exemplos:</span>
        {SUGESTOES_ASSISTENTE.map(sugestao => (
          <button
            key={sugestao}
            type="button"
            onClick={() => perguntar(sugestao)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700"
          >
            <MessageCircle className="h-3.5 w-3.5 text-slate-400" />
            {sugestao}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {historico.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <Bot className="mx-auto h-6 w-6 text-slate-300" />
            <p className="mt-2 text-[14px] font-semibold text-slate-700">Pergunte alguma coisa sobre a obra</p>
            <p className="mt-1 text-[12px] text-slate-500">
              O assistente lê pendências, produção, frota, presença, custos, qualidade e a linha do tempo do período
              selecionado. Ele não consulta nada fora do sistema.
            </p>
          </div>
        ) : (
          historico.map(troca => (
            <article key={troca.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{troca.pergunta}</p>
              <h2 className="mt-1 text-[14px] font-semibold text-slate-800">{troca.resposta.titulo}</h2>
              <ul className="mt-2 space-y-1 text-[12px] text-slate-600">
                {troca.resposta.linhas.map(linha => <li key={linha}>{linha}</li>)}
              </ul>
              {troca.resposta.tab && (
                <button
                  type="button"
                  onClick={() => onNavigate(troca.resposta.tab!)}
                  className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700"
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
