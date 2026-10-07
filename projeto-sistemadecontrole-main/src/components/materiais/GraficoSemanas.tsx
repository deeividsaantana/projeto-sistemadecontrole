import { useMemo, useState } from 'react';
import { ChartColumn, Table2 } from 'lucide-react';
import type { Material, MovimentoMaterial } from '../../types';
import { movimentoPorSemana, type PontoSemana } from '../../modules/materials/avisosMateriais';
import { CAMPO, CARTAO, FOCO } from '../cadastros/estilos';

const SERIES = [
  { chave: 'entradas', nome: 'Entradas', cor: 'bg-[#176b4d]' },
  { chave: 'saidas', nome: 'Saídas', cor: 'bg-[#f26a2e]' },
  { chave: 'transporte', nome: 'Transporte', cor: 'bg-[#718087]' },
] as const;
const SEMANAS = 12;

const br = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

interface Props {
  hoje: string;
  materiais: readonly Material[];
  movimentos: readonly MovimentoMaterial[];
}

/**
 * Entradas, saídas e transporte das últimas 12 semanas. Sem material escolhido
 * conta lançamentos; escolhendo um, mostra a quantidade na unidade dele.
 * Passar o dedo ou o mouse numa semana mostra os números; a tabela tem tudo.
 */
export default function GraficoSemanas({ hoje, materiais, movimentos }: Props) {
  const [materialId, setMaterialId] = useState('');
  const [emTabela, setEmTabela] = useState(false);
  const [destaque, setDestaque] = useState<number | null>(null);

  const comMovimento = useMemo(() => {
    const ids = new Set(movimentos.map(item => item.materialId));
    return materiais.filter(item => ids.has(item.id)).sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
  }, [materiais, movimentos]);
  const material = materiais.find(item => item.id === materialId);
  const pontos = useMemo(() => movimentoPorSemana(movimentos, hoje, SEMANAS, materialId || undefined), [hoje, materialId, movimentos]);
  const maior = Math.max(1, ...pontos.flatMap(ponto => [ponto.entradas, ponto.saidas, ponto.transporte]));
  const medida = material ? material.unidade : 'lançamentos';
  const ponto = destaque === null ? null : pontos[destaque];
  const resumoDo = (item: PontoSemana) => `Semana de ${item.rotulo}: ${br(item.entradas)} de entrada, ${br(item.saidas)} de saída, ${br(item.transporte)} de transporte (${medida})`;

  return (
    <article data-materiais-reveal className={`${CARTAO} p-4 lg:col-span-8`} aria-labelledby="materiais-semanas">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="materiais-semanas" className="text-base font-bold text-slate-900">Últimas 12 semanas</h2>
          <p className="text-sm text-slate-500">{material ? `Quantidade de ${material.descricao}, em ${material.unidade}` : 'Número de lançamentos por semana'}</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <label className="min-w-0 flex-1 sm:w-56 sm:flex-none">
            <span className="sr-only">Material do gráfico</span>
            <select value={materialId} onChange={event => setMaterialId(event.target.value)} className={`${CAMPO} min-h-10`}>
              <option value="">Todos (contar lançamentos)</option>
              {comMovimento.map(item => <option key={item.id} value={item.id}>{item.descricao}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setEmTabela(atual => !atual)}
            aria-pressed={emTabela}
            aria-label={emTabela ? 'Ver como gráfico' : 'Ver como tabela'}
            title={emTabela ? 'Ver como gráfico' : 'Ver como tabela'}
            className={`grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 transition duration-200 hover:border-emerald-500 hover:text-[#176b4d] ${FOCO}`}
          >
            {emTabela ? <ChartColumn className="size-5" aria-hidden="true" /> : <Table2 className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600" aria-label="Legenda do gráfico">
        {SERIES.map(serie => (
          <span key={serie.chave} className="flex items-center gap-1.5"><i className={`size-2.5 rounded-sm ${serie.cor}`} aria-hidden="true" />{serie.nome}</span>
        ))}
      </div>

      {emTabela ? (
        <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Movimento por semana, em {medida}</caption>
            <thead className="sticky top-0 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr><th className="px-3 py-2">Semana de</th>{SERIES.map(serie => <th key={serie.chave} className="px-3 py-2 text-right">{serie.nome}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...pontos].reverse().map(item => (
                <tr key={item.inicio}>
                  <td className="px-3 py-2 tabular-nums text-slate-700">{item.rotulo}</td>
                  {SERIES.map(serie => <td key={serie.chave} className="px-3 py-2 text-right tabular-nums text-slate-900">{br(item[serie.chave])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative mt-3">
          {/* Valor da maior barra no topo: a escala fica clara sem uma régua cheia de números. */}
          <span className="absolute left-0 top-0 text-xs tabular-nums text-slate-400">{br(maior)}</span>
          <div className="ml-8 grid h-44 items-end gap-1 border-b border-slate-200 sm:gap-2" style={{ gridTemplateColumns: `repeat(${SEMANAS}, minmax(0, 1fr))` }} onMouseLeave={() => setDestaque(null)}>
            {pontos.map((item, indice) => (
              <div
                key={item.inicio}
                role="img"
                tabIndex={0}
                aria-label={resumoDo(item)}
                onMouseEnter={() => setDestaque(indice)}
                onFocus={() => setDestaque(indice)}
                onBlur={() => setDestaque(null)}
                onClick={() => setDestaque(atual => (atual === indice ? null : indice))}
                className={`flex h-full min-w-0 cursor-default items-end justify-center gap-0.5 rounded-t-lg outline-none transition-colors ${destaque === indice ? 'bg-slate-100' : ''} focus-visible:ring-2 focus-visible:ring-[#f26a2e]/60`}
              >
                {SERIES.map(serie => (
                  <span
                    key={serie.chave}
                    className={`w-1.5 rounded-t-[4px] sm:w-2.5 ${serie.cor}`}
                    style={{ height: item[serie.chave] ? `max(2px, ${(item[serie.chave] / maior) * 100}%)` : 0 }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="ml-8 grid gap-1 pt-1 sm:gap-2" style={{ gridTemplateColumns: `repeat(${SEMANAS}, minmax(0, 1fr))` }} aria-hidden="true">
            {pontos.map((item, indice) => (
              <span key={item.inicio} className={`text-center text-[11px] tabular-nums text-slate-500 ${indice % 2 ? 'max-sm:invisible' : ''}`}>{item.rotulo}</span>
            ))}
          </div>
          <p className="mt-2 min-h-10 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700" aria-live="polite">
            {ponto
              ? <><strong className="text-slate-900">Semana de {ponto.rotulo}:</strong> {br(ponto.entradas)} de entrada, {br(ponto.saidas)} de saída e {br(ponto.transporte)} de transporte{material ? ` (${material.unidade})` : ''}.</>
              : 'Toque ou passe o mouse numa semana para ver os números.'}
          </p>
        </div>
      )}
    </article>
  );
}
