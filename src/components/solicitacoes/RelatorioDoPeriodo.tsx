import { useMemo, useState } from 'react';
import { ClipboardList, FileSpreadsheet, Upload, Users } from 'lucide-react';
import { PeriodFilter, buildPeriod, type PeriodValue } from '../../shared/ui';
import { montarPizza } from '../../utils/pizza';
import type { Solicitacao } from '../../utils/solicitacoes';
import { movimentoPorDia, pedidosDoPeriodo, resumoDoPeriodo, textoPct, type Parte } from '../../utils/relatorioSolicitacoes';
import { GraficoMovimento } from './GraficoMovimento';
import GraficoPizza from '../presenca/GraficoPizza';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO } from '../cadastros/estilos';

interface Props {
  solicitacoes: readonly Solicitacao[];
  hoje: string;
  ocupado: boolean;
  onExcel: (lista: readonly Solicitacao[], periodo: PeriodValue & { pessoa: string }, todas: readonly Solicitacao[]) => void;
  onPdf: (lista: readonly Solicitacao[], periodo: PeriodValue & { pessoa: string }) => void;
  /** Sem permissão para importar, o botão não aparece. */
  onImportar?: () => void;
}

/** Partes do resumo viram pizza: as 5 maiores com cor e o resto em "Outros". */
const pizzaDe = (partes: readonly Parte[]) =>
  montarPizza(partes.map(parte => ({ chave: parte.nome, nome: parte.nome, valor: parte.quantidade, lancamentos: parte.quantidade })));
const dinheiro = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const pedidos = (valor: number) => `${valor.toLocaleString('pt-BR')} ${valor === 1 ? 'pedido' : 'pedidos'}`;
const curto = (valor: number) => valor.toLocaleString('pt-BR');
const itens = (valor: number) => `${valor.toLocaleString('pt-BR')} ${valor === 1 ? 'item' : 'itens'}`;

/**
 * Relatório do período (pedido do usuário em 14/11/2026): escolhe "de tal dia
 * até tal dia", vê o resumo em pizza como na Presença e Controle e baixa o
 * Excel ou o PDF só com os pedidos abertos nesse período.
 */
export function RelatorioDoPeriodo({ solicitacoes, hoje, ocupado, onExcel, onPdf, onImportar }: Props) {
  const [periodo, setPeriodo] = useState<PeriodValue>(() => buildPeriod('mes'));
  const [pessoa, setPessoa] = useState('');
  const pessoas = useMemo(
    () => [...new Set(solicitacoes.map(sol => sol.solicitante).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [solicitacoes],
  );
  const daPessoa = useMemo(
    () => (pessoa ? solicitacoes.filter(sol => sol.solicitante === pessoa) : solicitacoes),
    [pessoa, solicitacoes],
  );
  const lista = useMemo(() => pedidosDoPeriodo(daPessoa, periodo), [daPessoa, periodo]);
  const resumo = useMemo(() => resumoDoPeriodo(lista, hoje), [hoje, lista]);
  const movimento = useMemo(() => movimentoPorDia(daPessoa, periodo), [daPessoa, periodo]);
  const pizzaSituacao = useMemo(() => pizzaDe(resumo.porSituacao), [resumo]);
  const pizzaSolicitante = useMemo(() => pizzaDe(resumo.porSolicitante), [resumo]);
  const pizzaConferencia = useMemo(() => pizzaDe(resumo.porConferencia), [resumo]);
  const pizzaFrente = useMemo(() => pizzaDe(resumo.porFrente), [resumo]);

  const cartoes = [
    { rotulo: 'Pedidos', valor: resumo.pedidos.toLocaleString('pt-BR'), nota: `${resumo.itens.toLocaleString('pt-BR')} itens no total`, tom: 'text-slate-900' },
    { rotulo: 'Entregues', valor: textoPct(resumo.pctEntregues), nota: `${resumo.entregues} de ${resumo.pedidos} pedidos`, tom: 'text-[#176b4d]' },
    { rotulo: 'Em atraso', valor: textoPct(resumo.pctEmAtraso), nota: `${resumo.emAtraso} de ${resumo.pedidos} passaram do prazo`, tom: resumo.emAtraso ? 'text-rose-700' : 'text-slate-900' },
    { rotulo: 'Itens recebidos', valor: textoPct(resumo.pctItensRecebidos), nota: 'Itens que chegaram por completo', tom: 'text-slate-900' },
    { rotulo: 'Até chegar', valor: resumo.diasAteEntrega === null ? '—' : `${resumo.diasAteEntrega.toLocaleString('pt-BR')} d`, nota: 'Média entre abrir e chegar', tom: 'text-slate-900' },
    { rotulo: 'Valor aprovado', valor: dinheiro(resumo.valorAprovado), nota: 'Soma dos pedidos aprovados', tom: 'text-slate-900' },
  ];
  const vazio = pessoa ? `Nenhum pedido de ${pessoa} neste período.` : 'Nenhum pedido aberto neste período.';

  return (
    <div data-sol-reveal className="grid content-start gap-4" data-testid="solicitacoes-relatorio-periodo">
      <div className={`${CARTAO} flex flex-wrap items-center justify-between gap-3 p-3`}>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <PeriodFilter value={periodo} onChange={setPeriodo} />
          <label className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-700">
            <Users className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
            <span className="sr-only">Pessoa que pediu</span>
            <select value={pessoa} onChange={evento => setPessoa(evento.target.value)} className={`${CAMPO} w-auto min-w-48`} data-testid="solicitacoes-relatorio-pessoa">
              <option value="">Todas as pessoas</option>
              {pessoas.map(nome => <option key={nome}>{nome}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onExcel(lista, { ...periodo, pessoa }, daPessoa)} disabled={ocupado || !lista.length} className={BOTAO_PRIMARIO} data-testid="solicitacoes-arquivo-excel">
            <FileSpreadsheet className="size-4" aria-hidden="true" /> Baixar Excel
          </button>
          <button type="button" onClick={() => onPdf(lista, { ...periodo, pessoa })} disabled={ocupado || !lista.length} className={BOTAO_SECUNDARIO} data-testid="solicitacoes-arquivo-pdf">
            <ClipboardList className="size-4" aria-hidden="true" /> Baixar PDF
          </button>
          {onImportar && (
            <button type="button" onClick={onImportar} disabled={ocupado} className={BOTAO_SECUNDARIO} data-testid="solicitacoes-arquivo-importar">
              <Upload className="size-4" aria-hidden="true" /> Importar planilha
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cartoes.map(cartao => (
          <article key={cartao.rotulo} className={`${CARTAO} min-w-0 p-4`}>
            <p className="text-xs font-bold text-slate-500">{cartao.rotulo}</p>
            <p className={`mt-2 truncate text-2xl font-black tabular-nums tracking-tight sm:text-3xl ${cartao.tom}`} title={cartao.valor}>{cartao.valor}</p>
            <p className="mt-1 text-xs leading-snug text-slate-500">{cartao.nota}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7"><GraficoMovimento pontos={movimento} /></div>
        <div className="min-w-0 lg:col-span-5 [&>section]:h-full">
          <GraficoPizza id="sol-pizza-situacao" titulo="Situação dos pedidos" subtitulo="Em que etapa cada pedido está" pizza={pizzaSituacao} formatar={pedidos} formatarCurto={curto} vazio={vazio} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 [&>section]:h-full">
        <GraficoPizza id="sol-pizza-solicitante" titulo="Pedidos por solicitante" subtitulo="Quem mais pediu no período" pizza={pizzaSolicitante} formatar={pedidos} formatarCurto={curto} vazio={vazio} />
        <GraficoPizza id="sol-pizza-conferencia" titulo="Conferência dos itens" subtitulo="O que já chegou e o que falta" pizza={pizzaConferencia} formatar={itens} formatarCurto={curto} vazio={vazio} />
        <GraficoPizza id="sol-pizza-frente" titulo="Pedidos por frente" subtitulo="Para onde vai o material" pizza={pizzaFrente} formatar={pedidos} formatarCurto={curto} vazio={vazio} />
      </div>
    </div>
  );
}
