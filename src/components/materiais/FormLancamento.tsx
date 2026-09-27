import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, CheckCircle2, RotateCcw, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import type { Empresa, EtapaServico, Material, MovimentoMaterial, TipoMovimentoMaterial } from '../../types';
import { saldoDoMaterial, validarMovimento } from '../../utils/estoque';
import { formatarData, numero } from '../../utils/formato';
import { lerNumeroBR, recentes } from '../../modules/materials/lancamentoRapido';
import { Modal } from '../../shared/ui';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, FOCO, ROTULO } from '../cadastros/estilos';
import CampoEscolha from './CampoEscolha';

const TIPOS: ReadonlyArray<{ id: TipoMovimentoMaterial; nome: string; ajuda: string; Icone: LucideIcon }> = [
  { id: 'Entrada', nome: 'Entrada', ajuda: 'Chegou na obra', Icone: ArrowDownToLine },
  { id: 'Saída', nome: 'Saída', ajuda: 'Foi usado ou saiu', Icone: ArrowUpFromLine },
  { id: 'Transferência', nome: 'Transporte', ajuda: 'Mudou de lugar', Icone: ArrowLeftRight },
  { id: 'Ajuste', nome: 'Ajuste', ajuda: 'Corrige o saldo', Icone: SlidersHorizontal },
];

interface Formulario {
  data: string;
  tipo: TipoMovimentoMaterial;
  materialId: string;
  quantidade: string;
  fornecedorId: string;
  notaFiscal: string;
  quantidadeNota: string;
  placa: string;
  ticket: string;
  origem: string;
  destino: string;
  etapaServicoId: string;
  servico: string;
  consumo: boolean;
  fatorConversao: string;
  valorUnitario: string;
  valorTotal: string;
  solicitacaoCompra: string;
  observacao: string;
}

const texto = (valor?: number) => (valor ? String(valor).replace('.', ',') : '');
// "12,5" e "12.5" valem 12,5: ponto sozinho é decimal, não milhar.
const numeroDigitado = (valor: string) => lerNumeroBR(valor) ?? 0;

const formularioNovo = (hoje: string): Formulario => ({
  data: hoje, tipo: 'Entrada', materialId: '', quantidade: '', fornecedorId: '', notaFiscal: '', quantidadeNota: '', placa: '', ticket: '',
  origem: '', destino: '', etapaServicoId: '', servico: '', consumo: false, fatorConversao: '', valorUnitario: '', valorTotal: '', solicitacaoCompra: '', observacao: '',
});

const formularioDe = (movimento: MovimentoMaterial): Formulario => ({
  data: movimento.data,
  tipo: movimento.tipo,
  materialId: movimento.materialId,
  quantidade: texto(movimento.quantidade),
  fornecedorId: movimento.fornecedorId || '',
  notaFiscal: movimento.notaFiscal || '',
  quantidadeNota: texto(movimento.quantidadeNota),
  placa: movimento.placa || '',
  ticket: movimento.ticket || '',
  origem: movimento.origem || '',
  destino: movimento.destino || '',
  etapaServicoId: movimento.etapaServicoId || '',
  servico: movimento.servico || '',
  consumo: movimento.finalidade === 'Consumo',
  fatorConversao: texto(movimento.fatorConversao),
  valorUnitario: texto(movimento.valorUnitario),
  valorTotal: texto(movimento.valorTotal),
  solicitacaoCompra: movimento.solicitacaoCompra || '',
  observacao: movimento.observacao || '',
});

/** O que muda de uma viagem para outra some; data, tipo, material, fornecedor e destino ficam. */
const proximoFormulario = (atual: Formulario): Formulario => ({
  ...atual, quantidade: '', notaFiscal: '', quantidadeNota: '', placa: '', ticket: '', valorTotal: '', solicitacaoCompra: '', observacao: '',
});

interface Props {
  aberto: boolean;
  /** Com um movimento, a janela edita; sem, lança um novo. */
  editando: MovimentoMaterial | null;
  hoje: string;
  materiais: readonly Material[];
  movimentos: MovimentoMaterial[];
  empresas: readonly Empresa[];
  etapas: readonly EtapaServico[];
  responsavel: string;
  onSalvar: (movimento: MovimentoMaterial, novo: boolean) => void;
  onFechar: () => void;
}

/**
 * Janela de lançamento: tipo em botões grandes, material achado digitando, o
 * saldo antes e depois na hora, e "Salvar e lançar outro" para quem lança uma
 * viagem atrás da outra sem ter que preencher tudo de novo.
 */
export default function FormLancamento({ aberto, editando, hoje, materiais, movimentos, empresas, etapas, responsavel, onSalvar, onFechar }: Props) {
  const [form, setForm] = useState<Formulario>(() => formularioNovo(hoje));
  const [voltarAValer, setVoltarAValer] = useState(false);
  const [maisCampos, setMaisCampos] = useState(false);
  const [erro, setErro] = useState('');
  const [lancado, setLancado] = useState('');
  const quantidadeRef = useRef<HTMLInputElement>(null);

  // Ao abrir: editar carrega o movimento; lançar novo mantém o que ficou da última vez.
  useEffect(() => {
    if (!aberto) return;
    setErro('');
    setLancado('');
    setVoltarAValer(false);
    if (editando) {
      setForm(formularioDe(editando));
      setMaisCampos(Boolean(editando.fatorConversao || editando.valorUnitario || editando.valorTotal || editando.solicitacaoCompra || editando.observacao));
    } else {
      setForm(atual => (atual.materialId ? proximoFormulario(atual) : formularioNovo(hoje)));
    }
  }, [aberto, editando, hoje]);

  const ativos = useMemo(() => materiais.filter(item => item.ativo !== false || item.id === editando?.materialId), [materiais, editando?.materialId]);
  const opcoesMaterial = useMemo(() => ativos.map(item => ({ id: item.id, nome: item.descricao, apelido: [item.codigo, item.categoria].filter(Boolean).join(' · ') })), [ativos]);
  const opcoesFornecedor = useMemo(() => empresas.map(item => ({ id: item.id, nome: item.nome })), [empresas]);
  const materiaisRecentes = useMemo(() => (aberto ? recentes(movimentos, item => item.materialId) : []), [aberto, movimentos]);
  const fornecedoresRecentes = useMemo(() => (aberto ? recentes(movimentos, item => item.fornecedorId) : []), [aberto, movimentos]);
  const destinosRecentes = useMemo(() => (aberto ? recentes(movimentos, item => item.destino, 12) : []), [aberto, movimentos]);

  const material = materiais.find(item => item.id === form.materialId);
  const quantidade = numeroDigitado(form.quantidade);
  const outros = editando ? movimentos.filter(item => item.id !== editando.id) : movimentos;
  const saldoAgora = material ? saldoDoMaterial(outros, material.id) : 0;
  const efeito = form.tipo === 'Entrada' ? Math.abs(quantidade) : form.tipo === 'Saída' ? -Math.abs(quantidade) : form.tipo === 'Ajuste' ? quantidade : 0;
  const desfeito = Boolean(editando?.canceladoEm) && !voltarAValer;
  const saldoDepois = saldoAgora + (desfeito ? 0 : efeito);
  const minimo = Number(material?.estoqueMinimo || 0);
  const totalCalculado = numeroDigitado(form.valorUnitario) * Math.abs(quantidade);

  const mudar = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => setForm(atual => ({ ...atual, [campo]: valor }));

  const escolherMaterial = (id: string) => {
    const escolhido = materiais.find(item => item.id === id);
    setForm(atual => ({
      ...atual,
      materialId: id,
      // Entrada sem fornecedor puxa o fornecedor padrão do material.
      fornecedorId: atual.fornecedorId || (atual.tipo === 'Entrada' ? escolhido?.fornecedorPadraoId || '' : ''),
    }));
  };

  const montar = (): MovimentoMaterial | null => {
    if (!material) { setErro('Escolha o material.'); return null; }
    const id = editando?.id ?? `mov-${Date.now()}`;
    const problema = validarMovimento(movimentos, { id, tipo: form.tipo, materialId: material.id, quantidade });
    if (problema) { setErro(problema); return null; }
    const fornecedor = form.tipo === 'Entrada' ? empresas.find(item => item.id === form.fornecedorId) : undefined;
    const etapa = form.tipo !== 'Ajuste' ? etapas.find(item => item.id === form.etapaServicoId) : undefined;
    const valorUnitario = numeroDigitado(form.valorUnitario);
    const valorTotal = numeroDigitado(form.valorTotal) || (valorUnitario ? Number((valorUnitario * Math.abs(quantidade)).toFixed(2)) : 0);
    const base: MovimentoMaterial = editando ? { ...editando } : { id, criadoEm: new Date().toISOString(), responsavel } as MovimentoMaterial;
    const movimento: MovimentoMaterial = {
      ...base,
      data: form.data || hoje,
      tipo: form.tipo,
      materialId: material.id,
      materialDescricao: material.descricao,
      quantidade,
      unidade: material.unidade,
      fornecedorId: fornecedor?.id,
      fornecedorNome: fornecedor?.nome,
      notaFiscal: form.tipo === 'Entrada' ? form.notaFiscal.trim() || undefined : undefined,
      // O que a nota prometeu, só na entrada: é o que mostra depois que faltou carga.
      quantidadeNota: form.tipo === 'Entrada' && numeroDigitado(form.quantidadeNota) > 0 ? numeroDigitado(form.quantidadeNota) : undefined,
      solicitacaoCompra: form.tipo === 'Entrada' ? form.solicitacaoCompra.trim() || undefined : undefined,
      placa: form.tipo !== 'Ajuste' ? form.placa.trim().toUpperCase() || undefined : undefined,
      ticket: form.tipo !== 'Ajuste' ? form.ticket.trim() || undefined : undefined,
      origem: form.tipo === 'Transferência' ? form.origem.trim() || undefined : undefined,
      destino: form.tipo !== 'Ajuste' ? form.destino.trim() || etapa?.nome || undefined : undefined,
      etapaServicoId: etapa?.id,
      etapaServicoNome: etapa?.nome,
      servico: form.tipo === 'Saída' ? form.servico.trim() || undefined : undefined,
      finalidade: form.tipo === 'Saída' && form.consumo ? 'Consumo' : undefined,
      fatorConversao: numeroDigitado(form.fatorConversao) > 0 ? numeroDigitado(form.fatorConversao) : undefined,
      valorUnitario: valorUnitario > 0 ? valorUnitario : undefined,
      valorTotal: valorTotal > 0 ? valorTotal : undefined,
      observacao: form.observacao.trim() || undefined,
    };
    if (voltarAValer) {
      delete movimento.canceladoEm;
      delete movimento.canceladoPor;
    }
    return movimento;
  };

  const registrar = () => {
    const movimento = montar();
    if (!movimento) return;
    onSalvar(movimento, !editando);
    if (!editando) setForm(proximoFormulario);
    onFechar();
  };

  const registrarEOutro = () => {
    const movimento = montar();
    if (!movimento) return;
    onSalvar(movimento, true);
    setLancado(`Lançado: ${TIPOS.find(item => item.id === movimento.tipo)?.nome.toLocaleLowerCase('pt-BR')} de ${numero(Math.abs(movimento.quantidade))} ${movimento.unidade} de ${movimento.materialDescricao}. Pode lançar a próxima.`);
    setErro('');
    setForm(proximoFormulario);
    quantidadeRef.current?.focus();
  };

  // Shift+Enter salva e já deixa pronto para a próxima viagem.
  const teclar = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && event.shiftKey && !editando && (event.target as HTMLElement).tagName !== 'TEXTAREA') {
      event.preventDefault();
      event.stopPropagation();
      registrarEOutro();
    }
  };

  const tomSaldo = saldoDepois < 0 ? 'text-rose-700' : minimo > 0 && saldoDepois < minimo ? 'text-amber-700' : 'text-slate-900';

  return (
    <Modal
      open={aberto}
      title={editando ? 'Editar lançamento' : 'Novo lançamento'}
      size="md"
      telaCheia="materiais-lancamento"
      onSubmit={registrar}
      onClose={onFechar}
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onFechar} className={BOTAO_SECUNDARIO}>Cancelar</button>
          {!editando && (
            <button type="button" onClick={registrarEOutro} className={BOTAO_SECUNDARIO} data-testid="materiais-lancar-outro">
              Salvar e lançar outro
              <kbd className="hidden rounded border border-slate-200 px-1.5 text-xs font-semibold text-slate-500 lg:inline">Shift+Enter</kbd>
            </button>
          )}
          <button type="button" onClick={registrar} className={`${BOTAO_PRIMARIO} px-5`} data-testid="materiais-registrar">
            {editando ? 'Salvar alteração' : 'Registrar'}
          </button>
        </div>
      )}
    >
      <div className="space-y-4" onKeyDown={teclar}>
        {lancado && (
          <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#176b4d]" aria-hidden="true" />
            {lancado}
          </p>
        )}

        {editando?.canceladoEm && (
          <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <p>
              {voltarAValer
                ? 'Ao salvar, este lançamento volta a contar no saldo.'
                : `Desfeito em ${formatarData(editando.canceladoEm.slice(0, 10))}${editando.canceladoPor ? ` por ${editando.canceladoPor}` : ''}. Não conta no saldo.`}
            </p>
            {!voltarAValer && (
              <button type="button" onClick={() => setVoltarAValer(true)} className={`${BOTAO_SECUNDARIO} shrink-0`}>
                <RotateCcw className="size-4" aria-hidden="true" />
                Voltar a valer
              </button>
            )}
          </div>
        )}

        <fieldset>
          <legend className={ROTULO}>O que aconteceu?</legend>
          <div role="radiogroup" className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TIPOS.map(({ id, nome, ajuda, Icone }) => {
              const ativo = form.tipo === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => setForm(atual => ({ ...atual, tipo: id, consumo: id === 'Saída' ? atual.consumo : false }))}
                  className={`flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-xl border px-3 py-2 text-left transition duration-200 ${FOCO} ${ativo
                    ? 'border-[#176b4d] bg-[#176b4d] text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500'}`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-bold"><Icone className="size-4" aria-hidden="true" />{nome}</span>
                  <span className={`text-xs ${ativo ? 'text-white/80' : 'text-slate-500'}`}>{ajuda}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="lancamento-material" className={ROTULO}>Material</label>
          <div className="mt-1">
            <CampoEscolha
              id="lancamento-material"
              testId="lancamento-material"
              opcoes={opcoesMaterial}
              recentes={materiaisRecentes}
              valor={form.materialId}
              onEscolher={escolherMaterial}
              placeholder="Digite o nome ou o código"
              onEnter={() => quantidadeRef.current?.focus()}
            />
          </div>
          {material && (
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600" aria-live="polite">
              <span>Saldo agora: <strong className="tabular-nums text-slate-900">{numero(saldoAgora)} {material.unidade}</strong></span>
              {quantidade !== 0 && form.tipo !== 'Transferência' && (
                <span>Depois deste lançamento: <strong className={`tabular-nums ${tomSaldo}`}>{numero(saldoDepois)} {material.unidade}</strong></span>
              )}
              {minimo > 0 && <span>Mínimo: <span className="tabular-nums">{numero(minimo)}</span></span>}
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`block ${ROTULO}`}>
            Quantidade{material ? ` (${material.unidade})` : ''}
            <input
              ref={quantidadeRef}
              inputMode="decimal"
              value={form.quantidade}
              onChange={event => mudar('quantidade', event.target.value)}
              placeholder={form.tipo === 'Ajuste' ? 'Use - para baixar' : 'Ex: 12,5'}
              data-testid="lancamento-quantidade"
              className={`mt-1 ${CAMPO} text-lg font-bold tabular-nums`}
            />
          </label>
          <label className={`block ${ROTULO}`}>
            Data
            <input type="date" value={form.data} onChange={event => mudar('data', event.target.value)} className={`mt-1 ${CAMPO}`} />
          </label>

          {form.tipo === 'Entrada' && (
            <>
              <div className="sm:col-span-2">
                <label htmlFor="lancamento-fornecedor" className={ROTULO}>Fornecedor</label>
                <div className="mt-1">
                  <CampoEscolha id="lancamento-fornecedor" opcoes={opcoesFornecedor} recentes={fornecedoresRecentes} valor={form.fornecedorId} onEscolher={id => mudar('fornecedorId', id)} vazio="Sem fornecedor informado" placeholder="Digite o nome do fornecedor" />
                </div>
              </div>
              <label className={`block ${ROTULO}`}>
                Nota fiscal
                <input value={form.notaFiscal} onChange={event => mudar('notaFiscal', event.target.value)} inputMode="numeric" className={`mt-1 ${CAMPO}`} />
              </label>
              <label className={`block ${ROTULO}`}>
                Quantidade na nota
                <input inputMode="decimal" value={form.quantidadeNota} onChange={event => mudar('quantidadeNota', event.target.value)} placeholder="Se for diferente do que chegou" className={`mt-1 ${CAMPO}`} />
              </label>
            </>
          )}

          {form.tipo !== 'Ajuste' && (
            <>
              <label className={`block ${ROTULO}`}>
                Placa
                <input value={form.placa} onChange={event => mudar('placa', event.target.value.toUpperCase())} placeholder="ABC1D23" className={`mt-1 ${CAMPO} uppercase`} />
              </label>
              <label className={`block ${ROTULO}`}>
                Ticket ou vale
                <input value={form.ticket} onChange={event => mudar('ticket', event.target.value)} className={`mt-1 ${CAMPO}`} />
              </label>
            </>
          )}

          {form.tipo === 'Transferência' && (
            <label className={`block ${ROTULO} sm:col-span-2`}>
              De onde saiu
              <input value={form.origem} onChange={event => mudar('origem', event.target.value)} list="lancamento-destinos" className={`mt-1 ${CAMPO}`} />
            </label>
          )}

          {form.tipo !== 'Ajuste' && (
            <>
              <label className={`block ${ROTULO}`}>
                {form.tipo === 'Transferência' ? 'Para onde foi' : 'Local ou frente'}
                <input value={form.destino} onChange={event => mudar('destino', event.target.value)} list="lancamento-destinos" placeholder="Ex: Ramo 700" className={`mt-1 ${CAMPO}`} />
                <datalist id="lancamento-destinos">{destinosRecentes.map(item => <option key={item} value={item} />)}</datalist>
              </label>
              <label className={`block ${ROTULO}`}>
                Ramo ou trecho
                <select
                  value={form.etapaServicoId}
                  onChange={event => {
                    const etapa = etapas.find(item => item.id === event.target.value);
                    setForm(atual => ({ ...atual, etapaServicoId: event.target.value, destino: atual.destino || etapa?.nome || '' }));
                  }}
                  className={`mt-1 ${CAMPO}`}
                >
                  <option value="">Sem ramo</option>
                  {etapas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </label>
            </>
          )}

          {form.tipo === 'Saída' && (
            <>
              <label className={`block ${ROTULO}`}>
                Serviço
                <input value={form.servico} onChange={event => mudar('servico', event.target.value)} className={`mt-1 ${CAMPO}`} />
              </label>
              <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={form.consumo} onChange={event => mudar('consumo', event.target.checked)} className="size-5 accent-[#176b4d]" />
                Conta como uso do ramo
              </label>
            </>
          )}
        </div>

        <details open={maisCampos} onToggle={event => setMaisCampos(event.currentTarget.open)} className="rounded-xl border border-slate-200">
          <summary className={`min-h-11 cursor-pointer rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 ${FOCO}`}>
            Mais campos: valor, fator, solicitação de compra e observação
          </summary>
          <div className="grid gap-3 border-t border-slate-200 p-3 sm:grid-cols-2">
            <label className={`block ${ROTULO}`}>
              Valor unitário (R$)
              <input inputMode="decimal" value={form.valorUnitario} onChange={event => mudar('valorUnitario', event.target.value)} className={`mt-1 ${CAMPO}`} />
            </label>
            <label className={`block ${ROTULO}`}>
              Valor total (R$)
              <input inputMode="decimal" value={form.valorTotal} onChange={event => mudar('valorTotal', event.target.value)} placeholder={totalCalculado ? totalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''} className={`mt-1 ${CAMPO}`} />
            </label>
            <label className={`block ${ROTULO}`}>
              Fator ou densidade
              <input inputMode="decimal" value={form.fatorConversao} onChange={event => mudar('fatorConversao', event.target.value)} placeholder="Ex: 1,6" className={`mt-1 ${CAMPO}`} />
            </label>
            {form.tipo === 'Entrada' && (
              <label className={`block ${ROTULO}`}>
                Solicitação de compra
                <input value={form.solicitacaoCompra} onChange={event => mudar('solicitacaoCompra', event.target.value)} placeholder="SC 93011249" className={`mt-1 ${CAMPO}`} />
              </label>
            )}
            <label className={`block ${ROTULO} sm:col-span-2`}>
              Observação
              <textarea value={form.observacao} onChange={event => mudar('observacao', event.target.value)} rows={2} className={`mt-1 ${CAMPO} py-2`} />
            </label>
          </div>
        </details>

        {erro && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{erro}</p>}
      </div>
    </Modal>
  );
}
