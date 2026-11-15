import { CalendarClock, FileSpreadsheet, FileText, Gauge, TimerOff, TrendingUp } from 'lucide-react';
import type { RegistroProducao } from '../../types';
import { CartaoIndicador, GradeIndicadores } from '../../shared/ui/CartaoIndicador';
import { TabelaPadrao, type ColunaTabela } from '../../shared/ui/TabelaPadrao';
import { BOTAO_SECUNDARIO } from '../cadastros/estilos';
import {
  SITUACOES,
  avancoGeral,
  curvaS,
  previstoGeral,
  producaoPorDia,
  type ResumoAtividade,
  type SituacaoAtividade,
} from '../../utils/programacao';
import {
  avancoPorServico,
  comRitmo,
  terminoDaObra,
  trechosPorFrente,
  type AtividadeComRitmo,
  type AvancoDoServico,
} from '../../utils/avancoObra';
import { DiagramaEstacas } from './DiagramaEstacas';
import { GraficoLinha, Rosca, type FatiaRosca } from './graficos';
import { BarraAvanco, diaDaSemana, diaMes, numeroObra } from './visual';

interface Props {
  resumos: readonly ResumoAtividade[];
  producao: readonly RegistroProducao[];
  hoje: string;
  exportando: boolean;
  onExportar: (tipo: 'excel' | 'pdf') => void;
  onAbrirAtividade: (id: string) => void;
}

// Realizado em verde (traço cheio) e previsto em laranja (tracejado): a cor
// não é o único sinal, e o nome de cada linha fica escrito na legenda.
const REALIZADO = { traco: 'stroke-[#176b4d]', ponto: 'bg-[#176b4d]' };
const PREVISTO = { traco: 'stroke-[#f26a2e]', ponto: 'bg-[#f26a2e]' };

const FATIA_SITUACAO: Record<SituacaoAtividade, string> = {
  atrasada: 'fill-rose-600',
  atencao: 'fill-amber-400',
  'em-dia': 'fill-[#176b4d]',
  programada: 'fill-slate-400',
  concluida: 'fill-sky-700',
  cancelada: 'fill-slate-200',
};

const porcento = (valor: number) => `${Math.round(valor)}%`;
const desvioTexto = (valor: number) => `${valor > 0 ? '+' : ''}${Math.round(valor)} pts`;
const tomDesvio = (valor: number): 'vermelho' | 'laranja' | 'verde' => (valor <= -5 ? 'vermelho' : valor < 0 ? 'laranja' : 'verde');
const dataCurta = (dia?: string) => (dia ? `${diaMes(dia)}/${dia.slice(2, 4)}` : '—');

/** Folga do término em dias de trabalho: + adiantado, − atrasado. */
export const textoFolga = (folga?: number) =>
  folga === undefined ? 'sem ritmo' : folga === 0 ? 'no prazo' : `${folga > 0 ? '+' : '−'}${Math.abs(folga)} ${Math.abs(folga) === 1 ? 'dia' : 'dias'}`;
const corFolga = (folga?: number) =>
  folga === undefined ? 'text-[#c2410c]' : folga < 0 ? 'text-rose-700' : 'text-[#176b4d]';

function Folga({ folga }: { folga?: number }) {
  return <span className={`whitespace-nowrap font-bold tabular-nums ${corFolga(folga)}`}>{textoFolga(folga)}</span>;
}

function Termino({ projetado, planejado }: { projetado?: string; planejado: string }) {
  return (
    <span className="block whitespace-nowrap tabular-nums">
      <span className="block font-bold text-slate-900">{dataCurta(projetado)}</span>
      <span className="block text-xs font-semibold text-[#5b6870]">plan. {dataCurta(planejado)}</span>
    </span>
  );
}

function BarraComPrevisto({ feito, previsto }: { feito: number; previsto: number }) {
  return (
    <span className="flex min-w-32 items-center gap-2" title={`Feito ${porcento(feito)} · previsto até ontem ${porcento(previsto)}`}>
      <span className="relative h-2.5 flex-1 rounded-full bg-slate-100" aria-hidden="true">
        <span className="absolute inset-y-0 left-0 rounded-full bg-[#176b4d]" style={{ width: `${Math.min(100, feito)}%` }} />
        <span className="absolute -inset-y-1 w-0.5 rounded bg-[#f26a2e]" style={{ left: `calc(${Math.min(100, previsto)}% - 1px)` }} />
      </span>
      <span className="w-10 text-right text-xs font-bold tabular-nums text-slate-700">{porcento(feito)}</span>
    </span>
  );
}

/** Unidade com mais atividades (normalmente M), para somar produção sem misturar unidades. */
const unidadePrincipal = (resumos: readonly ResumoAtividade[]) => {
  const contagem = new Map<string, number>();
  for (const { item } of resumos) contagem.set(item.unidade, (contagem.get(item.unidade) ?? 0) + 1);
  return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'M';
};

const titulo = 'text-base font-black text-slate-900';
const legenda = 'text-xs font-semibold text-[#5b6870]';
const cartao = 'min-w-0 rounded-2xl border border-slate-200 bg-white p-4';

export function AvancoFisico({ resumos, producao, hoje, exportando, onExportar, onAbrirAtividade }: Props) {
  const atividades = comRitmo(resumos, producao, hoje);
  const realizado = avancoGeral(resumos);
  const previsto = previstoGeral(resumos);
  const desvio = realizado - previsto;
  const obra = terminoDaObra(atividades);
  const foraDoPrazo = atividades.filter(a => a.situacao !== 'concluida' && a.situacao !== 'programada' && (a.ritmo.folga === undefined || a.ritmo.folga < 0)).length;
  const servicos = avancoPorServico(atividades, hoje);
  const trechos = trechosPorFrente(atividades);
  const curva = curvaS(resumos, producao, hoje);
  const unidade = unidadePrincipal(resumos);
  const dias = producaoPorDia(resumos, producao, hoje, 14, unidade);
  const marcaHoje = curva.findIndex(ponto => ponto.dia === hoje);

  const fatiasAvanco: FatiaRosca[] = [
    { chave: 'feito', nome: 'Feito', valor: Math.min(100, realizado), cor: 'fill-[#176b4d]' },
    { chave: 'atraso', nome: 'Atrasado', valor: Math.max(0, previsto - realizado), cor: 'fill-[#f26a2e]' },
    { chave: 'falta', nome: 'Ainda por fazer', valor: Math.max(0, 100 - Math.max(previsto, realizado)), cor: 'fill-slate-200' },
  ];
  const fatiasSituacao: FatiaRosca[] = SITUACOES
    .filter(opcao => opcao.id !== 'cancelada')
    .map(opcao => ({ chave: opcao.id, nome: opcao.rotulo, valor: resumos.filter(resumo => resumo.situacao === opcao.id).length, cor: FATIA_SITUACAO[opcao.id] }))
    .filter(fatia => fatia.valor > 0);

  const colunasServico: ColunaTabela<AvancoDoServico>[] = [
    {
      chave: 'servico',
      titulo: 'Serviço',
      render: s => (
        <span className="block min-w-0">
          <span className="block font-bold text-slate-900">{s.servico}</span>
          <span className="block text-xs font-semibold text-[#5b6870]">{s.frentes.length === 1 ? s.frentes[0] : `${s.frentes.length} frentes`}</span>
        </span>
      ),
      valorOrdenacao: s => s.servico,
      valorExportacao: s => s.servico,
      larguraMinima: 150,
    },
    { chave: 'executado', titulo: 'Executado', alinhamento: 'direita', render: s => <span className="whitespace-nowrap tabular-nums"><strong className="text-slate-900">{numeroObra(s.executado)}</strong> / {numeroObra(s.quantidade)} {s.unidade.toLowerCase()}</span>, valorOrdenacao: s => s.executado },
    { chave: 'avanco', titulo: 'Avanço', render: s => <BarraComPrevisto feito={s.percentual} previsto={s.percentualPrevisto} />, valorOrdenacao: s => s.percentual, valorExportacao: s => porcento(s.percentual), larguraMinima: 160 },
    { chave: 'saldo', titulo: 'Saldo', alinhamento: 'direita', render: s => <span className="whitespace-nowrap tabular-nums">{numeroObra(s.saldo)} {s.unidade.toLowerCase()}</span>, valorOrdenacao: s => s.saldo },
    {
      chave: 'ritmo',
      titulo: 'Média / meta por dia',
      alinhamento: 'direita',
      render: s => (s.meta > 0
        ? <span className="whitespace-nowrap tabular-nums"><strong className={s.mediaDiaria >= s.meta * 0.95 ? 'text-[#176b4d]' : 'text-rose-700'}>{numeroObra(s.mediaDiaria)}</strong> / {numeroObra(s.meta)}</span>
        : <span className="text-[#5b6870]">—</span>),
      valorOrdenacao: s => (s.meta > 0 ? s.mediaDiaria / s.meta : -1),
      valorExportacao: s => `${numeroObra(s.mediaDiaria)} / ${numeroObra(s.meta)}`,
    },
    { chave: 'termino', titulo: 'Término projetado', render: s => <Termino projetado={s.termino} planejado={s.terminoPlanejado} />, valorOrdenacao: s => s.termino ?? '9999' },
    { chave: 'folga', titulo: 'Folga', alinhamento: 'direita', render: s => <Folga folga={s.folga} />, valorOrdenacao: s => s.folga ?? -9999, valorExportacao: s => textoFolga(s.folga) },
  ];

  const colunasAtividade: ColunaTabela<AtividadeComRitmo>[] = [
    {
      chave: 'servico',
      titulo: 'Serviço',
      render: a => (
        <span className="block min-w-0">
          <span className="block font-bold text-slate-900">{a.item.servicoDescricao}</span>
          <span className="block text-xs font-semibold text-[#5b6870]">{a.item.frente || 'Sem frente'}</span>
        </span>
      ),
      valorOrdenacao: a => `${a.item.frente || ''} ${a.item.servicoDescricao}`,
      valorExportacao: a => `${a.item.frente || ''} · ${a.item.servicoDescricao}`,
      larguraMinima: 150,
    },
    { chave: 'estacas', titulo: 'Estacas', render: a => <span className="whitespace-nowrap tabular-nums">{a.item.estacaInicial ? `${a.item.estacaInicial} a ${a.item.estacaFinal || '?'}` : '—'}</span>, valorOrdenacao: a => a.ritmo.trecho?.de ?? 0, noCartao: false },
    { chave: 'executado', titulo: 'Executado', alinhamento: 'direita', render: a => <span className="whitespace-nowrap tabular-nums"><strong className="text-slate-900">{numeroObra(a.realizado)}</strong> / {numeroObra(a.item.quantidadePlanejada)} {a.item.unidade.toLowerCase()}</span>, valorOrdenacao: a => a.realizado },
    { chave: 'avanco', titulo: 'Avanço', render: a => <BarraAvanco percentual={a.percentual} situacao={a.situacao} />, valorOrdenacao: a => a.percentual, larguraMinima: 130 },
    { chave: 'media', titulo: 'Média / meta', alinhamento: 'direita', render: a => <span className="whitespace-nowrap tabular-nums">{a.ritmo.diasTrabalhados ? numeroObra(a.ritmo.mediaDiaria) : '—'} / {numeroObra(a.meta)}</span>, valorOrdenacao: a => a.ritmo.desempenho ?? -1 },
    { chave: 'desempenho', titulo: 'Desempenho', alinhamento: 'direita', render: a => (a.ritmo.desempenho === undefined ? '—' : <span className={`font-bold tabular-nums ${a.ritmo.desempenho >= 95 ? 'text-[#176b4d]' : a.ritmo.desempenho >= 80 ? 'text-[#c2410c]' : 'text-rose-700'}`}>{porcento(a.ritmo.desempenho)}</span>), valorOrdenacao: a => a.ritmo.desempenho ?? -1 },
    { chave: 'termino', titulo: 'Término', render: a => <Termino projetado={a.ritmo.termino} planejado={a.item.dataFim} />, valorOrdenacao: a => a.ritmo.termino ?? '9999' },
    { chave: 'folga', titulo: 'Folga', alinhamento: 'direita', render: a => <Folga folga={a.ritmo.folga} />, valorOrdenacao: a => a.ritmo.folga ?? -9999 },
  ];

  if (!resumos.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-[#5b6870]">
        Nenhuma atividade com esses filtros. Os gráficos aparecem quando houver atividades programadas.
      </p>
    );
  }

  const tomTermino = obra?.folga === undefined ? 'laranja' : obra.folga < 0 ? 'vermelho' : 'verde';

  return (
    <div className="grid min-w-0 gap-4" data-testid="programacao-avanco">
      <GradeIndicadores rotulo="Resumo do avanço físico">
        <CartaoIndicador rotulo="Avanço físico" valor={porcento(realizado)} detalhe={`Previsto até ontem: ${porcento(previsto)}`} icone={TrendingUp} tom={tomDesvio(desvio)} dados={{ 'data-linha-lista': true }} />
        <CartaoIndicador rotulo="Desvio" valor={desvioTexto(desvio)} detalhe={desvio < 0 ? 'Abaixo do cronograma' : 'No cronograma ou à frente'} icone={Gauge} tom={tomDesvio(desvio)} dados={{ 'data-linha-lista': true }} />
        <CartaoIndicador
          rotulo="Término projetado"
          valor={obra?.projetado ? dataCurta(obra.projetado) : 'Sem ritmo'}
          detalhe={obra ? `Planejado ${dataCurta(obra.planejado)} · ${obra.projetado ? textoFolga(obra.folga) : `${obra.semRitmo} sem produção`}` : undefined}
          icone={CalendarClock}
          tom={tomTermino}
          dados={{ 'data-linha-lista': true }}
        />
        <CartaoIndicador rotulo="Fora do prazo" valor={foraDoPrazo} detalhe={`Pelo ritmo atual, de ${atividades.length} ${atividades.length === 1 ? 'atividade' : 'atividades'}`} icone={TimerOff} tom={foraDoPrazo ? 'vermelho' : 'verde'} dados={{ 'data-linha-lista': true }} />
      </GradeIndicadores>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className={cartao} data-linha-lista>
          <h2 className={`${titulo} mb-3`}>Curva S: previsto x executado</h2>
          {curva.length > 1 ? (
            <GraficoLinha
              titulo="Curva S do avanço físico, previsto e executado, em percentual acumulado"
              rotulosX={curva.map(ponto => diaMes(ponto.dia))}
              rotulosLongos={curva.map(ponto => `${diaDaSemana(ponto.dia)}, ${diaMes(ponto.dia)}`)}
              series={[
                { nome: 'Executado', ...REALIZADO, valores: curva.map(ponto => ponto.realizado) },
                { nome: 'Previsto', ...PREVISTO, tracejado: true, valores: curva.map(ponto => ponto.previsto) },
              ]}
              formatar={porcento}
              maximo={100}
              marcaX={marcaHoje}
              rotuloMarca="hoje"
              altura={260}
            />
          ) : <p className={legenda}>A curva aparece quando as atividades tiverem mais de um dia.</p>}
        </section>

        <section className={cartao} data-linha-lista>
          <h2 className={`${titulo} mb-3`}>Avanço físico</h2>
          <Rosca
            titulo="Avanço físico"
            fatias={fatiasAvanco}
            centro={(
              <>
                <span className="text-2xl font-black tabular-nums text-slate-900">{porcento(realizado)}</span>
                <span className="text-xs font-bold text-[#5b6870]">executado</span>
              </>
            )}
            legendaValor={fatia => porcento(fatia.valor)}
          />
        </section>
      </div>

      <section className="grid min-w-0 gap-2" data-linha-lista>
        <div>
          <h2 className={titulo}>Avanço por serviço</h2>
          <p className={legenda}>Soma de todas as frentes. Barra verde: executado. Risco laranja: previsto até ontem. Término pelo ritmo médio de cada frente.</p>
        </div>
        <TabelaPadrao
          titulo="Avanço por serviço"
          linhas={servicos}
          colunas={colunasServico}
          idDaLinha={s => s.chave}
          nomeDoItem={{ um: 'serviço', varios: 'serviços' }}
          exportar={false}
          vazio="Nenhum serviço com esses filtros."
        />
      </section>

      <section className={cartao} data-linha-lista>
        <h2 className={`${titulo} mb-3`}>Diagrama linear por estaca</h2>
        <DiagramaEstacas trechos={trechos} onAbrir={onAbrirAtividade} />
      </section>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className={cartao} data-linha-lista>
          <h2 className={`${titulo} mb-3`}>Produção diária ({unidade.toLowerCase()}) x meta, últimos 14 dias</h2>
          <GraficoLinha
            titulo={`Produção lançada por dia em ${unidade} e meta do dia`}
            rotulosX={dias.map(d => diaMes(d.dia))}
            rotulosLongos={dias.map(d => `${diaDaSemana(d.dia)}, ${diaMes(d.dia)}`)}
            series={[
              // Domingo não é dia de trabalho: a linha pula o dia em vez de cair a zero.
              { nome: 'Executado', ...REALIZADO, valores: dias.map(d => (d.meta === 0 && d.feito === 0 ? undefined : d.feito)) },
              { nome: 'Meta do dia', ...PREVISTO, tracejado: true, valores: dias.map(d => (d.meta === 0 ? undefined : d.meta)) },
            ]}
            formatar={valor => numeroObra(valor)}
            marcaX={dias.length - 1}
            rotuloMarca="hoje"
          />
        </section>

        <section className={cartao} data-linha-lista>
          <h2 className={`${titulo} mb-3`}>Atividades por situação</h2>
          <Rosca
            titulo="Atividades por situação"
            fatias={fatiasSituacao}
            centro={(
              <>
                <span className="text-2xl font-black tabular-nums text-slate-900">{resumos.length}</span>
                <span className="text-xs font-bold text-[#5b6870]">{resumos.length === 1 ? 'atividade' : 'atividades'}</span>
              </>
            )}
            legendaValor={(fatia, percentual) => `${fatia.valor} · ${percentual}%`}
          />
        </section>
      </div>

      <section className="grid min-w-0 gap-2" data-linha-lista>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className={titulo}>Controle de produção por atividade</h2>
            <p className={legenda}>Média = executado ÷ dias trabalhados. Desempenho = média ÷ meta. Toque na atividade para abrir.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onExportar('pdf')} disabled={exportando} className={BOTAO_SECUNDARIO} data-testid="avanco-pdf">
              <FileText className="size-4 text-rose-700" aria-hidden="true" /> Relatório PDF
            </button>
            <button type="button" onClick={() => onExportar('excel')} disabled={exportando} className={BOTAO_SECUNDARIO}>
              <FileSpreadsheet className="size-4 text-[#176b4d]" aria-hidden="true" /> Excel
            </button>
          </div>
        </div>
        <TabelaPadrao
          titulo="Controle de produção por atividade"
          linhas={atividades}
          colunas={colunasAtividade}
          idDaLinha={a => a.item.id}
          nomeDoItem={{ um: 'atividade', varios: 'atividades' }}
          onAbrirLinha={a => onAbrirAtividade(a.item.id)}
          ordenacaoInicial={{ chave: 'folga', direcao: 'asc' }}
          exportar={false}
          vazio="Nenhuma atividade com esses filtros."
        />
      </section>
    </div>
  );
}
