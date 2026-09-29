/**
 * Aba Lançar do Quadro da Frota: todas as máquinas da tela numa lista, uma por
 * linha, para lançar o dia inteiro de uma vez. Cada linha muda situação,
 * canteiro, frente e operador; nada é gravado até "Salvar tudo".
 *
 * A barra de atalhos age sobre as selecionadas: situação, mover de canteiro,
 * frente, repetir o último dia e excluir o lançamento do dia (a máquina
 * continua no cadastro).
 */
import { useEffect, useId, useMemo, useState } from 'react';
import { CheckCheck, CopyCheck, History, ListChecks, MapPin, PauseCircle, PlayCircle, RotateCcw, Save, Trash2, Wrench, X } from 'lucide-react';
import type { ControleEquipamentoDiario, Equipamento, Funcionario, StatusControleEquipamentoDiario } from '../../types';
import {
  CANTEIROS,
  ROTULO_GRUPO,
  lancarEmLote,
  rascunhoDoCartao,
  rascunhoMudou,
  rascunhosDoUltimoDia,
  type CartaoFrota,
  type RascunhoQuadro,
} from '../../modules/frota/quadroFrota';
import { Modal } from '../../shared/ui';
import { DesenhoMaquina } from './DesenhoMaquina';
import { TOM } from './CartaoEquipamento';
import { BOTAO_PERIGO, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO } from '../cadastros/estilos';

const RAPIDAS: ReadonlyArray<{ status: StatusControleEquipamentoDiario; rotulo: string; Icone: typeof PlayCircle; ligado: string }> = [
  { status: 'Em operação', rotulo: 'Operando', Icone: PlayCircle, ligado: 'bg-[#176b4d] text-white shadow-sm' },
  { status: 'Em manutenção', rotulo: 'Manutenção', Icone: Wrench, ligado: 'bg-rose-600 text-white shadow-sm' },
  { status: 'Disponível', rotulo: 'Parado', Icone: PauseCircle, ligado: 'bg-amber-400 text-amber-950 shadow-sm' },
];

const EM_MANUTENCAO = new Set<string>(['Em manutenção', 'Aguardando manutenção']);
const CAMPO_LINHA = `${CAMPO} min-h-10 text-sm`;
const horaAgora = () => new Date().toTimeString().slice(0, 5);

interface Props {
  cartoes: readonly CartaoFrota[];
  dia: string;
  equipamentos: readonly Equipamento[];
  registros: readonly ControleEquipamentoDiario[];
  funcionarios: readonly Funcionario[];
  frentes: readonly string[];
  operadores: readonly string[];
  usuario: string;
  onSaveMany: (itens: Array<{ registro: ControleEquipamentoDiario; novo: boolean }>) => void;
  onDeleteMany: (ids: string[]) => void;
  onAviso: (texto: string) => void;
}

export function LancarFrota({ cartoes, dia, equipamentos, registros, funcionarios, frentes, operadores, usuario, onSaveMany, onDeleteMany, onAviso }: Props) {
  const idLista = useId();
  const [rascunhos, setRascunhos] = useState<ReadonlyMap<string, RascunhoQuadro>>(() => new Map());
  const [erros, setErros] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(() => new Set());
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  // Trocar de dia recomeça: rascunho de um dia não vale para outro.
  useEffect(() => {
    setRascunhos(new Map());
    setErros(new Map());
    setMarcadas(new Set());
  }, [dia]);

  const gravado = useMemo(() => new Map(cartoes.map(cartao => [cartao.equipamentoId, rascunhoDoCartao(cartao)])), [cartoes]);
  const valor = (id: string) => rascunhos.get(id) || gravado.get(id)!;
  const mudadas = useMemo(
    () => cartoes.filter(cartao => {
      const rascunho = rascunhos.get(cartao.equipamentoId);
      return rascunho && rascunhoMudou(rascunho, gravado.get(cartao.equipamentoId)!);
    }),
    [cartoes, rascunhos, gravado],
  );
  const alvo = marcadas.size > 0 ? cartoes.filter(cartao => marcadas.has(cartao.equipamentoId)) : [];
  const excluiveis = alvo.filter(cartao => cartao.registroId);
  const todasMarcadas = cartoes.length > 0 && cartoes.every(cartao => marcadas.has(cartao.equipamentoId));

  const mudar = (ids: readonly string[], parcial: Partial<RascunhoQuadro>) => {
    setRascunhos(atual => {
      const proximo = new Map(atual);
      ids.forEach(id => proximo.set(id, { ...(atual.get(id) || gravado.get(id)!), ...parcial }));
      return proximo;
    });
    setErros(atual => {
      if (!ids.some(id => atual.has(id))) return atual;
      const proximo = new Map(atual);
      ids.forEach(id => proximo.delete(id));
      return proximo;
    });
  };
  const marcar = (id: string) => setMarcadas(atual => {
    const proximo = new Set(atual);
    if (proximo.has(id)) proximo.delete(id);
    else proximo.add(id);
    return proximo;
  });
  const idsAlvo = () => alvo.map(cartao => cartao.equipamentoId);

  const repetirUltimoDia = () => {
    const base = alvo.length > 0 ? alvo : cartoes.filter(cartao => cartao.grupo === 'sem-lancamento');
    const copias = rascunhosDoUltimoDia(registros, base.map(cartao => cartao.equipamentoId), dia);
    if (copias.size === 0) {
      onAviso('Nenhuma dessas máquinas tem lançamento anterior para repetir.');
      return;
    }
    setRascunhos(atual => {
      const proximo = new Map(atual);
      copias.forEach((rascunho, id) => proximo.set(id, rascunho));
      return proximo;
    });
    onAviso(`${copias.size} máquina(s) preenchida(s) com o último dia lançado. Confira e toque em Salvar tudo.`);
  };

  const salvarTudo = () => {
    const { prontos, erros: falhas } = lancarEmLote({
      dia,
      hora: horaAgora(),
      agora: new Date().toISOString(),
      usuario,
      equipamentos,
      registros,
      funcionarios,
      rascunhos: mudadas.map(cartao => ({ equipamentoId: cartao.equipamentoId, rascunho: valor(cartao.equipamentoId) })),
    });
    if (prontos.length) onSaveMany(prontos);
    setErros(falhas);
    setRascunhos(atual => {
      const proximo = new Map(atual);
      prontos.forEach(({ registro }) => proximo.delete(registro.equipamentoId));
      return proximo;
    });
    onAviso(falhas.size
      ? `${prontos.length} salva(s). ${falhas.size} precisa(m) de ajuste, marcada(s) em vermelho.`
      : `${prontos.length} máquina(s) lançada(s).`);
  };

  const excluir = () => {
    onDeleteMany(excluiveis.map(cartao => cartao.registroId!));
    setConfirmarExclusao(false);
    setMarcadas(new Set());
    onAviso(`${excluiveis.length} lançamento(s) do dia excluído(s). As máquinas continuam no cadastro.`);
  };

  // Ctrl/Cmd+Enter salva tudo, mesmo padrão do painel do Quadro e do Modal padrão.
  useEffect(() => {
    if (mudadas.length === 0) return undefined;
    const teclar = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        salvarTudo();
      }
    };
    document.addEventListener('keydown', teclar);
    return () => document.removeEventListener('keydown', teclar);
  });

  if (cartoes.length === 0) {
    return <p className={`${CARTAO} px-6 py-12 text-center text-sm text-slate-500`}>Nenhuma máquina com esses filtros.</p>;
  }

  return (
    <section aria-label="Lançar a frota do dia" data-testid="quadro-lancar" className="space-y-3 pb-24">
      <div className={`${CARTAO} space-y-2.5 p-3`} data-quadro-reveal>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            <ListChecks className="size-4" aria-hidden="true" />
            {marcadas.size > 0 ? `${marcadas.size} selecionada(s)` : 'Atalhos'}
          </span>
          <button type="button" onClick={() => setMarcadas(new Set(cartoes.filter(cartao => cartao.grupo === 'sem-lancamento').map(cartao => cartao.equipamentoId)))} className={`${BOTAO_SECUNDARIO} min-h-10 px-3`} data-testid="lancar-sel-pendentes">
            <CheckCheck className="size-4" aria-hidden="true" />
            Selecionar sem lançamento
          </button>
          <button type="button" onClick={repetirUltimoDia} className={`${BOTAO_SECUNDARIO} min-h-10 px-3`} data-testid="lancar-repetir">
            <History className="size-4" aria-hidden="true" />
            Repetir último dia{alvo.length ? '' : ' (sem lançamento)'}
          </button>
          {marcadas.size > 0 && (
            <button type="button" onClick={() => setMarcadas(new Set())} className="inline-flex min-h-10 items-center gap-1 px-2 text-xs font-semibold text-slate-500 hover:text-[#176b4d]">
              <X className="size-3.5" aria-hidden="true" />
              Tirar seleção
            </button>
          )}
        </div>
        {marcadas.size > 0 && (
          <div className="grid gap-2.5 rounded-xl bg-[#f7f8f6] p-2.5 ring-1 ring-inset ring-slate-200 lg:grid-cols-[auto_1fr_auto]" data-testid="lancar-barra-selecao">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Situação das selecionadas">
              {RAPIDAS.map(item => (
                <button key={item.status} type="button" onClick={() => mudar(idsAlvo(), { status: item.status })} className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition hover:ring-emerald-300 active:scale-[0.97] ${FOCO}`} data-testid={`lancar-todas-${item.rotulo.toLowerCase()}`}>
                  <item.Icone className="size-4" aria-hidden="true" />
                  {item.rotulo}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Mover as selecionadas para o canteiro">
              <MapPin className="size-4 text-slate-400" aria-hidden="true" />
              {CANTEIROS.map(canteiro => (
                <button key={canteiro} type="button" onClick={() => mudar(idsAlvo(), { canteiro })} className={`min-h-10 rounded-full bg-white px-3 text-xs font-bold uppercase text-slate-600 ring-1 ring-slate-200 transition hover:bg-emerald-50 hover:text-[#176b4d] hover:ring-emerald-300 active:scale-[0.97] ${FOCO}`} data-testid={`lancar-mover-${canteiro}`}>
                  {canteiro}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setConfirmarExclusao(true)} disabled={excluiveis.length === 0} className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 ${FOCO}`} data-testid="lancar-excluir">
              <Trash2 className="size-4" aria-hidden="true" />
              Excluir lançamento{excluiveis.length ? ` (${excluiveis.length})` : ''}
            </button>
          </div>
        )}
      </div>

      <div className={`${CARTAO} overflow-hidden`} data-quadro-reveal>
        <div className="hidden items-center gap-3 border-b border-slate-200 bg-[#f7f8f6] px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 lg:grid lg:grid-cols-[2.75rem_minmax(13rem,1.2fr)_minmax(17rem,1.3fr)_minmax(9rem,0.9fr)_minmax(9rem,0.9fr)_minmax(11rem,1fr)]">
          <label className="grid size-11 cursor-pointer place-items-center">
            <span className="sr-only">Selecionar todas</span>
            <input type="checkbox" checked={todasMarcadas} onChange={() => setMarcadas(todasMarcadas ? new Set() : new Set(cartoes.map(cartao => cartao.equipamentoId)))} className="size-5 accent-[#176b4d]" data-testid="lancar-sel-todas" />
          </label>
          <span>Máquina</span>
          <span>Situação</span>
          <span>Canteiro</span>
          <span>Frente</span>
          <span>Operador</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {cartoes.map(cartao => {
            const id = cartao.equipamentoId;
            const atual = valor(id);
            const mudou = rascunhos.has(id) && rascunhoMudou(atual, gravado.get(id)!);
            const erro = erros.get(id);
            const tom = TOM[cartao.grupo];
            const outraSituacao = atual.status && !RAPIDAS.some(item => item.status === atual.status);
            return (
              <li
                key={id}
                data-testid={`lancar-linha-${cartao.prefixo}`}
                className={`relative grid gap-3 px-3 py-3 transition-colors duration-300 lg:grid-cols-[2.75rem_minmax(13rem,1.2fr)_minmax(17rem,1.3fr)_minmax(9rem,0.9fr)_minmax(9rem,0.9fr)_minmax(11rem,1fr)] lg:items-center ${erro ? 'bg-rose-50/60' : mudou ? 'bg-emerald-50/50' : marcadas.has(id) ? 'bg-slate-50' : 'bg-white'}`}
              >
                <span className={`absolute inset-y-0 left-0 w-1 ${erro ? 'bg-rose-500' : mudou ? 'bg-[#176b4d]' : 'bg-transparent'}`} aria-hidden="true" />
                <div className="flex items-center gap-3 lg:contents">
                  <label className="grid size-11 shrink-0 cursor-pointer place-items-center">
                    <span className="sr-only">Selecionar {cartao.prefixo}</span>
                    <input type="checkbox" checked={marcadas.has(id)} onChange={() => marcar(id)} className="size-5 accent-[#176b4d]" />
                  </label>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-b ${tom.fundo} ring-1 ring-slate-200`}>
                      {cartao.foto ? <img src={cartao.foto} alt="" className="h-full w-full object-cover" loading="lazy" /> : <DesenhoMaquina tipo={cartao.silhueta} className="h-10 w-14" />}
                    </span>
                    <span className="min-w-0">
                      <strong className="block font-mono text-sm font-bold text-slate-900">{cartao.prefixo}</strong>
                      <span className="block truncate text-[11px] font-semibold uppercase text-slate-500">{cartao.modelo}</span>
                      <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-1.5 text-[10px] font-bold uppercase ring-1 ring-inset ${tom.etiqueta}`}>
                        <span className={`size-1.5 rounded-full ${tom.ponto}`} aria-hidden="true" />
                        {mudou ? 'Não salvo' : ROTULO_GRUPO[cartao.grupo]}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label={`Situação de ${cartao.prefixo}`}>
                    {RAPIDAS.map(item => {
                      const ligado = atual.status === item.status;
                      return (
                        <button key={item.status} type="button" aria-pressed={ligado} onClick={() => mudar([id], { status: item.status })} className={`inline-flex min-h-10 items-center justify-center gap-1 rounded-lg px-1 text-xs font-bold transition duration-200 active:scale-[0.97] ${ligado ? item.ligado : 'text-slate-600 hover:bg-white'} ${FOCO}`} data-testid={`lancar-${cartao.prefixo}-${item.rotulo.toLowerCase()}`}>
                          <item.Icone className="hidden size-3.5 shrink-0 2xl:block" aria-hidden="true" />
                          <span className="truncate">{item.rotulo}</span>
                        </button>
                      );
                    })}
                  </div>
                  {outraSituacao && <span className="text-xs font-semibold text-slate-500">Agora: {atual.status}</span>}
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-500 lg:sr-only">Canteiro</span>
                  <select value={atual.canteiro} onChange={event => mudar([id], { canteiro: event.target.value })} className={CAMPO_LINHA} data-testid={`lancar-${cartao.prefixo}-canteiro`}>
                    <option value="">Sem canteiro</option>
                    {CANTEIROS.map(canteiro => <option key={canteiro} value={canteiro}>{canteiro}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-500 lg:sr-only">Frente</span>
                  <select value={atual.frente} onChange={event => mudar([id], { frente: event.target.value })} className={CAMPO_LINHA}>
                    <option value="">Sem frente</option>
                    {Array.from(new Set([...frentes, ...(atual.frente ? [atual.frente] : [])])).map(frente => <option key={frente} value={frente}>{frente}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-500 lg:sr-only">Operador</span>
                  <input value={atual.operador} onChange={event => mudar([id], { operador: event.target.value })} list={idLista} placeholder="Nome do operador" autoComplete="off" className={CAMPO_LINHA} data-testid={`lancar-${cartao.prefixo}-operador`} />
                </label>
                {(EM_MANUTENCAO.has(atual.status) || erro) && (
                  <div className="grid gap-2 lg:col-span-6 lg:grid-cols-[2.75rem_1fr] lg:gap-3">
                    <span className="hidden lg:block" />
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,24rem)_1fr] sm:items-center">
                      {EM_MANUTENCAO.has(atual.status) && (
                        <input value={atual.motivoManutencao} onChange={event => mudar([id], { motivoManutencao: event.target.value })} placeholder="Motivo da manutenção" aria-label={`Motivo da manutenção de ${cartao.prefixo}`} className={CAMPO_LINHA} data-testid={`lancar-${cartao.prefixo}-motivo`} />
                      )}
                      {erro && <p role="alert" className="text-sm font-semibold text-rose-700">{erro}</p>}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <datalist id={idLista}>
          {operadores.map(nome => <option key={nome} value={nome} />)}
        </datalist>
      </div>

      {mudadas.length > 0 && (
        <div className="fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl bg-white p-2.5 shadow-[0_18px_40px_-16px_rgba(15,40,31,0.45)] ring-1 ring-slate-200" data-testid="lancar-barra-salvar">
          <span className="flex items-center gap-2 px-2 text-sm font-bold text-slate-800">
            <CopyCheck className="size-4 text-[#176b4d]" aria-hidden="true" />
            {mudadas.length} alteração(ões) não salva(s)
          </span>
          <button type="button" onClick={() => { setRascunhos(new Map()); setErros(new Map()); }} className={`${BOTAO_SECUNDARIO} ml-auto min-h-11`} data-testid="lancar-desfazer">
            <RotateCcw className="size-4" aria-hidden="true" />
            Desfazer
          </button>
          <button type="button" onClick={salvarTudo} className={`${BOTAO_PRIMARIO} min-h-11 px-5`} data-testid="lancar-salvar-tudo">
            <Save className="size-4" aria-hidden="true" />
            Salvar tudo
            <kbd className="hidden rounded-md bg-white/15 px-1.5 font-mono text-xs xl:inline">Ctrl+Enter</kbd>
          </button>
        </div>
      )}

      <Modal
        open={confirmarExclusao}
        title={`Excluir ${excluiveis.length} lançamento(s) de hoje?`}
        size="sm"
        onClose={() => setConfirmarExclusao(false)}
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmarExclusao(false)} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button type="button" onClick={excluir} className={BOTAO_PERIGO} data-testid="lancar-confirmar-exclusao">Excluir lançamento</button>
          </div>
        )}
      >
        <p className="text-sm text-slate-600">Some só o lançamento deste dia. As máquinas continuam no cadastro e voltam para "Sem lançamento".</p>
        <p className="mt-3 font-mono text-sm font-bold text-slate-800">{excluiveis.map(cartao => cartao.prefixo).join(', ')}</p>
      </Modal>
    </section>
  );
}
