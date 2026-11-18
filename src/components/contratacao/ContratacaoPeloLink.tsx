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

const MOSTRAR = 5;

/**
 * Todas as solicitações que a pessoa pode ver, numa lista para bater o olho
 * (18/11/2026): sempre aparece, mesmo com um pedido só, para ficar claro o que
 * existe. Ordem: as que esperam a assinatura dela, as em andamento e as
 * encerradas. A aberta agora fica marcada; as outras abrem pelo próprio link
 * (as encerradas, na lista completa, onde se baixa o PDF assinado).
 */
export function SolicitacoesDoLink({ pedidos, leitor, atual }: { pedidos: PedidoContratacao[]; leitor: Leitor; atual: string }) {
  const [todas, setTodas] = useState(false);
  const minhaVez = (p: PedidoContratacao) => podeDecidir(p, p.signatures, leitor);
  const peso = (p: PedidoContratacao) => (minhaVez(p) ? 0 : emAberto(p.status) ? 1 : 2);
  const lista = [...pedidos].sort((a, b) => peso(a) - peso(b));
  if (lista.length === 0) return null;
  const naVez = lista.filter(minhaVez).length;
  const andamento = lista.filter(p => emAberto(p.status)).length;
  const visiveis = todas ? lista : lista.slice(0, MOSTRAR);
  return (
    <section className={`${CARTAO} mx-auto mb-4 w-full max-w-[860px] p-4 sm:p-5 print:hidden`} aria-labelledby="ct-lista-titulo" data-testid="solicitacoes-do-link">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="ct-lista-titulo" className="text-base font-black text-slate-900">Solicitações ({lista.length})</h2>
        <p className="flex flex-wrap gap-2 text-sm">
          <span className={`rounded-full px-2.5 py-0.5 font-bold ${naVez ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-[#5b6870]'}`}>{naVez} esperando a sua assinatura</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-bold text-[#5b6870]">{andamento} em andamento</span>
        </p>
      </div>
      <ul className="space-y-2">
        {visiveis.map(p => {
          const resumo = resumoDoPedido(p.form);
          const vez = minhaVez(p);
          const aqui = p.id === atual;
          const texto = <span className="min-w-0"><strong className="tabular-nums text-slate-900">{p.request_number}</strong> · {resumo.nomeDoTipo} · {resumo.pessoa}</span>;
          const selo = vez ? <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">É a sua vez</span> : <SeloSituacaoContratacao situacao={p.status} />;
          const linha = 'flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm';
          return (
            <li key={p.id}>
              {aqui ? (
                <div aria-current="page" className={`${linha} border-[#176b4d] bg-emerald-50/50`}>
                  {texto}
                  <span className="flex items-center gap-2">{selo}<span className="rounded-full bg-[#176b4d] px-2.5 py-0.5 text-xs font-bold text-white">Aberta abaixo</span></span>
                </div>
              ) : (
                <a href={p.link_token ? `/contratacao-link/${p.link_token}` : '/contratacao'} className={`${linha} transition hover:border-emerald-400 ${vez ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'} ${FOCO}`}>
                  {texto}
                  <span className="flex items-center gap-2">{selo}<ChevronRight className="size-4 text-[#5b6870]" aria-hidden="true" /></span>
                </a>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-5">
        {lista.length > MOSTRAR && (
          <button type="button" onClick={() => setTodas(aberta => !aberta)} className={`inline-flex min-h-11 items-center text-sm font-bold text-[#176b4d] underline underline-offset-4 ${FOCO}`}>
            {todas ? 'Mostrar menos' : `Mostrar todas (${lista.length})`}
          </button>
        )}
        <a href="/contratacao" className={`inline-flex min-h-11 items-center text-sm font-bold text-[#176b4d] underline underline-offset-4 ${FOCO}`}>Abrir a lista completa</a>
      </div>
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
        <SolicitacoesDoLink pedidos={todos} leitor={dados.me} atual="" />
      </>
    );
  }
  return (
    <>
      <SolicitacoesDoLink pedidos={todos} leitor={dados.me} atual={dados.request.id} />
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
