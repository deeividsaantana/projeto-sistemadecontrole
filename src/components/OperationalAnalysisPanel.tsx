import type { OperationalAnalysis } from '../utils/operationalAnalysis';

interface OperationalAnalysisPanelProps {
  analysis?: OperationalAnalysis;
}

// Só a revisão de importação usa este painel, sempre no fundo claro. O tom
// escuro antigo punha título branco em fundo quase branco e saiu (sem uso).
const CARTAO = 'rounded-md border border-slate-200 bg-white p-3';
const APAGADO = 'text-slate-600';

const confidenceTone = (confidence: OperationalAnalysis['confianca']) => {
  if (confidence === 'Alta') return 'border-emerald-600/40 text-emerald-800';
  if (confidence === 'Média') return 'border-amber-600/40 text-amber-800';
  return 'border-rose-600/40 text-rose-800';
};

const AnalysisList = ({ title, items }: { title: string; items: string[] }) => (
  <div className={CARTAO}>
    <h4 className={`text-xs font-black uppercase ${APAGADO}`}>{title}</h4>
    <ul className="mt-2 space-y-1 text-sm text-slate-700">
      {items.map((item, index) => (
        <li key={`${title}-${index}`} className="leading-relaxed">- {item}</li>
      ))}
    </ul>
  </div>
);

/** Fica dentro da janela de revisão (título h2), por isso os títulos começam em h3. */
export default function OperationalAnalysisPanel({ analysis }: OperationalAnalysisPanelProps) {
  if (!analysis) return null;
  return (
    <section className="rounded-md border border-cyan-200 bg-cyan-50 p-4 text-slate-900" aria-labelledby="analise-operacional-titulo">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 id="analise-operacional-titulo" className="text-base font-black text-slate-950">Análise da planilha</h3>
          <span className={`text-sm ${APAGADO}`}>Problemas, oportunidades, automações, indicadores e plano de ação.</span>
        </div>
        <span className={`w-fit border px-2 py-1 text-xs font-black ${confidenceTone(analysis.confianca)}`}>
          Confiança {analysis.confianca}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <AnalysisList title="Resumo" items={analysis.resumoExecutivo || []} />
        <AnalysisList title="Principais problemas" items={analysis.principaisProblemas || []} />
        <AnalysisList title="O que pode melhorar" items={analysis.oportunidadesMelhoria || []} />
        <AnalysisList title="Automações recomendadas" items={analysis.automacoesRecomendadas || []} />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1.1fr]">
        <div className={CARTAO}>
          <h4 className={`text-xs font-black uppercase ${APAGADO}`}>Indicadores</h4>
          <dl className="mt-2 divide-y divide-slate-200 text-sm">
            {(analysis.indicadores || []).map(indicator => (
              <div key={indicator.nome} className="grid gap-1 py-2 sm:grid-cols-[150px_110px_1fr]">
                <dt className="font-bold text-slate-950">{indicator.nome}</dt>
                <dd className="font-mono text-cyan-800">{indicator.valor}</dd>
                <dd className={APAGADO}>{indicator.interpretacao}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className={CARTAO}>
          <h4 className={`text-xs font-black uppercase ${APAGADO}`}>Plano de ação</h4>
          <ol className="mt-2 space-y-2 text-sm">
            {(analysis.planoAcao || []).map((action, index) => (
              <li key={`${action.acao}-${index}`} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                <strong className="text-slate-950">{index + 1}. {action.acao}</strong>
                <div className={`mt-1 grid gap-1 text-xs sm:grid-cols-2 ${APAGADO}`}>
                  <span>Impacto: {action.impacto}</span>
                  <span>Dificuldade: {action.dificuldade}</span>
                  <span>Tempo: {action.tempoEstimado}</span>
                  <span>Ganho: {action.ganhoEsperado}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-3">
        <AnalysisList title="Próximos passos" items={analysis.proximosPassos || []} />
      </div>
    </section>
  );
}
