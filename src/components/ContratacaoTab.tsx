/**
 * Solicitação de Contratação assinável (SGR-FRH-21-373-01-000-000-0008).
 * Fluxo rígido: quem pede assina → RH assina → gerente de contrato assina →
 * aprovada. Cada login vê só o que o papel dele permite e só assina a sua
 * etapa; a tela apenas mostra, quem decide é o servidor (api/contratacao.js)
 * e o banco (sign_erp_hiring_request). O mesmo componente abre dentro do ERP
 * e no link /contratacao, que pede login.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  FilePlus2,
  Inbox,
  LayoutDashboard,
  Link2,
  Search,
  Settings2,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { CartaoIndicador, PageHeader } from '../shared/ui';
import { TelaCheia } from '../shared/ui/TelaCheia';
import { AbasDaTela, idDaAba, type ItemDasAbas } from '../shared/ui/AbasDaTela';
import { TabelaPadrao, type ColunaTabela } from '../shared/ui/TabelaPadrao';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CAMPO_SELECT, CARTAO } from './cadastros/estilos';
import { NOME_DA_ETAPA, PAPEIS, SITUACOES, etapaPendente, podeDecidir } from '../../api/_shared/contratacao-regras.js';
import {
  carregarContratacoes,
  definirPapelContratacao,
  type DadosContratacao,
  type Etapa,
  type PapelContratacao,
  type PedidoContratacao,
  type PessoaContratacao,
  type SituacaoContratacao,
} from '../services/contratacaoApi';
import { FormularioNovaContratacao } from './contratacao/FormularioNovaContratacao';
import { DocumentoContratacao } from './contratacao/DocumentoContratacao';
import { LinhaDeEtapas, SeloSituacaoContratacao } from './contratacao/SeloSituacaoContratacao';
import { dataBr, dataHoraBr } from './contratacao/formatos';

type Subtela = 'painel' | 'fila' | 'pedidos' | 'nova' | 'papeis';
type Bloco = 'indicadores' | 'faltaAssinar' | 'etapas' | 'porArea' | 'movimentos';

const BLOCOS: Record<Bloco, string> = {
  indicadores: 'Números do fluxo',
  faltaAssinar: 'Quem falta assinar',
  etapas: 'Pedidos por etapa',
  porArea: 'Pedidos por área ou obra',
  movimentos: 'Últimos movimentos',
};
const CHAVE_BLOCOS = 'renea:contratacao:painel-blocos';
const lerBlocos = (): Bloco[] => {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_BLOCOS) || 'null');
    if (Array.isArray(salvo)) return salvo.filter((bloco): bloco is Bloco => Object.hasOwn(BLOCOS, bloco));
  } catch { /* sem preferência salva */ }
  return Object.keys(BLOCOS) as Bloco[];
};

const PAINEL = `renea-card ${CARTAO} p-4 sm:p-5`;
const diasDesde = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

interface Props {
  /** No link /contratacao a tela vem sem o menu do ERP. */
  noLink?: boolean;
}

export default function ContratacaoTab({ noLink = false }: Props) {
  const escopo = useRef<HTMLElement>(null);
  const [dados, setDados] = useState<DadosContratacao | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [subtela, setSubtela] = useState<Subtela>('painel');
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState<SituacaoContratacao | ''>('');
  const [blocos, setBlocos] = useState<Bloco[]>(lerBlocos);
  const [moldando, setMoldando] = useState(false);
  const [aviso, setAviso] = useState('');
  const primeiraCarga = useRef(true);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const novos = await carregarContratacoes();
      setDados(novos);
      setErro('');
      if (primeiraCarga.current) {
        primeiraCarga.current = false;
        const fila = novos.requests.filter(pedido => podeDecidir(pedido, pedido.signatures, novos.me));
        if (fila.length) setSubtela('fila');
      }
    } catch (falha) {
      if (!silencioso) setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    const intervalo = window.setInterval(() => void carregar(true), 60_000);
    const aoVoltar = () => { if (document.visibilityState === 'visible') void carregar(true); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { window.clearInterval(intervalo); document.removeEventListener('visibilitychange', aoVoltar); };
  }, [carregar]);

  useEffect(() => {
    try { localStorage.setItem(CHAVE_BLOCOS, JSON.stringify(blocos)); } catch { /* memória cheia: fica só nesta visita */ }
  }, [blocos]);

  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(raiz.querySelectorAll('[data-ct-reveal]'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, { scope: escopo, dependencies: [subtela, abertoId, Boolean(dados)] });

  const me = dados?.me;
  const pedidos = useMemo(() => dados?.requests ?? [], [dados]);
  const assina = Boolean(me && (me.papeis.includes('rh') || me.papeis.includes('gerente')));
  const fila = useMemo(() => (me ? pedidos.filter(pedido => podeDecidir(pedido, pedido.signatures, me)) : []), [pedidos, me]);
  const aberto = pedidos.find(pedido => pedido.id === abertoId) ?? null;
  const contagem = useMemo(() => {
    const total = { aguardando_rh: 0, aguardando_gerente: 0, aprovada: 0, recusada: 0 } as Record<SituacaoContratacao, number>;
    pedidos.forEach(pedido => { total[pedido.status] += 1; });
    return total;
  }, [pedidos]);
  const termo = busca.trim().toLowerCase();
  const filtrados = useMemo(() => pedidos.filter(pedido => (!filtroSituacao || pedido.status === filtroSituacao)
    && (!termo || [pedido.request_number, pedido.form.posicao, pedido.form.area, pedido.requester_name, pedido.form.requisitante]
      .some(valor => String(valor || '').toLowerCase().includes(termo)))), [pedidos, filtroSituacao, termo]);

  const trocar = (proxima: Subtela) => { setAbertoId(null); setSubtela(proxima); };
  const verSituacao = (situacao: SituacaoContratacao | '') => { setFiltroSituacao(situacao); trocar('pedidos'); };

  const copiarLink = async () => {
    const link = `${window.location.origin}/contratacao`;
    try { await navigator.clipboard.writeText(link); setAviso('Link copiado. Quem abrir entra com o próprio login.'); }
    catch { setAviso(`Copie o link: ${link}`); }
    window.setTimeout(() => setAviso(''), 5000);
  };

  const subtelas: ReadonlyArray<ItemDasAbas<Subtela>> = [
    { id: 'painel', rotulo: 'Painel', icone: LayoutDashboard },
    ...(assina ? [{ id: 'fila' as const, rotulo: 'Minha fila', curto: 'Fila', icone: Inbox, contador: fila.length, contadorRotulo: 'para assinar' }] : []),
    { id: 'pedidos', rotulo: 'Pedidos', icone: ClipboardList, contador: pedidos.length, tom: 'neutro' as const },
    { id: 'nova', rotulo: 'Nova solicitação', curto: 'Nova', icone: FilePlus2 },
    ...(me?.admin ? [{ id: 'papeis' as const, rotulo: 'Quem assina', curto: 'Papéis', icone: ShieldCheck }] : []),
  ];

  const colunas: ColunaTabela<PedidoContratacao>[] = [
    { chave: 'numero', titulo: 'N°', render: p => <strong className="tabular-nums">{p.request_number}</strong>, valorOrdenacao: p => p.request_number, larguraMinima: 130 },
    { chave: 'data', titulo: 'Data', render: p => dataBr(p.form.data), valorOrdenacao: p => p.form.data, larguraMinima: 100 },
    { chave: 'posicao', titulo: 'Posição', render: p => `${p.form.posicao} (${p.form.quantidade})`, valorOrdenacao: p => p.form.posicao, larguraMinima: 180 },
    { chave: 'area', titulo: 'Área/Obra', render: p => p.form.area, valorOrdenacao: p => p.form.area, larguraMinima: 160 },
    { chave: 'solicitante', titulo: 'Solicitante', render: p => p.requester_name, valorOrdenacao: p => p.requester_name, larguraMinima: 150 },
    { chave: 'prioridade', titulo: 'Prioridade', render: p => p.form.prioridade, valorOrdenacao: p => ['Alta', 'Média', 'Baixa'].indexOf(p.form.prioridade), larguraMinima: 100 },
    { chave: 'situacao', titulo: 'Situação', render: p => <SeloSituacaoContratacao situacao={p.status} />, valorOrdenacao: p => p.status, valorExportacao: p => SITUACOES[p.status], larguraMinima: 150 },
  ];

  const quemFalta = pedidos.filter(pedido => etapaPendente(pedido.status));
  const porArea = Object.entries(pedidos.reduce<Record<string, number>>((acc, pedido) => {
    const area = pedido.form.area || 'Sem área';
    acc[area] = (acc[area] ?? 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const picoArea = Math.max(1, ...porArea.map(([, total]) => total));
  const movimentos = pedidos.flatMap(pedido => pedido.history.map(evento => ({ evento, pedido })))
    .sort((a, b) => b.evento.created_at.localeCompare(a.evento.created_at)).slice(0, 8);

  const ver = (bloco: Bloco) => blocos.includes(bloco);

  const painel = (
    <div className="space-y-5">
      {moldando && (
        <section data-ct-reveal className={PAINEL} aria-label="Escolher o que aparece no painel">
          <p className="text-sm font-black text-slate-900">O que aparece no seu painel</p>
          <p className="mt-1 text-xs text-[#5b6870]">Marque os blocos que você quer ver. Fica salvo neste aparelho.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {(Object.entries(BLOCOS) as [Bloco, string][]).map(([bloco, rotulo]) => (
              <label key={bloco} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50">
                <input type="checkbox" className="size-5 accent-[#176b4d]" checked={ver(bloco)} onChange={() => setBlocos(atual => (atual.includes(bloco) ? atual.filter(item => item !== bloco) : [...atual, bloco]))} />
                {rotulo}
              </label>
            ))}
          </div>
        </section>
      )}
      {ver('indicadores') && (
        <div data-ct-reveal className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <CartaoIndicador rotulo="Aguardando RH" valor={contagem.aguardando_rh} detalhe="esperando a 2ª assinatura" icone={Clock} tom={contagem.aguardando_rh ? 'laranja' : 'neutro'} onClick={() => verSituacao('aguardando_rh')} />
          <CartaoIndicador rotulo="Aguardando gerente" valor={contagem.aguardando_gerente} detalhe="esperando a 3ª assinatura" icone={UserCheck} tom={contagem.aguardando_gerente ? 'laranja' : 'neutro'} onClick={() => verSituacao('aguardando_gerente')} />
          <CartaoIndicador rotulo="Aprovadas" valor={contagem.aprovada} detalhe="com as 3 assinaturas" icone={CheckCircle2} tom="verde" onClick={() => verSituacao('aprovada')} />
          <CartaoIndicador rotulo="Recusadas" valor={contagem.recusada} detalhe="pelo RH ou gerente" icone={XCircle} tom={contagem.recusada ? 'vermelho' : 'neutro'} onClick={() => verSituacao('recusada')} />
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        {ver('faltaAssinar') && (
          <article data-ct-reveal className={PAINEL}>
            <h2 className="text-lg font-black text-slate-900">Quem falta assinar</h2>
            {quemFalta.length === 0 ? (
              <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">Nenhum pedido parado esperando assinatura.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {quemFalta.slice(0, 8).map(pedido => {
                  const etapa = etapaPendente(pedido.status) as Etapa;
                  const dias = diasDesde(pedido.updated_at);
                  return (
                    <li key={pedido.id}>
                      <button type="button" onClick={() => setAbertoId(pedido.id)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-left text-sm transition hover:border-emerald-400">
                        <span className="min-w-0"><strong className="tabular-nums text-slate-900">{pedido.request_number}</strong> · {pedido.form.posicao} · <span className="text-[#5b6870]">{pedido.form.area}</span></span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${dias >= 3 ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'}`}>
                          Falta {NOME_DA_ETAPA[etapa]} · {dias === 0 ? 'hoje' : `há ${dias} dia${dias > 1 ? 's' : ''}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        )}
        <div className="space-y-5">
          {ver('etapas') && (
            <article data-ct-reveal className={PAINEL}>
              <p className="text-xs font-bold text-[#5b6870]">Pedidos por etapa</p>
              <ul className="mt-4 space-y-3">
                {(Object.keys(SITUACOES) as SituacaoContratacao[]).map(situacao => (
                  <li key={situacao}>
                    <button type="button" onClick={() => verSituacao(situacao)} className="group block w-full text-left">
                      <span className="flex items-center justify-between text-xs font-bold"><span className="text-slate-700 group-hover:text-emerald-800">{SITUACOES[situacao]}</span><span className="tabular-nums text-[#5b6870]">{contagem[situacao]}</span></span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${situacao === 'recusada' ? 'bg-rose-600' : 'bg-[#176b4d]'}`} style={{ width: `${(contagem[situacao] / Math.max(1, pedidos.length)) * 100}%` }} /></span>
                    </button>
                  </li>
                ))}
              </ul>
            </article>
          )}
          {ver('porArea') && (
            <article data-ct-reveal className={PAINEL}>
              <p className="text-xs font-bold text-[#5b6870]">Pedidos por área ou obra</p>
              {porArea.length === 0 ? <p className="mt-4 text-sm text-[#5b6870]">Nenhum pedido ainda.</p> : (
                <ul className="mt-4 space-y-3">
                  {porArea.map(([area, total]) => (
                    <li key={area}>
                      <button type="button" onClick={() => { setBusca(area); verSituacao(''); }} className="group block w-full text-left">
                        <span className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-bold text-slate-700 group-hover:text-emerald-800">{area}</span><strong className="tabular-nums text-slate-900">{total}</strong></span>
                        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${(total / picoArea) * 100}%` }} /></span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          )}
        </div>
      </div>
      {ver('movimentos') && (
        <article data-ct-reveal className={PAINEL}>
          <p className="text-xs font-bold text-[#5b6870]">Últimos movimentos</p>
          {movimentos.length === 0 ? <p className="mt-4 text-sm text-[#5b6870]">Nada aconteceu ainda.</p> : (
            <ol className="mt-3 divide-y divide-slate-100">
              {movimentos.map(({ evento, pedido }, indice) => (
                <li key={indice}>
                  <button type="button" onClick={() => setAbertoId(pedido.id)} className="flex w-full flex-wrap gap-x-2 py-2 text-left text-sm text-slate-700 hover:text-emerald-800">
                    <span className="tabular-nums text-[#5b6870]">{dataHoraBr(evento.created_at)}</span>
                    <strong className="text-slate-900">{pedido.request_number}</strong>
                    <span>{evento.actor_name} · {evento.to_status ? SITUACOES[evento.to_status as SituacaoContratacao] : ''}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </article>
      )}
      {blocos.length === 0 && !moldando && (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-[#5b6870]">Seu painel está vazio. Toque em <strong>Personalizar</strong> para escolher o que ver.</p>
      )}
    </div>
  );

  const cartaoDaFila = (pedido: PedidoContratacao) => (
    <li key={pedido.id} data-ct-reveal>
      <button type="button" onClick={() => setAbertoId(pedido.id)} className={`${PAINEL} block w-full text-left transition hover:border-emerald-400`}>
        <span className="flex flex-wrap items-center justify-between gap-2">
          <strong className="tabular-nums text-slate-900">{pedido.request_number}</strong>
          <SeloSituacaoContratacao situacao={pedido.status} />
        </span>
        <span className="mt-1 block text-base font-bold text-slate-900">{pedido.form.posicao} · {pedido.form.quantidade} vaga{Number(pedido.form.quantidade) > 1 ? 's' : ''}</span>
        <span className="block text-sm text-[#5b6870]">{pedido.form.area} · pedido por {pedido.requester_name} em {dataBr(pedido.form.data)} · prioridade {pedido.form.prioridade}</span>
        <span className="mt-3 block"><LinhaDeEtapas pedido={pedido} compacta /></span>
      </button>
    </li>
  );

  const conteudo = () => {
    if (carregando && !dados) return <p className="p-6 text-sm text-[#5b6870]" role="status">Carregando as solicitações…</p>;
    if (erro && !dados) {
      return (
        <div role="alert" className="mx-auto max-w-lg space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
          <p className="font-bold">{erro}</p>
          <button type="button" onClick={() => void carregar()} className={BOTAO_SECUNDARIO}>Tentar de novo</button>
        </div>
      );
    }
    if (!me) return null;
    if (aberto) return <DocumentoContratacao pedido={aberto} leitor={me} onVoltar={() => setAbertoId(null)} onAtualizado={() => void carregar(true)} />;
    if (subtela === 'nova') {
      return <FormularioNovaContratacao nome={me.nome} onCriado={pedido => { void carregar(true).then(() => setAbertoId(pedido.id)); setAviso(`Pedido ${pedido.request_number} enviado ao RH.`); window.setTimeout(() => setAviso(''), 6000); }} />;
    }
    if (subtela === 'fila') {
      return fila.length === 0
        ? <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-[#5b6870]">Nada esperando a sua assinatura agora.</p>
        : <ul className="grid gap-3 lg:grid-cols-2">{fila.map(cartaoDaFila)}</ul>;
    }
    if (subtela === 'pedidos') {
      return (
        <TabelaPadrao
          titulo="Solicitações de contratação"
          linhas={filtrados}
          colunas={colunas}
          idDaLinha={p => p.id}
          nomeDoItem={{ um: 'pedido', varios: 'pedidos' }}
          ordenacaoInicial={{ chave: 'numero', direcao: 'desc' }}
          onAbrirLinha={p => setAbertoId(p.id)}
          vazio={pedidos.length === 0 ? 'Nenhuma solicitação ainda. Use "Nova solicitação" para pedir uma contratação.' : 'Nenhum pedido com esses filtros.'}
        />
      );
    }
    if (subtela === 'papeis' && me.admin) return <PapeisContratacao pessoas={dados?.people ?? []} onMudou={() => void carregar(true)} />;
    return painel;
  };

  const comTabela = subtela === 'pedidos' && !aberto;
  const faixa = comTabela ? (
    <div data-ct-reveal className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-0 flex-1 sm:max-w-sm">
        <span className="sr-only">Buscar pedido</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5b6870]" aria-hidden="true" />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por número, posição, área ou pessoa" className={`${CAMPO} pl-9`} />
      </label>
      <label className="w-full sm:w-56">
        <span className="sr-only">Situação</span>
        <select value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value as SituacaoContratacao | '')} className={CAMPO_SELECT}>
          <option value="">Todas as situações</option>
          {(Object.entries(SITUACOES) as [SituacaoContratacao, string][]).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
        </select>
      </label>
    </div>
  ) : undefined;

  return (
    <TelaCheia
      ref={escopo}
      id="contratacao-tab"
      rotulo="Solicitação de contratação"
      longa={!comTabela}
      idAbaAtiva={idDaAba('contratacao', subtela)}
      idDados="contratacao-dados"
      chaveRolagem={`${subtela}-${abertoId ?? ''}`}
      cabecalho={
        <PageHeader
          eyebrow="Pessoas"
          title="Contratação"
          abas={<AbasDaTela<Subtela> id="contratacao" rotulo="Subtelas da contratação" abas={subtelas} ativa={subtela} onTrocar={trocar} idPainel="contratacao-dados" testId="contratacao-aba" />}
          actions={
            <>
              {subtela === 'painel' && !aberto && (
                <button type="button" onClick={() => setMoldando(atual => !atual)} aria-expanded={moldando} className={moldando ? BOTAO_PRIMARIO : BOTAO_SECUNDARIO}>
                  <Settings2 className="size-4" aria-hidden="true" /> Personalizar
                </button>
              )}
              {!noLink && (
                <button type="button" onClick={() => void copiarLink()} className={BOTAO_SECUNDARIO} title="Copiar o link para quem vai pedir ou assinar">
                  <Link2 className="size-4" aria-hidden="true" /> <span className="hidden sm:inline">Copiar link</span>
                </button>
              )}
              {subtela !== 'nova' && (
                <button type="button" onClick={() => trocar('nova')} className={BOTAO_PRIMARIO} data-testid="contratacao-nova">
                  <FilePlus2 className="size-4" aria-hidden="true" /> <span className="sm:hidden">Nova</span><span className="hidden sm:inline">Nova solicitação</span>
                </button>
              )}
            </>
          }
        />
      }
      faixa={aviso || erro || faixa ? (
        <>
          {aviso && <p role="status" className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900">{aviso}</p>}
          {erro && dados && <p role="alert" className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900">{erro}</p>}
          {faixa}
        </>
      ) : undefined}
    >
      {conteudo()}
    </TelaCheia>
  );
}

function PapeisContratacao({ pessoas, onMudou }: { pessoas: PessoaContratacao[]; onMudou: () => void }) {
  const [ocupado, setOcupado] = useState('');
  const [falha, setFalha] = useState('');
  const alternar = async (pessoa: PessoaContratacao, papel: PapelContratacao) => {
    setOcupado(`${pessoa.user_id}:${papel}`);
    setFalha('');
    try {
      await definirPapelContratacao(pessoa.user_id, papel, !pessoa.roles.includes(papel));
      onMudou();
    } catch (erro) {
      setFalha(erro instanceof Error ? erro.message : 'Não foi possível salvar.');
    } finally {
      setOcupado('');
    }
  };
  const colunas: ColunaTabela<PessoaContratacao>[] = [
    { chave: 'nome', titulo: 'Pessoa', render: p => <span><span className="block font-bold">{p.name}</span><span className="block text-[#5b6870]">{p.email}</span></span>, valorOrdenacao: p => p.name, larguraMinima: 220 },
    ...(Object.entries(PAPEIS) as [PapelContratacao, string][]).map(([papel, rotulo]) => ({
      chave: papel,
      titulo: rotulo,
      larguraMinima: 170,
      valorOrdenacao: (p: PessoaContratacao) => (p.roles.includes(papel) ? 1 : 0),
      valorExportacao: (p: PessoaContratacao) => (p.roles.includes(papel) ? 'Sim' : 'Não'),
      render: (p: PessoaContratacao) => (
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-5 accent-[#176b4d]" checked={p.roles.includes(papel)} disabled={Boolean(ocupado)} onChange={() => void alternar(p, papel)} aria-label={`${rotulo}: ${p.name}`} />
          {p.roles.includes(papel) ? 'Sim' : 'Não'}
        </label>
      ),
    })),
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p data-ct-reveal className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
        Qualquer pessoa com login pode pedir. Aqui você marca quem assina como <strong>RH</strong>, quem assina como <strong>gerente de contrato</strong> e quem é <strong>auxiliar</strong> (vê tudo, não assina). A mesma pessoa nunca assina duas etapas do mesmo pedido.
      </p>
      {falha && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{falha}</p>}
      <TabelaPadrao titulo="Quem assina a contratação" linhas={pessoas} colunas={colunas} idDaLinha={p => p.user_id} nomeDoItem={{ um: 'pessoa', varios: 'pessoas' }} ordenacaoInicial={{ chave: 'nome', direcao: 'asc' }} />
    </div>
  );
}
