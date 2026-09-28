/**
 * Combustível: lançar o abastecimento puxando do lançamento do dia da frota
 * quem operava, em que canteiro e frente a máquina estava e a última leitura.
 * Horímetro e km ficam separados; leitura menor que a anterior, máquina em
 * manutenção ou sem lançamento no dia viram aviso antes de salvar.
 *
 * Teclas, fora de campo de texto: N novo abastecimento, / busca no histórico.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, Droplets, FileSpreadsheet, Fuel, Gauge, History, Info, MapPin, Plus, Search, Trash2, Truck, UserRound, type LucideIcon } from 'lucide-react';
import type { Abastecimento, Comboio, ControleEquipamentoDiario, Empresa, Equipamento, GrupoEquipe, TipoCombustivel } from '../types';
import { ConfirmDialog, CountUp, PageHeader, isoDay } from '../shared/ui';
import { CANTEIROS, montarQuadro, type CartaoFrota } from '../modules/frota/quadroFrota';
import { abastecidasSemLancamento, avisosDoAbastecimento, contextoDoAbastecimento, lerNumero, operandoSemAbastecer } from '../modules/frota/combustivelDoDia';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO } from './cadastros/estilos';

interface Props {
  empresas: Empresa[];
  equipamentos: Equipamento[];
  comboios: Comboio[];
  combustiveis: TipoCombustivel[];
  abastecimentos: Abastecimento[];
  /** Lançamentos do Controle de Frotas; dão operador, canteiro e situação do dia. */
  registros?: ControleEquipamentoDiario[];
  gruposEquipe?: GrupoEquipe[];
  /** Quem está usando o sistema; entra como responsável do lançamento. */
  usuario?: string;
  onSaveAbastecimento: (item: Abastecimento, isNew: boolean) => void;
  onDeleteAbastecimento: (id: string) => void;
  onImportAbastecimentos?: (items: Abastecimento[], combustiveisImportados?: TipoCombustivel[]) => void;
  onOpenLubrificacao: () => void;
  onOpenCadastros?: () => void;
  onOpenControle?: () => void;
  onOpenSpreadsheetImport: () => void;
  isParsingSpreadsheet: boolean;
}

type View = 'resumo' | 'novo' | 'historico';

interface Formulario {
  data: string;
  hora: string;
  prefixo: string;
  tipoCombustivelId: string;
  comboioId: string;
  litros: string;
  horimetro: string;
  km: string;
  operador: string;
  responsavel: string;
  local: string;
  observacao: string;
}

const agoraHora = () => new Date().toTimeString().slice(0, 5);
const hoje = () => isoDay(new Date());
const dataCurta = (dia: string) => dia ? new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data';
const litrosTexto = (valor: number) => `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`;
const numeroTexto = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const TOM_GRUPO: Record<CartaoFrota['grupo'], string> = {
  operando: 'bg-emerald-50 text-[#176b4d] ring-emerald-200',
  manutencao: 'bg-rose-50 text-rose-700 ring-rose-200',
  parado: 'bg-amber-50 text-amber-800 ring-amber-200',
  'sem-lancamento': 'bg-slate-100 text-slate-600 ring-slate-200',
};

const vazio = (usuario: string, data = hoje()): Formulario => ({
  data, hora: agoraHora(), prefixo: '', tipoCombustivelId: '', comboioId: '', litros: '', horimetro: '', km: '',
  operador: '', responsavel: usuario, local: '', observacao: '',
});

export default function CombustivelOperacionalTab({
  equipamentos, comboios, combustiveis, abastecimentos, registros = [], gruposEquipe = [], usuario = '',
  onSaveAbastecimento, onDeleteAbastecimento, onOpenLubrificacao, onOpenCadastros, onOpenControle, onOpenSpreadsheetImport, isParsingSpreadsheet,
}: Props) {
  const escopo = useRef<HTMLElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const prefixoRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>('resumo');
  const [dia, setDia] = useState(hoje);
  const [busca, setBusca] = useState('');
  const [excluindo, setExcluindo] = useState<Abastecimento | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [form, setForm] = useState<Formulario>(() => vazio(usuario));
  /** Campos que a pessoa mexeu; o que vem do lançamento do dia não passa por cima deles. */
  const [mexidos, setMexidos] = useState<ReadonlySet<keyof Formulario>>(() => new Set());

  const ativos = useMemo(() => abastecimentos
    .filter(item => !item.inativoEm && item.status !== 'Cancelado')
    .sort((a, b) => `${b.data}${b.hora}`.localeCompare(`${a.data}${a.hora}`)), [abastecimentos]);
  const porId = useMemo(() => new Map(equipamentos.map(item => [item.id, item])), [equipamentos]);
  const nomeCombustivel = useMemo(() => new Map(combustiveis.map(item => [item.id, item.nome])), [combustiveis]);

  const cartoesDoDia = useMemo(() => montarQuadro({ dia, equipamentos, registros, gruposEquipe, abastecimentos }), [abastecimentos, dia, equipamentos, gruposEquipe, registros]);
  const cartoesDoForm = useMemo(
    () => (form.data === dia ? cartoesDoDia : montarQuadro({ dia: form.data, equipamentos, registros, gruposEquipe, abastecimentos })),
    [abastecimentos, cartoesDoDia, dia, equipamentos, form.data, gruposEquipe, registros],
  );
  const doDia = ativos.filter(item => item.data === dia);
  const litrosDia = doDia.reduce((soma, item) => soma + Number(item.quantidadeLitros || 0), 0);
  const maquinasDia = new Set(doDia.map(item => item.equipamentoId)).size;
  const semDiesel = useMemo(() => operandoSemAbastecer(cartoesDoDia, ativos, dia), [ativos, cartoesDoDia, dia]);
  const semLancamento = useMemo(() => abastecidasSemLancamento(cartoesDoDia, ativos, dia), [ativos, cartoesDoDia, dia]);
  const aConferir = doDia.filter(item => item.revisaoStatus === 'Pendente' || item.status === 'Pendente' || item.alertas?.some(alerta => alerta.severidade !== 'info')).length;

  // Máquina escolhida pelo prefixo digitado ("CB726" ou "CB726 · Caminhão").
  const equipamento = useMemo(() => {
    const texto = semAcento(form.prefixo.split('·')[0].trim());
    if (!texto) return undefined;
    return equipamentos.find(item => semAcento(item.prefixo) === texto);
  }, [equipamentos, form.prefixo]);
  const cartao = equipamento ? cartoesDoForm.find(item => item.equipamentoId === equipamento.id) : undefined;
  const contexto = cartao ? contextoDoAbastecimento({ dia: form.data, hora: form.hora, cartao, abastecimentos: ativos }) : undefined;
  const avisos = contexto ? avisosDoAbastecimento({ contexto, horimetro: lerNumero(form.horimetro), km: lerNumero(form.km) }) : [];
  const ehVeiculo = equipamento?.categoriaFrota === 'Veículo';

  // Ao escolher a máquina, puxa do lançamento do dia o que a pessoa ainda não digitou.
  useEffect(() => {
    if (!equipamento || !contexto) return;
    const ultimoCombustivel = ativos.find(item => item.equipamentoId === equipamento.id && item.tipoCombustivelId)?.tipoCombustivelId;
    setForm(atual => ({
      ...atual,
      operador: mexidos.has('operador') ? atual.operador : contexto.operador,
      local: mexidos.has('local') ? atual.local : [contexto.canteiro, contexto.frente].filter(Boolean).join(' · '),
      tipoCombustivelId: mexidos.has('tipoCombustivelId') || atual.tipoCombustivelId ? atual.tipoCombustivelId : ultimoCombustivel || combustiveis.find(item => /diesel/i.test(item.nome))?.id || combustiveis[0]?.id || '',
    }));
    // Só roda quando a máquina ou o dia mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipamento?.id, form.data]);

  const mudar = (campo: keyof Formulario, valor: string) => {
    setForm(atual => ({ ...atual, [campo]: valor }));
    setMexidos(atual => new Set(atual).add(campo));
    setErro('');
  };

  const abrirNovo = (prefixo = '') => {
    setForm({ ...vazio(usuario, dia), prefixo });
    setMexidos(new Set());
    setErro('');
    setView('novo');
    window.setTimeout(() => (prefixo ? document.getElementById('combustivel-litros') : prefixoRef.current)?.focus(), 60);
  };

  const salvar = (outro: boolean) => {
    const litros = lerNumero(form.litros);
    if (!equipamento) return setErro('Escolha a máquina pelo prefixo.');
    if (!form.tipoCombustivelId) return setErro('Escolha o combustível.');
    if (litros === undefined || litros <= 0) return setErro('Informe quantos litros foram abastecidos.');
    const horimetro = lerNumero(form.horimetro) ?? 0;
    const km = lerNumero(form.km) ?? 0;
    const agora = new Date().toISOString();
    onSaveAbastecimento({
      id: crypto.randomUUID(), data: form.data, hora: form.hora, equipamentoId: equipamento.id,
      horimetroInicial: horimetro, kmInicial: km, bombaInicial: 0, bombaFinal: litros,
      quantidadeLitros: litros, tipoCombustivelId: form.tipoCombustivelId, comboioId: form.comboioId,
      responsavel: form.responsavel.trim() || 'Não informado', operadorNome: form.operador.trim() || undefined,
      localAbastecimento: form.local.trim(), observacao: form.observacao.trim(), status: 'OK', origem: 'Manual',
      competencia: form.data.slice(0, 7), criadoEm: agora, atualizadoEm: agora,
    }, true);
    setAviso(`${equipamento.prefixo} abastecido com ${litrosTexto(litros)}.`);
    if (outro) {
      setForm(atual => ({ ...vazio(usuario, atual.data), responsavel: atual.responsavel, comboioId: atual.comboioId }));
      setMexidos(new Set());
      window.setTimeout(() => prefixoRef.current?.focus(), 60);
    } else {
      setView('resumo');
    }
  };

  const filtrados = useMemo(() => {
    const termo = semAcento(busca.trim());
    const base = ativos.filter(item => item.data === dia);
    if (!termo) return base;
    return base.filter(item => semAcento([
      porId.get(item.equipamentoId)?.prefixo, porId.get(item.equipamentoId)?.nome, nomeCombustivel.get(item.tipoCombustivelId),
      item.responsavel, item.operadorNome, item.localAbastecimento,
    ].filter(Boolean).join(' ')).includes(termo));
  }, [ativos, busca, dia, nomeCombustivel, porId]);

  useEffect(() => {
    if (!aviso) return undefined;
    const tempo = window.setTimeout(() => setAviso(''), 4000);
    return () => window.clearTimeout(tempo);
  }, [aviso]);

  useEffect(() => {
    const teclar = (event: KeyboardEvent) => {
      const alvo = event.target as HTMLElement | null;
      if (alvo?.matches('input, textarea, select, [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey || excluindo) return;
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        abrirNovo();
      } else if (event.key === '/') {
        event.preventDefault();
        setView('historico');
        window.setTimeout(() => buscaRef.current?.focus(), 60);
      }
    };
    document.addEventListener('keydown', teclar);
    return () => document.removeEventListener('keydown', teclar);
  });

  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(raiz.querySelectorAll('[data-comb-reveal]'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, { scope: escopo, dependencies: [view, dia] });

  const indicadores: Array<{ id: string; titulo: string; valor: number; sufixo?: string; detalhe: string; Icone: LucideIcon; tom: string; acao?: () => void }> = [
    { id: 'litros', titulo: 'Litros no dia', valor: Math.round(litrosDia), sufixo: ' L', detalhe: `${doDia.length} abastecimento(s)`, Icone: Fuel, tom: 'bg-emerald-50 text-[#176b4d]', acao: () => setView('historico') },
    { id: 'maquinas', titulo: 'Máquinas abastecidas', valor: maquinasDia, detalhe: 'receberam diesel', Icone: Truck, tom: 'bg-slate-100 text-slate-700', acao: () => setView('historico') },
    { id: 'sem-diesel', titulo: 'Operando sem diesel', valor: semDiesel.length, detalhe: 'lançadas em operação', Icone: Gauge, tom: 'bg-orange-50 text-[#f26a2e]' },
    { id: 'sem-lancamento', titulo: 'Sem lançamento', valor: semLancamento.length, detalhe: 'abasteceram sem lançar', Icone: AlertTriangle, tom: 'bg-amber-50 text-amber-700' },
    { id: 'conferir', titulo: 'A conferir', valor: aConferir, detalhe: 'com aviso ou pendência', Icone: ClipboardList, tom: 'bg-rose-50 text-rose-700', acao: () => setView('historico') },
  ];

  const vistas = [['resumo', 'Resumo', Fuel], ['novo', 'Lançar', Plus], ['historico', 'Histórico', History]] as const;

  return (
    <section ref={escopo} id="combustivel-tab" data-testid="combustivel-tab" aria-label="Combustível" className="space-y-4">
      <div data-comb-reveal>
        <PageHeader
          eyebrow="Frota"
          title="Combustível"
          description="Abastecimento de cada máquina, ligado ao lançamento do dia: operador e canteiro já vêm preenchidos."
          actions={<div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <label className="relative flex w-full min-w-0 items-center sm:inline-flex sm:w-auto">
              <span className="sr-only">Dia</span>
              <CalendarDays className="pointer-events-none absolute left-3 size-4 text-slate-400" aria-hidden="true" />
              <input type="date" value={dia} onChange={event => setDia(event.target.value || hoje())} className={`${CAMPO} min-w-0 pl-9 font-semibold sm:w-auto`} data-testid="combustivel-dia" />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:contents">
              <button type="button" onClick={onOpenLubrificacao} className={`${BOTAO_SECUNDARIO} px-3`}><Droplets className="size-4" aria-hidden="true" />Lubrificação</button>
              <button type="button" onClick={onOpenSpreadsheetImport} disabled={isParsingSpreadsheet} className={`${BOTAO_SECUNDARIO} px-3`}><FileSpreadsheet className="size-4" aria-hidden="true" />{isParsingSpreadsheet ? 'Lendo…' : 'Importar'}</button>
            </div>
            <button type="button" onClick={() => abrirNovo()} className={`${BOTAO_PRIMARIO} w-full px-5 max-sm:order-first sm:w-auto`} data-testid="combustivel-novo">
              <Plus className="size-5" aria-hidden="true" />
              Novo abastecimento
              <kbd className="hidden rounded-md bg-white/15 px-1.5 font-mono text-xs xl:inline">N</kbd>
            </button>
            <nav aria-label="Área de combustível" className="grid w-full grid-cols-3 gap-1 rounded-2xl bg-[#f7f8f6] p-1 ring-1 ring-inset ring-slate-200 sm:order-first sm:mr-auto sm:inline-grid sm:w-auto">
              {vistas.map(([id, rotulo, Icone]) => (
                <button key={id} type="button" aria-pressed={view === id} onClick={() => (id === 'novo' ? abrirNovo() : setView(id))} data-testid={`combustivel-vista-${id}`} className={`inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 text-sm font-bold transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] sm:gap-2 sm:px-3 ${view === id ? 'bg-white text-[#176b4d] shadow-[0_6px_16px_-10px_rgba(15,40,31,0.45)] ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'} ${FOCO}`}>
                  <Icone className="size-4 max-[380px]:hidden" aria-hidden="true" />{rotulo}
                </button>
              ))}
            </nav>
          </div>}
        />
      </div>

      <p role="status" aria-live="polite" className={`${aviso ? '' : 'sr-only'} flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-200`} data-testid="combustivel-aviso">
        {aviso && <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />}
        {aviso}
      </p>

      {view === 'resumo' && <>
        <section aria-label="Resumo do dia" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
          {indicadores.map(item => {
            const conteudo = <>
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 [overflow-wrap:anywhere] sm:tracking-[0.12em]">{item.titulo}</span>
                <span className={`grid size-8 shrink-0 place-items-center rounded-full ${item.tom}`}><item.Icone className="size-4" aria-hidden="true" /></span>
              </span>
              <CountUp value={item.valor} suffix={item.sufixo} className="mt-1 block text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl" />
              <span className="block text-xs text-slate-500">{item.detalhe}</span>
            </>;
            const classe = `${CARTAO} flex min-h-24 flex-col p-3 text-left transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] sm:min-h-28 sm:p-3.5`;
            return item.acao
              ? <button key={item.id} type="button" data-comb-reveal onClick={item.acao} data-testid={`combustivel-indicador-${item.id}`} className={`${classe} hover:-translate-y-0.5 hover:border-emerald-300 active:scale-[0.98] ${FOCO}`}>{conteudo}</button>
              : <div key={item.id} data-comb-reveal data-testid={`combustivel-indicador-${item.id}`} className={classe}>{conteudo}</div>;
          })}
        </section>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <section data-comb-reveal aria-labelledby="comb-sem-diesel" className="rounded-[1.25rem] bg-[#f7f8f6] p-1.5 ring-1 ring-slate-200">
            <header className="rounded-[0.9rem] bg-white px-4 py-3">
              <h2 id="comb-sem-diesel" className="text-base font-bold text-slate-900">Operando e ainda sem diesel</h2>
              <p className="text-sm text-slate-500">Lançadas em operação no Controle de Frotas. Toque para abastecer.</p>
            </header>
            {semDiesel.length === 0
              ? <p className="px-4 py-6 text-center text-sm text-slate-500">Nenhuma máquina operando sem diesel neste dia.</p>
              : <ul className="grid gap-1.5 p-1.5 sm:grid-cols-2">
                  {semDiesel.slice(0, 12).map(item => (
                    <li key={item.equipamentoId}>
                      <button type="button" onClick={() => abrirNovo(item.prefixo)} data-testid={`combustivel-abastecer-${item.prefixo}`} className={`flex min-h-14 w-full items-center gap-3 rounded-xl bg-white px-3 py-2 text-left ring-1 ring-slate-200 transition duration-200 hover:ring-emerald-300 active:scale-[0.98] ${FOCO}`}>
                        <span className="min-w-0 flex-1">
                          <span className="block font-mono text-sm font-bold text-slate-900">{item.prefixo}</span>
                          <span className="block truncate text-xs text-slate-500">{[item.operador, item.canteiro !== 'Sem canteiro' ? item.canteiro : ''].filter(Boolean).join(' · ') || item.tipo}</span>
                        </span>
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-[#176b4d]"><Plus className="size-4" aria-hidden="true" /></span>
                      </button>
                    </li>
                  ))}
                </ul>}
            {semDiesel.length > 12 && <p className="px-4 pb-2 text-xs text-slate-500">E mais {semDiesel.length - 12} máquina(s).</p>}
          </section>

          <section data-comb-reveal aria-labelledby="comb-sem-lancamento" className="rounded-[1.25rem] bg-[#f7f8f6] p-1.5 ring-1 ring-slate-200">
            <header className="flex flex-wrap items-start justify-between gap-2 rounded-[0.9rem] bg-white px-4 py-3">
              <div>
                <h2 id="comb-sem-lancamento" className="text-base font-bold text-slate-900">Abasteceu sem lançamento</h2>
                <p className="text-sm text-slate-500">Receberam diesel, mas ninguém lançou a máquina no Controle de Frotas.</p>
              </div>
              {onOpenControle && semLancamento.length > 0 && <button type="button" onClick={onOpenControle} className={`${BOTAO_SECUNDARIO} px-3`}>Abrir Controle</button>}
            </header>
            {semLancamento.length === 0
              ? <p className="px-4 py-6 text-center text-sm text-slate-500">Tudo que abasteceu tem lançamento no dia.</p>
              : <ul className="flex flex-wrap gap-1.5 p-2">
                  {semLancamento.map(item => <li key={item.equipamentoId} className="rounded-full bg-white px-3 py-1.5 font-mono text-sm font-bold text-amber-800 ring-1 ring-amber-200">{item.prefixo}</li>)}
                </ul>}
          </section>
        </div>

        <ListaDoDia itens={doDia.slice(0, 8)} porId={porId} nomeCombustivel={nomeCombustivel} titulo="Últimos abastecimentos do dia" onExcluir={setExcluindo} onVerTodos={doDia.length > 8 ? () => setView('historico') : undefined} onCadastros={combustiveis.length === 0 ? onOpenCadastros : undefined} />
      </>}

      {view === 'novo' && (
        <form data-comb-reveal onSubmit={event => { event.preventDefault(); salvar(false); }} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]" data-testid="combustivel-form">
          <div className={`${CARTAO} space-y-5 p-4 sm:p-5`}>
            <fieldset className="space-y-2">
              <legend className="text-base font-bold text-slate-900">1. Qual máquina?</legend>
              <label className="block">
                <span className="sr-only">Prefixo da máquina</span>
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input ref={prefixoRef} list="combustivel-prefixos" value={form.prefixo} onChange={event => mudar('prefixo', event.target.value.toUpperCase())} placeholder="Digite o prefixo, ex.: CB726" className={`${CAMPO} pl-9 font-mono text-lg font-bold uppercase`} data-testid="combustivel-prefixo" autoComplete="off" />
                </span>
                <datalist id="combustivel-prefixos">
                  {equipamentos.filter(item => item.status !== 'Desmobilizado').map(item => <option key={item.id} value={item.prefixo}>{item.nome}</option>)}
                </datalist>
              </label>
              {form.prefixo && !equipamento && <p className="text-sm font-semibold text-amber-800">Prefixo não encontrado no cadastro.</p>}
              {!form.prefixo && semDiesel.length > 0 && form.data === dia && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-slate-500">Operando e sem diesel hoje:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {semDiesel.slice(0, 10).map(item => (
                      <button key={item.equipamentoId} type="button" onClick={() => { mudar('prefixo', item.prefixo); window.setTimeout(() => document.getElementById('combustivel-litros')?.focus(), 60); }} className={`min-h-10 rounded-full bg-emerald-50 px-3 font-mono text-sm font-bold text-[#176b4d] ring-1 ring-inset ring-emerald-200 transition hover:bg-emerald-100 active:scale-[0.97] ${FOCO}`}>{item.prefixo}</button>
                    ))}
                  </div>
                </div>
              )}
            </fieldset>

            {contexto && cartao && <div className="lg:hidden"><CartaoContexto cartao={cartao} contexto={contexto} /></div>}

            <fieldset className="grid gap-3 sm:grid-cols-3">
              <legend className="mb-2 text-base font-bold text-slate-900">2. Quanto abasteceu?</legend>
              <label className={ROTULO}>Litros
                <input id="combustivel-litros" inputMode="decimal" value={form.litros} onChange={event => mudar('litros', event.target.value)} placeholder="0,0" className={`${CAMPO} mt-1 text-lg font-bold`} data-testid="combustivel-litros" />
              </label>
              <label className={ROTULO}>Combustível
                <select value={form.tipoCombustivelId} onChange={event => mudar('tipoCombustivelId', event.target.value)} className={`${CAMPO} mt-1`} data-testid="combustivel-tipo">
                  <option value="">Escolha</option>
                  {combustiveis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </label>
              <label className={ROTULO}>Comboio
                <select value={form.comboioId} onChange={event => mudar('comboioId', event.target.value)} className={`${CAMPO} mt-1`}>
                  <option value="">Não informado</option>
                  {comboios.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </label>
            </fieldset>

            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-2 text-base font-bold text-slate-900">3. Leitura do painel</legend>
              {([
                ['horimetro', 'Horímetro (h)', contexto?.ultimoHorimetro, 'h'],
                ['km', 'Km', contexto?.ultimoKm, 'km'],
              ] as const).filter(([campo]) => !(ehVeiculo && campo === 'horimetro' && !contexto?.ultimoHorimetro) || true).sort(([a]) => (ehVeiculo && a === 'km' ? -1 : 0)).map(([campo, rotulo, ultimo, unidade]) => (
                <label key={campo} className={ROTULO}>{rotulo}
                  <input inputMode="decimal" value={form[campo]} onChange={event => mudar(campo, event.target.value)} placeholder={ultimo ? `último: ${numeroTexto(ultimo.valor)}` : 'Opcional'} className={`${CAMPO} mt-1 font-mono`} data-testid={`combustivel-${campo}`} />
                  {ultimo && <span className="mt-1 block text-xs font-normal text-slate-500">Último: {numeroTexto(ultimo.valor)} {unidade} em {dataCurta(ultimo.data)}</span>}
                </label>
              ))}
            </fieldset>

            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-2 text-base font-bold text-slate-900">4. Quem e onde</legend>
              <label className={ROTULO}>Operador
                <input list="combustivel-operadores" value={form.operador} onChange={event => mudar('operador', event.target.value)} placeholder="Quem estava na máquina" className={`${CAMPO} mt-1`} data-testid="combustivel-operador" />
                <datalist id="combustivel-operadores">
                  {Array.from(new Set(cartoesDoForm.map(item => item.operador).filter(Boolean))).map(nome => <option key={nome} value={nome} />)}
                </datalist>
              </label>
              <label className={ROTULO}>Canteiro / local
                <input list="combustivel-locais" value={form.local} onChange={event => mudar('local', event.target.value)} placeholder="Onde abasteceu" className={`${CAMPO} mt-1`} data-testid="combustivel-local" />
                <datalist id="combustivel-locais">{CANTEIROS.map(nome => <option key={nome} value={nome} />)}</datalist>
              </label>
              <label className={ROTULO}>Responsável
                <input value={form.responsavel} onChange={event => mudar('responsavel', event.target.value)} placeholder="Quem lançou" className={`${CAMPO} mt-1`} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={ROTULO}>Data<input type="date" value={form.data} onChange={event => mudar('data', event.target.value || hoje())} className={`${CAMPO} mt-1`} /></label>
                <label className={ROTULO}>Hora<input type="time" value={form.hora} onChange={event => mudar('hora', event.target.value)} className={`${CAMPO} mt-1`} /></label>
              </div>
              <label className={`${ROTULO} sm:col-span-2`}>Observação
                <textarea rows={2} value={form.observacao} onChange={event => mudar('observacao', event.target.value)} placeholder="Opcional" className={`${CAMPO} mt-1 py-2`} />
              </label>
            </fieldset>

            {avisos.length > 0 && (
              <ul className="space-y-1.5" data-testid="combustivel-avisos">
                {avisos.map(item => (
                  <li key={item.texto} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-inset ${item.tom === 'alerta' ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-[#f7f8f6] text-slate-700 ring-slate-200'}`}>
                    {item.tom === 'alerta' ? <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                    {item.texto}
                  </li>
                ))}
              </ul>
            )}
            {erro && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 ring-1 ring-inset ring-rose-200" data-testid="combustivel-erro">{erro}</p>}

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setView('resumo')} className={BOTAO_SECUNDARIO}>Cancelar</button>
              <button type="button" onClick={() => salvar(true)} className={BOTAO_SECUNDARIO} data-testid="combustivel-salvar-outro">Salvar e lançar outro</button>
              <button type="submit" className={`${BOTAO_PRIMARIO} px-6`} data-testid="combustivel-salvar"><CheckCircle2 className="size-4" aria-hidden="true" />Salvar abastecimento</button>
            </div>
          </div>

          <aside className="hidden lg:sticky lg:top-4 lg:block">
            {contexto && cartao
              ? <CartaoContexto cartao={cartao} contexto={contexto} />
              : <div className={`${CARTAO} grid place-items-center gap-2 p-6 text-center`}>
                  <Truck className="size-8 text-slate-300" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-600">Escolha a máquina para ver o lançamento do dia dela.</p>
                </div>}
          </aside>
        </form>
      )}

      {view === 'historico' && <>
        <section data-comb-reveal className={`${CARTAO} p-3`}>
          <label className="relative block">
            <span className="sr-only">Buscar prefixo, operador, local ou combustível</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input ref={buscaRef} value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar prefixo, operador, local ou combustível" className={`${CAMPO} pl-9`} data-testid="combustivel-busca" />
          </label>
        </section>
        <ListaDoDia itens={filtrados} porId={porId} nomeCombustivel={nomeCombustivel} titulo={`Abastecimentos de ${dataCurta(dia)}`} onExcluir={setExcluindo} />
      </>}

      <ConfirmDialog
        open={Boolean(excluindo)}
        title={`Excluir o abastecimento de ${excluindo ? porId.get(excluindo.equipamentoId)?.prefixo || 'máquina' : ''}?`}
        description="O registro é apagado e não volta pela sincronização."
        confirmLabel="Excluir abastecimento"
        tone="danger"
        onCancel={() => setExcluindo(null)}
        onConfirm={() => { if (excluindo) onDeleteAbastecimento(excluindo.id); setExcluindo(null); }}
      />
    </section>
  );
}

function CartaoContexto({ cartao, contexto }: { cartao: CartaoFrota; contexto: ReturnType<typeof contextoDoAbastecimento> }) {
  const linhas: Array<[LucideIcon, string, string]> = [
    [UserRound, 'Operador', contexto.operador || 'Não informado'],
    [MapPin, 'Canteiro', contexto.canteiro || 'Sem canteiro'],
    [ClipboardList, 'Frente', contexto.frente || 'Sem frente'],
    [Gauge, 'Último horímetro', contexto.ultimoHorimetro ? `${numeroTexto(contexto.ultimoHorimetro.valor)} h` : '—'],
  ];
  return (
    <section aria-label="Lançamento do dia da máquina" data-testid="combustivel-contexto" className="rounded-[1.25rem] bg-[#f7f8f6] p-1.5 ring-1 ring-slate-200">
      <header className="flex items-center justify-between gap-2 rounded-[0.9rem] bg-white px-4 py-3">
        <span className="min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#176b4d]">Hoje no Controle</span>
          <span className="block font-mono text-lg font-bold text-slate-950">{cartao.prefixo}</span>
          <span className="block truncate text-xs text-slate-500">{cartao.modelo}</span>
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${TOM_GRUPO[contexto.grupo]}`}>{contexto.situacao}</span>
      </header>
      <dl className="grid gap-1 p-2">
        {linhas.map(([Icone, rotulo, valor]) => (
          <div key={rotulo} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2">
            <Icone className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
            <dt className="text-xs font-semibold text-slate-500">{rotulo}</dt>
            <dd className="ml-auto truncate text-right text-sm font-bold text-slate-900">{valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ListaDoDia({ itens, porId, nomeCombustivel, titulo, onExcluir, onVerTodos, onCadastros }: {
  itens: readonly Abastecimento[];
  porId: ReadonlyMap<string, Equipamento>;
  nomeCombustivel: ReadonlyMap<string, string>;
  titulo: string;
  onExcluir: (item: Abastecimento) => void;
  onVerTodos?: () => void;
  onCadastros?: () => void;
}) {
  return (
    <section data-comb-reveal aria-label={titulo} className={`${CARTAO} overflow-hidden`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 className="text-base font-bold text-slate-900">{titulo}</h2>
        <span className="flex items-center gap-2">
          {onCadastros && <button type="button" onClick={onCadastros} className={`${BOTAO_SECUNDARIO} px-3`}><Fuel className="size-4" aria-hidden="true" />Cadastrar combustível</button>}
          {onVerTodos && <button type="button" onClick={onVerTodos} className={`${BOTAO_SECUNDARIO} px-3`}>Ver todos</button>}
        </span>
      </header>
      {itens.length === 0
        ? <p className="px-4 py-10 text-center text-sm text-slate-500">Nenhum abastecimento neste dia.</p>
        : <ul className="divide-y divide-slate-100" data-testid="combustivel-lista">
            {itens.map(item => {
              const maquina = porId.get(item.equipamentoId);
              const leitura = [item.horimetroInicial > 0 ? `${numeroTexto(item.horimetroInicial)} h` : '', item.kmInicial > 0 && item.kmInicial !== item.horimetroInicial ? `${numeroTexto(item.kmInicial)} km` : ''].filter(Boolean).join(' · ');
              return (
                <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 transition-colors hover:bg-emerald-50/40 sm:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)_6rem_auto]">
                  <span className="font-mono text-sm font-semibold text-slate-500 max-sm:order-3 max-sm:text-xs">{item.hora || '—'}</span>
                  <span className="min-w-0">
                    <span className="block font-mono text-sm font-bold text-slate-950">{maquina?.prefixo || item.prefixoInformado || 'Sem cadastro'}</span>
                    <span className="block truncate text-xs text-slate-500">{nomeCombustivel.get(item.tipoCombustivelId) || 'Combustível não informado'}{leitura ? ` · ${leitura}` : ''}</span>
                  </span>
                  <span className="min-w-0 text-xs text-slate-600 max-sm:col-span-2 max-sm:order-4">
                    <span className="block truncate">{item.operadorNome || 'Operador não informado'}</span>
                    <span className="block truncate text-slate-500">{item.localAbastecimento || 'Local não informado'}</span>
                  </span>
                  <span className="text-right text-base font-bold tabular-nums text-slate-900 max-sm:order-2">{litrosTexto(Number(item.quantidadeLitros || 0))}</span>
                  <button type="button" onClick={() => onExcluir(item)} aria-label={`Excluir abastecimento de ${maquina?.prefixo || 'máquina'}`} className={`grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-rose-300 hover:text-rose-700 max-sm:order-5 max-sm:justify-self-end ${FOCO}`}><Trash2 className="size-4" aria-hidden="true" /></button>
                </li>
              );
            })}
          </ul>}
    </section>
  );
}
