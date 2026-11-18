/**
 * Solicitações de RH assináveis: contratação (SGR-FRH-21-373-01-000-000-0008),
 * promoção ("Solicitação de cargo e salário") e desligamento ("Check list de
 * desligamento"). Quem pede escolhe o tipo, preenche e salva; o sistema gera
 * um link só daquele pedido (/contratacao-link/<token>), que passa por 3
 * assinaturas em ordem (17/11/2026): 1ª RH → 2ª gerente (Bruno) → 3ª gerente
 * (Marcelo). Na 3ª o pedido conclui, o link expira e o documento assinado
 * fica para baixar aqui. A tela apenas mostra; quem
 * decide é o servidor (api/contratacao.js) e o banco (sign_erp_hiring_request).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  FilePlus2,
  Download,
  Inbox,
  LayoutDashboard,
  Link2,
  PenLine,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { CartaoIndicador, ConfirmDialog, PageHeader } from '../shared/ui';
import { useAtalhoNovo } from '../shared/hooks/useAtalhoNovo';
import { TelaCheia } from '../shared/ui/TelaCheia';
import { AbasDaTela, idDaAba, type ItemDasAbas } from '../shared/ui/AbasDaTela';
import { TabelaPadrao, type ColunaTabela } from '../shared/ui/TabelaPadrao';
import { BOTAO_PERIGO_LEVE, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CAMPO_SELECT, CARTAO } from './cadastros/estilos';
import { ETAPAS, PAPEIS, SITUACOES, SOLICITACOES, emAberto, etapaPendente, nomeDaEtapa, podeDecidir, resumoDoPedido } from '../../api/_shared/contratacao-regras.js';
import {
  apagarContratacao,
  carregarContratacoes,
  definirPapelContratacao,
  linkDoPedido,
  type DadosContratacao,
  type Etapa,
  type PapelContratacao,
  type PedidoContratacao,
  type PessoaContratacao,
  type SituacaoContratacao,
} from '../services/contratacaoApi';
import { FolhaContratacao } from './contratacao/FolhaContratacao';
import { LinhaDeEtapas, SelosDasEtapas, SeloSituacaoContratacao } from './contratacao/SeloSituacaoContratacao';
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

export default function ContratacaoTab() {
  const escopo = useRef<HTMLElement>(null);
  const [dados, setDados] = useState<DadosContratacao | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [subtela, setSubtela] = useState<Subtela>('painel');
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [baixarAoAbrir, setBaixarAoAbrir] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState<SituacaoContratacao | ''>('');
  const [blocos, setBlocos] = useState<Bloco[]>(lerBlocos);
  const [moldando, setMoldando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [apagando, setApagando] = useState<PedidoContratacao | null>(null);
  const [ocupadoApagar, setOcupadoApagar] = useState(false);
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
  const titulares = useMemo(() => dados?.titulares ?? {}, [dados]);
  const assina = Boolean(me && (ETAPAS as string[]).some(etapa => me.papeis.includes(etapa as PapelContratacao)));
  const fila = useMemo(() => (me ? pedidos.filter(pedido => podeDecidir(pedido, pedido.signatures, me)) : []), [pedidos, me]);
  const aberto = pedidos.find(pedido => pedido.id === abertoId) ?? null;
  const contagem = useMemo(() => {
    const total = { etapa_1: 0, etapa_2: 0, etapa_3: 0, concluido: 0, recusada: 0 } as Record<SituacaoContratacao, number>;
    pedidos.forEach(pedido => { if (pedido.status in total) total[pedido.status] += 1; });
    return total;
  }, [pedidos]);
  const termo = busca.trim().toLowerCase();
  const filtrados = useMemo(() => pedidos.filter(pedido => (!filtroSituacao || pedido.status === filtroSituacao)
    && (!termo || [pedido.request_number, resumoDoPedido(pedido.form).nomeDoTipo, pedido.form.candidato, resumoDoPedido(pedido.form).cargo, pedido.form.area, pedido.requester_name, pedido.form.requisitante]
      .some(valor => String(valor || '').toLowerCase().includes(termo)))), [pedidos, filtroSituacao, termo]);

  const trocar = (proxima: Subtela) => { setAbertoId(null); setBaixarAoAbrir(false); setSubtela(proxima); };
  // N abre uma nova solicitação (padrão de lançamento, 15/11/2026).
  useAtalhoNovo(() => trocar('nova'), Boolean(me) && subtela !== 'nova' && !abertoId);
  const verSituacao = (situacao: SituacaoContratacao | '') => { setFiltroSituacao(situacao); trocar('pedidos'); };

  const copiarLink = async (pedido: PedidoContratacao) => {
    if (!pedido.link_token) return;
    const link = linkDoPedido(pedido.link_token);
    try { await navigator.clipboard.writeText(link); setAviso(`Link do pedido ${pedido.request_number} copiado. Quem abrir entra com o próprio login.`); }
    catch { setAviso(`Copie o link: ${link}`); }
    window.setTimeout(() => setAviso(''), 6000);
  };
  // Apagar de vez: só o dono do sistema vê o botão; servidor e banco conferem de novo.
  const confirmarApagar = async () => {
    if (!apagando) return;
    setOcupadoApagar(true);
    try {
      const { request_number: numero } = await apagarContratacao(apagando.id);
      setApagando(null);
      setAbertoId(null);
      setAviso(`Pedido ${numero} apagado de vez.`);
      window.setTimeout(() => setAviso(''), 6000);
      await carregar(true);
    } catch (falha) {
      setApagando(null);
      setErro(falha instanceof Error ? falha.message : 'Não foi possível apagar.');
    } finally {
      setOcupadoApagar(false);
    }
  };
  const baixar = (pedido: PedidoContratacao) => { setBaixarAoAbrir(true); setAbertoId(pedido.id); };

  const subtelas: ReadonlyArray<ItemDasAbas<Subtela>> = [
    ...(assina ? [{ id: 'fila' as const, rotulo: 'Minha fila', curto: 'Fila', icone: Inbox, contador: fila.length, contadorRotulo: 'para assinar' }] : []),
    { id: 'pedidos', rotulo: 'Pedidos', icone: ClipboardList, contador: pedidos.length, tom: 'neutro' as const },
    // Relatórios no mesmo padrão das outras abas que lançam (15/11/2026). A
    // Nova solicitação abre pelo botão ou pela tecla N, na área inteira.
    { grupo: 'relatorios', rotulo: 'Relatórios', icone: LayoutDashboard, abas: [
      { id: 'painel', rotulo: 'Resumo', icone: LayoutDashboard },
    ] },
    ...(me?.admin ? [{ id: 'papeis' as const, rotulo: 'Quem assina', curto: 'Papéis', icone: ShieldCheck }] : []),
  ];

  const colunas: ColunaTabela<PedidoContratacao>[] = [
    { chave: 'numero', titulo: 'N°', render: p => <strong className="tabular-nums">{p.request_number}</strong>, valorOrdenacao: p => p.request_number, larguraMinima: 150 },
    { chave: 'tipo', titulo: 'Tipo', render: p => resumoDoPedido(p.form).nomeDoTipo, valorOrdenacao: p => resumoDoPedido(p.form).nomeDoTipo, larguraMinima: 120 },
    { chave: 'candidato', titulo: 'Pessoa', render: p => p.form.candidato || '—', valorOrdenacao: p => p.form.candidato || '', larguraMinima: 180 },
    { chave: 'posicao', titulo: 'Cargo', render: p => resumoDoPedido(p.form).cargo, valorOrdenacao: p => resumoDoPedido(p.form).cargo, larguraMinima: 150 },
    { chave: 'area', titulo: 'Frente/Setor', render: p => p.form.area || '—', valorOrdenacao: p => p.form.area || '', larguraMinima: 140 },
    { chave: 'situacao', titulo: 'Assinaturas', render: p => (p.status === 'concluido' || p.status === 'recusada' ? <SeloSituacaoContratacao situacao={p.status} /> : <SelosDasEtapas pedido={p} titulares={titulares} />), valorOrdenacao: p => p.status, valorExportacao: p => SITUACOES[p.status] ?? p.status, larguraMinima: 300 },
    { chave: 'acoes', titulo: 'Ações', valorExportacao: () => '', larguraMinima: 280, render: p => (
      // Copiar Link só com o pedido correndo; Baixar só depois da 3ª assinatura.
      <span className="flex flex-nowrap gap-2" onClick={evento => evento.stopPropagation()} onKeyDown={evento => evento.stopPropagation()}>
        {emAberto(p.status) && p.link_token && (
          <button type="button" onClick={() => void copiarLink(p)} className={BOTAO_SECUNDARIO} data-testid="copiar-link-pedido">
            <Link2 className="size-4" aria-hidden="true" /> Copiar Link
          </button>
        )}
        {p.status === 'concluido' && (
          <button type="button" onClick={() => baixar(p)} className={BOTAO_SECUNDARIO} data-testid="baixar-pedido">
            <Download className="size-4" aria-hidden="true" /> Baixar documento assinado
          </button>
        )}
        {me?.dev && (
          // Só o ícone, para caber ao lado de Copiar Link; o nome vem no aviso de confirmação.
          <button type="button" onClick={() => setApagando(p)} className={`${BOTAO_PERIGO_LEVE} min-w-11 px-3`} data-testid="apagar-pedido" aria-label={`Apagar de vez o pedido ${p.request_number}`} title="Apagar de vez">
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        )}
      </span>
    ) },
  ];

  const quemFalta = pedidos.filter(pedido => etapaPendente(pedido));
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
          <CartaoIndicador rotulo="Com o RH" valor={contagem.etapa_1} detalhe="1ª assinatura" icone={UserCheck} tom={contagem.etapa_1 ? 'laranja' : 'neutro'} onClick={() => verSituacao('etapa_1')} />
          <CartaoIndicador rotulo={`Com ${nomeDaEtapa('gerente_1', titulares)}`} valor={contagem.etapa_2} detalhe="2ª assinatura" icone={Clock} tom={contagem.etapa_2 ? 'laranja' : 'neutro'} onClick={() => verSituacao('etapa_2')} />
          <CartaoIndicador rotulo={`Com ${nomeDaEtapa('gerente_2', titulares)}`} valor={contagem.etapa_3} detalhe="3ª assinatura" icone={PenLine} tom={contagem.etapa_3 ? 'laranja' : 'neutro'} onClick={() => verSituacao('etapa_3')} />
          <CartaoIndicador rotulo="Concluídas" valor={contagem.concluido} detalhe={`com as 3 assinaturas${contagem.recusada ? ` · ${contagem.recusada} recusada${contagem.recusada > 1 ? 's' : ''}` : ''}`} icone={CheckCircle2} tom="verde" onClick={() => verSituacao('concluido')} />
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
                  const etapa = etapaPendente(pedido) as Etapa;
                  const dias = diasDesde(pedido.updated_at);
                  return (
                    <li key={pedido.id}>
                      <button type="button" onClick={() => setAbertoId(pedido.id)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-left text-sm transition hover:border-emerald-400">
                        <span className="min-w-0"><strong className="tabular-nums text-slate-900">{pedido.request_number}</strong> · {resumoDoPedido(pedido.form).nomeDoTipo} · {pedido.form.candidato || '—'} · <span className="text-[#5b6870]">{resumoDoPedido(pedido.form).cargo}</span></span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${dias >= 3 ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'}`}>
                          Falta {nomeDaEtapa(etapa, titulares)} · {dias === 0 ? 'hoje' : `há ${dias} dia${dias > 1 ? 's' : ''}`}
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
                    <span>{evento.actor_name} · {evento.to_status ? SITUACOES[evento.to_status as SituacaoContratacao] ?? evento.to_status : ''}</span>
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
        <span className="mt-1 block text-base font-bold text-slate-900">{resumoDoPedido(pedido.form).nomeDoTipo} · {pedido.form.candidato || '—'}</span>
        <span className="block text-sm text-[#5b6870]">{resumoDoPedido(pedido.form).cargo}{pedido.form.area ? ` · ${pedido.form.area}` : ''} · pedido por {pedido.requester_name} em {dataBr(pedido.form.data)}{pedido.form.prioridade ? ` · prioridade ${pedido.form.prioridade}` : ''}</span>
        <span className="mt-3 block"><LinhaDeEtapas pedido={pedido} titulares={titulares} compacta /></span>
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
    if (aberto) {
      return (
        <FolhaContratacao
          key={`${aberto.id}-${aberto.version}`}
          pedido={aberto}
          leitor={me}
          titulares={titulares}
          baixarAoAbrir={baixarAoAbrir}
          onCopiarLink={() => void copiarLink(aberto)}
          onVoltar={() => { setAbertoId(null); setBaixarAoAbrir(false); }}
          onAtualizado={() => void carregar(true)}
        />
      );
    }
    if (subtela === 'nova') {
      return <FolhaContratacao leitor={me} titulares={titulares} onVoltar={() => trocar('pedidos')} onCriado={pedido => { void carregar(true).then(() => setAbertoId(pedido.id)); setAviso(`Pedido ${pedido.request_number} salvo e link gerado. Use "Copiar Link" e mande para o RH, que faz a 1ª assinatura.`); window.setTimeout(() => setAviso(''), 8000); }} />;
    }
    if (subtela === 'fila') {
      return fila.length === 0
        ? <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-[#5b6870]">Nada esperando a sua assinatura agora.</p>
        : <ul className="grid gap-3 lg:grid-cols-2">{fila.map(cartaoDaFila)}</ul>;
    }
    if (subtela === 'pedidos') {
      return (
        <TabelaPadrao
          titulo="Solicitações de RH"
          linhas={filtrados}
          colunas={colunas}
          idDaLinha={p => p.id}
          nomeDoItem={{ um: 'pedido', varios: 'pedidos' }}
          ordenacaoInicial={{ chave: 'numero', direcao: 'desc' }}
          onAbrirLinha={p => setAbertoId(p.id)}
          vazio={pedidos.length === 0 ? `Nenhuma solicitação ainda. Use "+ Nova Solicitação" para pedir ${Object.values(SOLICITACOES).join(', ').toLowerCase()}.` : 'Nenhum pedido com esses filtros.'}
        />
      );
    }
    if (subtela === 'papeis' && me.admin) return <PapeisContratacao pessoas={dados?.people ?? []} onMudou={() => void carregar(true)} />;
    return painel;
  };

  const comTabela = subtela === 'pedidos' && !aberto;
  const lancando = subtela === 'nova' && !aberto;
  const faixa = comTabela ? (
    <div data-ct-reveal className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-0 flex-1 sm:max-w-sm">
        <span className="sr-only">Buscar pedido</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5b6870]" aria-hidden="true" />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por número, tipo, pessoa, cargo ou frente" className={`${CAMPO} pl-9`} />
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
      idAbaAtiva={lancando ? undefined : idDaAba('contratacao', subtela)}
      idDados="contratacao-dados"
      chaveRolagem={`${subtela}-${abertoId ?? ''}`}
      // Lançando, a folha ocupa a área inteira da aba (padrão do Combustível).
      cabecalho={lancando ? undefined :
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
              <button type="button" onClick={() => trocar('nova')} className={BOTAO_PRIMARIO} data-testid="contratacao-nova">
                <FilePlus2 className="size-4" aria-hidden="true" /> <span className="sm:hidden">Nova</span><span className="hidden sm:inline">Nova Solicitação</span>
              </button>
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
      <ConfirmDialog
        open={Boolean(apagando)}
        title={apagando ? `Apagar de vez o pedido ${apagando.request_number}?` : ''}
        description={apagando ? `${resumoDoPedido(apagando.form).nomeDoTipo} de ${apagando.form.candidato || 'sem nome'}. Some o pedido, as assinaturas e o link, para todo mundo. Não tem como desfazer.` : ''}
        confirmLabel="Apagar de vez"
        cancelLabel="Voltar"
        busy={ocupadoApagar}
        onConfirm={() => void confirmarApagar()}
        onCancel={() => setApagando(null)}
      />
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
        Qualquer pessoa com login pode pedir. Aqui você marca quem faz a <strong>1ª assinatura</strong> (RH), a <strong>2ª assinatura</strong> (gerente, ex.: Bruno) e a <strong>3ª assinatura</strong> (gerente, ex.: Marcelo Suegama), e quem é <strong>auxiliar</strong> (vê tudo, não assina). 2ª e 3ª têm uma pessoa só cada. Vale para contratação, promoção e desligamento. A mesma pessoa nunca assina duas etapas do mesmo pedido.
      </p>
      {falha && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{falha}</p>}
      <TabelaPadrao titulo="Quem assina a contratação" linhas={pessoas} colunas={colunas} idDaLinha={p => p.user_id} nomeDoItem={{ um: 'pessoa', varios: 'pessoas' }} ordenacaoInicial={{ chave: 'nome', direcao: 'asc' }} />
    </div>
  );
}
