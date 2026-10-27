import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { locaisParaEscolher, rotuloDoLocal } from '../../modules/materials/locaisSge';
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, CalendarDays, CheckCircle2, MapPin, Receipt, RotateCcw, Save, SlidersHorizontal, Truck, type LucideIcon } from 'lucide-react';
import type { Empresa, EtapaServico, Material, MovimentoMaterial, TipoMovimentoMaterial } from '../../types';
import { saldoDoMaterial, validarMovimento } from '../../utils/estoque';
import { formatarData, numero } from '../../utils/formato';
import { lerNumeroBR, recentes } from '../../modules/materials/lancamentoRapido';
import { Modal } from '../../shared/ui';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, FOCO } from '../cadastros/estilos';
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


/*
 * Molde de formulário do SGE (Nova Apropriação), pedido em 27/10/2026: o
 * lançamento em seções com título e ícone, rótulo curto em caixa alta com *
 * no obrigatório, o que o sistema preenche sozinho em cinza e o que ele
 * calcula em verde-claro. As colunas seguem a largura do formulário (container
 * query), então a mesma grade serve na tela de lançar e na janela de corrigir.
 */
const RotuloSge = ({ children, obrigatorio = false, htmlFor }: { children: ReactNode; obrigatorio?: boolean; htmlFor?: string }) => (
  <label htmlFor={htmlFor} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">
    {children}
    {obrigatorio && <span className="text-rose-700" aria-hidden="true"> *</span>}
  </label>
);

/** Campo que o sistema preenche (cinza) ou calcula (verde-claro): só leitura. */
const CampoAutomatico = ({ id, valor, vazio, calculado = false, tom }: { id: string; valor?: ReactNode; vazio: string; calculado?: boolean; tom?: string }) => (
  <output id={id} className={`flex min-h-11 w-full items-center rounded-xl border px-3 text-sm lg:min-h-10 ${calculado ? 'border-emerald-100 bg-emerald-50/70 font-bold tabular-nums' : 'border-slate-200 bg-slate-50'} ${valor ? (tom ?? 'text-slate-900') : 'text-slate-500'}`}>
    {valor || vazio}
  </output>
);

const SecaoSge = ({ titulo, Icone, children }: { titulo: string; Icone: LucideIcon; children: ReactNode }) => (
  <section aria-label={titulo} className="rounded-2xl border border-slate-200 bg-white">
    <h3 className="flex items-center gap-2 rounded-t-2xl border-b border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-bold text-slate-900">
      <Icone className="size-4 text-[#176b4d]" aria-hidden="true" />
      {titulo}
    </h3>
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 p-4 @xl:grid-cols-6 @3xl:grid-cols-12">{children}</div>
  </section>
);

/** Campos do formulário na ordem da tela, para o Enter andar de um para o outro. */
const SELETOR_CAMPOS = 'input:not([type="checkbox"]):not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

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
  /**
   * "pagina" desenha o lançamento na própria tela, sem janela: registrar
   * limpa o que muda de uma viagem para outra e deixa pronto para a próxima.
   */
  modo?: 'janela' | 'pagina';
}

/**
 * Janela de lançamento: tipo em botões grandes, material achado digitando, o
 * saldo antes e depois na hora, e "Salvar e lançar outro" para quem lança uma
 * viagem atrás da outra sem ter que preencher tudo de novo.
 */
export default function FormLancamento({ aberto, editando, hoje, materiais, movimentos, empresas, etapas, responsavel, onSalvar, onFechar, modo = 'janela' }: Props) {
  const pagina = modo === 'pagina';
  // A tela de lançar e a janela de corrigir podem estar abertas juntas: ids diferentes.
  const prefixo = pagina ? 'lancar' : 'lancamento';
  const [form, setForm] = useState<Formulario>(() => formularioNovo(hoje));
  const [voltarAValer, setVoltarAValer] = useState(false);
  const [erro, setErro] = useState('');
  const [lancado, setLancado] = useState('');
  const quantidadeRef = useRef<HTMLInputElement>(null);
  const corpoRef = useRef<HTMLDivElement>(null);

  // Ao abrir: editar carrega o movimento; lançar novo mantém o que ficou da última vez.
  useEffect(() => {
    if (!aberto) return;
    setErro('');
    setLancado('');
    setVoltarAValer(false);
    if (editando) {
      setForm(formularioDe(editando));
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

  /** Leva o foco para o campo seguinte; no último, registra. */
  const avancar = (de: Element | null) => {
    const campos = Array.from(corpoRef.current?.querySelectorAll<HTMLElement>(SELETOR_CAMPOS) ?? []);
    const indice = de ? campos.indexOf(de as HTMLElement) : -1;
    const proximo = campos[indice + 1];
    if (proximo) proximo.focus();
    else if (pagina && !editando) registrarEOutro();
  };

  // Como no SGE: Enter passa para o próximo campo, Ctrl+S ou F2 salvam.
  // Shift+Enter continua salvando e deixando pronto para a próxima viagem.
  const teclar = (event: KeyboardEvent<HTMLDivElement>) => {
    const alvo = event.target as HTMLElement;
    const salvarAgora = event.key === 'F2' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's');
    if (salvarAgora) {
      event.preventDefault();
      event.stopPropagation();
      if (pagina && !editando) registrarEOutro(); else registrar();
      return;
    }
    if (event.key !== 'Enter' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'BUTTON' || alvo.tagName === 'SUMMARY') return;
    if (event.shiftKey && !editando) {
      event.preventDefault();
      event.stopPropagation();
      registrarEOutro();
      return;
    }
    if (pagina && alvo.matches(SELETOR_CAMPOS)) {
      event.preventDefault();
      event.stopPropagation();
      avancar(alvo);
    }
  };

  const tomSaldo = saldoDepois < 0 ? 'text-rose-700' : minimo > 0 && saldoDepois < minimo ? 'text-amber-700' : 'text-slate-900';

  const limpar = () => {
    setForm(formularioNovo(hoje));
    setErro('');
    setLancado('');
  };

  const rodape = (
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
  );

  const unidade = material?.unidade;
  const comTransporte = form.tipo !== 'Ajuste';

  const corpo = (
    <div ref={corpoRef} className="@container space-y-4" onKeyDown={teclar}>
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

      <SecaoSge titulo="Dados do lançamento" Icone={CalendarDays}>
        <div className="@xl:col-span-2 @3xl:col-span-3">
          <RotuloSge htmlFor={`${prefixo}-data`} obrigatorio>Data</RotuloSge>
          <input id={`${prefixo}-data`} type="date" value={form.data} onChange={event => mudar('data', event.target.value)} className={`${CAMPO} lg:min-h-10`} />
        </div>
        <fieldset className="@xl:col-span-4 @3xl:col-span-9">
          <legend className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">O que aconteceu<span className="text-rose-700" aria-hidden="true"> *</span></legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-2 @lg:grid-cols-4">
            {TIPOS.map(({ id, nome, ajuda, Icone }) => {
              const ativo = form.tipo === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  title={ajuda}
                  onClick={() => setForm(atual => ({ ...atual, tipo: id, consumo: id === 'Saída' ? atual.consumo : false }))}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-bold transition duration-200 lg:min-h-10 ${FOCO} ${ativo
                    ? 'border-[#176b4d] bg-[#176b4d] text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500'}`}
                >
                  <Icone className="size-4 shrink-0" aria-hidden="true" />
                  {nome}
                  <span className="sr-only">: {ajuda}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="@xl:col-span-3 @3xl:col-span-5">
          <RotuloSge htmlFor={`${prefixo}-material`} obrigatorio>Material (nome ou código)</RotuloSge>
          <CampoEscolha
            id={`${prefixo}-material`}
            testId="lancamento-material"
            opcoes={opcoesMaterial}
            recentes={materiaisRecentes}
            valor={form.materialId}
            onEscolher={escolherMaterial}
            placeholder="Digite o nome ou o código"
            onEnter={() => quantidadeRef.current?.focus()}
          />
        </div>
        <div className="@xl:col-span-3 @3xl:col-span-7">
          <RotuloSge htmlFor={`${prefixo}-descricao`}>Descrição do material</RotuloSge>
          <CampoAutomatico
            id={`${prefixo}-descricao`}
            valor={material && [material.codigo, material.categoria, material.unidade].filter(Boolean).join(' · ')}
            vazio="Preenchido ao escolher o material"
          />
        </div>

        <div className="@xl:col-span-2 @3xl:col-span-3">
          <RotuloSge htmlFor={`${prefixo}-quantidade`} obrigatorio>Quantidade{unidade ? ` (${unidade})` : ''}</RotuloSge>
          <input
            id={`${prefixo}-quantidade`}
            ref={quantidadeRef}
            inputMode="decimal"
            value={form.quantidade}
            onChange={event => mudar('quantidade', event.target.value)}
            placeholder={form.tipo === 'Ajuste' ? 'Use - para baixar' : 'Ex: 12,5'}
            data-testid="lancamento-quantidade"
            className={`${CAMPO} text-lg font-bold tabular-nums lg:min-h-10`}
          />
        </div>
        <div className="@xl:col-span-2 @3xl:col-span-3">
          <RotuloSge htmlFor={`${prefixo}-saldo-agora`}>Saldo agora</RotuloSge>
          <CampoAutomatico id={`${prefixo}-saldo-agora`} calculado valor={material && `${numero(saldoAgora)} ${material.unidade}`} vazio="—" />
        </div>
        <div className="@xl:col-span-2 @3xl:col-span-3">
          <RotuloSge htmlFor={`${prefixo}-saldo-depois`}>Saldo depois</RotuloSge>
          <CampoAutomatico
            id={`${prefixo}-saldo-depois`}
            calculado
            tom={tomSaldo}
            valor={material && quantidade !== 0 && form.tipo !== 'Transferência' ? `${numero(saldoDepois)} ${material.unidade}` : undefined}
            vazio={form.tipo === 'Transferência' ? 'Transporte não muda o saldo' : '—'}
          />
        </div>
        <div className="@xl:col-span-6 @3xl:col-span-3">
          <RotuloSge htmlFor={`${prefixo}-minimo`}>Estoque mínimo</RotuloSge>
          <CampoAutomatico id={`${prefixo}-minimo`} valor={minimo > 0 && material ? `${numero(minimo)} ${material.unidade}` : undefined} vazio="Sem mínimo" />
        </div>
      </SecaoSge>

      {comTransporte && (
        <SecaoSge titulo={form.tipo === 'Entrada' ? 'Nota e transporte' : 'Transporte'} Icone={Truck}>
          {form.tipo === 'Entrada' && (
            <>
              <div className="@xl:col-span-6 @3xl:col-span-6">
                <RotuloSge htmlFor={`${prefixo}-fornecedor`}>Fornecedor</RotuloSge>
                <CampoEscolha id={`${prefixo}-fornecedor`} opcoes={opcoesFornecedor} recentes={fornecedoresRecentes} valor={form.fornecedorId} onEscolher={id => mudar('fornecedorId', id)} vazio="Sem fornecedor informado" placeholder="Digite o nome do fornecedor" onEnter={() => avancar(document.getElementById(`${prefixo}-fornecedor`))} />
              </div>
              <div className="@xl:col-span-3 @3xl:col-span-3">
                <RotuloSge htmlFor={`${prefixo}-nota`}>Nota fiscal</RotuloSge>
                <input id={`${prefixo}-nota`} value={form.notaFiscal} onChange={event => mudar('notaFiscal', event.target.value)} inputMode="numeric" className={`${CAMPO} lg:min-h-10`} />
              </div>
              <div className="@xl:col-span-3 @3xl:col-span-3">
                <RotuloSge htmlFor={`${prefixo}-quantidade-nota`}>Quantidade na nota</RotuloSge>
                <input id={`${prefixo}-quantidade-nota`} inputMode="decimal" value={form.quantidadeNota} onChange={event => mudar('quantidadeNota', event.target.value)} placeholder="Se diferente" className={`${CAMPO} lg:min-h-10`} />
              </div>
            </>
          )}
          <div className="@xl:col-span-3 @3xl:col-span-3">
            <RotuloSge htmlFor={`${prefixo}-placa`}>Placa</RotuloSge>
            <input id={`${prefixo}-placa`} value={form.placa} onChange={event => mudar('placa', event.target.value.toUpperCase())} placeholder="ABC1D23" className={`${CAMPO} uppercase lg:min-h-10`} />
          </div>
          <div className="@xl:col-span-3 @3xl:col-span-3">
            <RotuloSge htmlFor={`${prefixo}-ticket`}>Ticket ou vale</RotuloSge>
            <input id={`${prefixo}-ticket`} value={form.ticket} onChange={event => mudar('ticket', event.target.value)} className={`${CAMPO} lg:min-h-10`} />
          </div>
          {form.tipo === 'Entrada' && (
            <div className="@xl:col-span-6 @3xl:col-span-6">
              <RotuloSge htmlFor={`${prefixo}-sc`}>Solicitação de compra</RotuloSge>
              <input id={`${prefixo}-sc`} value={form.solicitacaoCompra} onChange={event => mudar('solicitacaoCompra', event.target.value)} placeholder="SC 93011249" className={`${CAMPO} lg:min-h-10`} />
            </div>
          )}
        </SecaoSge>
      )}

      {comTransporte && (
        <SecaoSge titulo="Local de aplicação" Icone={MapPin}>
          {form.tipo === 'Transferência' && (
            <div className="@xl:col-span-3 @3xl:col-span-4">
              <RotuloSge htmlFor={`${prefixo}-origem`}>De onde saiu</RotuloSge>
              <input id={`${prefixo}-origem`} value={form.origem} onChange={event => mudar('origem', event.target.value)} list={`${prefixo}-destinos`} className={`${CAMPO} lg:min-h-10`} />
            </div>
          )}
          <div className="@xl:col-span-3 @3xl:col-span-4">
            <RotuloSge htmlFor={`${prefixo}-destino`}>{form.tipo === 'Transferência' ? 'Para onde foi' : 'Local ou frente'}</RotuloSge>
            <input id={`${prefixo}-destino`} value={form.destino} onChange={event => mudar('destino', event.target.value)} list={`${prefixo}-destinos`} placeholder="Ex: Ramo 700" className={`${CAMPO} lg:min-h-10`} />
            <datalist id={`${prefixo}-destinos`}>{destinosRecentes.map(item => <option key={item} value={item} />)}</datalist>
          </div>
          <div className="@xl:col-span-3 @3xl:col-span-4">
            <RotuloSge htmlFor={`${prefixo}-ramo`}>Ramo ou trecho</RotuloSge>
            <select
              id={`${prefixo}-ramo`}
              value={form.etapaServicoId}
              onChange={event => {
                const etapa = etapas.find(item => item.id === event.target.value);
                setForm(atual => ({ ...atual, etapaServicoId: event.target.value, destino: atual.destino || etapa?.nome || '' }));
              }}
              className={`${CAMPO} lg:min-h-10`}
            >
              <option value="">Sem ramo</option>
              {locaisParaEscolher(etapas, form.etapaServicoId).map(([grupo, itens]) => (
                <optgroup key={grupo} label={grupo}>{itens.map(item => <option key={item.id} value={item.id}>{rotuloDoLocal(item)}</option>)}</optgroup>
              ))}
            </select>
          </div>
          {form.tipo === 'Saída' && (
            <>
              <div className="@xl:col-span-3 @3xl:col-span-4">
                <RotuloSge htmlFor={`${prefixo}-servico`}>Serviço</RotuloSge>
                <input id={`${prefixo}-servico`} value={form.servico} onChange={event => mudar('servico', event.target.value)} className={`${CAMPO} lg:min-h-10`} />
              </div>
              <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 @xl:col-span-3 @3xl:col-span-4 lg:min-h-10">
                <input type="checkbox" checked={form.consumo} onChange={event => mudar('consumo', event.target.checked)} className="size-5 accent-[#176b4d]" />
                Conta como uso do ramo
              </label>
            </>
          )}
        </SecaoSge>
      )}

      <SecaoSge titulo="Valores e observações" Icone={Receipt}>
        <div className="@xl:col-span-2 @3xl:col-span-3">
          <RotuloSge htmlFor={`${prefixo}-valor-unitario`}>Valor unitário (R$)</RotuloSge>
          <input id={`${prefixo}-valor-unitario`} inputMode="decimal" value={form.valorUnitario} onChange={event => mudar('valorUnitario', event.target.value)} className={`${CAMPO} tabular-nums lg:min-h-10`} />
        </div>
        <div className="@xl:col-span-2 @3xl:col-span-3">
          <RotuloSge htmlFor={`${prefixo}-valor-total`}>Valor total (R$)</RotuloSge>
          <input id={`${prefixo}-valor-total`} inputMode="decimal" value={form.valorTotal} onChange={event => mudar('valorTotal', event.target.value)} placeholder={totalCalculado ? totalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''} className={`${CAMPO} tabular-nums lg:min-h-10`} />
        </div>
        <div className="@xl:col-span-2 @3xl:col-span-2">
          <RotuloSge htmlFor={`${prefixo}-fator`}>Fator</RotuloSge>
          <input id={`${prefixo}-fator`} inputMode="decimal" value={form.fatorConversao} onChange={event => mudar('fatorConversao', event.target.value)} placeholder="Ex: 1,6" className={`${CAMPO} tabular-nums lg:min-h-10`} />
        </div>
        <div className="@xl:col-span-6 @3xl:col-span-4">
          <RotuloSge htmlFor={`${prefixo}-observacao`}>Observações</RotuloSge>
          <textarea id={`${prefixo}-observacao`} value={form.observacao} onChange={event => mudar('observacao', event.target.value)} rows={1} placeholder="Anotações adicionais…" className={`${CAMPO} min-h-11 py-2 lg:min-h-10`} />
        </div>
      </SecaoSge>

      {erro && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{erro}</p>}

      {/* Como o "Total geral apontado" do SGE: o resultado do lançamento em destaque. */}
      <div className="flex justify-center">
        <p className="inline-flex flex-wrap items-baseline justify-center gap-x-3 rounded-2xl border-2 border-[#176b4d]/30 bg-white px-6 py-3 text-center" aria-live="polite" data-testid="lancamento-saldo-final">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-700">{form.tipo === 'Transferência' ? 'Saldo (transporte não muda)' : 'Saldo depois deste lançamento'}</span>
          <strong className={`text-xl tabular-nums ${material ? tomSaldo : 'text-slate-500'}`}>
            {material ? `${numero(form.tipo === 'Transferência' ? saldoAgora : saldoDepois)} ${material.unidade}` : '—'}
          </strong>
        </p>
      </div>

      {/* No celular o botão do topo sai da vista com a rolagem: repete aqui embaixo. */}
      {pagina && !editando && (
        <button type="button" onClick={registrarEOutro} className={`${BOTAO_PRIMARIO} w-full lg:hidden`}>
          <Save className="size-5" aria-hidden="true" />
          Registrar
        </button>
      )}
    </div>
  );

  if (pagina) {
    return (
      <section data-materiais-reveal aria-labelledby={`${prefixo}-titulo`} className="flex flex-col gap-4">
        {/* Cabeçalho do formulário no molde do SGE: título, dica do teclado e o
            salvar à direita. Fica preso no topo enquanto o formulário rola. */}
        {/* A faixa em volta tem a cor do fundo da página: o que rola por baixo
            não aparece nos cantos arredondados nem no respiro de cima. */}
        <div className="z-10 bg-(--renea-v3-paper) lg:sticky lg:-top-0.5 lg:pt-0.5">
        <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_8px_18px_-16px_rgba(15,40,31,0.45)] sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 id={`${prefixo}-titulo`} className="text-lg font-bold text-slate-900">Novo lançamento de material</h2>
            <p className="text-sm text-slate-600 max-lg:hidden">Dica: <kbd className="font-semibold">Enter</kbd> passa para o próximo campo; <kbd className="font-semibold">Ctrl+S</kbd> ou <kbd className="font-semibold">F2</kbd> registra.</p>
          </div>
          <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={limpar} className={BOTAO_SECUNDARIO}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Começar de novo
            </button>
            <button type="button" onClick={registrarEOutro} aria-keyshortcuts="Control+S F2" className={`${BOTAO_PRIMARIO} px-5`} data-testid="materiais-registrar">
              <Save className="size-5" aria-hidden="true" />
              Registrar
              <span className="hidden text-sm font-semibold text-white/85 lg:inline">(Ctrl+S / F2)</span>
            </button>
          </div>
        </header>
        </div>
        {corpo}
      </section>
    );
  }

  return (
    <Modal
      open={aberto}
      title={editando ? 'Editar lançamento' : 'Novo lançamento'}
      size="lg"
      telaCheia="materiais-lancamento"
      onSubmit={registrar}
      onClose={onFechar}
      footer={rodape}
    >
      {corpo}
    </Modal>
  );
}
