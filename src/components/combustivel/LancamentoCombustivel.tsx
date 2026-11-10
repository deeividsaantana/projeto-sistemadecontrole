/**
 * Lançar (ou corrigir) um abastecimento. Desenho de 10/11/2026, refeito do
 * zero: três etapas na ordem em que o frentista pensa (qual máquina, quanto
 * abasteceu, de onde saiu o diesel) e, ao lado, a conferência do que vai ser
 * salvo. Os campos e as contas são os da planilha FORNECIMENTO DIESEL:
 * descrição e empresa saem do cadastro, a bomba inicial é a última bomba
 * final do comboio e a final é inicial + litros. Enter passa de campo,
 * Ctrl + S salva e já deixa pronto para o próximo, Esc fecha.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { AlertTriangle, CheckCircle2, Clock, CopyX, Info, Pencil, RotateCcw, Search, X } from 'lucide-react';
import type { Abastecimento, Comboio, ControleEquipamentoDiario, Empresa, Equipamento, GrupoEquipe, TipoCombustivel } from '../../types';
import { isoDay } from '../../shared/ui';
import { montarQuadro } from '../../modules/frota/quadroFrota';
import { avisosDoAbastecimento, contextoDoAbastecimento, lerNumero } from '../../modules/frota/combustivelDoDia';
import { montarConsumoPorEquipamento, textoConsumo } from '../../modules/frota/consumoPorEquipamento';
import { buildMacroFuelingRecord, getDefaultDieselFuelId, parseFuelFormNumber, resolveMacroPumpReadings } from '../../utils/fuelMacroForm';
import { normalizeQuickTime } from '../../utils/combustivelValidation';
import { getFuelRecordCompetence } from '../../modules/frota/fuelReport';
import { nomeDoMes } from '../../modules/frota/planilhaDiesel';
import { conferirNoDia } from '../../modules/frota/repetidosDiesel';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, reduzMovimento } from '../cadastros/estilos';

interface Props {
  abastecimentos: readonly Abastecimento[];
  equipamentos: readonly Equipamento[];
  empresas: readonly Empresa[];
  comboios: readonly Comboio[];
  combustiveis: TipoCombustivel[];
  registros?: ControleEquipamentoDiario[];
  gruposEquipe?: GrupoEquipe[];
  usuario: string;
  /** Abastecimento aberto para corrigir; sem ele é um lançamento novo. */
  emEdicao?: Abastecimento;
  /** Começa já com esta máquina (repetir do histórico). */
  prefixoInicial?: string;
  comboioInicial?: string;
  onSalvar: (item: Abastecimento, novo: boolean) => void;
  onFechar: () => void;
  onAviso: (texto: string) => void;
  /** Abre para corrigir o lançamento que já existe (a trava de repetido oferece). */
  onAbrirExistente?: (item: Abastecimento) => void;
}

interface Formulario {
  data: string;
  hora: string;
  prefixo: string;
  litros: string;
  horimetro: string;
  km: string;
  comboioId: string;
  bombaInicial: string;
  tipoCombustivelId: string;
}

const CHAVE_COMBOIO = 'renea_combustivel_comboio_v1';

const lerLocal = (chave: string) => {
  try { return window.localStorage.getItem(chave) || ''; } catch { return ''; }
};
const gravarLocal = (chave: string, valor: string) => {
  try { window.localStorage.setItem(chave, valor); } catch { /* aba anônima ou sem espaço */ }
};

const agoraHora = () => new Date().toTimeString().slice(0, 5);
const numeroTexto = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const litrosTexto = (valor: number) => `${numeroTexto(valor)} L`;
const paraCampo = (valor: number) => (valor > 0 ? String(valor).replace('.', ',') : '');
const dataCurta = (dia: string) => (dia ? new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '');
const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const SOMENTE_LEITURA = 'flex min-h-11 w-full min-w-0 items-center rounded-xl bg-[#f7f8f6] px-3 text-base font-bold ring-1 ring-inset ring-slate-200';
const CAMPO_GRANDE = `min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 tabular-nums text-lg font-bold tabular-nums text-slate-900 placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-slate-500 transition duration-200 focus:border-emerald-500 ${FOCO}`;

/** Uma etapa do lançamento: número, pergunta e os campos dela. */
function Etapa({ numero, titulo, ajuda, feita, children }: { numero: number; titulo: string; ajuda?: string; feita?: boolean; children: ReactNode }) {
  return (
    <section data-lanc-reveal aria-labelledby={`lanc-etapa-${numero}`} className={`${CARTAO} p-4 sm:p-5`}>
      <header className="mb-4 flex items-start gap-3">
        <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-black ${feita ? 'bg-[#176b4d] text-white' : 'bg-[#f7f8f6] text-slate-700 ring-1 ring-inset ring-slate-200'}`} aria-hidden="true">
          {feita ? <CheckCircle2 className="size-4" /> : numero}
        </span>
        <div className="min-w-0">
          <h2 id={`lanc-etapa-${numero}`} className="text-base font-black text-slate-900">{titulo}</h2>
          {ajuda && <p className="text-sm text-slate-600">{ajuda}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

/** Campo com o nome em cima: lê de cima para baixo, igual no celular e no computador. */
function Campo({ rotulo, para, dica, children, className }: { rotulo: string; para?: string; dica?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className ?? ''}`}>
      {para
        ? <label htmlFor={para} className="mb-1 block text-sm font-bold text-slate-700">{rotulo}</label>
        : <span className="mb-1 block text-sm font-bold text-slate-700">{rotulo}</span>}
      {children}
      {dica && <p className="mt-1 text-sm text-slate-600">{dica}</p>}
    </div>
  );
}

/** Linha da conferência: o que vai ser salvo, com um sinal de pronto ou pendente. */
function Conferido({ rotulo, valor, ok, testId }: { rotulo: string; valor: ReactNode; ok: boolean; testId?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        <span className={`size-2 shrink-0 rounded-full ${ok ? 'bg-[#176b4d]' : 'bg-slate-300'}`} aria-hidden="true" />
        {rotulo}
      </dt>
      <dd className="min-w-0 text-right text-sm font-black tabular-nums text-slate-900" data-testid={testId}>{valor}</dd>
    </div>
  );
}

export default function LancamentoCombustivel({
  abastecimentos, equipamentos, empresas, comboios, combustiveis, registros = [], gruposEquipe = [], usuario,
  emEdicao, prefixoInicial = '', comboioInicial, onSalvar, onFechar, onAviso, onAbrirExistente,
}: Props) {
  const raiz = useRef<HTMLFormElement>(null);
  const prefixoRef = useRef<HTMLInputElement>(null);
  const corpoRef = useRef<HTMLDivElement>(null);
  const porId = useMemo(() => new Map(equipamentos.map(item => [item.id, item])), [equipamentos]);
  const combustivelPadraoId = useMemo(() => getDefaultDieselFuelId(combustiveis), [combustiveis]);
  const outros = useMemo(() => abastecimentos.filter(item => item.id !== emEdicao?.id), [abastecimentos, emEdicao?.id]);

  const bombaInicialDoComboio = (comboioId: string, data: string, hora: string) => paraCampo(resolveMacroPumpReadings({ records: outros, comboioId, data, hora, litros: 0 }).bombaInicial);

  const formularioInicial = (): Formulario => {
    if (emEdicao) {
      return {
        data: emEdicao.data, hora: emEdicao.hora || '', prefixo: porId.get(emEdicao.equipamentoId)?.prefixo || emEdicao.prefixoInformado || '',
        litros: paraCampo(Number(emEdicao.quantidadeLitros || 0)), horimetro: paraCampo(Number(emEdicao.horimetroInicial || 0)),
        km: paraCampo(Number(emEdicao.kmInicial || 0)), comboioId: emEdicao.comboioId || '', bombaInicial: paraCampo(Number(emEdicao.bombaInicial || 0)),
        tipoCombustivelId: emEdicao.tipoCombustivelId || combustivelPadraoId,
      };
    }
    // Comboio da última vez neste aparelho; com um só cadastrado, já vem escolhido.
    const comboioId = comboioInicial ?? (comboios.some(item => item.id === lerLocal(CHAVE_COMBOIO)) ? lerLocal(CHAVE_COMBOIO) : comboios.length === 1 ? comboios[0].id : '');
    const data = isoDay(new Date());
    const hora = agoraHora();
    return {
      data, hora, prefixo: prefixoInicial, litros: '', horimetro: '', km: '', comboioId,
      bombaInicial: bombaInicialDoComboio(comboioId, data, hora), tipoCombustivelId: combustivelPadraoId,
    };
  };

  const [form, setForm] = useState<Formulario>(formularioInicial);
  const [mexidos, setMexidos] = useState<ReadonlySet<keyof Formulario>>(() => new Set());
  const [erro, setErro] = useState('');
  const [listaAberta, setListaAberta] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const [lancadosAgora, setLancadosAgora] = useState<string[]>([]);
  const [status, setStatus] = useState(emEdicao ? 'Corrigindo um lançamento já salvo.' : 'Pronto para novo lançamento.');
  /** Repetido que a pessoa confirmou ser outro abastecimento. */
  const [repetidoAceito, setRepetidoAceito] = useState('');

  const equipamento = useMemo(() => {
    const texto = semAcento(form.prefixo.trim());
    return texto ? equipamentos.find(item => semAcento(item.prefixo) === texto) : undefined;
  }, [equipamentos, form.prefixo]);

  const naoCadastrado = !equipamento && form.prefixo.trim().length > 0 && !listaAberta;
  // Trava de repetido: mesma máquina, mesmo dia e mesmos litros já lançados.
  const noDia = useMemo(() => conferirNoDia(abastecimentos, {
    id: emEdicao?.id || '', data: form.data, equipamentoId: equipamento?.id || '', prefixoInformado: form.prefixo,
    quantidadeLitros: parseFuelFormNumber(form.litros, 0),
  }), [abastecimentos, emEdicao?.id, equipamento?.id, form.data, form.litros, form.prefixo]);
  const repetido = form.prefixo.trim() && parseFuelFormNumber(form.litros, 0) > 0 ? noDia.repetido : undefined;
  const travado = Boolean(repetido && repetido.id !== repetidoAceito);
  const cartoes = useMemo(() => montarQuadro({ dia: form.data, equipamentos: [...equipamentos], registros, gruposEquipe, abastecimentos: [...abastecimentos] }), [abastecimentos, equipamentos, form.data, gruposEquipe, registros]);
  const cartao = equipamento ? cartoes.find(item => item.equipamentoId === equipamento.id) : undefined;
  const contexto = cartao ? contextoDoAbastecimento({ dia: form.data, hora: form.hora, cartao, abastecimentos, ignorarId: emEdicao?.id }) : undefined;
  const horimetroDigitado = lerNumero(form.horimetro);
  const kmDigitado = lerNumero(form.km);
  const avisos = contexto ? avisosDoAbastecimento({ contexto, horimetro: horimetroDigitado, km: kmDigitado }).filter(item => item.tom === 'alerta') : [];
  const bomba = useMemo(() => resolveMacroPumpReadings({ records: outros, comboioId: form.comboioId, data: form.data, hora: form.hora, litros: form.litros, bombaInicialManual: form.bombaInicial }), [form.bombaInicial, form.comboioId, form.data, form.hora, form.litros, outros]);
  const consumo = useMemo(() => {
    if (!equipamento) return undefined;
    return montarConsumoPorEquipamento({ registros: abastecimentos.filter(item => item.equipamentoId === equipamento.id), equipamentos: [equipamento], empresas })[0];
  }, [abastecimentos, empresas, equipamento]);

  const opcoes = useMemo(() => {
    const termo = semAcento(form.prefixo.trim());
    if (!termo) return [];
    const comeca = equipamentos.filter(item => semAcento(item.prefixo).startsWith(termo));
    const contem = equipamentos.filter(item => !semAcento(item.prefixo).startsWith(termo) && semAcento(`${item.prefixo} ${item.nome}`).includes(termo));
    return [...comeca, ...contem].slice(0, 8);
  }, [equipamentos, form.prefixo]);

  // Ao achar a máquina, puxa o combustível da última vez se a pessoa ainda não mexeu.
  useEffect(() => {
    if (!equipamento || mexidos.has('tipoCombustivelId')) return;
    const ultimoCombustivel = abastecimentos.find(item => item.equipamentoId === equipamento.id && item.tipoCombustivelId)?.tipoCombustivelId;
    if (ultimoCombustivel) setForm(atual => ({ ...atual, tipoCombustivelId: ultimoCombustivel }));
    // Só quando a máquina muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipamento?.id]);

  useEffect(() => {
    const raizAtual = raiz.current;
    if (!raizAtual || reduzMovimento()) return;
    gsap.fromTo(raizAtual.querySelectorAll('[data-lanc-reveal]'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.03, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, []);

  useEffect(() => {
    const alvo = prefixoInicial || emEdicao ? document.getElementById('lanc-litros') : prefixoRef.current;
    window.setTimeout(() => (alvo as HTMLInputElement | null)?.focus(), 60);
    // Foco só ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mudar = (campo: keyof Formulario, valor: string) => {
    setForm(atual => {
      const proximo = { ...atual, [campo]: valor };
      // Comboio, data ou hora mudaram: a bomba sugerida acompanha, se ninguém digitou nela.
      const refazBomba = campo === 'comboioId' || ((campo === 'data' || campo === 'hora') && !emEdicao && !mexidos.has('bombaInicial'));
      return refazBomba ? { ...proximo, bombaInicial: bombaInicialDoComboio(proximo.comboioId, proximo.data, proximo.hora) } : proximo;
    });
    if (campo === 'comboioId' && !emEdicao) gravarLocal(CHAVE_COMBOIO, valor);
    setMexidos(atual => new Set(atual).add(campo));
    setErro('');
  };

  const escolherMaquina = (maquina: Equipamento) => {
    mudar('prefixo', maquina.prefixo);
    setListaAberta(false);
    window.setTimeout(() => document.getElementById('lanc-litros')?.focus(), 30);
  };

  const proximoCampo = (atual: HTMLElement) => {
    const campos = [...(raiz.current?.querySelectorAll<HTMLElement>('[data-campo]') || [])].filter(item => !item.hasAttribute('disabled') && item.offsetParent !== null);
    const indice = campos.indexOf(atual);
    if (indice >= 0 && indice < campos.length - 1) {
      campos[indice + 1].focus();
      return true;
    }
    return false;
  };

  const aoTeclar = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    if (!proximoCampo(event.target as HTMLElement)) salvar();
  };

  const aoTeclarPrefixo = (event: KeyboardEvent<HTMLInputElement>) => {
    if (listaAberta && opcoes.length > 0) {
      if (event.key === 'ArrowDown') { event.preventDefault(); setDestaque(atual => Math.min(opcoes.length - 1, atual + 1)); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); setDestaque(atual => Math.max(0, atual - 1)); return; }
      if (event.key === 'Enter' && !equipamento) { event.preventDefault(); escolherMaquina(opcoes[destaque] || opcoes[0]); return; }
      if (event.key === 'Escape') { event.preventDefault(); setListaAberta(false); return; }
    }
    aoTeclar(event);
  };

  const limpar = () => {
    setForm(atual => ({ ...formularioInicial(), data: atual.data, comboioId: atual.comboioId, bombaInicial: bombaInicialDoComboio(atual.comboioId, atual.data, agoraHora()), tipoCombustivelId: atual.tipoCombustivelId, prefixo: '' }));
    setMexidos(new Set());
    setErro('');
    setStatus('Pronto para novo lançamento.');
    window.setTimeout(() => prefixoRef.current?.focus(), 30);
  };

  function salvar() {
    const hora = normalizeQuickTime(form.hora);
    const litros = parseFuelFormNumber(form.litros, 0);
    const prefixo = equipamento?.prefixo || form.prefixo.trim().toUpperCase();
    if (!prefixo) { setErro('Digite o prefixo da máquina.'); prefixoRef.current?.focus(); return; }
    if (litros <= 0) { setErro('Informe quantos litros foram abastecidos.'); document.getElementById('lanc-litros')?.focus(); return; }
    if (!hora.valid) { setErro('Digite a hora como 1005 ou 10:05.'); document.getElementById('lanc-hora')?.focus(); return; }
    if (!form.comboioId) { setErro('Escolha o comboio que abasteceu.'); document.getElementById('lanc-comboio')?.focus(); return; }
    if (!form.tipoCombustivelId) { setErro('Escolha o combustível.'); return; }
    if (bomba.bombaInicial <= 0) { setErro('Digite a leitura inicial da bomba deste comboio.'); document.getElementById('lanc-bomba')?.focus(); return; }
    if (travado && repetido) {
      setErro(`Já existe ${prefixo} em ${dataCurta(repetido.data)} com ${litrosTexto(litros)}. Confira antes de salvar.`);
      document.getElementById('lanc-repetido')?.scrollIntoView({ block: 'nearest', behavior: reduzMovimento() ? 'auto' : 'smooth' });
      return;
    }
    const agora = new Date().toISOString();
    const registro = buildMacroFuelingRecord({
      id: emEdicao?.id || crypto.randomUUID(), equipment: equipamento, prefixo, records: [...outros], data: form.data, hora: form.hora,
      litros: form.litros, horimetro: form.horimetro, km: form.km, tipoCombustivelId: form.tipoCombustivelId, comboioId: form.comboioId,
      responsavel: emEdicao?.responsavel || usuario, bombaInicialManual: form.bombaInicial,
      operador: emEdicao?.operadorNome || contexto?.operador || '', local: emEdicao?.localAbastecimento || contexto?.canteiro || contexto?.frente || '',
      observacao: emEdicao?.observacao || '', nowIso: agora,
    });
    if (emEdicao) {
      // Corrigir não muda de onde o registro veio nem quando nasceu.
      onSalvar({ ...emEdicao, ...registro, origem: emEdicao.origem || registro.origem, criadoEm: emEdicao.criadoEm || registro.criadoEm, alertas: undefined }, false);
      onAviso(`Abastecimento de ${prefixo} corrigido.`);
      onFechar();
      return;
    }
    onSalvar(registro, true);
    onAviso(`${prefixo} abastecido com ${litrosTexto(litros)}${equipamento ? '' : ' (sem cadastro)'}.`);
    setLancadosAgora(atual => [registro.id, ...atual]);
    setStatus(`Salvo: ${prefixo}, ${litrosTexto(litros)}. Pronto para o próximo.`);
    setForm(atual => ({
      ...formularioInicial(), data: atual.data, comboioId: atual.comboioId, tipoCombustivelId: atual.tipoCombustivelId,
      bombaInicial: bomba.bombaFinal > 0 ? paraCampo(bomba.bombaFinal) : bombaInicialDoComboio(atual.comboioId, atual.data, agoraHora()), prefixo: '', hora: agoraHora(),
    }));
    setMexidos(new Set());
    setRepetidoAceito('');
    window.setTimeout(() => {
      corpoRef.current?.scrollTo({ top: 0 });
      prefixoRef.current?.focus({ preventScroll: true });
    }, 30);
  }

  useEffect(() => {
    const teclar = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        salvar();
        return;
      }
      // Esc fecha, como na planilha; com algo digitado, avisa em vez de perder o lançamento.
      if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('[role="dialog"]')) {
        if (mexidos.size === 0) onFechar();
        else setStatus('Tem dados sem salvar. Toque em Salvar, ou em Fechar para sair sem salvar.');
      }
    };
    document.addEventListener('keydown', teclar);
    return () => document.removeEventListener('keydown', teclar);
  });

  const totalLancado = lancadosAgora
    .map(id => abastecimentos.find(item => item.id === id))
    .reduce((soma, item) => soma + Number(item?.quantidadeLitros || 0), 0);
  const diferenca = (digitado: number | undefined, anterior?: { valor: number }) => (digitado !== undefined && anterior && digitado >= anterior.valor ? digitado - anterior.valor : undefined);
  const horasDesde = diferenca(horimetroDigitado, contexto?.ultimoHorimetro);
  const kmDesde = diferenca(kmDigitado, contexto?.ultimoKm);
  const litrosDigitados = parseFuelFormNumber(form.litros, 0);
  const consumoAgora = horasDesde && horasDesde > 0 && litrosDigitados > 0 ? litrosDigitados / horasDesde : undefined;
  const gastoAlto = consumoAgora !== undefined && consumo?.consumoHabitual && consumo.unidade === 'L/h' && consumoAgora >= consumo.consumoHabitual * 1.5;
  const empresaNome = equipamento ? empresas.find(item => item.id === equipamento.empresaId)?.nome || 'Sem empresa' : '';

  const comboioNome = comboios.find(item => item.id === form.comboioId)?.nome;
  const combustivelNome = combustiveis.find(item => item.id === form.tipoCombustivelId)?.nome;
  const maquinaOk = Boolean(equipamento || (form.prefixo.trim() && !listaAberta));
  const quantoOk = litrosDigitados > 0;
  const origemOk = Boolean(form.comboioId && form.tipoCombustivelId && bomba.bombaInicial > 0);
  const mensagem = erro || (naoCadastrado ? 'Prefixo sem cadastro. Pode lançar assim; o abastecimento fica com o prefixo digitado.' : avisos[0]?.texto || (equipamento && status.startsWith('Pronto') ? 'Equipamento localizado.' : status));
  const tomMensagem = erro ? 'bg-rose-50 text-rose-700' : naoCadastrado || avisos.length ? 'bg-amber-50 text-amber-900' : equipamento ? 'bg-emerald-50 text-[#176b4d]' : 'bg-[#f7f8f6] text-slate-600';

  return (
    <form ref={raiz} onFocus={event => { const alvo = event.target as HTMLElement; if (alvo instanceof HTMLInputElement && alvo.dataset.campo !== undefined && alvo.id !== 'lanc-prefixo') alvo.select(); }}
      onSubmit={event => { event.preventDefault(); salvar(); }} className="flex min-h-0 flex-1 flex-col" data-testid="combustivel-form" noValidate>
      <div ref={corpoRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-6 sm:py-4">
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="grid min-w-0 gap-4">
            <Etapa numero={1} titulo="Qual máquina?" ajuda="Digite o prefixo; a lista mostra as parecidas." feita={Boolean(equipamento)}>
              <span className="relative block max-w-xl">
                <label htmlFor="lanc-prefixo" className="sr-only">Prefixo</label>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input id="lanc-prefixo" ref={prefixoRef} data-campo value={form.prefixo} autoComplete="off" role="combobox" aria-expanded={listaAberta && opcoes.length > 0} aria-controls="lanc-opcoes"
                  onChange={event => { mudar('prefixo', event.target.value.toUpperCase()); setListaAberta(true); setDestaque(0); }}
                  onFocus={() => setListaAberta(true)} onBlur={() => window.setTimeout(() => setListaAberta(false), 150)} onKeyDown={aoTeclarPrefixo}
                  placeholder="Prefixo, ex.: LO279" className={`${CAMPO_GRANDE} pl-10 uppercase placeholder:normal-case`} data-testid="combustivel-prefixo" />
                {equipamento && <CheckCircle2 className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-[#176b4d]" aria-label="Máquina encontrada" />}
                {listaAberta && !equipamento && opcoes.length > 0 && (
                  <ul id="lanc-opcoes" role="listbox" className="absolute inset-x-0 z-30 mt-1 max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-lg">
                    {opcoes.map((item, indice) => (
                      <li key={item.id} role="option" aria-selected={indice === destaque}>
                        <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => escolherMaquina(item)}
                          className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left ${indice === destaque ? 'bg-emerald-50' : 'hover:bg-[#f7f8f6]'}`}>
                          <span className="tabular-nums font-black text-slate-950">{item.prefixo}</span>
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{item.nome}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </span>
              <dl className={`mt-3 grid gap-x-6 gap-y-1 rounded-xl px-3 py-2.5 ring-1 ring-inset sm:grid-cols-2 ${naoCadastrado ? 'bg-amber-50 ring-amber-200' : 'bg-[#f7f8f6] ring-slate-200'}`}>
                <div className="min-w-0">
                  <dt className="text-sm font-semibold text-slate-600">Descrição</dt>
                  <dd className={`truncate text-base font-bold ${naoCadastrado ? 'text-[#c2410c]' : 'text-slate-900'}`} data-testid="combustivel-descricao">{equipamento?.nome || (naoCadastrado ? 'NÃO CADASTRADO' : '—')}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-sm font-semibold text-slate-600">Empresa</dt>
                  <dd className={`truncate text-base font-bold ${naoCadastrado ? 'text-[#c2410c]' : 'text-slate-900'}`} data-testid="combustivel-empresa">{equipamento ? empresaNome : naoCadastrado ? 'NÃO CADASTRADO' : '—'}</dd>
                </div>
                {consumo?.consumoHabitual ? (
                  <p className="text-sm text-slate-600 sm:col-span-2">Costuma gastar {textoConsumo(consumo.consumoHabitual, consumo.unidade)}.</p>
                ) : null}
              </dl>
            </Etapa>

            <Etapa numero={2} titulo="Quanto abasteceu?" ajuda="Litros é obrigatório. Horímetro e KM, se a máquina tiver." feita={quantoOk}>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                <Campo rotulo="Litros" para="lanc-litros" className="col-span-2 xl:col-span-1"
                  dica={gastoAlto && consumo ? <span className="font-semibold text-[#c2410c]">Dá {numeroTexto(consumoAgora ?? 0)} L/h; ela costuma gastar {textoConsumo(consumo.consumoHabitual, 'L/h')}.</span> : undefined}>
                  <input id="lanc-litros" data-campo inputMode="decimal" value={form.litros} onChange={event => mudar('litros', event.target.value)} onKeyDown={aoTeclar} placeholder="0" className={`${CAMPO_GRANDE} text-[#176b4d]`} data-testid="combustivel-litros" />
                </Campo>
                <Campo rotulo="Horímetro" para="lanc-horimetro"
                  dica={horasDesde !== undefined ? `+${numeroTexto(horasDesde)} h desde ${dataCurta(contexto?.ultimoHorimetro?.data || '')}` : contexto?.ultimoHorimetro ? `Último: ${numeroTexto(contexto.ultimoHorimetro.valor)} h` : undefined}>
                  <input id="lanc-horimetro" data-campo inputMode="decimal" value={form.horimetro} onChange={event => mudar('horimetro', event.target.value)} onKeyDown={aoTeclar}
                    placeholder="se tiver" className={`${CAMPO} tabular-nums`} data-testid="combustivel-horimetro" />
                </Campo>
                <Campo rotulo="KM" para="lanc-km"
                  dica={kmDesde !== undefined ? `+${numeroTexto(kmDesde)} km desde ${dataCurta(contexto?.ultimoKm?.data || '')}` : contexto?.ultimoKm ? `Último: ${numeroTexto(contexto.ultimoKm.valor)} km` : undefined}>
                  <input id="lanc-km" data-campo inputMode="decimal" value={form.km} onChange={event => mudar('km', event.target.value)} onKeyDown={aoTeclar}
                    placeholder="se tiver" className={`${CAMPO} tabular-nums`} data-testid="combustivel-km" />
                </Campo>
                <Campo rotulo="Data" para="lanc-data">
                  <input id="lanc-data" type="date" value={form.data} max={isoDay(new Date())} onChange={event => mudar('data', event.target.value || isoDay(new Date()))} className={CAMPO} />
                </Campo>
                <Campo rotulo="Hora" para="lanc-hora">
                  <span className="relative block">
                    <input id="lanc-hora" data-campo inputMode="numeric" value={form.hora} onChange={event => mudar('hora', event.target.value)} onKeyDown={aoTeclar}
                      onBlur={() => { const hora = normalizeQuickTime(form.hora); if (hora.valid) setForm(atual => ({ ...atual, hora: hora.value })); }} placeholder="10:05" className={`${CAMPO} pr-11 tabular-nums`} data-testid="combustivel-hora" />
                    <button type="button" onClick={() => mudar('hora', agoraHora())} aria-label="Usar a hora de agora" title="Agora" className={`absolute right-0.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:text-[#176b4d] ${FOCO}`}><Clock className="size-4" aria-hidden="true" /></button>
                  </span>
                </Campo>
              </div>
            </Etapa>

            <Etapa numero={3} titulo="De onde saiu o diesel?" ajuda="A bomba inicial vem da última bomba final do comboio." feita={origemOk}>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <Campo rotulo="Comboio" para="lanc-comboio">
                  <select id="lanc-comboio" value={form.comboioId} onChange={event => mudar('comboioId', event.target.value)} className={CAMPO} data-testid="combustivel-comboio">
                    <option value="">Escolha o comboio</option>
                    {comboios.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Combustível" para="lanc-tipo">
                  <select id="lanc-tipo" value={form.tipoCombustivelId} onChange={event => mudar('tipoCombustivelId', event.target.value)} className={CAMPO} data-testid="combustivel-tipo">
                    <option value="">Escolha</option>
                    {combustiveis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Bomba inicial" para="lanc-bomba">
                  <input id="lanc-bomba" data-campo inputMode="decimal" value={form.bombaInicial} onChange={event => mudar('bombaInicial', event.target.value)} onKeyDown={aoTeclar}
                    placeholder={form.comboioId ? 'leitura antes' : 'escolha o comboio'} className={`${CAMPO} tabular-nums`} data-testid="combustivel-bomba-inicial" />
                </Campo>
                <Campo rotulo="Bomba final" dica="Inicial + litros.">
                  <output className={`${SOMENTE_LEITURA} tabular-nums font-black text-slate-900`} data-testid="combustivel-bomba-final">{bomba.bombaFinal > 0 ? numeroTexto(bomba.bombaFinal) : '—'}</output>
                </Campo>
              </div>
            </Etapa>
          </div>

          <aside data-lanc-reveal aria-label="Conferência antes de salvar" className={`${CARTAO} grid gap-3 p-4 sm:p-5 lg:sticky lg:top-0`}>
            <div>
              <h2 className="text-base font-black text-slate-900">Conferência</h2>
              <p className="text-sm text-slate-600">Mês da planilha: <output className="font-bold text-slate-900" data-testid="combustivel-mes">{nomeDoMes(getFuelRecordCompetence({ data: form.data }))}</output></p>
            </div>
            <dl className="divide-y divide-slate-100">
              <Conferido rotulo="Máquina" ok={maquinaOk} valor={form.prefixo.trim() ? form.prefixo.trim().toUpperCase() : 'falta'} />
              <Conferido rotulo="Litros" ok={quantoOk} valor={quantoOk ? litrosTexto(litrosDigitados) : 'falta'} />
              <Conferido rotulo="Comboio" ok={Boolean(form.comboioId)} valor={comboioNome || 'falta'} />
              <Conferido rotulo="Combustível" ok={Boolean(form.tipoCombustivelId)} valor={combustivelNome || 'falta'} />
              <Conferido rotulo="Bomba" ok={bomba.bombaFinal > 0} valor={bomba.bombaFinal > 0 ? `${numeroTexto(bomba.bombaInicial)} → ${numeroTexto(bomba.bombaFinal)}` : '—'} />
            </dl>

            {repetido && (
              <div id="lanc-repetido" role="alert" className={`rounded-xl px-3 py-3 ring-1 ring-inset ${travado ? 'bg-rose-50 ring-rose-200' : 'bg-amber-50 ring-amber-200'}`} data-testid="combustivel-repetido">
                <p className={`flex items-start gap-2 text-sm font-bold ${travado ? 'text-rose-800' : 'text-amber-900'}`}>
                  <CopyX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    {travado ? 'Lançamento repetido. ' : 'Você confirmou que é outro abastecimento. '}
                    {form.prefixo.trim().toUpperCase()} já tem {litrosTexto(Number(repetido.quantidadeLitros || 0))} em {dataCurta(repetido.data)}{repetido.hora ? ` às ${repetido.hora}` : ''}
                    {comboios.find(item => item.id === repetido.comboioId) ? ` (${comboios.find(item => item.id === repetido.comboioId)?.nome})` : ''}.
                    {travado ? ' Salvar de novo conta o diesel duas vezes.' : ''}
                  </span>
                </p>
                {travado && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {onAbrirExistente && <button type="button" onClick={() => onAbrirExistente(repetido)} className={`${BOTAO_SECUNDARIO} min-h-10`} data-testid="combustivel-abrir-existente"><Pencil className="size-4" aria-hidden="true" />Abrir o que já existe</button>}
                    <button type="button" onClick={() => { setRepetidoAceito(repetido.id); setErro(''); }} className={`${BOTAO_SECUNDARIO} min-h-10 text-rose-700`} data-testid="combustivel-outro-abastecimento">É outro abastecimento</button>
                  </div>
                )}
              </div>
            )}
            {!repetido && noDia.doDia.length > 0 && (
              <p className="flex items-start gap-2 rounded-xl bg-[#f7f8f6] px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200" data-testid="combustivel-ja-abasteceu">
                <Info className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
                <span>Já abasteceu em {dataCurta(form.data)}: {noDia.doDia.map(item => `${item.hora || 'sem hora'} · ${litrosTexto(Number(item.quantidadeLitros || 0))}`).join('; ')}.</span>
              </p>
            )}
            <p role="status" className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-bold ${tomMensagem}`} data-testid="combustivel-status">
              {erro || naoCadastrado || avisos.length ? <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
              <span data-testid={erro ? 'combustivel-erro' : undefined}>{mensagem}</span>
            </p>
            {!emEdicao && lancadosAgora.length > 0 && (
              <p className="text-sm font-bold text-slate-600" data-testid="lanc-lancados">
                {lancadosAgora.length} lançado(s) agora · <span className="tabular-nums text-[#176b4d]">{litrosTexto(totalLancado)}</span>
              </p>
            )}
          </aside>
        </div>
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-white px-3 py-3 sm:px-6">
        <div className="ml-auto grid w-full grid-cols-[1fr_1fr_1.4fr] gap-2 sm:flex sm:w-auto sm:justify-end">
          <button type="button" onClick={onFechar} className={`${BOTAO_SECUNDARIO} min-w-0 px-2 sm:px-4`}><X className="size-4" aria-hidden="true" />{emEdicao ? 'Cancelar' : 'Fechar'}</button>
          <button type="button" onClick={emEdicao ? () => setForm(formularioInicial()) : limpar} className={`${BOTAO_SECUNDARIO} min-w-0 px-2 sm:px-4`}><RotateCcw className="size-4" aria-hidden="true" />Limpar</button>
          <button type="submit" aria-disabled={travado} className={`${BOTAO_PRIMARIO} min-w-0 px-2 sm:min-w-40 sm:px-6 ${travado ? 'opacity-60' : ''}`} data-testid="combustivel-salvar"><CheckCircle2 className="size-4" aria-hidden="true" />{emEdicao ? 'Salvar correção' : 'Salvar'}</button>
        </div>
      </footer>
    </form>
  );
}
