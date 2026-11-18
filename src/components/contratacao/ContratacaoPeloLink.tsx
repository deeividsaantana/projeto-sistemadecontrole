import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { emAberto, podeDecidir, resumoDoPedido } from '../../../api/_shared/contratacao-regras.js';
import { BOTAO_SECUNDARIO, CARTAO, FOCO } from '../cadastros/estilos';
import { carregarContratacoes, carregarPeloLink, type DadosDoLink, type Leitor, type PedidoContratacao } from '../../services/contratacaoApi';
import { FolhaContratacao } from './FolhaContratacao';
import { SeloSituacaoContratacao } from './SeloSituacaoContratacao';

/** Cartão no centro da tela, no mesmo jeito da entrada do link de presença. */
function Aviso({ titulo, texto, tom = 'neutro', children }: { titulo: string; texto: string; tom?: 'neutro' | 'erro'; children?: ReactNode }) {
  const Icone = tom === 'erro' ? AlertCircle : CheckCircle2;
  return (
    <section className="flex min-h-[70dvh] items-center justify-center" aria-labelledby="ct-link-aviso">
      <div className={`${CARTAO} w-full max-w-md p-6 text-center shadow-sm sm:p-8`} data-testid="contratacao-link-aviso">
        <Icone className={`mx-auto mb-4 size-10 ${tom === 'erro' ? 'text-rose-700' : 'text-[#176b4d]'}`} aria-hidden="true" />
        <h1 id="ct-link-aviso" className="mb-2 text-2xl font-black text-slate-950">{titulo}</h1>
        <p className="text-sm text-slate-600">{texto}</p>
        {children}
      </div>
    </section>
  );
}

const MOSTRAR = 4;

/**
 * Os outros pedidos que a pessoa pode ver, numa lista curta para bater o olho
 * (18/11/2026): só os que ainda correm, primeiro os que esperam a assinatura
 * dela. Cada um abre pelo seu próprio link; os encerrados ficam em "Ver todos".
 */
export function OutrosPedidos({ pedidos, leitor, atual }: { pedidos: PedidoContratacao[]; leitor: Leitor; atual: string }) {
  const minhaVez = (p: PedidoContratacao) => podeDecidir(p, p.signatures, leitor);
  const outros = pedidos.filter(p => p.id !== atual && emAberto(p.status)).sort((a, b) => Number(minhaVez(b)) - Number(minhaVez(a)));
  if (outros.length === 0) return null;
  const naVez = outros.filter(minhaVez).length;
  return (
    <section className={`${CARTAO} mx-auto mb-4 w-full max-w-[860px] p-4 sm:p-5 print:hidden`} aria-labelledby="ct-outros-titulo" data-testid="outros-pedidos">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ct-outros-titulo" className="text-base font-black text-slate-900">Outros pedidos em andamento ({outros.length})</h2>
        {naVez > 0
          ? <p className="rounded-full bg-amber-50 px-2.5 py-0.5 text-sm font-bold text-amber-900">{naVez === 1 ? '1 esperando a sua assinatura' : `${naVez} esperando a sua assinatura`}</p>
          : <p className="text-sm text-[#5b6870]">Nenhum outro esperando a sua assinatura.</p>}
      </div>
      <ul className="space-y-2">
        {outros.slice(0, MOSTRAR).map(p => {
          const resumo = resumoDoPedido(p.form);
          const vez = minhaVez(p);
          return (
            <li key={p.id}>
              <a
                href={p.link_token ? `/contratacao-link/${p.link_token}` : '/contratacao'}
                className={`flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm transition hover:border-emerald-400 ${vez ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'} ${FOCO}`}
              >
                <span className="min-w-0"><strong className="tabular-nums text-slate-900">{p.request_number}</strong> · {resumo.nomeDoTipo} · {resumo.pessoa}</span>
                <span className="flex items-center gap-2">
                  {vez ? <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">É a sua vez</span> : <SeloSituacaoContratacao situacao={p.status} />}
                  <ChevronRight className="size-4 text-[#5b6870]" aria-hidden="true" />
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <a href="/contratacao" className={`mt-3 inline-flex min-h-11 items-center text-sm font-bold text-[#176b4d] underline underline-offset-4 ${FOCO}`}>Ver todos os pedidos, inclusive os concluídos</a>
    </section>
  );
}

/**
 * Link individual de um pedido (/contratacao-link/<token>). O login já foi
 * pedido antes; aqui o servidor diz se o link vale. Encerrado, aparece só o
 * aviso de expirado, sem nenhum dado do candidato.
 */
export function ContratacaoPeloLink({ token }: { token: string }) {
  const [dados, setDados] = useState<DadosDoLink | null>(null);
  const [erro, setErro] = useState('');
  const [todos, setTodos] = useState<PedidoContratacao[]>([]);

  const carregar = useCallback(async () => {
    try {
      setDados(await carregarPeloLink(token));
      setErro('');
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível abrir o link.');
    }
  }, [token]);

  useEffect(() => { void carregar(); }, [carregar]);
  // A lista dos outros é só um atalho: se falhar, o pedido do link segue normal.
  useEffect(() => {
    if (dados) carregarContratacoes().then(resposta => setTodos(resposta.requests)).catch(() => setTodos([]));
  }, [dados]);

  if (erro) {
    return (
      <Aviso titulo="Não deu para abrir" texto={erro} tom="erro">
        <button type="button" onClick={() => { setErro(''); void carregar(); }} className={`${BOTAO_SECUNDARIO} mt-6 w-full`}>Tentar de novo</button>
      </Aviso>
    );
  }
  if (!dados) return <p className="p-6 text-sm text-[#5b6870]" role="status">Abrindo a solicitação…</p>;
  if (!('request' in dados)) {
    return (
      <>
        {dados.expirado === 'recusada'
          ? <Aviso titulo="Link encerrado" texto="Este link foi encerrado. A solicitação foi recusada." tom="erro" />
          : <Aviso titulo="Link expirado" texto="Este link expirou. A solicitação já foi concluída e assinada por todas as partes." />}
        <OutrosPedidos pedidos={todos} leitor={dados.me} atual="" />
      </>
    );
  }
  return (
    <>
      <OutrosPedidos pedidos={todos} leitor={dados.me} atual={dados.request.id} />
      <FolhaContratacao
        key={`${dados.request.id}-${dados.request.version}`}
        pedido={dados.request}
        leitor={dados.me}
        token={token}
        onAtualizado={() => void carregar()}
      />
    </>
  );
}
