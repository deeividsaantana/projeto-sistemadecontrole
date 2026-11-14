import { useEffect, useRef, useState } from 'react';
import type { PlanejamentoItem, RegistroProducao } from '../../types';
import { Modal } from '../../shared/ui/Modal';
import { Campo } from '../../shared/ui/Lancamento';
import { BOTAO_PERIGO_LEVE, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO } from '../cadastros/estilos';
import { formatarData } from '../../utils/formato';
import {
  diasDeTrabalho,
  metaAutomatica,
  metaDiariaDe,
  observacaoSemCarga,
  type ResumoAtividade,
} from '../../utils/programacao';
import { BarraAvanco, SeloSituacao, numeroObra } from './visual';

export const UNIDADES = ['M', 'M²', 'M³', 'UN', 'T'] as const;

interface Formulario {
  frente: string;
  servico: string;
  responsavel: string;
  inicio: string;
  fim: string;
  quantidade: string;
  unidade: string;
  meta: string;
  estacaInicial: string;
  estacaFinal: string;
  equipamentos: string;
  observacao: string;
}

interface Props {
  aberto: boolean;
  /** Atividade aberta; sem ela o diálogo cria uma nova. */
  resumo: ResumoAtividade | null;
  producao: readonly RegistroProducao[];
  hoje: string;
  podeEditar: boolean;
  sugestoes: { frentes: string[]; servicos: string[]; responsaveis: string[] };
  onFechar: () => void;
  onSalvar: (item: PlanejamentoItem, nova: boolean) => void;
  onLancar: (item: PlanejamentoItem, quantidade: number, data: string, observacao: string) => void;
}

const slug = (valor: string) => valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** "1.234,5" e "158.5" viram número; vazio vira NaN. */
const numeroDigitado = (valor: string) => Number(valor.includes(',') ? valor.replace(/\./g, '').replace(',', '.') : valor);
const paraCampo = (valor?: number) => (valor === undefined || valor === null ? '' : String(valor).replace('.', ','));

const vazio = (hoje: string): Formulario => ({
  frente: '', servico: '', responsavel: '', inicio: hoje, fim: hoje, quantidade: '', unidade: 'M', meta: '',
  estacaInicial: '', estacaFinal: '', equipamentos: '', observacao: '',
});

const doItem = (item: PlanejamentoItem): Formulario => ({
  frente: item.frente || '',
  servico: item.servicoDescricao,
  responsavel: item.responsavel || item.equipeNome || '',
  inicio: item.dataInicio,
  fim: item.dataFim,
  quantidade: paraCampo(item.quantidadePlanejada),
  unidade: item.unidade,
  // A meta que veio no texto da carga original passa a ser campo.
  meta: item.metaDiaria ? paraCampo(item.metaDiaria) : metaDiariaDe(item) !== metaAutomatica(item.quantidadePlanejada, item.dataInicio, item.dataFim) ? paraCampo(metaDiariaDe(item)) : '',
  estacaInicial: item.estacaInicial || '',
  estacaFinal: item.estacaFinal || '',
  equipamentos: item.equipamentos || '',
  observacao: observacaoSemCarga(item.observacao),
});

export function AtividadeModal({ aberto, resumo, producao, hoje, podeEditar, sugestoes, onFechar, onSalvar, onLancar }: Props) {
  const item = resumo?.item ?? null;
  const [form, setForm] = useState<Formulario>(() => (item ? doItem(item) : vazio(hoje)));
  const [erros, setErros] = useState<Partial<Record<keyof Formulario, string>>>({});
  const [lancamento, setLancamento] = useState({ quantidade: '', data: hoje, observacao: '' });
  const primeiroCampo = useRef<HTMLInputElement>(null);
  const campoProducao = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aberto) return;
    setForm(item ? doItem(item) : vazio(hoje));
    setErros({});
    setLancamento({ quantidade: '', data: hoje, observacao: '' });
    // Reabre só quando troca a atividade, não a cada lançamento salvo.
  }, [aberto, item?.id]);

  const mudar = (campo: keyof Formulario, valor: string) => {
    setForm(atual => ({ ...atual, [campo]: valor }));
    if (erros[campo]) setErros(atual => ({ ...atual, [campo]: undefined }));
  };

  const quantidade = numeroDigitado(form.quantidade);
  const dias = form.inicio && form.fim && form.fim >= form.inicio ? diasDeTrabalho(form.inicio, form.fim) : 0;
  const metaCalculada = quantidade > 0 && dias ? metaAutomatica(quantidade, form.inicio, form.fim) : 0;
  const somenteLeitura = !podeEditar;

  const salvar = (situacao?: PlanejamentoItem['situacao']) => {
    if (somenteLeitura) return;
    const novos: typeof erros = {};
    if (!form.frente.trim()) novos.frente = 'Informe a frente (ex.: RAMO 1400).';
    if (!form.servico.trim()) novos.servico = 'Informe o serviço.';
    if (!form.responsavel.trim()) novos.responsavel = 'Informe o encarregado.';
    if (!form.inicio) novos.inicio = 'Informe o início.';
    if (!form.fim) novos.fim = 'Informe o término.';
    else if (form.inicio && form.fim < form.inicio) novos.fim = 'O término é antes do início.';
    if (!(quantidade > 0)) novos.quantidade = 'Informe a quantidade total.';
    if (form.meta.trim() && !(numeroDigitado(form.meta) > 0)) novos.meta = 'A meta precisa ser um número maior que zero.';
    setErros(novos);
    if (Object.keys(novos).length) return;
    const agora = new Date().toISOString();
    const servico = form.servico.trim().toUpperCase();
    const frente = form.frente.trim().toUpperCase();
    const meta = form.meta.trim() ? numeroDigitado(form.meta) : undefined;
    const base: PlanejamentoItem = item ?? {
      id: `programacao-${slug(frente)}-${slug(servico)}-${Date.now().toString(36)}`,
      servicoId: `servico-${slug(servico)}`,
      servicoDescricao: servico,
      unidade: form.unidade,
      quantidadePlanejada: quantidade,
      dataInicio: form.inicio,
      dataFim: form.fim,
      responsavel: '',
      situacao: 'Planejado',
      ativo: true,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    onSalvar({
      ...base,
      servicoId: base.servicoDescricao === servico ? base.servicoId : `servico-${slug(servico)}`,
      servicoDescricao: servico,
      frente,
      responsavel: form.responsavel.trim().toUpperCase(),
      equipeNome: form.responsavel.trim().toUpperCase(),
      dataInicio: form.inicio,
      dataFim: form.fim,
      quantidadePlanejada: quantidade,
      unidade: form.unidade,
      metaDiaria: meta,
      estacaInicial: form.estacaInicial.trim() || undefined,
      estacaFinal: form.estacaFinal.trim() || undefined,
      equipamentos: form.equipamentos.trim() || undefined,
      observacao: form.observacao.trim() || undefined,
      situacao: situacao ?? (base.situacao === 'Cancelado' ? 'Planejado' : base.situacao),
      ativo: true,
      atualizadoEm: agora,
    }, !item);
  };

  const lancar = () => {
    const valor = numeroDigitado(lancamento.quantidade);
    if (!item || !(valor > 0) || !lancamento.data) return;
    onLancar(item, valor, lancamento.data, lancamento.observacao.trim());
    setLancamento(atual => ({ ...atual, quantidade: '', observacao: '' }));
    campoProducao.current?.focus();
  };

  const daAtividade = producao.slice().sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm)).slice(0, 8);
  const datalist = (id: string, lista: string[]) => (
    <datalist id={id}>{lista.map(valor => <option key={valor} value={valor} />)}</datalist>
  );

  return (
    <Modal
      open={aberto}
      title={item ? `${item.frente || 'Sem frente'} · ${item.servicoDescricao}` : 'Nova atividade'}
      description={item ? undefined : 'Preencha o que a equipe vai fazer. A meta por dia é calculada sozinha.'}
      size="lg"
      onClose={onFechar}
      onSubmit={somenteLeitura ? undefined : () => salvar()}
      initialFocusRef={item ? campoProducao : primeiroCampo}
      footer={(
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {item && podeEditar && item.situacao !== 'Cancelado' && (
            <button type="button" onClick={() => salvar('Cancelado')} className={`${BOTAO_PERIGO_LEVE} sm:mr-auto`}>Cancelar atividade</button>
          )}
          {item && podeEditar && resumo?.situacao !== 'concluida' && item.situacao !== 'Cancelado' && (
            <button type="button" onClick={() => salvar('Concluído')} className={BOTAO_SECUNDARIO}>Marcar como concluída</button>
          )}
          <button type="button" onClick={onFechar} className={`${BOTAO_SECUNDARIO} ${!item || !podeEditar ? 'sm:ml-auto' : ''}`}>Fechar</button>
          {podeEditar && (
            <button type="button" onClick={() => salvar()} className={BOTAO_PRIMARIO} data-testid="programacao-salvar">
              {item?.situacao === 'Cancelado' ? 'Reativar e salvar' : item ? 'Salvar alterações' : 'Criar atividade'}
            </button>
          )}
        </div>
      )}
    >
      <div className="grid gap-5">
        {resumo && item && (
          <section aria-label="Andamento" className="grid gap-3 rounded-2xl border border-slate-200 bg-[#f7f8f6] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SeloSituacao situacao={resumo.situacao} />
              <span className="text-sm font-semibold text-slate-700">
                {formatarData(item.dataInicio)} a {formatarData(item.dataFim)} · {resumo.dias} dias de trabalho
              </span>
            </div>
            <BarraAvanco percentual={resumo.percentual} situacao={resumo.situacao} />
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Feito', `${numeroObra(resumo.realizado)} ${item.unidade}`],
                ['Falta', `${numeroObra(resumo.saldo)} ${item.unidade}`],
                ['Meta por dia', `${numeroObra(resumo.meta)} ${item.unidade}`],
                ['Precisa por dia', resumo.saldo > 0 ? `${numeroObra(resumo.precisaPorDia)} ${item.unidade}` : '—'],
              ].map(([rotulo, valor]) => (
                <div key={rotulo}>
                  <dt className="text-xs font-bold uppercase text-[#5b6870]">{rotulo}</dt>
                  <dd className="text-lg font-black tabular-nums text-slate-900">{valor}</dd>
                </div>
              ))}
            </dl>

            {podeEditar && item.situacao !== 'Cancelado' && (
              <div className="grid gap-2 border-t border-slate-200 pt-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
                <Campo rotulo={`Lançar produção (${item.unidade})`} para="prog-lancar-qtd">
                  <input
                    id="prog-lancar-qtd"
                    ref={campoProducao}
                    inputMode="decimal"
                    value={lancamento.quantidade}
                    onChange={event => setLancamento(atual => ({ ...atual, quantidade: event.target.value }))}
                    onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); lancar(); } }}
                    placeholder="Quanto foi feito"
                    className={`${CAMPO} font-bold tabular-nums`}
                  />
                </Campo>
                <Campo rotulo="Dia" para="prog-lancar-dia">
                  <input id="prog-lancar-dia" type="date" max={hoje} value={lancamento.data} onChange={event => setLancamento(atual => ({ ...atual, data: event.target.value }))} className={CAMPO} />
                </Campo>
                <button type="button" onClick={lancar} disabled={!(numeroDigitado(lancamento.quantidade) > 0)} className={BOTAO_PRIMARIO}>Lançar</button>
                <Campo rotulo="Observação do dia (opcional)" para="prog-lancar-obs" className="sm:col-span-3">
                  <input id="prog-lancar-obs" value={lancamento.observacao} onChange={event => setLancamento(atual => ({ ...atual, observacao: event.target.value }))} placeholder="Chuva, quebra, falta de material…" className={CAMPO} />
                </Campo>
              </div>
            )}

            {daAtividade.length > 0 && (
              <details className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <summary className="cursor-pointer font-bold text-slate-800">Últimos lançamentos ({producao.length})</summary>
                <ul className="mt-2 divide-y divide-slate-100">
                  {daAtividade.map(registro => (
                    <li key={registro.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                      <span className="font-semibold text-slate-700">{formatarData(registro.data)} · {registro.responsavel}</span>
                      <span className="font-bold tabular-nums text-slate-900">{numeroObra(registro.quantidade)} {registro.unidade}</span>
                      {registro.observacao && <span className="w-full text-xs text-[#5b6870]">{registro.observacao}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        <fieldset disabled={somenteLeitura} className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-black uppercase text-slate-800">{item ? 'Dados da atividade' : 'O que vai ser feito'}</legend>
          <Campo rotulo="Frente" para="prog-frente" obrigatorio erro={erros.frente}>
            <input id="prog-frente" ref={primeiroCampo} list="prog-frentes" value={form.frente} onChange={event => mudar('frente', event.target.value)} placeholder="RAMO 1400" aria-invalid={Boolean(erros.frente)} className={CAMPO} />
          </Campo>
          <Campo rotulo="Serviço" para="prog-servico" obrigatorio erro={erros.servico}>
            <input id="prog-servico" list="prog-servicos" value={form.servico} onChange={event => mudar('servico', event.target.value)} placeholder="SUB BASE" aria-invalid={Boolean(erros.servico)} className={CAMPO} />
          </Campo>
          <Campo rotulo="Encarregado" para="prog-responsavel" obrigatorio erro={erros.responsavel}>
            <input id="prog-responsavel" list="prog-responsaveis" value={form.responsavel} onChange={event => mudar('responsavel', event.target.value)} placeholder="Quem toca a equipe" aria-invalid={Boolean(erros.responsavel)} className={CAMPO} />
          </Campo>
          <Campo rotulo="Equipamentos" para="prog-equipamentos">
            <input id="prog-equipamentos" value={form.equipamentos} onChange={event => mudar('equipamentos', event.target.value)} placeholder="Escavadeira 320, rolo, 2 caminhões" className={CAMPO} />
          </Campo>
          <Campo rotulo="Início" para="prog-inicio" obrigatorio erro={erros.inicio}>
            <input id="prog-inicio" type="date" value={form.inicio} onChange={event => mudar('inicio', event.target.value)} aria-invalid={Boolean(erros.inicio)} className={CAMPO} />
          </Campo>
          <Campo rotulo="Término" para="prog-fim" obrigatorio erro={erros.fim} dica={dias ? `${dias} ${dias === 1 ? 'dia' : 'dias'} de trabalho, sem domingos` : undefined}>
            <input id="prog-fim" type="date" min={form.inicio} value={form.fim} onChange={event => mudar('fim', event.target.value)} aria-invalid={Boolean(erros.fim)} className={CAMPO} />
          </Campo>
          <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
            <Campo rotulo="Quantidade total" para="prog-quantidade" obrigatorio erro={erros.quantidade}>
              <input id="prog-quantidade" inputMode="decimal" value={form.quantidade} onChange={event => mudar('quantidade', event.target.value)} placeholder="157" aria-invalid={Boolean(erros.quantidade)} className={`${CAMPO} tabular-nums`} />
            </Campo>
            <Campo rotulo="Unidade" para="prog-unidade">
              <select id="prog-unidade" value={form.unidade} onChange={event => mudar('unidade', event.target.value)} className={CAMPO}>
                {[...new Set([...UNIDADES, form.unidade])].map(unidade => <option key={unidade}>{unidade}</option>)}
              </select>
            </Campo>
          </div>
          <Campo rotulo="Meta por dia" para="prog-meta" erro={erros.meta} dica={metaCalculada ? `Em branco, usa a automática: ${numeroObra(metaCalculada)} ${form.unidade} por dia.` : 'Em branco, o sistema calcula.'}>
            <input id="prog-meta" inputMode="decimal" value={form.meta} onChange={event => mudar('meta', event.target.value)} placeholder={metaCalculada ? `${numeroObra(metaCalculada)} (automática)` : 'Automática'} aria-invalid={Boolean(erros.meta)} className={`${CAMPO} tabular-nums`} />
          </Campo>
          <Campo rotulo="Estaca inicial" para="prog-est-ini">
            <input id="prog-est-ini" value={form.estacaInicial} onChange={event => mudar('estacaInicial', event.target.value)} placeholder="1401+10" className={CAMPO} />
          </Campo>
          <Campo rotulo="Estaca final" para="prog-est-fim">
            <input id="prog-est-fim" value={form.estacaFinal} onChange={event => mudar('estacaFinal', event.target.value)} placeholder="1409+7" className={CAMPO} />
          </Campo>
          <Campo rotulo="Observação" para="prog-obs" className="sm:col-span-2">
            <textarea id="prog-obs" rows={2} value={form.observacao} onChange={event => mudar('observacao', event.target.value)} placeholder="Interferência, prioridade, combinado com a fiscalização…" className={`${CAMPO} py-2`} />
          </Campo>
        </fieldset>
        {datalist('prog-frentes', sugestoes.frentes)}
        {datalist('prog-servicos', sugestoes.servicos)}
        {datalist('prog-responsaveis', sugestoes.responsaveis)}
      </div>
    </Modal>
  );
}
