import { avancoGeral, previstoGeral } from '../../utils/programacao';
import { textoEstaca, type TrechoDaFrente } from '../../utils/avancoObra';
import { COR_SITUACAO, numeroObra } from './visual';

/**
 * Diagrama linear por estaca, como o engenheiro desenha no papel: cada frente
 * tem uma régua de estacas e cada serviço ocupa o trecho programado. A parte
 * pintada é o trecho já feito, estimado pelo avanço (do começo para o fim).
 */
export function DiagramaEstacas({ trechos, onAbrir }: { trechos: readonly TrechoDaFrente[]; onAbrir: (id: string) => void }) {
  const comEstaca = trechos.filter(trecho => trecho.atividades.length);
  const semEstaca = trechos.reduce((total, trecho) => total + trecho.semEstaca.length, 0);
  if (!comEstaca.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm font-semibold text-[#5b6870]">
        Nenhuma atividade com estaca inicial e final. Informe as estacas na atividade (ex.: 1401+10) para ver o diagrama.
      </p>
    );
  }
  return (
    <div className="grid gap-5">
      {comEstaca.map(trecho => {
        const extensao = Math.max(1, trecho.ate - trecho.de);
        const posicao = (metros: number) => ((metros - trecho.de) / extensao) * 100;
        const marcas = Array.from({ length: 5 }, (_, i) => trecho.de + (extensao * i) / 4);
        const feito = avancoGeral(trecho.atividades);
        const previsto = previstoGeral(trecho.atividades);
        return (
          <div key={trecho.frente} className="min-w-0">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <h3 className="text-sm font-black text-slate-900">
                {trecho.frente}
                <span className="ml-2 font-semibold text-[#5b6870]">est. {textoEstaca(trecho.de)} a {textoEstaca(trecho.ate)} · {numeroObra(extensao)} m</span>
              </h3>
              <p className="text-xs font-bold text-[#5b6870]">
                Feito <span className="tabular-nums text-slate-900">{Math.round(feito)}%</span> · previsto <span className="tabular-nums text-slate-900">{Math.round(previsto)}%</span>
              </p>
            </div>
            <div className="grid gap-1.5">
              {trecho.atividades.map(atividade => {
                const { de, ate } = atividade.ritmo.trecho!;
                const esquerda = posicao(de);
                const largura = Math.max(0.8, posicao(ate) - esquerda);
                const feitoPct = Math.min(100, atividade.percentual);
                return (
                  <button
                    type="button"
                    key={atividade.item.id}
                    onClick={() => onAbrir(atividade.item.id)}
                    className="grid min-h-9 min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-lg px-1 py-0.5 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-(--renea-focus) sm:grid-cols-[10rem_minmax(0,1fr)_3rem]"
                    aria-label={`${atividade.item.servicoDescricao}, estaca ${atividade.item.estacaInicial} a ${atividade.item.estacaFinal}, ${Math.round(atividade.percentual)}% feito`}
                  >
                    <span className="flex min-w-0 items-baseline justify-between gap-2 sm:block">
                      <span className="block truncate text-xs font-bold text-slate-800">{atividade.item.servicoDescricao}</span>
                      <span className="text-xs font-bold tabular-nums text-slate-700 sm:hidden">{Math.round(atividade.percentual)}%</span>
                    </span>
                    <span className="relative block h-5 rounded bg-slate-50 ring-1 ring-inset ring-slate-100" aria-hidden="true">
                      <span className="absolute inset-y-1 overflow-hidden rounded-sm bg-slate-200" style={{ left: `${esquerda}%`, width: `${largura}%` }}>
                        <span className={`block h-full ${COR_SITUACAO[atividade.situacao].ponto}`} style={{ width: `${feitoPct}%` }} />
                      </span>
                    </span>
                    <span className="hidden text-right text-xs font-bold tabular-nums text-slate-700 sm:block">{Math.round(atividade.percentual)}%</span>
                  </button>
                );
              })}
            </div>
            <div className="relative mt-1 h-4 sm:ml-[10.75rem] sm:mr-[3.75rem]" aria-hidden="true">
              {marcas.map((metros, i) => (
                <span
                  key={metros}
                  className={`absolute top-0 whitespace-nowrap text-xs font-semibold tabular-nums text-slate-500 ${i % 2 ? 'hidden sm:block' : ''}`}
                  style={{ left: `${(i / 4) * 100}%`, transform: i === 0 ? undefined : i === 4 ? 'translateX(-100%)' : 'translateX(-50%)' }}
                >
                  {textoEstaca(Math.round(metros))}
                </span>
              ))}
            </div>
          </div>
        );
      })}
      <p className="text-xs font-semibold text-[#5b6870]">
        Cinza: trecho programado. Cor: trecho feito, estimado pelo avanço e pintado na cor da situação.
        {semEstaca > 0 && ` ${semEstaca} ${semEstaca === 1 ? 'atividade sem estaca não aparece' : 'atividades sem estaca não aparecem'} aqui.`}
      </p>
    </div>
  );
}
