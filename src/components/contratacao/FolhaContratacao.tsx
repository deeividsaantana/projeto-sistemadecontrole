import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import logoCliente from '../../assets/images/logo-renea-dark.svg';
import { CLIENTE, PRODUTO } from '../../config/marca';
import { BOTAO_PERIGO_LEVE, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, FOCO } from '../cadastros/estilos';
import { ETAPAS, ITENS, MOTIVOS, PRIORIDADES, SITUACOES, TIPOS, etapaPendente, podeDecidir, validarFormulario } from '../../../api/_shared/contratacao-regras.js';
import {
  criarContratacao,
  decidirContratacao,
  type AssinaturaContratacao,
  type AssinaturaEnviada,
  type Etapa,
  type FormularioContratacao,
  type Leitor,
  type PedidoContratacao,
} from '../../services/contratacaoApi';
import { QuadroAssinatura } from './QuadroAssinatura';
import { dataHoraBr } from './formatos';

export const CODIGO_DOCUMENTO = 'SGR-FRH-21-373-01-000-000-0008 · Ver. 7';

/** Título de cada caixa de assinatura, como no documento em papel. */
const TITULO_ASSINATURA: Record<Etapa, string> = {
  solicitante: 'Assinatura do solicitante',
  rh: 'Assinatura recursos humanos',
  gerente: 'Gerente de contrato',
};

const ACOES: Record<string, string> = {
  criou_e_assinou: 'abriu o pedido e assinou como solicitante',
  assinou_rh: 'assinou como RH',
  assinou_gerente: 'assinou como gerente de contrato e aprovou',
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
  /** Sem pedido: folha em branco para pedir. Com pedido: folha travada. */
  pedido?: PedidoContratacao;
  onVoltar?: () => void;
  onCriado?: (pedido: PedidoContratacao) => void;
  onAtualizado?: () => void;
}

/**
 * A Solicitação de Contratação no mesmo desenho do documento em HTML que a
 * RENEA já usava (SGR-FRH-21-373-01-000-000-0008), com a logo no topo.
 * Em branco: quem pede preenche e assina na própria caixa. Depois da primeira
 * assinatura os dados ficam travados; RH e gerente só veem o botão de
 * assinar na caixa deles, na vez deles. O servidor confere tudo de novo.
 */
export function FolhaContratacao({ leitor, pedido, onVoltar, onCriado, onAtualizado }: Props) {
  const novo = !pedido;
  const [form, setForm] = useState<FormularioContratacao>(() => pedido?.form ?? {
    data: hojeLocal(), prioridade: '', motivo: '', motivoOutro: '', tipo: '', posicao: '', quantidade: '1',
    salario: '', requisitante: leitor.nome, area: '', itens: [], obs: '', aprovados: '', comentarios: '',
  });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [painel, setPainel] = useState<'' | 'assinar' | 'recusar'>('');
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [falha, setFalha] = useState('');
  const chave = useRef(novaChave());
  const folhaRef = useRef<HTMLElement>(null);

  const assinaturas = pedido?.signatures ?? [];
  const pendente: Etapa | null = novo ? 'solicitante' : (etapaPendente(pedido.status) as Etapa | null);
  const minhaVez = novo || podeDecidir(pedido, assinaturas, leitor);
  const totalAssinado = assinaturas.length;
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

  const abrirAssinatura = () => {
    setFalha('');
    if (novo) {
      const { erros: encontrados } = validarFormulario(form);
      setErros(encontrados);
      if (Object.keys(encontrados).length) {
        folhaRef.current?.querySelector<HTMLElement>(`[name="${Object.keys(encontrados)[0]}"]`)?.focus();
        return;
      }
    }
    setPainel('assinar');
  };

  const assinar = async (assinatura: AssinaturaEnviada) => {
    setOcupado(true);
    setFalha('');
    try {
      if (novo) {
        const criado = await criarContratacao(form, assinatura, chave.current);
        chave.current = novaChave();
        onCriado?.(criado);
      } else {
        await decidirContratacao(pedido, 'aprovar', assinatura);
        setPainel('');
        onAtualizado?.();
      }
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
      await decidirContratacao(pedido, 'recusar', undefined, motivoRecusa);
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

  const caixa = (etapa: Etapa) => {
    const assinatura: AssinaturaContratacao | undefined = assinaturas.find(item => item.stage === etapa);
    const vez = !assinatura && pendente === etapa && minhaVez && painel === '';
    return (
      <div key={etapa} className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 break-inside-avoid" data-testid={`assinatura-${etapa}`}>
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase text-slate-900">{TITULO_ASSINATURA[etapa]}</h4>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${assinatura ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
            {assinatura ? 'Assinado' : 'Pendente'}
          </span>
        </div>
        <div className="grid h-24 place-items-center overflow-hidden rounded-lg border border-dashed border-slate-400 bg-white">
          {assinatura?.image_data
            ? <img src={assinatura.image_data} alt={`Assinatura de ${assinatura.signer_name}`} className="max-h-full max-w-full" />
            : assinatura && !assinatura.oculta
              ? <span className="truncate px-2 font-serif text-2xl italic text-slate-900">{assinatura.signer_name}</span>
              : <span className="px-2 text-center text-xs text-[#5b6870]">{assinatura?.oculta ? 'Aparece quando o pedido for aprovado' : 'Aguardando assinatura'}</span>}
        </div>
        {assinatura ? (
          <div>
            <p className="font-semibold text-slate-900 [overflow-wrap:anywhere]">{assinatura.signer_name}</p>
            <p className="text-xs text-[#5b6870]">{dataHoraBr(assinatura.signed_at)}</p>
          </div>
        ) : vez ? (
          <div className="ct-sem-papel flex flex-wrap items-center gap-2">
            <button type="button" onClick={abrirAssinatura} className={BOTAO_PRIMARIO} data-testid={novo ? 'ir-assinar' : 'assinar-etapa'}>Assinar</button>
            {!novo && <button type="button" onClick={() => { setFalha(''); setPainel('recusar'); }} className="min-h-11 px-1 text-sm font-semibold text-rose-700 underline underline-offset-4">Recusar</button>}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[860px] space-y-4" data-testid="folha-contratacao">
      <div className="ct-sem-papel flex flex-wrap items-center gap-2.5 print:hidden">
        {onVoltar && <button type="button" onClick={onVoltar} className={BOTAO_SECUNDARIO}><ArrowLeft className="size-4" aria-hidden="true" /> Voltar</button>}
        <span className={`inline-flex min-h-11 items-center gap-2.5 rounded-xl border px-3 text-sm font-semibold ${totalAssinado === 3 ? 'border-[#176b4d] text-[#176b4d]' : 'border-slate-200 bg-white text-slate-700'}`}>
          <span className="inline-flex gap-1" aria-hidden="true">
            {[0, 1, 2].map(indice => <i key={indice} className={`h-1.5 w-5 rounded-sm ${indice < totalAssinado ? 'bg-[#176b4d]' : 'bg-slate-200'}`} />)}
          </span>
          {totalAssinado} de 3 assinaturas
        </span>
        {!novo && (
          <button type="button" onClick={() => imprimir(`${pedido.request_number} - Solicitação de Contratação`)} className={BOTAO_SECUNDARIO} data-testid="imprimir-contratacao">
            <Printer className="size-4" aria-hidden="true" /> Imprimir / salvar PDF
          </button>
        )}
      </div>

      {!novo && pedido.status === 'recusada' && (
        <p role="status" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <strong>Recusada pelo {pedido.rejected_stage === 'rh' ? 'RH' : 'gerente de contrato'}:</strong> {pedido.rejection_reason}
        </p>
      )}
      {novo && totalErros > 0 && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          Falta preencher {totalErros === 1 ? '1 campo' : `${totalErros} campos`}. Eles estão marcados em vermelho.
        </p>
      )}
      {!novo && totalAssinado > 0 && (
        <p className="ct-sem-papel rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 print:hidden">
          Há assinaturas neste documento, então os dados do formulário estão travados.
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

        <fieldset disabled={novo && (painel !== '' || ocupado)} className="contents">
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
              {([['posicao', 'Posição a contratar'], ['quantidade', 'Quantidade'], ['salario', 'Salário'], ['requisitante', 'Requisitante']] as const).map(([nome, titulo]) => (
                <label key={nome} className="flex min-w-0 flex-col gap-1">
                  <span className={rotulo}>{titulo}</span>
                  <input name={nome} readOnly={!novo} inputMode={nome === 'quantidade' ? 'numeric' : undefined} value={String(form[nome])} onChange={e => mudar(nome, e.target.value)} className={campo(nome)} {...erroDe(nome)} />
                  {mensagem(nome)}
                </label>
              ))}
              <label className="flex min-w-0 flex-col gap-1 sm:col-span-2">
                <span className={rotulo}>Área/Obra</span>
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
              {([['obs', 'OBS'], ['aprovados', 'Aprovados']] as const).map(([nome, titulo]) => (
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
          {painel !== '' && (
            <section className="ct-sem-papel mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-label={painel === 'assinar' ? 'Assinar' : 'Recusar'}>
              {falha && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{falha}</p>}
              {painel === 'assinar' ? (
                <>
                  <h3 className="text-sm font-bold text-slate-900">Assinar · {TITULO_ASSINATURA[pendente as Etapa]}</h3>
                  <QuadroAssinatura
                    nome={leitor.nome}
                    rotuloConfirmar={novo ? 'Confirmar e enviar ao RH' : pendente === 'gerente' ? 'Confirmar e aprovar' : 'Confirmar e enviar ao gerente'}
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
            ? <textarea name="comentarios" aria-label="Comentários" rows={3} value={form.comentarios} disabled={painel !== '' || ocupado} onChange={e => mudar('comentarios', e.target.value)} className={`${campo('comentarios')} py-2`} />
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
              {SITUACOES[pedido.status]} · código de conferência <strong className="font-mono text-slate-700">{pedido.form_hash.slice(0, 12).toUpperCase()}</strong>. As assinaturas valem para estes dados. Emitido no {PRODUTO.nome} para {CLIENTE.nome}.
            </p>
          </Bloco>
        )}
      </article>

      {novo && (
        <p className="text-sm text-[#5b6870]">
          Como usar: preencha os dados e clique em <strong>Assinar</strong> na sua caixa. O pedido vai para o RH, que assina, e depois para o gerente de contrato. Cada um assina só a própria caixa, com o próprio login.
        </p>
      )}
    </div>
  );
}
