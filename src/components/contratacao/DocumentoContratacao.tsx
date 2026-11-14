import { useState } from 'react';
import { ArrowLeft, Check, Printer, X } from 'lucide-react';
import logoCliente from '../../assets/images/logo-renea-dark.svg';
import { CLIENTE, PRODUTO } from '../../config/marca';
import { BOTAO_PERIGO_LEVE, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, ROTULO } from '../cadastros/estilos';
import { ETAPAS, ITENS, MOTIVOS, NOME_DA_ETAPA, TIPOS, etapaPendente, podeDecidir } from '../../../api/_shared/contratacao-regras.js';
import { decidirContratacao, type AssinaturaContratacao, type AssinaturaEnviada, type Etapa, type Leitor, type PedidoContratacao } from '../../services/contratacaoApi';
import { QuadroAssinatura } from './QuadroAssinatura';
import { LinhaDeEtapas, SeloSituacaoContratacao } from './SeloSituacaoContratacao';
import { dataBr, dataHoraBr } from './formatos';

export const CODIGO_DOCUMENTO = 'SGR-FRH-21-373-01-000-000-0008 · Ver. 7';

interface Props {
  pedido: PedidoContratacao;
  leitor: Leitor;
  onVoltar: () => void;
  onAtualizado: () => void;
}

const ACOES: Record<string, string> = {
  criou_e_assinou: 'abriu o pedido e assinou como solicitante',
  assinou_rh: 'assinou como RH',
  assinou_gerente: 'assinou como gerente de contrato e aprovou',
  recusou_rh: 'recusou na etapa do RH',
  recusou_gerente: 'recusou na etapa do gerente',
};

function Dado({ rotulo, valor, largo = false }: { rotulo: string; valor: string; largo?: boolean }) {
  return (
    <div className={`min-w-0 ${largo ? 'sm:col-span-3' : ''}`}>
      <dt className="text-xs font-bold text-[#5b6870]">{rotulo}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">{valor || '—'}</dd>
    </div>
  );
}

function CaixaAssinatura({ etapa, assinatura, pendente }: { etapa: Etapa; assinatura?: AssinaturaContratacao; pendente: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-slate-200 p-3 break-inside-avoid" data-testid={`assinatura-${etapa}`}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-xs font-black text-slate-700">{NOME_DA_ETAPA[etapa]}</h4>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${assinatura ? 'bg-emerald-50 text-emerald-800' : pendente ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
          {assinatura ? 'Assinado' : pendente ? 'Aguardando' : 'Ainda não'}
        </span>
      </div>
      <div className="grid h-24 place-items-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white">
        {assinatura?.image_data
          ? <img src={assinatura.image_data} alt={`Assinatura de ${assinatura.signer_name}`} className="max-h-full max-w-full" />
          : assinatura && !assinatura.oculta
            ? <span className="truncate px-2 font-serif text-2xl italic text-slate-900">{assinatura.signer_name}</span>
            : assinatura?.oculta
              ? <span className="px-2 text-center text-xs text-[#5b6870]">Assinatura visível ao fim do fluxo</span>
              : <span className="text-xs text-[#5b6870]">—</span>}
      </div>
      <p className="truncate text-sm font-bold text-slate-900">{assinatura?.signer_name ?? ' '}</p>
      <p className="text-xs text-[#5b6870]">{assinatura ? dataHoraBr(assinatura.signed_at) : ' '}</p>
    </div>
  );
}

/**
 * O documento no padrão RENEA: dados, a linha de etapas, as três assinaturas
 * e o histórico. Imprimir usa só esta área (classe ct-imprimir, index.css).
 * Quem está na vez assina ou recusa aqui; o servidor confere de novo.
 */
/**
 * Imprime ou salva em PDF só o documento, numa janela própria em A4 de pé,
 * com os mesmos estilos do sistema. Assim nada da tela (menu, botões, rolagem)
 * entra no papel.
 */
const imprimir = (titulo: string) => {
  const documento = document.querySelector('.ct-imprimir');
  const janela = window.open('', '_blank');
  if (!documento || !janela) { window.print(); return; }
  const estilos = [...document.querySelectorAll('link[rel="stylesheet"], style')].map(no => no.outerHTML).join('');
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><base href="${window.location.origin}/"><title>${titulo}</title>${estilos}<style>@page{size:A4 portrait;margin:10mm}html,body{background:#fff!important;margin:0}.ct-imprimir{border:0!important}</style></head><body>${documento.outerHTML}</body></html>`);
  janela.document.close();
  janela.focus();
  window.setTimeout(() => { janela.print(); }, 400);
};

export function DocumentoContratacao({ pedido, leitor, onVoltar, onAtualizado }: Props) {
  const [modo, setModo] = useState<'ver' | 'assinar' | 'recusar'>('ver');
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [falha, setFalha] = useState('');
  const f = pedido.form;
  const pendente = etapaPendente(pedido.status) as Etapa | null;
  const minhaVez = podeDecidir(pedido, pedido.signatures, leitor);
  const itens = (f.itens || []).map(item => ITENS[item as keyof typeof ITENS]).filter(Boolean).join(', ');
  const motivoTexto = f.motivo === 'outro' ? `Outro: ${f.motivoOutro}` : MOTIVOS[f.motivo as keyof typeof MOTIVOS] ?? '';

  const decidir = async (decisao: 'aprovar' | 'recusar', assinatura?: AssinaturaEnviada) => {
    setOcupado(true);
    setFalha('');
    try {
      await decidirContratacao(pedido, decisao, assinatura, motivo);
      setModo('ver');
      onAtualizado();
    } catch (erro) {
      setFalha(erro instanceof Error ? erro.message : 'Não foi possível concluir.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button type="button" onClick={onVoltar} className={BOTAO_SECUNDARIO}><ArrowLeft className="size-4" aria-hidden="true" /> Voltar</button>
        <button type="button" onClick={() => imprimir(`${pedido.request_number} - Solicitação de Contratação`)} className={BOTAO_SECUNDARIO} data-testid="imprimir-contratacao">
          <Printer className="size-4" aria-hidden="true" /> Imprimir ou salvar PDF
        </button>
      </div>

      {minhaVez && modo === 'ver' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 print:hidden" role="status">
          <p className="text-sm font-bold text-amber-900">É a sua vez: confira os dados e assine como {NOME_DA_ETAPA[pendente as Etapa]}.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setModo('assinar')} className={BOTAO_PRIMARIO} data-testid="assinar-etapa"><Check className="size-4" aria-hidden="true" /> Aprovar e assinar</button>
            <button type="button" onClick={() => setModo('recusar')} className={BOTAO_PERIGO_LEVE}><X className="size-4" aria-hidden="true" /> Recusar</button>
          </div>
        </div>
      )}
      {modo === 'assinar' && (
        <section className={`${CARTAO} space-y-3 border-emerald-300 p-4 sm:p-5 print:hidden`} aria-label="Assinar">
          <h3 className="text-sm font-black text-slate-900">Sua assinatura ({NOME_DA_ETAPA[pendente as Etapa]})</h3>
          {falha && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{falha}</p>}
          <QuadroAssinatura nome={leitor.nome} rotuloConfirmar={pendente === 'gerente' ? 'Assinar e aprovar' : 'Assinar e enviar ao gerente'} ocupado={ocupado} onConfirmar={assinatura => void decidir('aprovar', assinatura)} onCancelar={() => setModo('ver')} />
        </section>
      )}
      {modo === 'recusar' && (
        <section className={`${CARTAO} space-y-3 border-rose-200 p-4 sm:p-5 print:hidden`} aria-label="Recusar">
          {falha && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{falha}</p>}
          <label htmlFor="ct-motivo-recusa" className={ROTULO}>Por que está recusando?</label>
          <textarea id="ct-motivo-recusa" rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} className={`${CAMPO} py-2`} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={ocupado || motivo.trim().length < 3} onClick={() => void decidir('recusar')} className={BOTAO_PERIGO_LEVE}>{ocupado ? 'Enviando…' : 'Confirmar recusa'}</button>
            <button type="button" disabled={ocupado} onClick={() => setModo('ver')} className={BOTAO_SECUNDARIO}>Voltar</button>
          </div>
        </section>
      )}

      <article className={`ct-imprimir ${CARTAO} overflow-hidden`} data-testid="documento-contratacao">
        <header className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <img src={logoCliente} alt={CLIENTE.nome} className="h-8 w-auto" />
            <div>
              <p className="text-xs font-bold text-[#5b6870]">{CODIGO_DOCUMENTO}</p>
              <h2 className="text-lg font-black tracking-tight text-slate-900">Solicitação de Contratação</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:flex-col sm:items-end">
            <p className="text-lg font-black tabular-nums text-slate-900">{pedido.request_number}</p>
            <SeloSituacaoContratacao situacao={pedido.status} />
          </div>
          </div>
        </header>

        <div className="border-b border-slate-200 p-4 sm:p-5">
          <LinhaDeEtapas pedido={pedido} />
          {pedido.status === 'recusada' && (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              <strong>Recusada pelo {pedido.rejected_stage === 'rh' ? 'RH' : 'gerente de contrato'}:</strong> {pedido.rejection_reason}
            </p>
          )}
        </div>

        <dl className="grid gap-4 border-b border-slate-200 p-4 sm:grid-cols-3 sm:p-5">
          <Dado rotulo="Data da solicitação" valor={dataBr(f.data)} />
          <Dado rotulo="Prioridade" valor={f.prioridade} />
          <Dado rotulo="Quantidade" valor={String(f.quantidade)} />
          <Dado rotulo="Posição a contratar" valor={f.posicao} />
          <Dado rotulo="Salário" valor={f.salario} />
          <Dado rotulo="Área/Obra" valor={f.area} />
          <Dado rotulo="Requisitante" valor={f.requisitante} />
          <Dado rotulo="Motivo" valor={motivoTexto} />
          <Dado rotulo="Tipo de contratação" valor={TIPOS[f.tipo as keyof typeof TIPOS] ?? ''} />
          <Dado rotulo="Itens necessários" valor={itens} largo />
          {f.obs && <Dado rotulo="OBS" valor={f.obs} largo />}
          {f.aprovados && <Dado rotulo="Aprovados" valor={f.aprovados} largo />}
          {f.comentarios && <Dado rotulo="Comentários" valor={f.comentarios} largo />}
        </dl>

        <section className="p-4 sm:p-5" aria-label="Assinaturas">
          <h3 className="mb-3 text-xs font-black text-[#5b6870]">Assinaturas</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {(ETAPAS as Etapa[]).map(etapa => (
              <CaixaAssinatura key={etapa} etapa={etapa} assinatura={pedido.signatures.find(item => item.stage === etapa)} pendente={pendente === etapa} />
            ))}
          </div>
          <p className="mt-4 text-xs text-[#5b6870]">
            Código de conferência <strong className="font-mono text-slate-700">{pedido.form_hash.slice(0, 12).toUpperCase()}</strong>: as assinaturas valem para estes dados, que ficam travados depois da primeira assinatura.
            {' '}Emitido no {PRODUTO.nome} · {CLIENTE.nome}.
          </p>
        </section>

        {pedido.history.length > 0 && (
          <section className="border-t border-slate-200 p-4 sm:p-5" aria-label="Histórico">
            <h3 className="mb-2 text-xs font-black text-[#5b6870]">Histórico</h3>
            <ol className="space-y-1.5">
              {pedido.history.map((evento, indice) => (
                <li key={indice} className="flex flex-wrap gap-x-2 text-sm text-slate-700">
                  <span className="tabular-nums text-[#5b6870]">{dataHoraBr(evento.created_at)}</span>
                  <span><strong className="text-slate-900">{evento.actor_name}</strong> {ACOES[evento.action] ?? evento.action}{evento.details?.reason ? `: "${evento.details.reason}"` : ''}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </article>
    </div>
  );
}
