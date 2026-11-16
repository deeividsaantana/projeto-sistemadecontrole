/**
 * Detalhe de uma máquina do quadro, com edição na hora: situação em botões
 * grandes, frente, operador, motivo e observação. Grava o lançamento do dia no
 * mesmo formato do Controle de Frotas.
 *
 * Abre em tela cheia, no padrão de lançamento: Ctrl+S salva, Esc fecha.
 * Teclas, fora de campo de texto: O operando, M manutenção, P parado.
 * Shift+Enter salva e abre a próxima máquina da tela.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, PauseCircle, PlayCircle, Wrench } from 'lucide-react';
import type { StatusControleEquipamentoDiario } from '../../types';
import { CANTEIROS, SITUACOES_EDITAVEIS, rascunhoDoCartao, type CartaoFrota, type EdicaoQuadro, type RascunhoQuadro } from '../../modules/frota/quadroFrota';
import { Modal } from '../../shared/ui';
import { TOM, numero } from './CartaoEquipamento';
import { ROTULO_GRUPO } from '../../modules/frota/quadroFrota';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, FOCO, ROTULO } from '../cadastros/estilos';

const RAPIDAS: ReadonlyArray<{ status: StatusControleEquipamentoDiario; rotulo: string; tecla: string; Icone: typeof PlayCircle; ligado: string }> = [
  { status: 'Em operação', rotulo: 'Em operação', tecla: 'O', Icone: PlayCircle, ligado: 'border-[#176b4d] bg-emerald-50 text-[#176b4d]' },
  { status: 'Em manutenção', rotulo: 'Manutenção', tecla: 'M', Icone: Wrench, ligado: 'border-rose-500 bg-rose-50 text-rose-700' },
  { status: 'Disponível', rotulo: 'À disposição', tecla: 'P', Icone: PauseCircle, ligado: 'border-amber-400 bg-amber-50 text-amber-800' },
];

const EM_MANUTENCAO = new Set<StatusControleEquipamentoDiario>(['Em manutenção', 'Aguardando manutenção']);

interface Props {
  cartao: CartaoFrota | null;
  podeEditar: boolean;
  temProximo: boolean;
  /** Canteiros do cadastro; sem isso usa a lista fixa de reserva. */
  canteiros?: readonly string[];
  frentes: readonly string[];
  operadores: readonly string[];
  onFechar: () => void;
  /** Devolve a mensagem de erro, ou nada quando gravou. */
  onSalvar: (cartao: CartaoFrota, edicao: EdicaoQuadro, irParaProximo: boolean) => string | undefined;
  onAbrirControle: () => void;
  /** Abre as ordens de serviço desta máquina na Manutenção. */
  onVerOrdens?: () => void;
  /** Quem pode desmobilizar a máquina (mesma permissão de excluir em Cadastros). */
  podeRemover?: boolean;
  onRemover?: () => void;
}

export function PainelEquipamento({ cartao, podeEditar, temProximo, canteiros = CANTEIROS, frentes, operadores, onFechar, onSalvar, onAbrirControle, onVerOrdens, podeRemover, onRemover }: Props) {
  const [edicao, setEdicao] = useState<RascunhoQuadro | null>(null);
  const [erro, setErro] = useState('');
  const idLista = useId();
  const motivoRef = useRef<HTMLInputElement>(null);

  // Cada máquina aberta começa do que está gravado para ela.
  useEffect(() => {
    setEdicao(cartao ? rascunhoDoCartao(cartao) : null);
    setErro('');
  }, [cartao?.equipamentoId, cartao?.registroId, cartao?.status]);

  const opcoesFrente = useMemo(
    () => Array.from(new Set([...frentes, ...(edicao?.frente ? [edicao.frente] : [])])).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [frentes, edicao?.frente],
  );

  const mudar = (parcial: Partial<RascunhoQuadro>) => setEdicao(atual => (atual ? { ...atual, ...parcial } : atual));
  const escolherSituacao = (status: StatusControleEquipamentoDiario) => {
    mudar({ status });
    if (EM_MANUTENCAO.has(status)) window.setTimeout(() => motivoRef.current?.focus(), 0);
  };
  const salvar = (irParaProximo: boolean) => {
    if (!cartao || !edicao) return;
    // Só operador (ou canteiro, frente etc.) preenchido, sem situação escolhida,
    // não trava o salvamento: a máquina fica Disponível até alguém marcar outra coisa.
    const status = edicao.status || 'Disponível';
    const falha = onSalvar(cartao, { ...edicao, status }, irParaProximo);
    setErro(falha || '');
  };

  useEffect(() => {
    if (!cartao || !podeEditar) return undefined;
    const teclar = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && (event.shiftKey || event.ctrlKey || event.metaKey)) {
        if ((event.target as HTMLElement | null)?.tagName === 'TEXTAREA' && !event.ctrlKey && !event.metaKey && !event.shiftKey) return;
        event.preventDefault();
        salvar(event.shiftKey && temProximo);
        return;
      }
      const alvo = event.target as HTMLElement | null;
      if (alvo?.matches('input, textarea, select, [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey) return;
      const rapida = RAPIDAS.find(item => item.tecla.toLowerCase() === event.key.toLowerCase());
      if (rapida) {
        event.preventDefault();
        escolherSituacao(rapida.status);
      }
    };
    document.addEventListener('keydown', teclar);
    return () => document.removeEventListener('keydown', teclar);
  });

  const emManutencao = edicao?.status ? EM_MANUTENCAO.has(edicao.status) : false;
  // Atalho só para quem já está em manutenção no que está gravado (não no rascunho).
  const botaoOrdens = onVerOrdens && cartao?.grupo === 'manutencao'
    ? <button type="button" onClick={onVerOrdens} className={BOTAO_SECUNDARIO} data-testid="quadro-ver-ordens">Ver ordens de serviço na Manutenção</button>
    : null;
  const tom = cartao ? TOM[cartao.grupo] : TOM['sem-lancamento'];

  const rodape = cartao && (podeEditar ? (
    <div className="grid gap-2">
      {erro && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 ring-1 ring-inset ring-rose-200">{erro}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onFechar} className={BOTAO_SECUNDARIO}>Fechar</button>
        {temProximo && (
          <button type="button" onClick={() => salvar(true)} className={BOTAO_SECUNDARIO} data-testid="quadro-salvar-proximo">
            Salvar e próxima
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={() => salvar(false)} className={`${BOTAO_PRIMARIO} px-6`} data-testid="quadro-salvar">
          <Check className="size-5" aria-hidden="true" />
          Salvar
        </button>
      </div>
    </div>
  ) : (
    <div className="flex justify-end">
      <button type="button" onClick={onFechar} className={BOTAO_SECUNDARIO}>Fechar</button>
    </div>
  ));

  return (
    <Modal
      open={Boolean(cartao)}
      onClose={onFechar}
      lancamento
      onSubmit={podeEditar ? () => salvar(false) : undefined}
      title={cartao ? `${cartao.prefixo} · ${cartao.modelo}` : ''}
      description={cartao ? `${cartao.tipo}${cartao.horimetro ? ` · ${numero(cartao.horimetro)} h` : ''}` : undefined}
      footer={rodape}
    >
      {cartao && edicao && (
        <div className="space-y-5" data-testid="quadro-painel">
          <div className="flex flex-wrap items-center gap-3">
            {cartao.foto && <img src={cartao.foto} alt={`Foto do ${cartao.prefixo}`} className="size-14 rounded-xl object-cover ring-1 ring-slate-200" />}
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ring-1 ring-inset ${tom.etiqueta}`}>
              <span className={`size-2 rounded-full ${tom.ponto}`} aria-hidden="true" />
              {ROTULO_GRUPO[cartao.grupo]}{cartao.status && cartao.grupo !== 'sem-lancamento' && cartao.status !== ROTULO_GRUPO[cartao.grupo] ? ` · ${cartao.status}` : ''}
            </span>
            <span className="text-sm text-slate-600">Canteiro: <strong className="text-slate-900">{cartao.canteiro}</strong></span>
            {cartao.frente && <span className="text-sm text-slate-600">Frente: <strong className="text-slate-900">{cartao.frente}</strong></span>}
          </div>

          {cartao.grupo === 'sem-lancamento' && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
              Esta máquina ainda não foi lançada hoje. Escolha a situação e salve para lançar.
            </p>
          )}
          {cartao.situacaoHerdada && (
            <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900 ring-1 ring-inset ring-sky-200">
              Situação de um lançamento anterior, mantida porque não mudou. Sem lançamento hoje.
            </p>
          )}

          {podeEditar ? (
            <div className="grid gap-5 lg:grid-cols-2 lg:gap-8">
              <div className="space-y-5">
              <fieldset>
                <legend className={ROTULO}>Situação</legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {RAPIDAS.map(item => {
                    const ligado = edicao.status === item.status;
                    return (
                      <button
                        key={item.status}
                        type="button"
                        aria-pressed={ligado}
                        onClick={() => escolherSituacao(item.status)}
                        data-testid={`quadro-situacao-${item.tecla.toLowerCase()}`}
                        className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 text-xs font-bold transition duration-200 active:scale-[0.97] ${ligado ? item.ligado : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'} ${FOCO}`}
                      >
                        <item.Icone className="size-5" aria-hidden="true" />
                        {item.rotulo}
                        <kbd className="hidden text-xs font-semibold opacity-60 lg:inline">{item.tecla}</kbd>
                      </button>
                    );
                  })}
                </div>
                <label className="mt-2 block">
                  <span className="sr-only">Outra situação</span>
                  <select value={edicao.status} onChange={event => escolherSituacao(event.target.value as StatusControleEquipamentoDiario)} className={CAMPO} data-testid="quadro-situacao">
                    {!edicao.status && <option value="" disabled>Outra situação</option>}
                    {SITUACOES_EDITAVEIS.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
              </fieldset>

              {emManutencao && (
                <label className="block">
                  <span className={ROTULO}>Motivo da manutenção</span>
                  <input ref={motivoRef} value={edicao.motivoManutencao} onChange={event => mudar({ motivoManutencao: event.target.value })} placeholder="Ex.: mangueira do hidráulico" className={`${CAMPO} mt-1.5`} data-testid="quadro-motivo" />
                </label>
              )}

              <fieldset>
                <legend className={ROTULO}>Canteiro</legend>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {canteiros.map(canteiro => {
                    const ligado = edicao.canteiro === canteiro;
                    return (
                      <button
                        key={canteiro}
                        type="button"
                        aria-pressed={ligado}
                        onClick={() => mudar({ canteiro: ligado ? '' : canteiro })}
                        data-testid={`quadro-canteiro-${canteiro}`}
                        className={`min-h-11 rounded-xl border-2 px-2 text-xs font-bold uppercase transition duration-200 active:scale-[0.97] ${ligado ? 'border-[#176b4d] bg-[#176b4d] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-400'} ${FOCO}`}
                      >
                        {canteiro}
                      </button>
                    );
                  })}
                </div>
                <span className="mt-1 block text-xs text-slate-500">O canteiro fica guardado para os próximos dias.</span>
              </fieldset>
              </div>

              <div className="space-y-5">

              <label className="block">
                <span className={ROTULO}>Frente</span>
                <select value={edicao.frente} onChange={event => mudar({ frente: event.target.value })} className={`${CAMPO} mt-1.5`} data-testid="quadro-frente">
                  <option value="">Sem frente</option>
                  {opcoesFrente.map(frente => <option key={frente} value={frente}>{frente}</option>)}
                </select>
              </label>

              <label className="block">
                <span className={ROTULO}>Operador</span>
                <input
                  value={edicao.operador}
                  onChange={event => mudar({ operador: event.target.value })}
                  list={idLista}
                  placeholder="Digite o nome e escolha na lista"
                  autoComplete="off"
                  className={`${CAMPO} mt-1.5`}
                  data-testid="quadro-operador"
                />
                <datalist id={idLista}>
                  {operadores.map(nome => <option key={nome} value={nome} />)}
                </datalist>
                <span className="mt-1 block text-xs text-slate-500">Nome fora da lista fica como motorista temporário, para conferir depois.</span>
              </label>

              <label className="block">
                <span className={ROTULO}>Observação</span>
                <textarea value={edicao.observacao} onChange={event => mudar({ observacao: event.target.value })} rows={3} className={`${CAMPO} mt-1.5 py-2.5`} data-testid="quadro-observacao" />
              </label>

              <div className="flex flex-col items-start gap-1 border-t border-slate-100 pt-3">
                {botaoOrdens}
                <button type="button" onClick={onAbrirControle} className={`min-h-11 text-sm font-semibold text-[#176b4d] underline-offset-4 hover:underline ${FOCO}`}>
                  Ver horários e histórico no Controle de Frotas
                </button>
                {podeRemover && (
                  <button type="button" onClick={onRemover} className={`min-h-11 text-sm font-semibold text-rose-700 underline-offset-4 hover:underline ${FOCO}`} data-testid="quadro-remover-cartao">
                    Remover esta máquina do quadro
                  </button>
                )}
              </div>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {[
                ['Situação', cartao.status],
                ['Canteiro', cartao.canteiro],
                ['Frente', cartao.frente],
                ['Operador', cartao.operador || 'Sem operador'],
                ['Horímetro', cartao.horimetro ? `${numero(cartao.horimetro)} h` : 'Sem abastecimento com horímetro'],
                ...(cartao.motivoManutencao ? [['Motivo da manutenção', cartao.motivoManutencao]] : []),
                ...(cartao.observacao ? [['Observação', cartao.observacao]] : []),
              ].map(([rotulo, valor]) => (
                <div key={rotulo} className={`rounded-xl border border-slate-200 bg-white p-3 ${String(valor).length > 28 ? 'col-span-2' : ''}`}>
                  <dt className="text-xs font-semibold text-slate-500">{rotulo}</dt>
                  <dd className="mt-0.5 font-bold text-slate-900">{valor}</dd>
                </div>
              ))}
            </dl>
          )}
          {!podeEditar && (
            <div className="flex flex-col items-start gap-2">
              <button type="button" onClick={onAbrirControle} className={`${BOTAO_PRIMARIO} px-5`}>Abrir no Controle de Frotas</button>
              {botaoOrdens}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
