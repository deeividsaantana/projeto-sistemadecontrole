import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarDays, Factory, FileSpreadsheet, Layers, Minus, Package, Printer, Route } from 'lucide-react';
import type { EtapaServico, Material, MovimentoMaterial, TipoMovimentoMaterial } from '../../types';
import {
  SEM_FORNECEDOR,
  diasDoPeriodo,
  filtrarRelatorio,
  indicadores,
  mesAMes,
  paraCsv,
  periodoAnterior,
  porDia,
  porFornecedor,
  porMaterial,
  porRamo,
  ramoDoMovimento,
  somaVazia,
  somar,
  type FiltroRelatorio,
  type Indicador,
  type LinhaRelatorio,
} from '../../modules/materials/relatoriosMateriais';
import { nomeDoMes, ramosDaObra } from '../../modules/materials/previstoMateriais';
import { formatarData, moeda, numero } from '../../utils/formato';
import { CountUp, TabelaPadrao, type ColunaTabela } from '../../shared/ui';
import { AbasDaTela, type AbaDaTela } from '../../shared/ui/AbasDaTela';
import { useEntradaDeLista } from '../../shared/hooks/useEntradaDeLista';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO } from '../cadastros/estilos';

type Relatorio = 'material' | 'fornecedor' | 'ramo' | 'mes' | 'dia';

const RELATORIOS: ReadonlyArray<AbaDaTela<Relatorio>> = [
  { id: 'material', rotulo: 'Por material', curto: 'Material', icone: Package, testId: 'relatorio-material' },
  { id: 'fornecedor', rotulo: 'Por fornecedor', curto: 'Fornecedor', icone: Factory, testId: 'relatorio-fornecedor' },
  { id: 'ramo', rotulo: 'Por ramo', curto: 'Ramo', icone: Route, testId: 'relatorio-ramo' },
  { id: 'mes', rotulo: 'Mês a mês', curto: 'Mês', icone: Layers, testId: 'relatorio-mes' },
  { id: 'dia', rotulo: 'Dia a dia', curto: 'Dia', icone: CalendarDays, testId: 'relatorio-dia' },
];

type LinhaMatriz = NonNullable<ReturnType<typeof mesAMes>>['linhas'][number];

const TIPOS: ReadonlyArray<{ id: TipoMovimentoMaterial | ''; nome: string }> = [
  { id: 'Entrada', nome: 'Chegou' },
  { id: 'Saída', nome: 'Saiu' },
  { id: 'Transferência', nome: 'Transporte' },
  { id: '', nome: 'Tudo' },
];

const INDICADOR: Record<Indicador['chave'], { nome: string; formatar: (valor: number) => string }> = {
  lancamentos: { nome: 'Lançamentos', formatar: valor => valor.toLocaleString('pt-BR') },
  toneladas: { nome: 'Toneladas', formatar: valor => `${numero(valor, 1)} t` },
  metrosCubicos: { nome: 'Metros cúbicos', formatar: valor => `${numero(valor, 1)} m³` },
  valor: {
    nome: 'Valor',
    // O cartão é estreito: "R$ 499.203,61" vira "R$ 499 mil"; o número inteiro fica no toque longo e nas tabelas.
    formatar: valor => (valor >= 1_000_000 ? `R$ ${(valor / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : valor >= 10_000 ? `R$ ${Math.round(valor / 1000).toLocaleString('pt-BR')} mil` : moeda(valor)),
  },
  fornecedores: { nome: 'Fornecedores', formatar: valor => valor.toLocaleString('pt-BR') },
  porDia: { nome: 'Lançamentos por dia', formatar: valor => numero(valor, 1) },
};

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesCurto = (mes: string) => `${MESES_CURTOS[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;
const outrasEmTexto = (outras: Record<string, number>) => Object.entries(outras).map(([unidade, total]) => `${numero(total, 1)} ${unidade}`).join(' · ');
const primeiroDoMes = (dia: string) => `${dia.slice(0, 7)}-01`;
const ultimoDoMes = (dia: string) => {
  const [ano, mes] = dia.split('-').map(Number);
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
};
const somarDias = (dia: string, dias: number) => new Date(new Date(`${dia}T12:00:00Z`).getTime() + dias * 86_400_000).toISOString().slice(0, 10);

interface Props {
  hoje: string;
  materiais: readonly Material[];
  movimentos: readonly MovimentoMaterial[];
  etapas: readonly EtapaServico[];
}

/**
 * Relatórios de Materiais: escolhe o período e os filtros uma vez, vê os
 * indicadores comparados com o período anterior e troca de relatório por
 * abas. Cada relatório baixa em planilha e imprime do jeito que está na tela.
 */
export default function RelatoriosMateriais({ hoje, materiais, movimentos, etapas }: Props) {
  const [filtro, setFiltro] = useState<FiltroRelatorio>(() => ({ de: primeiroDoMes(hoje), ate: hoje, tipo: 'Entrada', materialId: '', fornecedor: '', ramo: '' }));
  const [relatorio, setRelatorio] = useState<Relatorio>('material');
  // As 20 primeiras linhas entram em cascata ao trocar de relatório ou filtro.
  const tabela = useEntradaDeLista<HTMLElement>([relatorio, filtro]);
  const mudar = (parte: Partial<FiltroRelatorio>) => setFiltro(atual => ({ ...atual, ...parte }));

  const ramoDe = useMemo(() => ramoDoMovimento(etapas), [etapas]);
  const doPeriodo = useMemo(() => filtrarRelatorio(movimentos, filtro, ramoDe), [filtro, movimentos, ramoDe]);
  const anterior = useMemo(() => periodoAnterior(filtro.de, filtro.ate), [filtro.ate, filtro.de]);
  const doAnterior = useMemo(() => filtrarRelatorio(movimentos, { ...filtro, ...anterior }, ramoDe), [anterior, filtro, movimentos, ramoDe]);
  const numeros = useMemo(() => indicadores(doPeriodo, doAnterior, diasDoPeriodo(filtro.de, filtro.ate)), [doAnterior, doPeriodo, filtro.ate, filtro.de]);

  const opcoes = useMemo(() => {
    const usados = new Set(movimentos.map(item => item.materialId));
    const fornecedores = [...new Set(movimentos.map(item => item.fornecedorNome?.trim()).filter((nome): nome is string => Boolean(nome)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return {
      materiais: materiais.filter(item => usados.has(item.id)).sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR')),
      fornecedores,
      ramos: ramosDaObra(etapas),
    };
  }, [etapas, materiais, movimentos]);

  const linhas = useMemo((): LinhaRelatorio[] => {
    if (relatorio === 'material') return porMaterial(doPeriodo);
    if (relatorio === 'fornecedor') return porFornecedor(doPeriodo);
    if (relatorio === 'ramo') return porRamo(doPeriodo, ramoDe);
    if (relatorio === 'dia') return porDia(doPeriodo);
    return [];
  }, [doPeriodo, ramoDe, relatorio]);
  const matriz = useMemo(() => (relatorio === 'mes' ? mesAMes(doPeriodo) : null), [doPeriodo, relatorio]);
  const total = useMemo(() => doPeriodo.reduce(somar, somaVazia()), [doPeriodo]);

  const nomeRelatorio = RELATORIOS.find(item => item.id === relatorio)?.rotulo ?? '';
  const nomeTipo = TIPOS.find(item => item.id === filtro.tipo)?.nome ?? 'Tudo';
  const material = materiais.find(item => item.id === filtro.materialId);
  const filtrosAtivos = [material?.descricao, filtro.fornecedor, filtro.ramo].filter(Boolean) as string[];
  const periodoEscrito = `${formatarData(filtro.de)} a ${formatarData(filtro.ate)}`;
  const nomeDaLinha = (linha: LinhaRelatorio) => (relatorio === 'dia' ? formatarData(linha.nome) : linha.nome);

  const atalhos = [
    { nome: 'Este mês', de: primeiroDoMes(hoje), ate: hoje },
    { nome: 'Mês passado', de: primeiroDoMes(somarDias(primeiroDoMes(hoje), -1)), ate: ultimoDoMes(somarDias(primeiroDoMes(hoje), -1)) },
    { nome: 'Últimos 30 dias', de: somarDias(hoje, -29), ate: hoje },
    { nome: 'Tudo', de: movimentos.reduce((menor, item) => (item.data && item.data < menor ? item.data : menor), hoje), ate: hoje },
  ];

  const baixar = () => {
    const tabela: Array<Array<string | number>> = matriz
      ? [['Material', 'Unidade', ...matriz.meses.map(nomeDoMes), 'Total'], ...matriz.linhas.map(linha => [linha.nome, linha.unidade, ...matriz.meses.map(mes => linha.porMes[mes] || 0), linha.total])]
      : [
        [relatorio === 'dia' ? 'Dia' : relatorio === 'material' ? 'Material' : relatorio === 'fornecedor' ? 'Fornecedor' : 'Ramo', 'Lançamentos', 'Toneladas', 'Metros cúbicos', 'Outras unidades', 'Valor (R$)', 'Último'],
        ...linhas.map(linha => [nomeDaLinha(linha), linha.lancamentos, linha.toneladas, linha.metrosCubicos, outrasEmTexto(linha.outras), linha.valor, linha.ultima ? formatarData(linha.ultima) : '']),
        ['Total', total.lancamentos, total.toneladas, total.metrosCubicos, outrasEmTexto(total.outras), total.valor, ''],
      ];
    const url = URL.createObjectURL(new Blob([paraCsv(tabela)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `materiais-${nomeRelatorio.toLocaleLowerCase('pt-BR').replace(/\s+/g, '-')}-${filtro.de}-a-${filtro.ate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const vazio = doPeriodo.length === 0;
  const tituloDaPrimeira = relatorio === 'dia' ? 'Dia' : relatorio === 'material' ? 'Material' : relatorio === 'fornecedor' ? 'Fornecedor' : 'Ramo';
  const colunasLinhas: ColunaTabela<LinhaRelatorio>[] = [
    {
      chave: 'nome',
      titulo: tituloDaPrimeira,
      larguraMinima: 200,
      valorOrdenacao: linha => linha.nome,
      render: linha => <span className="font-semibold text-slate-800">{nomeDaLinha(linha)}{linha.detalhe && <span className="ml-1 text-xs font-normal text-slate-600">({linha.detalhe})</span>}</span>,
      dica: linha => nomeDaLinha(linha),
    },
    { chave: 'lancamentos', titulo: 'Lançamentos', alinhamento: 'direita', valorOrdenacao: linha => linha.lancamentos, render: linha => linha.lancamentos.toLocaleString('pt-BR') },
    { chave: 'toneladas', titulo: 'Toneladas', alinhamento: 'direita', valorOrdenacao: linha => linha.toneladas, render: linha => (linha.toneladas ? numero(linha.toneladas, 1) : '-') },
    { chave: 'm3', titulo: 'm³', alinhamento: 'direita', valorOrdenacao: linha => linha.metrosCubicos, render: linha => (linha.metrosCubicos ? numero(linha.metrosCubicos, 1) : '-') },
    { chave: 'outras', titulo: 'Outras', alinhamento: 'direita', render: linha => outrasEmTexto(linha.outras) || '-' },
    { chave: 'valor', titulo: 'Valor', alinhamento: 'direita', valorOrdenacao: linha => linha.valor, render: linha => (linha.valor ? moeda(linha.valor) : '-') },
    { chave: 'parte', titulo: '% do valor', alinhamento: 'direita', valorOrdenacao: linha => linha.valor, render: linha => (total.valor ? `${Math.round((linha.valor / total.valor) * 100)}%` : '-') },
    ...(relatorio !== 'dia' ? [{ chave: 'ultima', titulo: 'Último', alinhamento: 'direita' as const, valorOrdenacao: (linha: LinhaRelatorio) => linha.ultima || null, render: (linha: LinhaRelatorio) => (linha.ultima ? formatarData(linha.ultima) : '-') }] : []),
  ];
  const colunasMatriz: ColunaTabela<LinhaMatriz>[] = matriz ? [
    {
      chave: 'nome',
      titulo: 'Material',
      larguraMinima: 180,
      valorOrdenacao: linha => linha.nome,
      render: linha => <><span className="block font-semibold text-slate-800">{linha.nome}</span><span className="text-xs text-slate-600">{linha.unidade}</span></>,
      dica: linha => linha.nome,
    },
    ...matriz.meses.map((mes): ColunaTabela<LinhaMatriz> => ({ chave: mes, titulo: mesCurto(mes), alinhamento: 'direita', valorOrdenacao: linha => linha.porMes[mes] || 0, render: linha => (linha.porMes[mes] ? numero(linha.porMes[mes], 1) : '-') })),
    { chave: 'total', titulo: 'Total', alinhamento: 'direita', valorOrdenacao: linha => linha.total, render: linha => <strong className="font-black text-slate-950">{numero(linha.total, 1)}</strong> },
  ] : [];
  const resumoDoTotal = [
    `${total.lancamentos.toLocaleString('pt-BR')} lançamento(s)`,
    total.toneladas ? `${numero(total.toneladas, 1)} t` : '',
    total.metrosCubicos ? `${numero(total.metrosCubicos, 1)} m³` : '',
    outrasEmTexto(total.outras),
    total.valor ? moeda(total.valor) : '',
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-4">
      <section data-materiais-reveal aria-label="Período e filtros do relatório" className={`${CARTAO} space-y-3 p-4 print:hidden`}>
        <div className="flex flex-wrap gap-2">
          {atalhos.map(item => {
            const ativo = filtro.de === item.de && filtro.ate === item.ate;
            return (
              <button key={item.nome} type="button" aria-pressed={ativo} onClick={() => mudar({ de: item.de, ate: item.ate })} className={`min-h-10 rounded-full border px-4 text-sm font-bold transition duration-200 ${FOCO} ${ativo ? 'border-[#176b4d] bg-[#176b4d] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500'}`}>
                {item.nome}
              </button>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <label className="block space-y-1">
            <span className={ROTULO}>De</span>
            <input type="date" value={filtro.de} max={filtro.ate} onChange={event => event.target.value && mudar({ de: event.target.value })} className={CAMPO} />
          </label>
          <label className="block space-y-1">
            <span className={ROTULO}>Até</span>
            <input type="date" value={filtro.ate} min={filtro.de} onChange={event => event.target.value && mudar({ ate: event.target.value })} className={CAMPO} />
          </label>
          <label className="block space-y-1">
            <span className={ROTULO}>Mostrar</span>
            <select value={filtro.tipo} onChange={event => mudar({ tipo: event.target.value as FiltroRelatorio['tipo'] })} className={CAMPO}>
              {TIPOS.map(item => <option key={item.nome} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className={ROTULO}>Material</span>
            <select value={filtro.materialId} onChange={event => mudar({ materialId: event.target.value })} className={CAMPO}>
              <option value="">Todos</option>
              {opcoes.materiais.map(item => <option key={item.id} value={item.id}>{item.descricao}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className={ROTULO}>Fornecedor</span>
            <select value={filtro.fornecedor} onChange={event => mudar({ fornecedor: event.target.value })} className={CAMPO}>
              <option value="">Todos</option>
              {opcoes.fornecedores.map(item => <option key={item} value={item}>{item}</option>)}
              <option value={SEM_FORNECEDOR}>{SEM_FORNECEDOR}</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className={ROTULO}>Ramo</span>
            <select value={filtro.ramo} onChange={event => mudar({ ramo: event.target.value })} className={CAMPO}>
              <option value="">Todos</option>
              {opcoes.ramos.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        {filtrosAtivos.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <p className="text-sm text-slate-600">Filtrando por <strong className="text-slate-900">{filtrosAtivos.join(', ')}</strong></p>
            <button type="button" onClick={() => mudar({ materialId: '', fornecedor: '', ramo: '' })} className={BOTAO_SECUNDARIO}>Limpar filtros</button>
          </div>
        )}
      </section>

      <section data-materiais-reveal aria-label="Indicadores do período" className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6 print:hidden">
        {numeros.map(item => {
          const Seta = item.variacao === null || item.variacao === 0 ? Minus : item.variacao > 0 ? ArrowUpRight : ArrowDownRight;
          return (
            <article key={item.chave} className={`${CARTAO} p-4`}>
              <p className="text-sm font-semibold text-slate-600">{INDICADOR[item.chave].nome}</p>
              <strong className="mt-1 block truncate text-2xl font-black tabular-nums text-slate-950" title={item.chave === 'valor' ? moeda(item.valor) : INDICADOR[item.chave].formatar(item.valor)}>
                <CountUp value={item.valor} format={INDICADOR[item.chave].formatar} />
              </strong>
              <span className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <Seta className={`size-3.5 shrink-0 ${item.variacao ? (item.variacao > 0 ? 'text-[#176b4d]' : 'text-[#c2410c]') : ''}`} aria-hidden="true" />
                {item.variacao === null ? 'nada no período anterior' : `${item.variacao > 0 ? '+' : ''}${item.variacao}% sobre o anterior`}
              </span>
            </article>
          );
        })}
      </section>
      <p className="-mt-2 px-1 text-xs text-slate-500 print:hidden">Período anterior comparado: {formatarData(anterior.de)} a {formatarData(anterior.ate)}.</p>

      <section ref={tabela} id="materiais-relatorio-impressao" data-materiais-reveal aria-labelledby="materiais-relatorio-titulo" className={`${CARTAO} overflow-hidden`}>
        <div className="border-b border-slate-100 p-2 print:hidden">
          <AbasDaTela<Relatorio> id="relatorios-materiais" rotulo="Relatórios" abas={RELATORIOS} ativa={relatorio} onTrocar={setRelatorio} idPainel="materiais-relatorio-impressao" />
        </div>

        <header className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
          <div>
            <h2 id="materiais-relatorio-titulo" className="text-base font-bold text-slate-900">{nomeRelatorio} · {nomeTipo}</h2>
            <p className="text-sm text-slate-500">
              {periodoEscrito} · {total.lancamentos.toLocaleString('pt-BR')} lançamento(s){filtrosAtivos.length ? ` · ${filtrosAtivos.join(', ')}` : ''}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row print:hidden">
            <button type="button" onClick={() => window.print()} disabled={vazio} className={BOTAO_SECUNDARIO}>
              <Printer className="size-4" aria-hidden="true" />
              Imprimir
            </button>
            <button type="button" onClick={baixar} disabled={vazio} className={BOTAO_PRIMARIO}>
              <FileSpreadsheet className="size-4" aria-hidden="true" />
              Baixar planilha
            </button>
          </div>
        </header>

        {vazio ? (
          <p className="px-4 pb-10 pt-6 text-center text-sm text-slate-600">Nada lançado com esse período e esses filtros. Tente "Tudo" ou limpe os filtros.</p>
        ) : (
          <>
            {/* Na tela: a tabela padrão (ordena, pagina e vira cartões no celular). */}
            <div className="border-t border-slate-100 print:hidden">
              {matriz ? (
                <TabelaPadrao
                  key="mes"
                  titulo={`${nomeRelatorio} · ${nomeTipo}`}
                  linhas={matriz.linhas}
                  colunas={colunasMatriz}
                  idDaLinha={linha => linha.chave}
                  nomeDoItem={{ um: 'material', varios: 'materiais' }}
                  className="rounded-none border-0"
                />
              ) : (
                <TabelaPadrao
                  key={relatorio}
                  titulo={`${nomeRelatorio} · ${nomeTipo}`}
                  linhas={linhas}
                  colunas={colunasLinhas}
                  idDaLinha={linha => linha.chave}
                  nomeDoItem={{ um: 'linha', varios: 'linhas' }}
                  className="rounded-none border-0"
                />
              )}
              <p className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold tabular-nums text-slate-900"><span className="font-semibold text-slate-600">Total do período: </span>{resumoDoTotal}</p>
            </div>
            {/* Só no papel: a folha inteira, sem páginas, com a linha de total. */}
            <div className="hidden print:block">
              {matriz ? (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{nomeRelatorio} · {nomeTipo}, {periodoEscrito}</caption>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 bg-slate-50 p-3">Material</th>
                  {matriz.meses.map(mes => <th key={mes} scope="col" className="whitespace-nowrap p-3 text-right">{mesCurto(mes)}</th>)}
                  <th scope="col" className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matriz.linhas.map((linha, posicao) => (
                  <tr key={linha.chave} data-linha-lista={posicao < 20 ? '' : undefined} className="group transition-colors duration-150 hover:bg-emerald-50/50">
                    <th scope="row" className="sticky left-0 z-10 max-w-[12rem] bg-white p-3 font-semibold text-slate-800 group-hover:bg-[#f3faf6]">
                      <span className="block truncate" title={linha.nome}>{linha.nome}</span>
                      <span className="text-xs font-normal text-slate-500">{linha.unidade}</span>
                    </th>
                    {matriz.meses.map(mes => <td key={mes} className="whitespace-nowrap p-3 text-right tabular-nums text-slate-700">{linha.porMes[mes] ? numero(linha.porMes[mes], 1) : '-'}</td>)}
                    <td className="whitespace-nowrap p-3 text-right font-black tabular-nums text-slate-950">{numero(linha.total, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
              ) : (
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">{nomeRelatorio} · {nomeTipo}, {periodoEscrito}</caption>
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="p-3">{relatorio === 'dia' ? 'Dia' : relatorio === 'material' ? 'Material' : relatorio === 'fornecedor' ? 'Fornecedor' : 'Ramo'}</th>
                    <th scope="col" className="p-3 text-right">Lançamentos</th>
                    <th scope="col" className="p-3 text-right">Toneladas</th>
                    <th scope="col" className="p-3 text-right">m³</th>
                    <th scope="col" className="p-3 text-right">Outras</th>
                    <th scope="col" className="p-3 text-right">Valor</th>
                    <th scope="col" className="p-3 text-right">% do valor</th>
                    {relatorio !== 'dia' && <th scope="col" className="p-3 text-right">Último</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {linhas.map((linha, posicao) => (
                    <tr key={linha.chave} data-linha-lista={posicao < 20 ? '' : undefined} className="transition-colors duration-150 hover:bg-emerald-50/50">
                      <th scope="row" className="p-3 font-semibold text-slate-800">
                        {nomeDaLinha(linha)}
                        {linha.detalhe && <span className="ml-1 text-xs font-normal text-slate-500">({linha.detalhe})</span>}
                      </th>
                      <td className="p-3 text-right tabular-nums text-slate-700">{linha.lancamentos.toLocaleString('pt-BR')}</td>
                      <td className="whitespace-nowrap p-3 text-right tabular-nums text-slate-700">{linha.toneladas ? numero(linha.toneladas, 1) : '-'}</td>
                      <td className="whitespace-nowrap p-3 text-right tabular-nums text-slate-700">{linha.metrosCubicos ? numero(linha.metrosCubicos, 1) : '-'}</td>
                      <td className="p-3 text-right tabular-nums text-slate-700">{outrasEmTexto(linha.outras) || '-'}</td>
                      <td className="whitespace-nowrap p-3 text-right tabular-nums text-slate-900">{linha.valor ? moeda(linha.valor) : '-'}</td>
                      <td className="p-3 text-right font-bold tabular-nums text-slate-900">
                        {total.valor ? (
                          <span className="inline-flex items-center justify-end gap-2">
                            <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-slate-200 lg:block print:hidden" aria-hidden="true">
                              <span className="block h-full rounded-full bg-[#176b4d]" style={{ width: `${Math.max(2, (linha.valor / total.valor) * 100)}%` }} />
                            </span>
                            {Math.round((linha.valor / total.valor) * 100)}%
                          </span>
                        ) : '-'}
                      </td>
                      {relatorio !== 'dia' && <td className="whitespace-nowrap p-3 text-right tabular-nums text-slate-500">{linha.ultima ? formatarData(linha.ultima) : '-'}</td>}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-black text-slate-950">
                  <tr>
                    <th scope="row" className="p-3">Total</th>
                    <td className="p-3 text-right tabular-nums">{total.lancamentos.toLocaleString('pt-BR')}</td>
                    <td className="whitespace-nowrap p-3 text-right tabular-nums">{total.toneladas ? numero(total.toneladas, 1) : '-'}</td>
                    <td className="whitespace-nowrap p-3 text-right tabular-nums">{total.metrosCubicos ? numero(total.metrosCubicos, 1) : '-'}</td>
                    <td className="p-3 text-right tabular-nums">{outrasEmTexto(total.outras) || '-'}</td>
                    <td className="whitespace-nowrap p-3 text-right tabular-nums">{total.valor ? moeda(total.valor) : '-'}</td>
                    <td className="p-3 text-right tabular-nums">{total.valor ? '100%' : '-'}</td>
                    {relatorio !== 'dia' && <td className="p-3" />}
                  </tr>
                </tfoot>
              </table>
            </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
