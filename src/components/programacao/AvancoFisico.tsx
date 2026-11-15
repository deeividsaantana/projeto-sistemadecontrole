import { AlertTriangle, CalendarClock, FileSpreadsheet, FileText, Gauge, TrendingUp } from 'lucide-react';
import type { RegistroProducao } from '../../types';
import { CartaoIndicador, GradeIndicadores } from '../../shared/ui/CartaoIndicador';
import { TabelaPadrao, type ColunaTabela } from '../../shared/ui/TabelaPadrao';
import { BOTAO_SECUNDARIO } from '../cadastros/estilos';
import {
  SITUACOES,
  avancoGeral,
  avancoPorFrente,
  curvaS,
  previstoGeral,
  producaoPorDia,
  type AvancoDaFrente,
  type ResumoAtividade,
  type SituacaoAtividade,
} from '../../utils/programacao';
import { GraficoLinha, Rosca, type FatiaRosca } from './graficos';
import { diaDaSemana, diaMes, numeroObra } from './visual';

interface Props {
  resumos: readonly ResumoAtividade[];
  producao: readonly RegistroProducao[];
  hoje: string;
  exportando: boolean;
  onExportar: (tipo: 'excel' | 'pdf') => void;
  onEscolherFrente: (frente: string) => void;
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
const corDesvio = { vermelho: 'text-rose-700', laranja: 'text-[#c2410c]', verde: 'text-[#176b4d]' };

/** Unidade com mais atividades (normalmente M), para somar produção sem misturar unidades. */
const unidadePrincipal = (resumos: readonly ResumoAtividade[]) => {
  const contagem = new Map<string, number>();
  for (const { item } of resumos) contagem.set(item.unidade, (contagem.get(item.unidade) ?? 0) + 1);
  return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'M';
};

const titulo = 'mb-3 text-base font-black text-slate-900';
const cartao = 'min-w-0 rounded-2xl border border-slate-200 bg-white p-4';

/**
 * Avanço físico da obra: curva S (previsto x realizado), quanto já foi feito,
 * como estão as atividades, a produção dos últimos 14 dias e o relatório por
 * frente. Tudo segue os filtros do topo.
 */
export function AvancoFisico({ resumos, producao, hoje, exportando, onExportar, onEscolherFrente }: Props) {
  const realizado = avancoGeral(resumos);
  const previsto = previstoGeral(resumos);
  const desvio = realizado - previsto;
  const atrasadas = resumos.filter(resumo => resumo.situacao === 'atrasada').length;
  const curva = curvaS(resumos, producao, hoje);
  const frentes = avancoPorFrente(resumos);
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

  const colunas: ColunaTabela<AvancoDaFrente>[] = [
    { chave: 'frente', titulo: 'Frente', render: f => <span className="font-bold text-slate-900">{f.frente}</span>, valorOrdenacao: f => f.frente, larguraMinima: 110 },
    { chave: 'atividades', titulo: 'Atividades', alinhamento: 'direita', render: f => f.atividades, valorOrdenacao: f => f.atividades },
    { chave: 'atrasadas', titulo: 'Atrasadas', alinhamento: 'direita', render: f => <span className={f.atrasadas ? 'font-bold text-rose-700' : ''}>{f.atrasadas}</span>, valorOrdenacao: f => f.atrasadas },
    { chave: 'previsto', titulo: 'Previsto', alinhamento: 'direita', render: f => porcento(f.previsto), valorOrdenacao: f => f.previsto },
    {
      chave: 'realizado',
      titulo: 'Feito',
      render: f => (
        <span className="relative flex min-w-32 items-center gap-2" title={`Feito ${porcento(f.realizado)} · previsto ${porcento(f.previsto)}`}>
          <span className="relative h-2.5 flex-1 rounded-full bg-slate-100" aria-hidden="true">
            <span className="absolute inset-y-0 left-0 rounded-full bg-[#176b4d]" style={{ width: `${Math.min(100, f.realizado)}%` }} />
            <span className="absolute -inset-y-1 w-0.5 rounded bg-[#f26a2e]" style={{ left: `calc(${Math.min(100, f.previsto)}% - 1px)` }} />
          </span>
          <span className="w-10 text-right text-xs font-bold tabular-nums text-slate-700">{porcento(f.realizado)}</span>
        </span>
      ),
      valorOrdenacao: f => f.realizado,
      valorExportacao: f => porcento(f.realizado),
      larguraMinima: 160,
    },
    {
      chave: 'desvio',
      titulo: 'Desvio',
      alinhamento: 'direita',
      render: f => <span className={`font-bold tabular-nums ${corDesvio[tomDesvio(f.realizado - f.previsto)]}`}>{desvioTexto(f.realizado - f.previsto)}</span>,
      valorOrdenacao: f => f.realizado - f.previsto,
    },
  ];

  if (!resumos.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-[#5b6870]">
        Nenhuma atividade com esses filtros. Os gráficos aparecem quando houver atividades programadas.
      </p>
    );
  }

  return (
    <div className="grid min-w-0 gap-4" data-testid="programacao-avanco">
      <GradeIndicadores rotulo="Resumo do avanço físico">
        <CartaoIndicador rotulo="Feito" valor={porcento(realizado)} detalhe="Avanço físico da obra" icone={TrendingUp} tom="verde" dados={{ 'data-linha-lista': true }} />
        <CartaoIndicador rotulo="Previsto até ontem" valor={porcento(previsto)} detalhe="Pelo cronograma" icone={CalendarClock} dados={{ 'data-linha-lista': true }} />
        <CartaoIndicador rotulo="Desvio" valor={desvioTexto(desvio)} detalhe={desvio < 0 ? 'Abaixo do previsto' : 'No previsto ou à frente'} icone={Gauge} tom={tomDesvio(desvio)} dados={{ 'data-linha-lista': true }} />
        <CartaoIndicador rotulo="Atrasadas" valor={atrasadas} detalhe={`De ${resumos.length} ${resumos.length === 1 ? 'atividade' : 'atividades'}`} icone={AlertTriangle} tom={atrasadas ? 'vermelho' : 'verde'} dados={{ 'data-linha-lista': true }} />
      </GradeIndicadores>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className={cartao} data-linha-lista>
          <h2 className={titulo}>Curva S: previsto x feito</h2>
          {curva.length > 1 ? (
            <GraficoLinha
              titulo="Curva S do avanço físico, previsto e feito, em percentual acumulado"
              rotulosX={curva.map(ponto => diaMes(ponto.dia))}
              rotulosLongos={curva.map(ponto => `${diaDaSemana(ponto.dia)}, ${diaMes(ponto.dia)}`)}
              series={[
                { nome: 'Feito', ...REALIZADO, valores: curva.map(ponto => ponto.realizado) },
                { nome: 'Previsto', ...PREVISTO, tracejado: true, valores: curva.map(ponto => ponto.previsto) },
              ]}
              formatar={porcento}
              maximo={100}
              marcaX={marcaHoje}
              rotuloMarca="hoje"
              altura={260}
            />
          ) : <p className="text-sm font-semibold text-[#5b6870]">A curva aparece quando as atividades tiverem mais de um dia.</p>}
        </section>

        <section className={cartao} data-linha-lista>
          <h2 className={titulo}>Avanço físico</h2>
          <Rosca
            titulo="Avanço físico"
            fatias={fatiasAvanco}
            centro={(
              <>
                <span className="text-2xl font-black tabular-nums text-slate-900">{porcento(realizado)}</span>
                <span className="text-xs font-bold text-[#5b6870]">feito</span>
              </>
            )}
            legendaValor={fatia => porcento(fatia.valor)}
          />
        </section>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className={cartao} data-linha-lista>
          <h2 className={titulo}>Produção por dia ({unidade.toLowerCase()}), últimos 14 dias</h2>
          <GraficoLinha
            titulo={`Produção lançada por dia em ${unidade} e meta do dia`}
            rotulosX={dias.map(d => diaMes(d.dia))}
            rotulosLongos={dias.map(d => `${diaDaSemana(d.dia)}, ${diaMes(d.dia)}`)}
            series={[
              // Domingo não é dia de trabalho: a linha pula o dia em vez de cair a zero.
              { nome: 'Feito', ...REALIZADO, valores: dias.map(d => (d.meta === 0 && d.feito === 0 ? undefined : d.feito)) },
              { nome: 'Meta do dia', ...PREVISTO, tracejado: true, valores: dias.map(d => (d.meta === 0 ? undefined : d.meta)) },
            ]}
            formatar={valor => numeroObra(valor)}
            marcaX={dias.length - 1}
            rotuloMarca="hoje"
          />
        </section>

        <section className={cartao} data-linha-lista>
          <h2 className={titulo}>Atividades por situação</h2>
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

      <section className="grid min-w-0 gap-3" data-linha-lista>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-black text-slate-900">Relatório de avanço por frente</h2>
            <p className="text-xs font-semibold text-[#5b6870]">
              Barra verde: feito. Risco laranja: onde deveria estar até ontem. Toque na frente para filtrar.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onExportar('pdf')} disabled={exportando} className={BOTAO_SECUNDARIO} data-testid="avanco-pdf">
              <FileText className="size-4 text-rose-700" aria-hidden="true" /> PDF
            </button>
            <button type="button" onClick={() => onExportar('excel')} disabled={exportando} className={BOTAO_SECUNDARIO}>
              <FileSpreadsheet className="size-4 text-[#176b4d]" aria-hidden="true" /> Excel
            </button>
          </div>
        </div>
        <TabelaPadrao
          titulo="Avanço por frente"
          linhas={frentes}
          colunas={colunas}
          idDaLinha={f => f.frente}
          nomeDoItem={{ um: 'frente', varios: 'frentes' }}
          onAbrirLinha={f => onEscolherFrente(f.frente === 'Sem frente' ? '' : f.frente)}
          exportar={false}
          vazio="Nenhuma frente com esses filtros."
          resumo={` · feito ${porcento(realizado)} de ${porcento(previsto)} previsto`}
        />
      </section>
    </div>
  );
}
