import { useMemo, useState } from 'react';
import { CalendarClock, Check, ChevronDown, ListTodo, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { PendenciaRotina, PrioridadeRotina, TipoPendenciaRotina } from '../../types';
import { PRIORIDADES, TIPOS_PENDENCIA, concluidasNoDia, contarPorPrioridade, pendenciasAbertas } from '../../modules/rotina/checklistDiario';
import { formatarData } from '../../utils/formato';
import { ConfirmDialog, EmptyState, Modal } from '../../shared/ui';
import { useEntradaDeLista } from '../../shared/hooks/useEntradaDeLista';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO } from '../cadastros/estilos';

export type AcaoPendencia = 'Criou' | 'Editou' | 'Excluiu';

interface Props {
  dia: string;
  responsavel: string;
  pendencias: readonly PendenciaRotina[];
  onSalvar: (pendencia: PendenciaRotina, descricao: string, acao: AcaoPendencia) => void;
}

interface Rascunho {
  titulo: string;
  prioridade: PrioridadeRotina;
  tipo: TipoPendenciaRotina;
  dependeDe: string;
  frente: string;
  prazo: string;
  observacao: string;
}

const VAZIO: Rascunho = { titulo: '', prioridade: 'importante', tipo: 'cobrar', dependeDe: '', frente: '', prazo: '', observacao: '' };

export const TOM_PRIORIDADE: Record<PrioridadeRotina, string> = {
  critico: 'bg-rose-50 text-rose-800 ring-rose-200',
  importante: 'bg-orange-50 text-orange-800 ring-orange-200',
  acompanhar: 'bg-amber-50 text-amber-800 ring-amber-200',
  rotina: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

const BORDA_PRIORIDADE: Record<PrioridadeRotina, string> = {
  critico: 'border-l-rose-500',
  importante: 'border-l-orange-400',
  acompanhar: 'border-l-amber-400',
  rotina: 'border-l-emerald-500',
};

const nomeDoTipo = (tipo: TipoPendenciaRotina) => TIPOS_PENDENCIA.find(item => item.id === tipo)?.nome || 'Outro';
const prioridade = (id: PrioridadeRotina) => PRIORIDADES.find(item => item.id === id)!;

function CamposPendencia({ valor, onMudar, detalhesAbertos, onAlternarDetalhes, focoTitulo }: {
  valor: Rascunho;
  onMudar: (valor: Rascunho) => void;
  detalhesAbertos: boolean;
  onAlternarDetalhes: () => void;
  focoTitulo?: boolean;
}) {
  const mudar = <K extends keyof Rascunho>(campo: K, novo: Rascunho[K]) => onMudar({ ...valor, [campo]: novo });
  return (
    <div className="space-y-3">
      <label className="block space-y-1.5">
        <span className={ROTULO}>O que precisa ser feito</span>
        <input
          className={CAMPO}
          value={valor.titulo}
          autoFocus={focoTitulo}
          maxLength={200}
          placeholder="Ex.: cobrar a nota da brita do dia 25"
          onChange={event => mudar('titulo', event.target.value)}
          data-testid="meu-dia-pendencia-titulo"
        />
      </label>
      <fieldset className="space-y-1.5">
        <legend className={ROTULO}>Prioridade</legend>
        <div className="grid grid-cols-2 gap-2">
          {PRIORIDADES.map(item => {
            const escolhida = valor.prioridade === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={escolhida}
                onClick={() => mudar('prioridade', item.id)}
                className={`min-h-11 rounded-xl px-3 py-2 text-left text-sm ring-1 ring-inset transition duration-200 ${FOCO} ${escolhida ? `${TOM_PRIORIDADE[item.id]} font-bold ring-2` : 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-300'}`}
              >
                <span aria-hidden="true">{item.marca}</span> {item.nome}
                <span className="block text-xs font-normal text-slate-500">{item.ajuda}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <label className="block space-y-1.5">
        <span className={ROTULO}>Tipo</span>
        <select className={CAMPO} value={valor.tipo} onChange={event => mudar('tipo', event.target.value as TipoPendenciaRotina)}>
          {TIPOS_PENDENCIA.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
      </label>
      <button type="button" onClick={onAlternarDetalhes} aria-expanded={detalhesAbertos} className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-sm font-bold text-[#176b4d] ${FOCO}`}>
        <ChevronDown className={`size-4 transition-transform duration-200 ${detalhesAbertos ? 'rotate-180' : ''}`} aria-hidden="true" />
        {detalhesAbertos ? 'Menos detalhes' : 'Quem, onde e prazo (opcional)'}
      </button>
      {detalhesAbertos && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className={ROTULO}>Depende de quem</span>
            <input className={CAMPO} value={valor.dependeDe} maxLength={120} placeholder="Ex.: topografia" onChange={event => mudar('dependeDe', event.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className={ROTULO}>Ramo ou frente</span>
            <input className={CAMPO} value={valor.frente} maxLength={120} placeholder="Ex.: Ramo 900" onChange={event => mudar('frente', event.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className={ROTULO}>Prazo</span>
            <input type="date" className={CAMPO} value={valor.prazo} onChange={event => mudar('prazo', event.target.value)} />
          </label>
          <label className="block space-y-1.5 sm:col-span-3">
            <span className={ROTULO}>Observação</span>
            <textarea className={`${CAMPO} min-h-20 py-2`} value={valor.observacao} maxLength={1000} onChange={event => mudar('observacao', event.target.value)} />
          </label>
        </div>
      )}
    </div>
  );
}

const paraRascunho = (item: PendenciaRotina): Rascunho => ({
  titulo: item.titulo, prioridade: item.prioridade, tipo: item.tipo, dependeDe: item.dependeDe || '', frente: item.frente || '', prazo: item.prazo || '', observacao: item.observacao || '',
});

const aplicar = (base: PendenciaRotina, rascunho: Rascunho, agora: string): PendenciaRotina => ({
  ...base,
  titulo: rascunho.titulo.trim(),
  prioridade: rascunho.prioridade,
  tipo: rascunho.tipo,
  dependeDe: rascunho.dependeDe.trim() || undefined,
  frente: rascunho.frente.trim() || undefined,
  prazo: rascunho.prazo || undefined,
  observacao: rascunho.observacao.trim() || undefined,
  atualizadoEm: agora,
});

export function PendenciasDoDia({ dia, responsavel, pendencias, onSalvar }: Props) {
  const [novo, setNovo] = useState<Rascunho>(VAZIO);
  const [detalhesNovo, setDetalhesNovo] = useState(false);
  const [filtro, setFiltro] = useState<PrioridadeRotina | 'todas'>('todas');
  const [editando, setEditando] = useState<PendenciaRotina | null>(null);
  const [rascunhoEdicao, setRascunhoEdicao] = useState<Rascunho>(VAZIO);
  const [detalhesEdicao, setDetalhesEdicao] = useState(true);
  const [excluindo, setExcluindo] = useState<PendenciaRotina | null>(null);

  const abertas = useMemo(() => pendenciasAbertas(pendencias, dia, responsavel), [pendencias, dia, responsavel]);
  const resolvidas = useMemo(() => concluidasNoDia(pendencias, dia, responsavel), [pendencias, dia, responsavel]);
  const contagem = contarPorPrioridade(abertas);
  const visiveis = filtro === 'todas' ? abertas : abertas.filter(item => item.prioridade === filtro);
  const lista = useEntradaDeLista([filtro, dia]);

  const criar = () => {
    if (!novo.titulo.trim()) return;
    const agora = new Date().toISOString();
    const base: PendenciaRotina = { id: `pend-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, titulo: '', prioridade: 'importante', tipo: 'cobrar', dia, responsavel: responsavel.trim(), criadoEm: agora, atualizadoEm: agora };
    const pendencia = aplicar(base, novo, agora);
    onSalvar(pendencia, `Nova pendência ${prioridade(pendencia.prioridade).nome.toLowerCase()}: ${pendencia.titulo}`, 'Criou');
    setNovo({ ...VAZIO, prioridade: novo.prioridade, tipo: novo.tipo });
  };

  const concluir = (item: PendenciaRotina) => {
    const agora = new Date().toISOString();
    // Concluir num dia passado fica registrado naquele dia.
    const quando = dia < agora.slice(0, 10) ? `${dia}T23:59:00.000Z` : agora;
    onSalvar({ ...item, concluidaEm: quando, atualizadoEm: agora }, `Concluiu a pendência: ${item.titulo}`, 'Editou');
  };

  const reabrir = (item: PendenciaRotina) => {
    onSalvar({ ...item, concluidaEm: undefined, atualizadoEm: new Date().toISOString() }, `Reabriu a pendência: ${item.titulo}`, 'Editou');
  };

  const abrirEdicao = (item: PendenciaRotina) => {
    setEditando(item);
    setRascunhoEdicao(paraRascunho(item));
    setDetalhesEdicao(true);
  };

  const salvarEdicao = () => {
    if (!editando || !rascunhoEdicao.titulo.trim()) return;
    const pendencia = aplicar(editando, rascunhoEdicao, new Date().toISOString());
    onSalvar(pendencia, `Editou a pendência: ${pendencia.titulo}`, 'Editou');
    setEditando(null);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:items-start">
      <form
        data-meu-dia-reveal
        className={`${CARTAO} space-y-3 p-4 xl:sticky xl:top-4`}
        onSubmit={event => { event.preventDefault(); criar(); }}
      >
        <div>
          <h2 className="text-base font-bold text-slate-900">Anotar pendência</h2>
          <p className="text-sm text-slate-600">Fica aberta nos próximos dias até você concluir.</p>
        </div>
        <CamposPendencia valor={novo} onMudar={setNovo} detalhesAbertos={detalhesNovo} onAlternarDetalhes={() => setDetalhesNovo(aberto => !aberto)} />
        <button type="submit" className={`${BOTAO_PRIMARIO} w-full`} disabled={!novo.titulo.trim()} data-testid="meu-dia-pendencia-salvar">
          <Plus className="size-5" aria-hidden="true" />
          Anotar pendência
        </button>
      </form>

      <section data-meu-dia-reveal className={`${CARTAO} min-w-0 p-4`} aria-labelledby="meu-dia-abertas">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="meu-dia-abertas" className="text-base font-bold text-slate-900">Em aberto ({abertas.length})</h2>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mostrar só uma prioridade">
            <button type="button" aria-pressed={filtro === 'todas'} onClick={() => setFiltro('todas')} className={`min-h-11 rounded-xl px-3 text-sm font-bold ring-1 ring-inset ${FOCO} ${filtro === 'todas' ? 'bg-[#176b4d] text-white ring-[#176b4d]' : 'bg-white text-slate-700 ring-slate-200'}`}>Todas</button>
            {PRIORIDADES.map(item => (
              <button key={item.id} type="button" aria-pressed={filtro === item.id} onClick={() => setFiltro(item.id)} className={`min-h-11 rounded-xl px-3 text-sm font-bold ring-1 ring-inset ${FOCO} ${filtro === item.id ? `${TOM_PRIORIDADE[item.id]} ring-2` : 'bg-white text-slate-700 ring-slate-200'}`} aria-label={`${item.nome}: ${contagem[item.id]}`}>
                <span aria-hidden="true">{item.marca}</span> {contagem[item.id]}
              </button>
            ))}
          </div>
        </div>

        <div ref={lista} className="mt-3 space-y-2">
          {visiveis.length === 0 && (
            <EmptyState compact icon={ListTodo} title={abertas.length ? 'Nada com essa prioridade' : 'Nenhuma pendência em aberto'} description={abertas.length ? 'Toque em Todas para ver o resto.' : 'Anote ao lado o que precisa cobrar, conferir ou lançar.'} />
          )}
          {visiveis.map(item => {
            const vencida = Boolean(item.prazo && item.prazo < dia);
            const marca = prioridade(item.prioridade);
            const detalhes = [nomeDoTipo(item.tipo), item.dependeDe && `depende de ${item.dependeDe}`, item.frente].filter(Boolean).join(' · ');
            return (
              <article key={item.id} data-linha-lista className={`meu-dia-vivo rounded-xl border border-l-4 border-slate-200 bg-white p-3 ${BORDA_PRIORIDADE[item.prioridade]}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="break-words font-bold text-slate-900"><span aria-hidden="true">{marca.marca}</span> {item.titulo}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{detalhes}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-bold">
                      <span className={`rounded-full px-2 py-0.5 ring-1 ring-inset ${TOM_PRIORIDADE[item.prioridade]}`}>{marca.nome}</span>
                      {item.dia < dia && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 ring-1 ring-inset ring-slate-200">Desde {formatarData(item.dia)}</span>}
                      {item.prazo && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-inset ${vencida ? 'bg-rose-50 text-rose-800 ring-rose-200' : 'bg-white text-slate-700 ring-slate-200'}`}>
                          <CalendarClock className="size-3.5" aria-hidden="true" />
                          {vencida ? `Venceu em ${formatarData(item.prazo)}` : `Prazo ${formatarData(item.prazo)}`}
                        </span>
                      )}
                    </div>
                    {item.observacao && <p className="mt-1.5 whitespace-pre-line break-words text-sm text-slate-600">{item.observacao}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2 max-sm:w-full">
                    <button type="button" onClick={() => concluir(item)} className={`${BOTAO_PRIMARIO} max-sm:flex-1`} aria-label={`Concluir: ${item.titulo}`}>
                      <Check className="size-5" aria-hidden="true" />
                      Concluir
                    </button>
                    <button type="button" onClick={() => abrirEdicao(item)} className={`${BOTAO_SECUNDARIO} px-3`} aria-label={`Editar: ${item.titulo}`}>
                      <Pencil className="size-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => setExcluindo(item)} className={`${BOTAO_SECUNDARIO} px-3 hover:border-rose-300 hover:text-rose-700`} aria-label={`Apagar: ${item.titulo}`}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {resolvidas.length > 0 && (
          <div className="mt-5 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-bold text-slate-700">Resolvidas neste dia ({resolvidas.length})</h3>
            <ul className="mt-2 space-y-1.5">
              {resolvidas.map(item => (
                <li key={item.id} className="flex items-center gap-3 rounded-xl bg-[#f7f8f6] px-3 py-1.5">
                  <Check className="size-4 shrink-0 text-[#176b4d]" aria-hidden="true" />
                  <span className="min-w-0 flex-1 break-words text-sm text-slate-600 line-through decoration-slate-400">{item.titulo}</span>
                  <button type="button" onClick={() => reabrir(item)} className={`inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-bold text-[#176b4d] ${FOCO}`}>
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Reabrir
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <Modal
        open={Boolean(editando)}
        title="Editar pendência"
        onClose={() => setEditando(null)}
        onSubmit={salvarEdicao}
        footer={(
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setEditando(null)}>Cancelar</button>
            <button type="button" onClick={salvarEdicao} className={BOTAO_PRIMARIO} disabled={!rascunhoEdicao.titulo.trim()}>Salvar</button>
          </div>
        )}
      >
        <CamposPendencia valor={rascunhoEdicao} onMudar={setRascunhoEdicao} detalhesAbertos={detalhesEdicao} onAlternarDetalhes={() => setDetalhesEdicao(aberto => !aberto)} focoTitulo />
      </Modal>

      <ConfirmDialog
        open={Boolean(excluindo)}
        title="Apagar esta pendência?"
        description={excluindo ? `"${excluindo.titulo}" sai da sua lista. Se ela foi resolvida, prefira Concluir, que guarda o registro.` : ''}
        confirmLabel="Apagar"
        onCancel={() => setExcluindo(null)}
        onConfirm={() => {
          if (excluindo) {
            const agora = new Date().toISOString();
            onSalvar({ ...excluindo, excluidaEm: agora, atualizadoEm: agora }, `Apagou a pendência: ${excluindo.titulo}`, 'Excluiu');
          }
          setExcluindo(null);
        }}
      />
    </div>
  );
}
