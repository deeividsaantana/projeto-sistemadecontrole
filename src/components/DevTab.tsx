import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowLeft, History, KeyRound, Lock, RefreshCw, RotateCcw, Search, ShieldCheck, UserPlus } from 'lucide-react';
import { ConfirmDialog, Modal, PageHeader, TabelaPadrao, type ColunaTabela } from '../shared/ui';
import { TelaCheia } from '../shared/ui/TelaCheia';
import { AbasDaTela, idDaAba, type AbaDaTela } from '../shared/ui/AbasDaTela';
import { Avatar } from '../shared/ui/Avatar';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CAMPO_SELECT, CARTAO, FOCO, ROTULO, TOM_SITUACAO } from './cadastros/estilos';
import type { Capacidade } from '../utils/permissoes';
import { PERFIS_DE_ACESSO } from './perfil/perfisDeAcesso';
import { LinkDePrimeiroAcesso } from './perfil/LinkDePrimeiroAcesso';
import type { UserRole } from '../app/navigation/navigation';
import {
  ABAS_AJUSTAVEIS,
  NOME_DA_ACAO,
  acoesDoPerfil,
  acoesEfetivas,
  motivoDaTrava,
  normalizarAcoes,
  perfilDaPessoa,
  regrasDasLinhas,
  resumoDasAcoes,
  type RegrasDeAcesso,
} from '../utils/regrasDeAcesso';
import {
  carregarPainelDev,
  criarLoginDev,
  desfazerMudanca,
  gerarLinkDeSenha,
  mudarAbaDaPessoa,
  mudarContratacaoDaPessoa,
  mudarPerfilDaPessoa,
  mudarSituacaoDaPessoa,
  type DadosPainelDev,
  type MudancaDeAcesso,
  type PapelContratacaoDev,
  type PessoaDev,
} from '../services/devAcessosApi';

/**
 * Aba Dev (16/11/2026): o painel do dono do sistema para ver e mudar o que
 * cada pessoa vê e faz. Só aparece para quem o banco marca como dev, e cada
 * mudança é conferida de novo no servidor e no banco, fica no Histórico com
 * quem mudou e quando, e pode ser desfeita. Aqui também se cria login; a
 * senha a pessoa cria sozinha pelo link de primeiro acesso (18/11/2026).
 */
type Subtela = 'pessoas' | 'quadro' | 'historico';

const NOME_DO_PERFIL: Record<UserRole, string> = Object.fromEntries(PERFIS_DE_ACESSO.map(perfil => [perfil.value, perfil.label])) as Record<UserRole, string>;
const PAPEIS_CONTRATACAO: Array<{ id: PapelContratacaoDev; nome: string; faz: string }> = [
  { id: 'rh', nome: 'RH', faz: 'Faz a 1ª assinatura.' },
  { id: 'gerente_1', nome: 'Gerente (ex.: Bruno)', faz: 'Faz a 2ª assinatura. Uma pessoa só.' },
  { id: 'gerente_2', nome: 'Gerente (ex.: Marcelo)', faz: 'Faz a 3ª assinatura e conclui. Uma pessoa só.' },
  { id: 'auxiliar', nome: 'Auxiliar', faz: 'Só acompanha os pedidos.' },
];
const ACOES: Capacidade[] = ['ver', 'editar', 'aprovar', 'excluir'];
const tomDoResumo = (acoes: readonly Capacidade[]) => (
  !acoes.length ? 'bg-white text-slate-500 ring-1 ring-inset ring-slate-200'
    : acoes.length === 1 ? 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200'
      : TOM_SITUACAO.ok
);
const textoDasAcoes = (acoes: readonly Capacidade[]) => (acoes.length ? acoes.map(acao => NOME_DA_ACAO[acao]).join(', ') : 'Sem acesso');
const NOME_DA_ABA = Object.fromEntries(ABAS_AJUSTAVEIS.map(aba => [aba.id, aba.nome]));

const dataHora = (iso: string | null) => (iso
  ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : 'nunca entrou');

/** Uma linha do histórico em palavras: "Combustível: Padrão → Só ver". */
export const descreverMudanca = (mudanca: Pick<MudancaDeAcesso, 'kind' | 'item' | 'before' | 'after'>) => {
  const valor = (texto: string | null) => {
    if (mudanca.kind === 'aba') return texto === null ? 'Padrão' : textoDasAcoes(normalizarAcoes(texto.split(',').filter(Boolean)));
    if (mudanca.kind === 'perfil') return NOME_DO_PERFIL[texto as UserRole] ?? texto ?? '';
    if (mudanca.kind === 'situacao') return texto === 'ativo' ? 'Ativo' : 'Inativo';
    return texto === 'sim' ? 'Tem' : 'Não tem';
  };
  if (mudanca.kind === 'criacao') return `Login criado como ${NOME_DO_PERFIL[mudanca.after as UserRole] ?? mudanca.after}`;
  if (mudanca.kind === 'senha') return mudanca.item === 'link' ? 'Link para criar senha gerado' : 'Senha temporária nova gerada';
  const oQue = mudanca.kind === 'aba' ? `Aba ${NOME_DA_ABA[mudanca.item] ?? mudanca.item}`
    : mudanca.kind === 'perfil' ? 'Perfil'
      : mudanca.kind === 'situacao' ? 'Situação'
        : `Contratação: ${PAPEIS_CONTRATACAO.find(papel => papel.id === mudanca.item)?.nome ?? mudanca.item}`;
  return `${oQue}: ${valor(mudanca.before)} → ${valor(mudanca.after)}`;
};

type Pendente = { titulo: string; descricao: string; botao: string; executar: () => Promise<unknown> };

export default function DevTab() {
  const escopo = useRef<HTMLElement>(null);
  const [subtela, setSubtela] = useState<Subtela>('pessoas');
  const [dados, setDados] = useState<DadosPainelDev | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState<{ texto: string; desfazer?: number } | null>(null);
  const [busca, setBusca] = useState('');
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  // O link de primeiro acesso vive só neste estado: some ao fechar.
  const [linkMostrado, setLinkMostrado] = useState<{ nome: string; email: string; token: string } | null>(null);
  const [novoLogin, setNovoLogin] = useState<{ nome: string; email: string; perfil: UserRole } | null>(null);
  const [erroNovo, setErroNovo] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setDados(await carregarPainelDev());
      setErro('');
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar os acessos.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(raiz.querySelectorAll('[data-dev-reveal]'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.04, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, { scope: escopo, dependencies: [subtela, selecionadaId, Boolean(dados)] });

  const pessoas = useMemo(() => dados?.people ?? [], [dados]);
  const regrasPorPessoa = useMemo(() => {
    const mapa = new Map<string, RegrasDeAcesso>();
    for (const pessoa of pessoas) mapa.set(pessoa.user_id, regrasDasLinhas(dados?.rules.filter(regra => regra.user_id === pessoa.user_id)));
    return mapa;
  }, [dados, pessoas]);
  const papeisPorPessoa = useMemo(() => {
    const mapa = new Map<string, Set<PapelContratacaoDev>>();
    for (const linha of dados?.hiring ?? []) {
      if (!mapa.has(linha.user_id)) mapa.set(linha.user_id, new Set());
      mapa.get(linha.user_id)!.add(linha.role);
    }
    return mapa;
  }, [dados]);
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return termo ? pessoas.filter(pessoa => `${pessoa.name} ${pessoa.email}`.toLocaleLowerCase('pt-BR').includes(termo)) : pessoas;
  }, [pessoas, busca]);
  const selecionada = pessoas.find(pessoa => pessoa.user_id === selecionadaId) ?? null;
  const mudancasHoje = (dados?.audit ?? []).filter(item => item.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;

  const aplicar = async (acao: () => Promise<{ id: number }>, texto: string) => {
    setOcupado(true);
    setAviso(null);
    try {
      const { id } = await acao();
      await carregar();
      setAviso({ texto, desfazer: id });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível mudar.');
    } finally {
      setOcupado(false);
      setPendente(null);
    }
  };

  const desfazer = (id: number) => aplicar(async () => desfazerMudanca(id), 'Mudança desfeita. Ela também ficou no Histórico.').then(() => setAviso(atual => (atual ? { texto: atual.texto } : atual)));

  const subtelas: AbaDaTela<Subtela>[] = [
    { id: 'pessoas', rotulo: 'Por pessoa', curto: 'Pessoas' },
    { id: 'quadro', rotulo: 'Quadro geral', curto: 'Quadro' },
    { id: 'historico', rotulo: 'Histórico', contador: mudancasHoje, contadorRotulo: 'mudanças hoje', tom: 'neutro' },
  ];

  const trocar = (proxima: Subtela) => { setSubtela(proxima); setErro(''); };

  const criarLogin = async () => {
    if (!novoLogin || ocupado) return;
    if (!novoLogin.nome.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoLogin.email.trim())) {
      setErroNovo('Escreva o nome e um e-mail válido.');
      return;
    }
    setOcupado(true);
    setErroNovo('');
    try {
      const criado = await criarLoginDev(novoLogin.nome.trim(), novoLogin.email.trim(), novoLogin.perfil);
      setLinkMostrado({ nome: novoLogin.nome.trim(), email: novoLogin.email.trim().toLowerCase(), token: criado.token });
      setNovoLogin(null);
      await carregar();
      setSelecionadaId(criado.user_id);
      setSubtela('pessoas');
    } catch (falha) {
      setErroNovo(falha instanceof Error ? falha.message : 'Não foi possível criar o login.');
    } finally {
      setOcupado(false);
    }
  };

  const listaDePessoas = (
    <div className={`${CARTAO} flex min-h-0 flex-col`} data-dev-reveal>
      <label className="relative block border-b border-slate-200 p-3">
        <span className="sr-only">Procurar pessoa</span>
        <Search className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <input value={busca} onChange={evento => setBusca(evento.target.value)} placeholder="Procurar por nome ou e-mail" className={`${CAMPO} pl-9`} />
      </label>
      <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto" aria-label="Pessoas com login">
        {filtradas.map(pessoa => {
          const perfil = perfilDaPessoa(pessoa.membership, pessoa.claimed_role);
          const ajustes = Object.keys(regrasPorPessoa.get(pessoa.user_id) ?? {}).length;
          const ativa = pessoa.user_id === selecionadaId;
          return (
            <li key={pessoa.user_id}>
              <button type="button" onClick={() => setSelecionadaId(pessoa.user_id)} aria-current={ativa ? 'true' : undefined} data-testid="dev-pessoa"
                className={`flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition ${ativa ? 'bg-emerald-50' : 'hover:bg-slate-50'} ${FOCO}`}>
                <Avatar nome={pessoa.name} tamanho="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900">{pessoa.name}</span>
                  <span className="block truncate text-xs text-slate-600">{NOME_DO_PERFIL[perfil]}{ajustes ? ` · ${ajustes} ajuste${ajustes > 1 ? 's' : ''}` : ''}{pessoa.active ? '' : ' · inativo'}</span>
                </span>
                {pessoa.dev && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${TOM_SITUACAO.ok}`}>Dev</span>}
              </button>
            </li>
          );
        })}
        {!filtradas.length && <li className="p-4 text-sm text-slate-600">Ninguém com esse nome.</li>}
      </ul>
    </div>
  );

  const detalhe = (pessoa: PessoaDev) => {
    const perfil = perfilDaPessoa(pessoa.membership, pessoa.claimed_role);
    const regras = regrasPorPessoa.get(pessoa.user_id) ?? {};
    const papeis = papeisPorPessoa.get(pessoa.user_id) ?? new Set<PapelContratacaoDev>();
    const ehVoce = pessoa.user_id === dados?.me;
    const historico = (dados?.audit ?? []).filter(item => item.target_user_id === pessoa.user_id).slice(0, 5);

    const pedirPerfil = (novo: UserRole) => {
      const trava = motivoDaTrava({ tipo: 'perfil', perfil: novo }, ehVoce);
      if (trava) { setErro(trava); return; }
      const info = PERFIS_DE_ACESSO.find(item => item.value === novo);
      setPendente({
        titulo: `Mudar ${pessoa.name} para ${info?.label}?`,
        descricao: `${info?.faz ?? ''} As abas ajustadas à mão continuam como estão.`,
        botao: 'Mudar perfil',
        executar: () => aplicar(() => mudarPerfilDaPessoa(pessoa.user_id, novo), `${pessoa.name} agora é ${info?.label}.`),
      });
    };
    const pedirSituacao = () => {
      const trava = motivoDaTrava({ tipo: 'situacao', ativo: !pessoa.active }, ehVoce);
      if (trava) { setErro(trava); return; }
      setPendente(pessoa.active ? {
        titulo: `Inativar ${pessoa.name}?`,
        descricao: 'A pessoa não consegue mais entrar. O que ela lançou continua. Dá para reativar ou desfazer depois.',
        botao: 'Inativar',
        executar: () => aplicar(() => mudarSituacaoDaPessoa(pessoa.user_id, false), `${pessoa.name} foi inativado.`),
      } : {
        titulo: `Reativar ${pessoa.name}?`,
        descricao: 'A pessoa volta a entrar com o mesmo login e senha.',
        botao: 'Reativar',
        executar: () => aplicar(() => mudarSituacaoDaPessoa(pessoa.user_id, true), `${pessoa.name} foi reativado.`),
      });
    };
    const mudarAba = (aba: string, acoes: Capacidade[] | null) => {
      const trava = motivoDaTrava({ tipo: 'aba', aba, acoes }, ehVoce);
      if (trava) { setErro(trava); return; }
      void aplicar(() => mudarAbaDaPessoa(pessoa.user_id, aba, acoes), `${NOME_DA_ABA[aba]}: ${acoes ? textoDasAcoes(acoes) : 'volta ao padrão do perfil'} para ${pessoa.name}.`);
    };
    /** Marcar Lançar, Aprovar ou Excluir já marca Ver; desmarcar Ver tira tudo. */
    const alternarAcao = (aba: string, acao: Capacidade) => {
      const atuais = acoesEfetivas(perfil, aba, regras);
      const tem = atuais.includes(acao);
      const proximas = acao === 'ver' && tem ? [] : normalizarAcoes(tem ? atuais.filter(item => item !== acao) : [...atuais, acao]);
      mudarAba(aba, proximas);
    };
    const pedirSenha = () => {
      const trava = motivoDaTrava({ tipo: 'senha' }, ehVoce);
      if (trava) { setErro(trava); return; }
      setPendente({
        titulo: `Mandar link para ${pessoa.name} criar senha nova?`,
        descricao: 'A pessoa abre o link e cria a senha dela; você não vê. A senha atual continua valendo até ela criar a nova. Link anterior dela para de funcionar.',
        botao: 'Gerar link',
        executar: async () => {
          setOcupado(true);
          try {
            const { token } = await gerarLinkDeSenha(pessoa.user_id);
            setLinkMostrado({ nome: pessoa.name, email: pessoa.email, token });
            await carregar();
          } catch (falha) {
            setErro(falha instanceof Error ? falha.message : 'Não foi possível gerar o link.');
          } finally {
            setOcupado(false);
            setPendente(null);
          }
        },
      });
    };

    return (
      <div className="grid min-w-0 grid-cols-1 content-start gap-3" data-testid="dev-detalhe">
        <div className={`${CARTAO} flex flex-wrap items-center gap-3 p-4`} data-dev-reveal>
          <button type="button" onClick={() => setSelecionadaId(null)} className={`${BOTAO_SECUNDARIO} lg:hidden`} aria-label="Voltar para a lista">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </button>
          <Avatar nome={pessoa.name} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-black text-slate-900">{pessoa.name}{ehVoce && <span className="ml-2 text-sm font-semibold text-slate-600">(você)</span>}</h2>
            <p className="truncate text-sm text-slate-600">{pessoa.email} · último acesso {dataHora(pessoa.last_sign_in_at)}</p>
          </div>
          {pessoa.dev && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${TOM_SITUACAO.ok}`}>Dev</span>}
        </div>

        <section className={`${CARTAO} grid gap-3 p-4 sm:grid-cols-2`} aria-labelledby="dev-perfil-titulo" data-dev-reveal>
          <h3 id="dev-perfil-titulo" className="text-base font-black text-slate-900 sm:col-span-2">Perfil e situação</h3>
          <label className="grid gap-1">
            <span className="text-sm font-semibold text-slate-700">Perfil {ehVoce && <Lock className="inline size-3.5" aria-label="travado para você" />}</span>
            <select value={perfil} disabled={ocupado} onChange={evento => pedirPerfil(evento.target.value as UserRole)} className={CAMPO_SELECT} data-testid="dev-perfil">
              {PERFIS_DE_ACESSO.map(item => <option key={item.value} value={item.value} disabled={ehVoce && item.value !== 'admin'}>{item.label}</option>)}
            </select>
            <span className="text-xs text-slate-600">{PERFIS_DE_ACESSO.find(item => item.value === perfil)?.faz}</span>
          </label>
          <div className="grid gap-1">
            <span className="text-sm font-semibold text-slate-700">Situação</span>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-sm font-bold ${pessoa.active ? TOM_SITUACAO.ok : TOM_SITUACAO.alerta}`}>{pessoa.active ? 'Ativo' : 'Inativo'}</span>
              <button type="button" onClick={pedirSituacao} disabled={ocupado || (ehVoce && pessoa.active)} className={BOTAO_SECUNDARIO}>
                {ehVoce && pessoa.active && <Lock className="size-4" aria-hidden="true" />}{pessoa.active ? 'Inativar' : 'Reativar'}
              </button>
            </div>
            {ehVoce && <span className="text-xs text-slate-600">Trava: você não tira o próprio acesso por aqui.</span>}
          </div>
          <div className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Senha</span>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={pedirSenha} disabled={ocupado || ehVoce} className={BOTAO_SECUNDARIO} data-testid="dev-nova-senha">
                {ehVoce ? <Lock className="size-4" aria-hidden="true" /> : <KeyRound className="size-4" aria-hidden="true" />} Link para criar senha
              </button>
              <span className="text-xs text-slate-600">{ehVoce ? 'A sua você troca pelo "Recuperar senha" da tela de entrada.' : 'Esqueceu a senha? Mande o link: ela mesma cria outra.'}</span>
            </div>
          </div>
        </section>

        <section className={`${CARTAO} overflow-hidden`} aria-labelledby="dev-abas-titulo" data-dev-reveal>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <h3 id="dev-abas-titulo" className="text-base font-black text-slate-900">Abas e o que pode fazer</h3>
            <p className="text-xs text-slate-600">Sem ajuste, vale o que o perfil {NOME_DO_PERFIL[perfil]} já dá. Tirar Ver tira a aba.</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {ABAS_AJUSTAVEIS.map(aba => {
              const ajustada = Boolean(regras[aba.id]);
              const efetivas = acoesEfetivas(perfil, aba.id, regras);
              return (
                <li key={aba.id} className="grid gap-2 px-4 py-2.5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center" data-testid={`dev-aba-${aba.id}`}>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-bold text-slate-900">{aba.nome}</span>
                    {ajustada ? (
                      <button type="button" disabled={ocupado} onClick={() => mudarAba(aba.id, null)} title={`Volta a: ${textoDasAcoes(acoesDoPerfil(perfil, aba.id))}`}
                        className={`inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-xs font-bold text-[#c2410c] ring-1 ring-inset ring-orange-200 hover:bg-orange-50 ${FOCO}`}>
                        <RotateCcw className="size-3.5" aria-hidden="true" /> Ajustada · voltar ao padrão
                      </button>
                    ) : <span className="text-xs font-semibold text-slate-600">padrão do perfil</span>}
                  </div>
                  <fieldset className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    <legend className="sr-only">O que {pessoa.name} faz em {aba.nome}</legend>
                    {ACOES.map(acao => {
                      const marcada = efetivas.includes(acao);
                      const proximas = acao === 'ver' && marcada ? [] : normalizarAcoes(marcada ? efetivas.filter(item => item !== acao) : [...efetivas, acao]);
                      const bloqueada = Boolean(motivoDaTrava({ tipo: 'aba', aba: aba.id, acoes: proximas }, ehVoce));
                      return (
                        <label key={acao} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-2.5 text-sm font-semibold ${marcada ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700'} ${bloqueada || ocupado ? 'cursor-not-allowed opacity-60' : ''}`}>
                          <input type="checkbox" checked={marcada} disabled={ocupado || bloqueada} onChange={() => alternarAcao(aba.id, acao)} className="size-5 shrink-0 accent-[#176b4d]" />
                          <span className="whitespace-nowrap">{NOME_DA_ACAO[acao]}</span>
                        </label>
                      );
                    })}
                  </fieldset>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={`${CARTAO} grid gap-2 p-4`} aria-labelledby="dev-contratacao-titulo" data-dev-reveal>
          <h3 id="dev-contratacao-titulo" className="text-base font-black text-slate-900">Quem assina na Contratação (contratação, promoção e desligamento)</h3>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {PAPEIS_CONTRATACAO.map(papel => {
              const tem = papeis.has(papel.id);
              return (
                <label key={papel.id} className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-xl border p-3 ${tem ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
                  <input type="checkbox" checked={tem} disabled={ocupado} className="mt-0.5 size-5 accent-[#176b4d]"
                    onChange={() => void aplicar(() => mudarContratacaoDaPessoa(pessoa.user_id, papel.id, !tem), `${pessoa.name} ${tem ? 'deixou de ser' : 'agora é'} ${papel.nome} na Contratação.`)} />
                  <span><span className="block text-sm font-bold text-slate-900">{papel.nome}</span><span className="block text-xs text-slate-600">{papel.faz}</span></span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-slate-600">Compras e Solicitações seguem com quem faz o quê definido na própria aba.</p>
        </section>

        <section className={`${CARTAO} p-4`} aria-labelledby="dev-ultimas-titulo" data-dev-reveal>
          <h3 id="dev-ultimas-titulo" className="mb-2 text-base font-black text-slate-900">Últimas mudanças desta pessoa</h3>
          {historico.length ? <ListaDeMudancas itens={historico} ocupado={ocupado} onDesfazer={desfazer} compacta /> : <p className="text-sm text-slate-600">Nada mudou por aqui ainda.</p>}
        </section>
      </div>
    );
  };

  const colunasDoQuadro: ColunaTabela<PessoaDev>[] = [
    {
      chave: 'pessoa', titulo: 'Pessoa', larguraMinima: 180,
      valorOrdenacao: pessoa => pessoa.name,
      render: pessoa => (
        <span>
          <span className="block whitespace-nowrap font-bold text-slate-900">{pessoa.name}</span>
          <span className="block text-xs font-medium text-slate-600">{NOME_DO_PERFIL[perfilDaPessoa(pessoa.membership, pessoa.claimed_role)]}{pessoa.active ? '' : ' · inativo'}</span>
        </span>
      ),
    },
    ...ABAS_AJUSTAVEIS.map((aba): ColunaTabela<PessoaDev> => ({
      chave: aba.id, titulo: aba.nome, larguraMinima: 96, alinhamento: 'centro',
      render: pessoa => {
        const regras = regrasPorPessoa.get(pessoa.user_id) ?? {};
        const acoes = acoesEfetivas(perfilDaPessoa(pessoa.membership, pessoa.claimed_role), aba.id, regras);
        return (
          <span className={`inline-flex min-w-12 items-center justify-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${tomDoResumo(acoes)}`}
            title={`${textoDasAcoes(acoes)}${regras[aba.id] ? ' (ajustada à mão)' : ' (padrão do perfil)'}`}>
            {resumoDasAcoes(acoes)}
            {regras[aba.id] && <span className="size-2 rounded-full bg-[#f26a2e]" aria-label="ajustada à mão" />}
          </span>
        );
      },
    })),
  ];

  const conteudo = () => {
    if (!dados) {
      return (
        <div className={`${CARTAO} grid place-items-center gap-3 p-8 text-center`}>
          <ShieldCheck className="size-8 text-[#176b4d]" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-700">{carregando ? 'Carregando os acessos…' : erro || 'Não foi possível carregar.'}</p>
          {!carregando && <button type="button" onClick={() => void carregar()} className={BOTAO_SECUNDARIO}>Tentar de novo</button>}
        </div>
      );
    }
    if (subtela === 'historico') {
      return (
        <div className={`${CARTAO} p-4`} data-dev-reveal>
          {dados.audit.length ? <ListaDeMudancas itens={dados.audit} ocupado={ocupado} onDesfazer={desfazer} /> : <p className="text-sm text-slate-600">Nenhuma mudança de acesso ainda.</p>}
        </div>
      );
    }
    if (subtela === 'quadro') {
      return (
        <div className="flex h-full min-h-0 flex-col gap-2" data-dev-reveal data-testid="dev-quadro">
          <TabelaPadrao<PessoaDev>
            titulo="O que cada pessoa vê e edita"
            linhas={pessoas}
            colunas={colunasDoQuadro}
            idDaLinha={pessoa => pessoa.user_id}
            nomeDoItem={{ um: 'pessoa', varios: 'pessoas' }}
            onAbrirLinha={pessoa => { setSelecionadaId(pessoa.user_id); trocar('pessoas'); }}
            densa
          />
          <p className="text-xs text-slate-600">Ponto laranja: aba ajustada à mão para a pessoa. Toque na linha para mudar.</p>
        </div>
      );
    }
    return (
      <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className={`${selecionada ? 'max-lg:hidden' : ''} min-h-0 min-w-0 lg:h-full`}>{listaDePessoas}</div>
        <div className={`${selecionada ? '' : 'max-lg:hidden'} min-h-0 min-w-0 overflow-y-auto`}>
          {selecionada ? detalhe(selecionada) : (
            <div className={`${CARTAO} grid h-full place-items-center p-8 text-center text-sm text-slate-600`} data-dev-reveal>
              Escolha uma pessoa na lista para ver e mudar o que ela vê e faz.
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <TelaCheia
      ref={escopo}
      id="dev-tab"
      rotulo="Dev: acessos e permissões"
      idAbaAtiva={idDaAba('dev', subtela)}
      idDados="dev-dados"
      chaveRolagem={`${subtela}-${selecionadaId ?? ''}`}
      cabecalho={
        <PageHeader
          eyebrow="Administração"
          title="Dev"
          abas={<AbasDaTela<Subtela> id="dev" rotulo="Subtelas do Dev" abas={subtelas} ativa={subtela} onTrocar={trocar} idPainel="dev-dados" testId="dev-aba" />}
          actions={
            <>
              <button type="button" onClick={() => void carregar()} disabled={carregando} className={BOTAO_SECUNDARIO} aria-label="Atualizar">
                <RefreshCw className={`size-4 ${carregando ? 'animate-spin' : ''}`} aria-hidden="true" /> <span className="hidden sm:inline">Atualizar</span>
              </button>
              <button type="button" onClick={() => { setErroNovo(''); setNovoLogin({ nome: '', email: '', perfil: 'operador' }); }} disabled={!dados} className={BOTAO_PRIMARIO} data-testid="dev-novo-login">
                <UserPlus className="size-4" aria-hidden="true" /> Novo login
              </button>
            </>
          }
        />
      }
      faixa={aviso || (erro && dados) ? (
        <>
          {aviso && (
            <p role="status" className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900">
              <span className="flex-1">{aviso.texto}</span>
              {aviso.desfazer && (
                <button type="button" onClick={() => void desfazer(aviso.desfazer!)} disabled={ocupado} className={`inline-flex min-h-9 items-center gap-1 rounded-lg px-2 font-bold text-[#176b4d] underline ${FOCO}`}>
                  <RotateCcw className="size-4" aria-hidden="true" /> Desfazer
                </button>
              )}
            </p>
          )}
          {erro && dados && <p role="alert" className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">{erro}</p>}
        </>
      ) : undefined}
    >
      {conteudo()}
      <ConfirmDialog
        open={Boolean(pendente)}
        title={pendente?.titulo ?? ''}
        description={pendente?.descricao ?? ''}
        confirmLabel={pendente?.botao}
        tone="warning"
        busy={ocupado}
        onConfirm={() => { void pendente?.executar(); }}
        onCancel={() => setPendente(null)}
      />
      <Modal
        open={Boolean(novoLogin)}
        title="Novo login"
        description="Você só cria o login. Na próxima tela sai um link: a pessoa abre e cria a própria senha."
        busy={ocupado}
        onClose={() => setNovoLogin(null)}
        onSubmit={() => void criarLogin()}
        footer={
          <>
            <button type="button" onClick={() => setNovoLogin(null)} disabled={ocupado} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button type="button" onClick={() => void criarLogin()} disabled={ocupado} className={BOTAO_PRIMARIO}>Criar login</button>
          </>
        }
      >
        {novoLogin && (
          <div className="grid gap-3">
            <label className="grid gap-1"><span className={ROTULO}>Nome</span>
              <input value={novoLogin.nome} onChange={evento => setNovoLogin({ ...novoLogin, nome: evento.target.value })} className={CAMPO} autoComplete="off" data-testid="dev-novo-nome" />
            </label>
            <label className="grid gap-1"><span className={ROTULO}>E-mail de entrada</span>
              <input type="email" value={novoLogin.email} onChange={evento => setNovoLogin({ ...novoLogin, email: evento.target.value })} className={CAMPO} autoComplete="off" data-testid="dev-novo-email" />
            </label>
            <label className="grid gap-1"><span className={ROTULO}>Perfil</span>
              <select value={novoLogin.perfil} onChange={evento => setNovoLogin({ ...novoLogin, perfil: evento.target.value as UserRole })} className={CAMPO_SELECT}>
                {PERFIS_DE_ACESSO.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <span className="text-xs text-slate-600">{PERFIS_DE_ACESSO.find(item => item.value === novoLogin.perfil)?.faz} Depois você ajusta aba por aba.</span>
            </label>
            {erroNovo && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{erroNovo}</p>}
          </div>
        )}
      </Modal>
      <Modal
        open={Boolean(linkMostrado)}
        role="alertdialog"
        title="Link para criar senha"
        description="A pessoa abre o link e cria a própria senha. Ninguém mais fica sabendo dela."
        onClose={() => setLinkMostrado(null)}
        footer={<button type="button" onClick={() => setLinkMostrado(null)} className={BOTAO_SECUNDARIO}>Já mandei, fechar</button>}
      >
        {linkMostrado && <LinkDePrimeiroAcesso {...linkMostrado} />}
      </Modal>
    </TelaCheia>
  );
}

function ListaDeMudancas({ itens, ocupado, onDesfazer, compacta = false }: { itens: MudancaDeAcesso[]; ocupado: boolean; onDesfazer: (id: number) => void; compacta?: boolean }) {
  return (
    <ul className="divide-y divide-slate-100" data-testid="dev-historico">
      {itens.map(item => (
        <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
          <History className="size-4 shrink-0 text-[#5b6870]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${item.undone ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
              {compacta ? '' : `${item.target_name} · `}{descreverMudanca(item)}
            </p>
            <p className="text-xs text-slate-600">
              {dataHora(item.created_at)} por {item.actor_name || 'sem nome'}
              {item.undoes_id ? ' · desfez uma mudança anterior' : ''}{item.undone ? ' · desfeita' : ''}
            </p>
          </div>
          {!item.undone && item.kind !== 'criacao' && item.kind !== 'senha' && (
            <button type="button" onClick={() => onDesfazer(item.id)} disabled={ocupado} className={`${BOTAO_SECUNDARIO} min-h-10 px-3`}>
              <RotateCcw className="size-4" aria-hidden="true" /> Desfazer
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
