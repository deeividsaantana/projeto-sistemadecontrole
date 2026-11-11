/**
 * Ficha da solicitação no painel lateral: o que foi pedido, o pedido de
 * compra, a decisão, a entrega e o histórico. Embaixo, só as ações que a
 * pessoa logada pode fazer nesta etapa (acoesDisponiveis).
 */
import { useState, type ReactNode } from 'react';
import { CalendarClock, CheckCircle2, PackageCheck, Send, ShieldCheck, ShieldX, Truck, XCircle } from 'lucide-react';
import { BOTAO_PERIGO_LEVE, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO } from '../cadastros/estilos';
import { Campo } from '../../shared/ui/Lancamento';
import {
  DESTINOS_SUGERIDOS,
  MENSAGEM_PRAZO_NEGADO,
  acoesDisponiveis,
  aplicarAcao,
  formatarDia,
  formatarReais,
  numeroBr,
  saldoDoItem,
  situacaoDe,
  type Acao,
  type Ator,
  type CotacaoFornecedor,
  type Solicitacao,
  type TipoChegada,
} from '../../utils/solicitacoes';
import { SeloSituacao } from './SeloSituacao';

interface DetalheProps {
  solicitacao: Solicitacao;
  todas: readonly Solicitacao[];
  ator: Ator;
  hoje: string;
  onSalvar: (sol: Solicitacao, descricao: string) => void;
}

/** "58.000,50" e "58000.50" viram 58000.5. */
const numero = (texto: string) => Number(texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto);

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-black text-slate-900">{titulo}</h3>
      {children}
    </section>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <dt className="text-slate-600">{rotulo}</dt>
      <dd className="text-right font-bold text-slate-900">{valor}</dd>
    </div>
  );
}

export function DetalheSolicitacao({ solicitacao: sol, todas, ator, hoje, onSalvar }: DetalheProps) {
  const [erro, setErro] = useState('');
  const acoes = acoesDisponiveis(sol, ator);
  const situacao = situacaoDe(sol, hoje);

  // Pedido de compra (Suprimentos)
  const [fornecedor, setFornecedor] = useState(sol.fornecedor ?? '');
  const [valor, setValor] = useState(sol.valorTotal ? String(sol.valorTotal).replace('.', ',') : '');
  const [condicao, setCondicao] = useState(sol.condicaoPagamento ?? '');
  const [inicio, setInicio] = useState(sol.janelaInicio ?? '');
  const [fim, setFim] = useState(sol.janelaFim ?? '');
  const [cotacoes, setCotacoes] = useState<Array<{ fornecedor: string; valor: string }>>(
    sol.cotacoes?.length ? sol.cotacoes.map(item => ({ fornecedor: item.fornecedor, valor: String(item.valor).replace('.', ',') })) : [{ fornecedor: '', valor: '' }],
  );
  const [quantidades, setQuantidades] = useState<Record<number, string>>(
    Object.fromEntries(sol.itens.map(item => [item.itemId, String(item.quantidadePedido ?? item.quantidade).replace('.', ',')])),
  );
  // Decisão (aprovador)
  const [parecer, setParecer] = useState('');
  // Recebimento
  const [tipoChegada, setTipoChegada] = useState<TipoChegada>('Chegou ao Local');
  const [local, setLocal] = useState(sol.localDestino ?? '');
  const [nf, setNf] = useState('');
  const [recebidas, setRecebidas] = useState<Record<number, string>>(
    Object.fromEntries(sol.itens.map(item => [item.itemId, String(saldoDoItem(item)).replace('.', ',')])),
  );
  // Reagendamento e cancelamento
  const [novaData, setNovaData] = useState('');
  const [motivo, setMotivo] = useState('');
  const [cancelar, setCancelar] = useState(false);

  const executar = (acao: Acao, descricao: (s: Solicitacao) => string) => {
    const resultado = aplicarAcao(sol, acao, ator, new Date().toISOString(), todas);
    if ('erro' in resultado) {
      setErro(resultado.erro);
      return;
    }
    setErro('');
    setParecer('');
    setMotivo('');
    setNovaData('');
    setNf('');
    setCancelar(false);
    onSalvar(resultado.solicitacao, descricao(resultado.solicitacao));
  };

  const enviarPedido = () => executar({
    tipo: 'enviarParaAprovacao',
    pedido: {
      fornecedor,
      valorTotal: numero(valor),
      condicaoPagamento: condicao,
      janelaInicio: inicio,
      janelaFim: fim,
      cotacoes: cotacoes.map((item): CotacaoFornecedor => ({ fornecedor: item.fornecedor.trim(), valor: numero(item.valor) })),
      quantidades: Object.fromEntries(Object.entries(quantidades).map(([id, qtd]) => [Number(id), numero(qtd)])),
    },
  }, s => `Pedido ${s.numeroPedido} da ${s.numero} enviado para aprovação.`);

  const prazoPodeMudar = sol.etapa === 'Aprovado' || sol.etapa === 'Em Trânsito';

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <SeloSituacao situacao={situacao} />
        {sol.comprador && <span className="text-sm text-slate-600">Comprador: <strong className="text-slate-900">{sol.comprador}</strong></span>}
      </div>

      <Bloco titulo="Itens">
        <ul className="grid gap-2">
          {sol.itens.map(item => (
            <li key={item.itemId} className={`${CARTAO} p-3 text-sm`}>
              <strong className="block text-slate-900">{item.itemId}. {item.descricao}</strong>
              <span className="block text-slate-600">
                {item.tipo} · {numeroBr(item.quantidade)} {item.unidade} · até {formatarDia(item.prazoDesejado)} · parcial: {item.permiteParcial ? 'sim' : 'não'}
              </span>
              {(item.quantidadePedido !== undefined && item.quantidadePedido !== item.quantidade) && (
                <span className="block text-slate-600">No pedido: {numeroBr(item.quantidadePedido)} {item.unidade}</span>
              )}
              {(item.quantidadeRecebida ?? 0) > 0 && (
                <span className="block font-semibold text-[#176b4d]">Recebido: {numeroBr(item.quantidadeRecebida ?? 0)} {item.unidade} · saldo {numeroBr(saldoDoItem(item))}</span>
              )}
            </li>
          ))}
        </ul>
      </Bloco>

      {(sol.numeroPedido || sol.statusAprovacao !== 'Pendente') && (
        <Bloco titulo="Pedido de compra e aprovação">
          <dl className="divide-y divide-slate-100">
            {sol.numeroPedido && <Linha rotulo="Pedido" valor={sol.numeroPedido} />}
            {sol.fornecedor && <Linha rotulo="Fornecedor" valor={sol.fornecedor} />}
            {sol.valorTotal !== undefined && <Linha rotulo="Valor total" valor={formatarReais(sol.valorTotal)} />}
            {sol.condicaoPagamento && <Linha rotulo="Pagamento" valor={sol.condicaoPagamento} />}
            {sol.janelaFim && <Linha rotulo="Janela de entrega" valor={`${formatarDia(sol.janelaInicio)} a ${formatarDia(sol.janelaFim)}`} />}
            {sol.statusAprovacao !== 'Pendente' && <Linha rotulo="Decisão" valor={`${sol.statusAprovacao}${sol.aprovacaoCondicional ? ' com condição' : ''} · ${sol.aprovador ?? ''}`} />}
            {sol.parecer && <Linha rotulo="Parecer" valor={sol.parecer} />}
          </dl>
          {(sol.cotacoes?.length ?? 0) > 0 && (
            <div className={`${CARTAO} p-3`}>
              <p className="mb-1 text-sm font-bold text-slate-700">Mapa de cotações</p>
              <ul className="grid gap-1 text-sm">
                {[...(sol.cotacoes ?? [])].sort((a, b) => a.valor - b.valor).map((item, indice) => (
                  <li key={`${item.fornecedor}-${indice}`} className="flex justify-between gap-3">
                    <span className="text-slate-700">{indice === 0 ? <strong>{item.fornecedor} (menor)</strong> : item.fornecedor}</span>
                    <span className="font-bold tabular-nums text-slate-900">{formatarReais(item.valor)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Bloco>
      )}

      {(sol.chegadaEm || sol.reagendamentos.length > 0) && (
        <Bloco titulo="Entrega">
          <dl className="divide-y divide-slate-100">
            {sol.localDestino && <Linha rotulo="Local" valor={sol.localDestino} />}
            {sol.chegadaEm && <Linha rotulo="Última chegada" valor={`${formatarDia(sol.chegadaEm)} · ${sol.statusLogistico}`} />}
            {sol.notaFiscal && <Linha rotulo="Nota fiscal" valor={sol.notaFiscal} />}
            {sol.divergencia && <Linha rotulo="Divergência" valor={<span className="text-rose-700">{sol.divergencia}</span>} />}
          </dl>
          {sol.reagendamentos.length > 0 && (
            <div className={`${CARTAO} p-3`}>
              <p className="mb-1 text-sm font-bold text-slate-700">Reagendamentos (registro fixo)</p>
              <ol className="grid gap-1.5 text-sm">
                {sol.reagendamentos.map((item, indice) => (
                  <li key={`${item.data}-${indice}`} className="text-slate-700">
                    <strong className="text-slate-900">{formatarDia(item.anterior)} → {formatarDia(item.nova)}</strong> por {item.usuario} em {formatarDia(item.data)}: {item.motivo}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Bloco>
      )}

      {/* Ações: só o que esta pessoa pode fazer agora. */}
      {acoes.includes('assumir') && (
        <button type="button" onClick={() => executar({ tipo: 'assumir' }, s => `Você assumiu a ${s.numero} para cotação.`)} className={BOTAO_PRIMARIO}>
          <CheckCircle2 className="size-4" aria-hidden="true" /> Assumir para cotação
        </button>
      )}

      {acoes.includes('enviarParaAprovacao') && (
        <Bloco titulo="Montar o pedido de compra">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Fornecedor escolhido (razão social / CNPJ)" para="pc-fornecedor" className="sm:col-span-2">
              <input id="pc-fornecedor" value={fornecedor} onChange={event => setFornecedor(event.target.value)} className={CAMPO} />
            </Campo>
            <Campo rotulo="Valor total (R$)" para="pc-valor">
              <input id="pc-valor" inputMode="decimal" value={valor} onChange={event => setValor(event.target.value)} placeholder="0,00" className={CAMPO} />
            </Campo>
            <Campo rotulo="Condição de pagamento" para="pc-condicao">
              <input id="pc-condicao" value={condicao} onChange={event => setCondicao(event.target.value)} placeholder="28 dias" className={CAMPO} />
            </Campo>
            <Campo rotulo="Entrega a partir de" para="pc-inicio">
              <input id="pc-inicio" type="date" value={inicio} onChange={event => setInicio(event.target.value)} className={CAMPO} />
            </Campo>
            <Campo rotulo="Entrega até" para="pc-fim">
              <input id="pc-fim" type="date" value={fim} onChange={event => setFim(event.target.value)} className={CAMPO} />
            </Campo>
          </div>
          {sol.itens.some(item => item.permiteParcial) && (
            <div className="grid gap-2">
              <p className="text-sm font-bold text-slate-700">Quantidade neste pedido (itens que aceitam parcial)</p>
              {sol.itens.filter(item => item.permiteParcial).map(item => (
                <Campo key={item.itemId} rotulo={`${item.itemId}. ${item.descricao} (pedido: ${numeroBr(item.quantidade)} ${item.unidade})`} para={`pc-qtd-${item.itemId}`}>
                  <input id={`pc-qtd-${item.itemId}`} inputMode="decimal" value={quantidades[item.itemId] ?? ''} onChange={event => setQuantidades(atual => ({ ...atual, [item.itemId]: event.target.value }))} className={CAMPO} />
                </Campo>
              ))}
            </div>
          )}
          <div className="grid gap-2">
            <p className="text-sm font-bold text-slate-700">Cotações para o mapa comparativo</p>
            {cotacoes.map((item, indice) => (
              <div key={indice} className="grid grid-cols-[1fr_8rem] gap-2">
                <input aria-label={`Fornecedor da cotação ${indice + 1}`} value={item.fornecedor} placeholder="Fornecedor" onChange={event => setCotacoes(atual => atual.map((c, i) => (i === indice ? { ...c, fornecedor: event.target.value } : c)))} className={CAMPO} />
                <input aria-label={`Valor da cotação ${indice + 1}`} inputMode="decimal" value={item.valor} placeholder="R$" onChange={event => setCotacoes(atual => atual.map((c, i) => (i === indice ? { ...c, valor: event.target.value } : c)))} className={CAMPO} />
              </div>
            ))}
            <button type="button" onClick={() => setCotacoes(atual => [...atual, { fornecedor: '', valor: '' }])} className={BOTAO_SECUNDARIO}>Mais uma cotação</button>
          </div>
          <button type="button" onClick={enviarPedido} className={BOTAO_PRIMARIO}>
            <Send className="size-4" aria-hidden="true" /> Enviar para aprovação
          </button>
        </Bloco>
      )}

      {acoes.includes('aprovar') && (
        <Bloco titulo="Decisão da gerência">
          <Campo rotulo="Parecer (obrigatório para rejeitar ou aprovar com condição)" para="ap-parecer">
            <textarea id="ap-parecer" rows={3} value={parecer} onChange={event => setParecer(event.target.value)} className={`${CAMPO} py-2`} />
          </Campo>
          <div className="grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => executar({ tipo: 'aprovar', parecer }, s => `Pedido ${s.numeroPedido} aprovado.`)} className={BOTAO_PRIMARIO}>
              <ShieldCheck className="size-4" aria-hidden="true" /> Aprovar
            </button>
            <button type="button" onClick={() => executar({ tipo: 'aprovar', parecer, condicional: true }, s => `Pedido ${s.numeroPedido} aprovado com condição.`)} className={BOTAO_SECUNDARIO}>
              Aprovar com condição
            </button>
            <button type="button" onClick={() => executar({ tipo: 'rejeitar', parecer }, s => `Pedido ${s.numeroPedido} rejeitado e devolvido a Suprimentos.`)} className={BOTAO_PERIGO_LEVE}>
              <ShieldX className="size-4" aria-hidden="true" /> Rejeitar
            </button>
          </div>
        </Bloco>
      )}

      {acoes.includes('despachar') && (
        <button type="button" onClick={() => executar({ tipo: 'despachar' }, s => `${s.numero} saiu para entrega.`)} className={BOTAO_SECUNDARIO}>
          <Truck className="size-4" aria-hidden="true" /> Marcar como em trânsito
        </button>
      )}

      {acoes.includes('receber') && (
        <Bloco titulo="Confirmar chegada">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Onde chegou">
            {(['Chegou ao Local', 'Chegou ao Local de Descarte'] as const).map(opcao => (
              <button key={opcao} type="button" aria-pressed={tipoChegada === opcao} onClick={() => setTipoChegada(opcao)}
                className={`${BOTAO_SECUNDARIO} ${tipoChegada === opcao ? 'border-[#176b4d] bg-emerald-50 text-[#176b4d]' : ''}`}>
                {opcao === 'Chegou ao Local' ? 'No local (canteiro, obra)' : 'No descarte (bota-fora)'}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Local" para="rc-local">
              <input id="rc-local" list="rc-locais" value={local} onChange={event => setLocal(event.target.value)} className={CAMPO} />
              <datalist id="rc-locais">{DESTINOS_SUGERIDOS.map(item => <option key={item} value={item} />)}</datalist>
            </Campo>
            <Campo rotulo="Nota fiscal" para="rc-nf">
              <input id="rc-nf" value={nf} onChange={event => setNf(event.target.value)} className={CAMPO} />
            </Campo>
            {sol.itens.map(item => (
              <Campo key={item.itemId} rotulo={`Chegou agora: ${item.itemId}. ${item.descricao} (${item.unidade})`} para={`rc-qtd-${item.itemId}`} className="sm:col-span-2">
                <input id={`rc-qtd-${item.itemId}`} inputMode="decimal" value={recebidas[item.itemId] ?? ''} onChange={event => setRecebidas(atual => ({ ...atual, [item.itemId]: event.target.value }))} className={CAMPO} />
              </Campo>
            ))}
          </div>
          <button type="button" onClick={() => executar({
            tipo: 'receber',
            recebimento: { tipo: tipoChegada, local, notaFiscal: nf, quantidades: Object.fromEntries(Object.entries(recebidas).map(([id, qtd]) => [Number(id), numero(qtd)])) },
          }, s => (s.etapa === 'Entregue' ? `${s.numero} entregue.` : `${s.numero}: entrega parcial registrada, saldo segue aberto.`))} className={BOTAO_PRIMARIO}>
            <PackageCheck className="size-4" aria-hidden="true" /> Confirmar chegada
          </button>
        </Bloco>
      )}

      {prazoPodeMudar && (
        acoes.includes('reagendar') ? (
          <Bloco titulo="Reagendar entrega">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Nova data prometida" para="rg-data">
                <input id="rg-data" type="date" value={novaData} onChange={event => setNovaData(event.target.value)} className={CAMPO} />
              </Campo>
              <Campo rotulo="Motivo do atraso" para="rg-motivo" className="sm:col-span-2">
                <textarea id="rg-motivo" rows={2} value={motivo} onChange={event => setMotivo(event.target.value)} className={`${CAMPO} py-2`} />
              </Campo>
            </div>
            <button type="button" onClick={() => executar({ tipo: 'reagendar', novaData, motivo }, s => `Entrega da ${s.numero} reagendada para ${formatarDia(s.janelaFim)}.`)} className={BOTAO_SECUNDARIO}>
              <CalendarClock className="size-4" aria-hidden="true" /> Gravar nova data
            </button>
          </Bloco>
        ) : (
          <p className="flex items-start gap-2 rounded-xl bg-[#f7f8f6] p-3 text-sm text-slate-600">
            <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {MENSAGEM_PRAZO_NEGADO}
          </p>
        )
      )}

      {acoes.includes('cancelar') && (
        cancelar ? (
          <Bloco titulo="Cancelar solicitação">
            <Campo rotulo="Motivo" para="cc-motivo">
              <textarea id="cc-motivo" rows={2} value={motivo} onChange={event => setMotivo(event.target.value)} className={`${CAMPO} py-2`} />
            </Campo>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => executar({ tipo: 'cancelar', motivo }, s => `${s.numero} cancelada.`)} className={BOTAO_PERIGO_LEVE}>Confirmar cancelamento</button>
              <button type="button" onClick={() => setCancelar(false)} className={BOTAO_SECUNDARIO}>Voltar</button>
            </div>
          </Bloco>
        ) : (
          <button type="button" onClick={() => setCancelar(true)} className={BOTAO_PERIGO_LEVE}>
            <XCircle className="size-4" aria-hidden="true" /> Cancelar solicitação
          </button>
        )
      )}

      {erro && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{erro}</p>}

      <Bloco titulo="Histórico">
        <ol className="grid gap-2 border-l-2 border-slate-200 pl-3 text-sm">
          {[...sol.eventos].reverse().map((evento, indice) => (
            <li key={`${evento.data}-${indice}`}>
              <strong className="text-slate-900">{evento.acao}</strong>
              <span className="block text-slate-600">{evento.usuario} · {new Date(evento.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              {evento.detalhe && <span className="block text-slate-700">{evento.detalhe}</span>}
            </li>
          ))}
        </ol>
      </Bloco>
    </div>
  );
}
