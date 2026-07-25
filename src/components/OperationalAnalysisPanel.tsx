import React from 'react';
import type { OperationalAnalysis } from '../utils/operationalAnalysis';

interface OperationalAnalysisPanelProps {
  analysis?: OperationalAnalysis;
  variant?: 'dark' | 'light';
}

const tone = {
  dark: {
    section: 'border border-cyan-500/30 bg-cyan-500/5 p-4 text-slate-100',
    card: 'border border-slate-800 bg-slate-900/60 p-3',
    nested: 'border border-slate-800 bg-slate-950/60 p-2',
    title: 'text-white',
    muted: 'text-slate-400',
    body: 'text-slate-200',
    metric: 'text-cyan-300',
  },
  light: {
    section: 'rounded-md border border-cyan-200 bg-cyan-50 p-4 text-slate-900',
    card: 'rounded-md border border-slate-200 bg-white p-3',
    nested: 'rounded-md border border-slate-200 bg-slate-50 p-2',
    title: 'text-slate-950',
    muted: 'text-slate-500',
    body: 'text-slate-700',
    metric: 'text-cyan-700',
  },
};

const confidenceTone = (confidence: OperationalAnalysis['confianca']) => {
  if (confidence === 'Alta') return 'border-emerald-500/40 text-emerald-600';
  if (confidence === 'Média') return 'border-amber-500/40 text-amber-600';
  return 'border-rose-500/40 text-rose-600';
};

const AnalysisList = ({ title, items, variant }: { title: string; items: string[]; variant: 'dark' | 'light' }) => {
  const style = tone[variant];
  return (
    <div className={style.card}>
      <h3 className={`text-xs font-black uppercase ${style.muted}`}>{title}</h3>
      <ul className={`mt-2 space-y-1 text-sm ${style.body}`}>
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="leading-relaxed">- {item}</li>
        ))}
      </ul>
    </div>
  );
};

export default function OperationalAnalysisPanel({ analysis, variant = 'dark' }: OperationalAnalysisPanelProps) {
  if (!analysis) return null;
  const style = tone[variant];
  return (
    <section className={style.section}>
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className={`text-base font-black ${style.title}`}>Análise Operacional e BI</h2>
          <span className={`text-xs ${style.muted}`}>Problemas, oportunidades, automações, KPIs e plano de ação.</span>
        </div>
        <span className={`w-fit border px-2 py-1 text-xs font-black ${confidenceTone(analysis.confianca)}`}>
          Confiança {analysis.confianca}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <AnalysisList title="Resumo Executivo" items={analysis.resumoExecutivo || []} variant={variant} />
        <AnalysisList title="Principais Problemas" items={analysis.principaisProblemas || []} variant={variant} />
        <AnalysisList title="Oportunidades de Melhoria" items={analysis.oportunidadesMelhoria || []} variant={variant} />
        <AnalysisList title="Automações Recomendadas" items={analysis.automacoesRecomendadas || []} variant={variant} />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1.1fr]">
        <div className={style.card}>
          <h3 className={`text-xs font-black uppercase ${style.muted}`}>Indicadores</h3>
          <div className="mt-2 divide-y divide-slate-200 text-sm">
            {(analysis.indicadores || []).map(indicator => (
              <div key={indicator.nome} className="grid gap-1 py-2 sm:grid-cols-[150px_110px_1fr]">
                <strong className={style.title}>{indicator.nome}</strong>
                <span className={`font-mono ${style.metric}`}>{indicator.valor}</span>
                <span className={style.muted}>{indicator.interpretacao}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={style.card}>
          <h3 className={`text-xs font-black uppercase ${style.muted}`}>Plano de Ação</h3>
          <div className="mt-2 space-y-2 text-sm">
            {(analysis.planoAcao || []).map((action, index) => (
              <div key={`${action.acao}-${index}`} className={style.nested}>
                <strong className={style.title}>{index + 1}. {action.acao}</strong>
                <div className={`mt-1 grid gap-1 text-xs sm:grid-cols-2 ${style.muted}`}>
                  <span>Impacto: {action.impacto}</span>
                  <span>Dificuldade: {action.dificuldade}</span>
                  <span>Tempo: {action.tempoEstimado}</span>
                  <span>Ganho: {action.ganhoEsperado}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <AnalysisList title="Próximos Passos" items={analysis.proximosPassos || []} variant={variant} />
      </div>
    </section>
  );
}
