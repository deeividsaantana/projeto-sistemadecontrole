import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Download, Link2, Lock, PenLine } from 'lucide-react';
import logoCliente from '../../assets/images/logo-renea-dark.svg';
import { CLIENTE, PRODUTO } from '../../config/marca';
import { BOTAO_PERIGO_LEVE, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, FOCO } from '../cadastros/estilos';
import { CARGO_DA_ETAPA, ETAPAS, ITENS, MOTIVOS, PRIORIDADES, SITUACOES, TIPOS, cpfFormatado, etapaPendente, nomeDaEtapa, podeDecidir, validarFormulario } from '../../../api/_shared/contratacao-regras.js';
import {
  criarContratacao,
  decidirContratacao,
  type AssinaturaContratacao,
  type AssinaturaEnviada,
  type Etapa,
  type FormularioContratacao,
  type Leitor,
  type PedidoContratacao,
  type Titulares,
} from '../../services/contratacaoApi';
import { QuadroAssinatura } from './QuadroAssinatura';
import { dataHoraBr } from './formatos';

export const CODIGO_DOCUMENTO = 'SGR-FRH-21-373-01-000-000-0008 · Ver. 7';

const ACOES: Record<string, string> = {
  abriu: 'abriu o pedido e gerou o link',
  criou_e_assinou: 'abriu o pedido e assinou como solicitante',
  assinou_gerente_1: 'assinou como 1º gerente',
  assinou_gerente_2: 'assinou como 2º gerente',
  assinou_rh: 'assinou como RH e concluiu',
  assinou_gerente: 'assinou como gerente de contrato',
  recusou_gerente_1: 'recusou na 1ª assinatura',
  recusou_gerente_2: 'recusou na 2ª assinatura',
  recusou_rh: 'recusou na etapa do RH',
  recusou_gerente: 'recusou na etapa do gerente',
};

const hojeLocal = () => {
  const agora = new Date();
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
const novaChave = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g, '');

/**
 * Imprime ou salva em PDF só a folha, numa janela própria em A4 de pé, com
 * os mesmos estilos do sistema: menu, botões e rolagem não entram no papel.
 */
const imprimir = (titulo: string) => {
  const folha = document.querySelector('.ct-imprimir');
  const janela = window.open('', '_blank');
  if (!folha || !janela) { window.print(); return; }
  const estilos = [...document.querySelectorAll('link[rel="stylesheet"], style')].map(no => no.outerHTML).join('');
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><base href="${window.location.origin}/"><title>${titulo}</title>${estilos}<style>@page{size:A4 portrait;margin:10mm}html,body{background:#fff!important;margin:0}.ct-imprimir{border:0!important}.ct-sem-papel{display:none!important}.ct-imprimir .min-h-11{min-height:26px!important}.ct-imprimir .min-h-9{min-height:22px!important}.ct-imprimir .py-4{padding-top:7px!important;padding-bottom:7px!important}.ct-imprimir .h-24{height:72px!important}</style></head><body>${folha.outerHTML}</body></html>`);
  janela.document.close();
  janela.focus();
  window.setTimeout(() => { janela.print(); }, 400);
};

/** Bloco da folha: faixa com borda em cima, título pequeno em maiúsculas. */
function Bloco({ titulo, children, className = '' }: { titulo?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`border-t border-slate-200 px-4 py-4 first:border-t-0 sm:px-5 ${className}`}>
      {titulo && <h3 className="mb-3 text-xs font-semibold uppercase text-[#5b6870]">{titulo}</h3>}
      {children}
    </div>
  );
}

interface Props {
  leitor: Leitor;
  /** Quem está marcado em cada etapa, para "Aguardando assinatura de: Bruno (Gerente)". */
  titulares: Titulares;
  /** Aberto pelo link individual: o token vai junto na assinatura. */
  token?: string;
  /** Veio do botão "Baixar documento assinado" da lista: abre já imprimindo. */
  baixarAoAbrir?: boolean;
  /** Dentro do ERP: copia o link individual deste pedido. */
  onCopiarLink?: () => void;
  /** Sem pedido: folha em branco para pedir. Com pedido: folha travada. */
  pedido?: PedidoContratacao;
  onVoltar?: () => void;
  onCriado?: (pedido: PedidoContratacao) => void;
  onAtualizado?: () => void;
}

/**
 * A Solicitação de Contratação no mesmo desenho do documento em HTML que a
 * RENEA já usava (SGR-FRH-21-373-01-000-000-0008), com a logo no topo.
 * Em branco: quem pede só preenche e salva; o sistema gera o link. Salvo, os
 * dados ficam travados e passam por 3 assinaturas, nesta ordem: 1º gerente,
 * 2º gerente e RH. Quem não é da vez vê tudo, mas o botão fica bloqueado.
 * O servidor e o banco conferem tudo de novo.
 */
export function FolhaContratacao({ leitor, titulares, token, baixarAoAbrir = false, onCopiarLink, pedido, onVoltar, onCriado, onAtualizado }: Props) {
  const novo = !pedido;
  const [form, setForm] = useState<FormularioContratacao>(() => pedido?.form ?? {
    data: hojeLocal(), candidato: '', cpf: '', inicio: '', prioridade: '', motivo: '', motivoOutro: '', tipo: '', posicao: '', quantidade: '1',
    salario: '', requisitante: leitor.nome, area: '', itens: [], obs: '', aprovados: '', comentarios: '',
  });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [painel, setPainel] = useState<'' | 'assinar' | 'recusar'>('');
  const [errosNoEnvio, setErrosNoEnvio] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [falha, setFalha] = useState('');
  const chave = useRef(novaChave());
  const folhaRef = useRef<HTMLElement>(null);

  const assinaturas = pedido?.signatures ?? [];
  const pendente = (pedido ? etapaPendente(pedido) : null) as Etapa | null;
  const minhaVez = Boolean(pedido && podeDecidir(pedido, assinaturas, leitor));
  const totalAssinado = assinaturas.filter(item => (ETAPAS as string[]).includes(item.stage)).length;
  const concluido = pedido?.status === 'concluido';
  const tituloDoArquivo = pedido ? `${pedido.request_number} - Solicitação de Contratação assinada` : '';

  useEffect(() => {
    if (baixarAoAbrir && concluido) imprimir(tituloDoArquivo);
  }, [baixarAoAbrir, concluido, tituloDoArquivo]);
  const totalErros = useMemo(() => Object.keys(erros).length, [erros]);

  const mudar = <K extends keyof FormularioContratacao>(campo: K, valor: FormularioContratacao[K]) => {
    // Folha assinada fica travada: nada muda, nem na tela.
    if (!novo) return;
    setForm(atual => ({ ...atual, [campo]: valor }));
    setErros(atual => { const { [campo]: _sai, ...resto } = atual; return resto; });
  };
  const alternarItem = (item: string) => {
    const marcado = form.itens.includes(item);
    mudar('itens', item === 'nenhum'
      ? (marcado ? [] : ['nenhum'])
      : (marcado ? form.itens.filter(atual => atual !== item) : [...form.itens.filter(atual => atual !== 'nenhum'), item]));
  };

  const salvar = async () => {
    setFalha('');
    const { erros: encontrados } = validarFormulario(form);
    setErros(encontrados);
    setErrosNoEnvio(true);
    if (Object.keys(encontrados).length) {
      folhaRef.current?.querySelector<HTMLElement>(`[name="${Object.keys(encontrados)[0]}"]`)?.focus();
      return;
    }
    setOcupado(true);
    try {
      const criado = await criarContratacao(form, chave.current);
      chave.current = novaChave();
      onCriado?.(criado);
    } catch (erro) {
      setFalha(erro instanceof Error ? erro.message : 'Não foi possível salvar.');
    } finally {
      setOcupado(false);
    }
  };

  // Folha nova segue o padrão de lançamento: Ctrl+S salva e Esc fecha.
  useEffect(() => {
    if (!novo) return undefined;
    const teclar = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!ocupado) void salvar();
      } else if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        onVoltar?.();
      }
    };
    document.addEventListener('keydown', teclar);
    return () => document.removeEventListener('keydown', teclar);
  });

  const assinar = async (assinatura: AssinaturaEnviada) => {
    if (!pedido) return;
    setOcupado(true);
    setFalha('');
    try {
      await decidirContratacao(pedido, 'aprovar', assinatura, undefined, token);
      setPainel('');
      onAtualizado?.();
    } catch (erro) {
      setFalha(erro instanceof Error ? erro.message : 'Não foi possível concluir.');
    } finally {
      setOcupado(false);
    }
  };

  const recusar = async () => {
    if (!pedido) return;
    setOcupado(true);
    setFalha('');
    try {
      await decidirContratacao(pedido, 'recusar', undefined, motivoRecusa, token);
      setPainel('');
      onAtualizado?.();
    } catch (erro) {
      setFalha(erro instanceof Error ? erro.message : 'Não foi possível concluir.');
    } finally {
      setOcupado(false);
    }
  };

  // Campo editável só na folha em branco; travado, vira texto no mesmo lugar.
  const campo = (_nome: string) => (novo
    ? `${CAMPO} bg-slate-50`
    : 'min-h-11 w-full border-0 bg-transparent px-0 text-base text-slate-900 outline-none sm:text-sm');
  const erroDe = (nome: string) => (erros[nome] ? { 'aria-invalid': true as const, 'aria-describedby': `ct-${nome}-erro` } : {});
  const mensagem = (nome: string) => erros[nome] && <p id={`ct-${nome}-erro`} className="text-xs font-semibold text-rose-700">{erros[nome]}</p>;
  const rotulo = 'text-xs font-semibold text-[#5b6870]';
  const opcao = 'flex min-h-9 items-center gap-2.5 text-base text-slate-900 sm:text-[15px]';
  const marca = `size-[18px] shrink-0 accent-[#176b4d] ${FOCO}`;

  const caixa = (etapa: Etapa, indice: number) => {
    const assinatura: AssinaturaContratacao | undefined = assinaturas.find(item => item.stage === etapa);
    const daVez = !assinatura && pendente === etapa;
    return (
      <div key={etapa} className={`flex min-w-0 flex-col gap-2.5 rounded-2xl border bg-white p-3.5 break-inside-avoid ${daVez ? 'border-amber-300' : 'border-slate-200'}`} data-testid={`assinatura-${etapa}`}>
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase text-slate-900">{indice + 1}. {nomeDaEtapa(etapa, titulares)}</h4>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${assinatura ? 'bg-emerald-50 text-emerald-800' : daVez ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
            {assinatura ? 'Assinado' : daVez ? 'Na vez' : 'Pendente'}
          </span>
        </div>
        <div className="grid h-24 place-items-center overflow-hidden rounded-lg border border-dashed border-slate-400 bg-white">
          {assinatura?.image_data
            ? <img src={assinatura.image_data} alt={`Assinatura de ${assinatura.signer_name}`} className="max-h-full max-w-full" />
            : assinatura
              ? <span className="truncate px-2 font-serif text-2xl italic text-slate-900">{assinatura.signer_name}</span>
              : <span className="px-2 text-center text-xs text-[#5b6870]">{daVez ? 'Aguardando esta assinatura' : 'Aguardando a etapa anterior'}</span>}
        </div>
        {assinatura && (
          <dl className="space-y-0.5 text-xs text-[#5b6870]">
            <dd className="text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">{assinatura.signer_name}</dd>
            <dd>{assinatura.signer_cargo || CARGO_DA_ETAPA[etapa]} · {dataHoraBr(assinatura.signed_at, true)}</dd>
            {assinatura.hash_validacao && <dd className="font-mono [overflow-wrap:anywhere]" >Hash de autenticidade: {assinatura.hash_validacao}</dd>}
          </dl>
        )}
      </div>
    );
  };

  // Barra de assinatura: na vez, o botão; fora da vez, o mesmo botão
  // bloqueado e quem falta. O servidor recusa de novo se alguém forçar.
  const barraDeAssinatura = pedido && pendente && painel === '' && (
    <div className="ct-sem-papel flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 print:hidden" data-testid="barra-assinatura">
      {minhaVez ? (
        <>
          <button type="button" onClick={() => { setFalha(''); setPainel('assinar'); }} className={BOTAO_PRIMARIO} data-testid="assinar-etapa">
            <PenLine className="size-4" aria-hidden="true" /> Assinar e Aprovar
          </button>
          <button type="button" onClick={() => { setFalha(''); setPainel('recusar'); }} className="min-h-11 px-1 text-sm font-semibold text-rose-700 underline underline-offset-4">Recusar</button>
          <span className="text-sm text-[#5b6870]">É a sua vez: {ETAPAS.indexOf(pendente) + 1}ª assinatura.</span>
        </>
      ) : (
        <>
          <button type="button" disabled className={BOTAO_PRIMARIO} aria-describedby="ct-aguardando" data-testid="assinar-bloqueado">
            <Lock className="size-4" aria-hidden="true" /> Assinar e Aprovar
          </button>
          <p id="ct-aguardando" role="status" className="text-sm font-semibold text-amber-800">
            Aguardando assinatura prioritária de: {nomeDaEtapa(pendente, titulares)}
          </p>
        </>
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[860px] space-y-4" data-testid="folha-contratacao" data-lancamento={novo ? '' : undefined}>
      <div className="ct-sem-papel flex flex-wrap items-center gap-2.5 print:hidden">
        {onVoltar && <button type="button" onClick={onVoltar} className={BOTAO_SECUNDARIO}><ArrowLeft className="size-4" aria-hidden="true" /> {novo ? 'Fechar' : 'Voltar'}</button>}
        {!novo && <span className={`inline-flex min-h-11 items-center gap-2.5 rounded-xl border px-3 text-sm font-semibold ${totalAssinado === 3 ? 'border-[#176b4d] text-[#176b4d]' : 'border-slate-200 bg-white text-slate-700'}`}>
          <span className="inline-flex gap-1" aria-hidden="true">
            {[0, 1, 2].map(indice => <i key={indice} className={`h-1.5 w-5 rounded-sm ${indice < totalAssinado ? 'bg-[#176b4d]' : 'bg-slate-200'}`} />)}
          </span>
          {totalAssinado} de 3 assinaturas
        </span>}
        {concluido && (
          <button type="button" onClick={() => imprimir(tituloDoArquivo)} className={BOTAO_SECUNDARIO} data-testid="baixar-contratacao">
            <Download className="size-4" aria-hidden="true" /> Baixar documento assinado
          </button>
        )}
        {onCopiarLink && pedido?.link_token && (
          <button type="button" onClick={onCopiarLink} className={BOTAO_SECUNDARIO} data-testid="copiar-link-folha">
            <Link2 className="size-4" aria-hidden="true" /> Copiar Link
          </button>
        )}
      </div>

      {barraDeAssinatura}

      {!novo && pedido.status === 'recusada' && (
        <p role="status" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <strong>Recusada por {pedido.rejected_stage && (ETAPAS as string[]).includes(pedido.rejected_stage) ? nomeDaEtapa(pedido.rejected_stage, titulares) : 'gerente de contrato'}:</strong> {pedido.rejection_reason}
        </p>
      )}
      {novo && falha && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{falha}</p>}
      {novo && errosNoEnvio && totalErros > 0 && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          Falta preencher {totalErros === 1 ? '1 campo' : `${totalErros} campos`}. Eles estão marcados em vermelho.
        </p>
      )}
      {!novo && !concluido && (
        <p className="ct-sem-papel rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 print:hidden">
          Os dados estão travados: as assinaturas valem para eles. Para mudar algo, recuse e abra um pedido novo.
        </p>
      )}

      <article ref={folhaRef} className="ct-imprimir overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="documento-contratacao">
        <header className="flex flex-wrap items-center justify-between gap-4 px-4 pb-3 pt-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs uppercase text-[#5b6870]">{CODIGO_DOCUMENTO}</p>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Solicitação de Contratação</h2>
          </div>
          <img src={logoCliente} alt={CLIENTE.nome} className="h-9 w-auto" />
        </header>

        <fieldset disabled={novo && ocupado} className="contents">
          <Bloco titulo="Candidato">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex min-w-0 flex-col gap-1 sm:col-span-3">
                <span className={rotulo}>Nome completo</span>
                <input name="candidato" readOnly={!novo} autoComplete="off" value={form.candidato || (novo ? '' : '—')} onChange={e => mudar('candidato', e.target.value)} className={campo('candidato')} {...erroDe('candidato')} />
                {mensagem('candidato')}
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className={rotulo}>CPF</span>
                <input name="cpf" readOnly={!novo} inputMode="numeric" autoComplete="off" placeholder={novo ? '000.000.000-00' : undefined} value={novo ? form.cpf ?? '' : cpfFormatado(form.cpf ?? '') || '—'} onChange={e => mudar('cpf', e.target.value)} className={campo('cpf')} {...erroDe('cpf')} />
                {mensagem('cpf')}
              </label>
              <label className="flex min-w-0 flex-col gap-1 sm:col-span-2">
                <span className={rotulo}>Data prevista de início</span>
                <input name="inicio" type={novo ? 'date' : 'text'} readOnly={!novo} value={novo ? form.inicio ?? '' : (form.inicio || '').split('-').reverse().join('/') || '—'} onChange={e => mudar('inicio', e.target.value)} className={campo('inicio')} {...erroDe('inicio')} />
                {mensagem('inicio')}
              </label>
            </div>
          </Bloco>

          <Bloco titulo="Identificação">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex min-w-0 flex-col gap-1">
                <span className={rotulo}>N°</span>
                <input value={pedido?.request_number ?? ''} placeholder="Gerado ao enviar" readOnly className={campo('numero')} disabled />
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className={rotulo}>Data da solicitação</span>
                <input name="data" type={novo ? 'date' : 'text'} readOnly={!novo} value={novo ? form.data : form.data.split('-').reverse().join('/')} onChange={e => mudar('data', e.target.value)} className={campo('data')} {...erroDe('data')} />
                {mensagem('data')}
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className={rotulo}>Prioridade</span>
                {novo ? (
                  <select name="prioridade" value={form.prioridade} onChange={e => mudar('prioridade', e.target.value)} className={`${campo('prioridade')} cursor-pointer`} {...erroDe('prioridade')}>
                    <option value="">Escolha</option>
                    {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                ) : <input value={form.prioridade} readOnly className={campo('prioridade')} />}
                {mensagem('prioridade')}
              </label>
            </div>
          </Bloco>

          <Bloco>
            <div className="grid gap-5 sm:grid-cols-2">
              <div role="radiogroup" aria-labelledby="ct-motivo-t" {...erroDe('motivo')}>
                <h3 id="ct-motivo-t" className="mb-2 text-xs font-semibold uppercase text-[#5b6870]">Motivo</h3>
                <div className="grid gap-1">
                  {Object.entries(MOTIVOS).map(([valor, nome]) => (
                    <label key={valor} className={opcao}>
                      <input type="radio" name="motivo" value={valor} aria-readonly={!novo} checked={form.motivo === valor} onChange={() => mudar('motivo', valor)} className={marca} />
                      {valor === 'outro' ? 'Outro:' : nome}
                      {valor === 'outro' && (novo || form.motivo === 'outro') && (
                        <input name="motivoOutro" readOnly={!novo} aria-label="Qual é o outro motivo" value={form.motivoOutro} onChange={e => mudar('motivoOutro', e.target.value)} onFocus={() => mudar('motivo', 'outro')} className={`${campo('motivoOutro')} min-w-0 flex-1`} {...erroDe('motivoOutro')} />
                      )}
                    </label>
                  ))}
                </div>
                {mensagem('motivo')}{mensagem('motivoOutro')}
              </div>
              <div role="radiogroup" aria-labelledby="ct-tipo-t" {...erroDe('tipo')}>
                <h3 id="ct-tipo-t" className="mb-2 text-xs font-semibold uppercase text-[#5b6870]">Tipo de contratação</h3>
                <div className="grid gap-1">
                  {Object.entries(TIPOS).map(([valor, nome]) => (
                    <label key={valor} className={opcao}>
                      <input type="radio" name="tipo" value={valor} aria-readonly={!novo} checked={form.tipo === valor} onChange={() => mudar('tipo', valor)} className={marca} /> {nome}
                    </label>
                  ))}
                </div>
                {mensagem('tipo')}
              </div>
            </div>
          </Bloco>

          <Bloco>
            <div className="grid gap-4 sm:grid-cols-2">
              {([['posicao', 'Cargo/Função'], ['quantidade', 'Quantidade'], ['salario', 'Salário/Benefícios'], ['requisitante', 'Requisitante']] as const).map(([nome, titulo]) => (
                <label key={nome} className="flex min-w-0 flex-col gap-1">
                  <span className={rotulo}>{titulo}</span>
                  <input name={nome} readOnly={!novo} inputMode={nome === 'quantidade' ? 'numeric' : undefined} value={String(form[nome])} onChange={e => mudar(nome, e.target.value)} className={campo(nome)} {...erroDe(nome)} />
                  {mensagem(nome)}
                </label>
              ))}
              <label className="flex min-w-0 flex-col gap-1 sm:col-span-2">
                <span className={rotulo}>Frente de obra/Setor</span>
                <input name="area" readOnly={!novo} value={form.area} onChange={e => mudar('area', e.target.value)} className={campo('area')} {...erroDe('area')} />
                {mensagem('area')}
              </label>
            </div>
          </Bloco>

          <Bloco titulo="Itens necessários para a função do colaborador (preenchimento obrigatório)">
            <div className="grid gap-1 sm:grid-cols-3" {...erroDe('itens')}>
              {Object.entries(ITENS).map(([valor, nome]) => (
                <label key={valor} className={`${opcao} ${valor === 'nenhum' ? 'sm:col-span-3' : ''}`}>
                   <input type="checkbox" name="itens" aria-readonly={!novo} checked={form.itens.includes(valor)} onChange={() => alternarItem(valor)} className={marca} />
                  {valor === 'nenhum' ? 'A função não requer nenhum destes itens.' : nome}
                </label>
              ))}
            </div>
            {mensagem('itens')}
          </Bloco>

          <Bloco>
            <div className="grid gap-4 sm:grid-cols-2">
              {([['obs', 'Observações'], ['aprovados', 'Aprovados']] as const).map(([nome, titulo]) => (
                <label key={nome} className="flex min-w-0 flex-col gap-1">
                  <span className={rotulo}>{titulo}</span>
                  {novo
                    ? <textarea name={nome} rows={2} value={form[nome]} onChange={e => mudar(nome, e.target.value)} className={`${campo(nome)} py-2`} />
                    : <span className="min-h-11 whitespace-pre-line py-2 text-sm text-slate-900">{form[nome] || '—'}</span>}
                </label>
              ))}
            </div>
          </Bloco>
        </fieldset>

        <Bloco titulo="Assinaturas">
          <div className="grid gap-3.5 sm:grid-cols-3">{(ETAPAS as Etapa[]).map(caixa)}</div>
          {pendente && painel === '' && falha && <p role="alert" className="ct-sem-papel mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{falha}</p>}
          {painel !== '' && (
            <section className="ct-sem-papel mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-label={painel === 'assinar' ? 'Assinar' : 'Recusar'}>
              {falha && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{falha}</p>}
              {painel === 'assinar' ? (
                <>
                  <h3 className="text-sm font-bold text-slate-900">Assinar · {ETAPAS.indexOf(pendente as Etapa) + 1}. {nomeDaEtapa(pendente as Etapa, titulares)}</h3>
                  <QuadroAssinatura
                    nome={leitor.nome}
                    rotuloConfirmar={pendente === 'rh' ? 'Confirmar e concluir' : 'Confirmar e enviar à próxima assinatura'}
                    ocupado={ocupado}
                    onConfirmar={assinatura => void assinar(assinatura)}
                    onCancelar={() => setPainel('')}
                  />
                </>
              ) : (
                <>
                  <label htmlFor="ct-motivo-recusa" className="text-sm font-bold text-slate-900">Por que está recusando?</label>
                  <textarea id="ct-motivo-recusa" rows={3} value={motivoRecusa} onChange={e => setMotivoRecusa(e.target.value)} className={`${CAMPO} py-2`} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={ocupado || motivoRecusa.trim().length < 3} onClick={() => void recusar()} className={BOTAO_PERIGO_LEVE}>{ocupado ? 'Enviando…' : 'Confirmar recusa'}</button>
                    <button type="button" disabled={ocupado} onClick={() => setPainel('')} className={BOTAO_SECUNDARIO}>Voltar</button>
                  </div>
                </>
              )}
            </section>
          )}
        </Bloco>

        <Bloco titulo="Comentários">
          {novo
            ? <textarea name="comentarios" aria-label="Comentários" rows={3} value={form.comentarios} disabled={ocupado} onChange={e => mudar('comentarios', e.target.value)} className={`${campo('comentarios')} py-2`} />
            : <p className="min-h-11 whitespace-pre-line text-sm text-slate-900">{form.comentarios || '—'}</p>}
        </Bloco>

        {!novo && (
          <Bloco titulo="Histórico">
            <ol className="space-y-1">
              {pedido.history.map((evento, indice) => (
                <li key={indice} className="flex flex-wrap gap-x-2 text-sm text-slate-700">
                  <span className="tabular-nums text-[#5b6870]">{dataHoraBr(evento.created_at)}</span>
                  <span><strong className="text-slate-900">{evento.actor_name}</strong> {ACOES[evento.action] ?? evento.action}{evento.details?.reason ? `: "${evento.details.reason}"` : ''}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-[#5b6870]">
              {SITUACOES[pedido.status] ?? pedido.status} · código de conferência dos dados <strong className="font-mono text-slate-700">{pedido.form_hash.slice(0, 12).toUpperCase()}</strong>. As assinaturas valem para estes dados. Emitido no {PRODUTO.nome} para {CLIENTE.nome}.
            </p>
          </Bloco>
        )}
      </article>

      {novo && (
        <div className="ct-sem-papel flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void salvar()} disabled={ocupado} className={BOTAO_PRIMARIO} data-testid="salvar-contratacao">
            {ocupado ? 'Salvando…' : 'Salvar e gerar link'}
          </button>
          <p className="text-sm text-[#5b6870]">
            Ao salvar, o sistema gera um link só deste pedido. Mande o link para as 3 assinaturas, nesta ordem: {ETAPAS.map((etapa, i) => `${i + 1}. ${nomeDaEtapa(etapa, titulares)}`).join(', ')}.
          </p>
        </div>
      )}
    </div>
  );
}
