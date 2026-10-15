/**
 * Lançar (ou editar) um abastecimento sem travar: a máquina sai de uma lista
 * que já sugere as que estão operando sem diesel e as últimas abastecidas, a
 * ficha ao lado mostra a última leitura e quanto ela costuma gastar, Enter
 * passa de campo e o último Enter salva e já abre o próximo.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { gsap } from 'gsap';
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, Fuel, Gauge, Info, Pencil, RotateCcw, Save, Search, X } from 'lucide-react';
import type { Abastecimento, Comboio, ControleEquipamentoDiario, Empresa, Equipamento, GrupoEquipe, TipoCombustivel } from '../../types';
import { isoDay } from '../../shared/ui';
import { montarQuadro } from '../../modules/frota/quadroFrota';
import { avisosDoAbastecimento, contextoDoAbastecimento, lerNumero, operandoSemAbastecer } from '../../modules/frota/combustivelDoDia';
import { montarConsumoPorEquipamento, textoConsumo } from '../../modules/frota/consumoPorEquipamento';
import { buildMacroFuelingRecord, getDefaultDieselFuelId, parseFuelFormNumber, resolveMacroPumpReadings } from '../../utils/fuelMacroForm';
import { normalizeQuickTime } from '../../utils/combustivelValidation';
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
  /** Começa já com esta máquina (repetir do histórico ou toque numa sugestão). */
  prefixoInicial?: string;
  comboioInicial?: string;
  onSalvar: (item: Abastecimento, novo: boolean) => void;
  onEditar: (item: Abastecimento) => void;
  onFechar: () => void;
  onAviso: (texto: string) => void;
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
  operador: string;
  local: string;
  observacao: string;
  responsavel: string;
}

const CHAVE_COMBOIO = 'renea_combustivel_comboio_v1';
const CHAVE_DETALHES = 'renea_combustivel_detalhes_v1';

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
const mesDoDiesel = (dia: string) => {
  if (!dia) return '';
  const data = new Date(`${dia}T12:00:00`);
  if (data.getDate() >= 21) data.setMonth(data.getMonth() + 1);
  return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};
const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const ROTULO_CAMPO = 'mb-1 block text-sm font-bold text-slate-700';
const CAMPO_GRANDE = `min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-lg font-bold tabular-nums text-slate-900 placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-slate-400 transition duration-200 focus:border-emerald-500 ${FOCO}`;

export default function LancamentoCombustivel({
  abastecimentos, equipamentos, empresas, comboios, combustiveis, registros = [], gruposEquipe = [], usuario,
  emEdicao, prefixoInicial = '', comboioInicial, onSalvar, onEditar, onFechar, onAviso,
}: Props) {
  const raiz = useRef<HTMLFormElement>(null);
  const prefixoRef = useRef<HTMLInputElement>(null);
  const corpoRef = useRef<HTMLDivElement>(null);
  const porId = useMemo(() => new Map(equipamentos.map(item => [item.id, item])), [equipamentos]);
  const combustivelPadraoId = useMemo(() => getDefaultDieselFuelId(combustiveis), [combustiveis]);
  const outros = useMemo(() => abastecimentos.filter(item => item.id !== emEdicao?.id), [abastecimentos, emEdicao?.id]);

  const bombaInicialDoComboio = (comboioId: string) => paraCampo(resolveMacroPumpReadings({ records: outros, comboioId, litros: 0 }).bombaInicial);

  const formularioInicial = (): Formulario => {
    if (emEdicao) {
      return {
        data: emEdicao.data, hora: emEdicao.hora || '', prefixo: porId.get(emEdicao.equipamentoId)?.prefixo || emEdicao.prefixoInformado || '',
        litros: paraCampo(Number(emEdicao.quantidadeLitros || 0)), horimetro: paraCampo(Number(emEdicao.horimetroInicial || 0)),
        km: paraCampo(Number(emEdicao.kmInicial || 0)), comboioId: emEdicao.comboioId || '', bombaInicial: paraCampo(Number(emEdicao.bombaInicial || 0)),
        tipoCombustivelId: emEdicao.tipoCombustivelId || combustivelPadraoId, operador: emEdicao.operadorNome || '', local: emEdicao.localAbastecimento || '',
        observacao: emEdicao.observacao || '', responsavel: emEdicao.responsavel || usuario,
      };
    }
    // Comboio da última vez neste aparelho; com um só cadastrado, já vem escolhido.
    const comboioId = comboioInicial ?? (comboios.some(item => item.id === lerLocal(CHAVE_COMBOIO)) ? lerLocal(CHAVE_COMBOIO) : comboios.length === 1 ? comboios[0].id : '');
    return {
      data: isoDay(new Date()), hora: agoraHora(), prefixo: prefixoInicial, litros: '', horimetro: '', km: '', comboioId,
      bombaInicial: bombaInicialDoComboio(comboioId), tipoCombustivelId: combustivelPadraoId, operador: '', local: '', observacao: '', responsavel: usuario,
    };
  };

  const [form, setForm] = useState<Formulario>(formularioInicial);
  const [mexidos, setMexidos] = useState<ReadonlySet<keyof Formulario>>(() => new Set());
  const [erro, setErro] = useState('');
  const [listaAberta, setListaAberta] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const [detalhes, setDetalhes] = useState(() => lerLocal(CHAVE_DETALHES) === '1' || Boolean(emEdicao?.observacao || emEdicao?.operadorNome));
  const [lancadosAgora, setLancadosAgora] = useState<string[]>([]);

  const equipamento = useMemo(() => {
    const texto = semAcento(form.prefixo.split('·')[0].trim());
    return texto ? equipamentos.find(item => semAcento(item.prefixo) === texto) : undefined;
  }, [equipamentos, form.prefixo]);

  const cartoes = useMemo(() => montarQuadro({ dia: form.data, equipamentos: [...equipamentos], registros, gruposEquipe, abastecimentos: [...abastecimentos] }), [abastecimentos, equipamentos, form.data, gruposEquipe, registros]);
  const cartao = equipamento ? cartoes.find(item => item.equipamentoId === equipamento.id) : undefined;
  const contexto = cartao ? contextoDoAbastecimento({ dia: form.data, hora: form.hora, cartao, abastecimentos, ignorarId: emEdicao?.id }) : undefined;
  const horimetroDigitado = lerNumero(form.horimetro);
  const kmDigitado = lerNumero(form.km);
  const avisos = contexto ? avisosDoAbastecimento({ contexto, horimetro: horimetroDigitado, km: kmDigitado }) : [];
  const bomba = useMemo(() => resolveMacroPumpReadings({ records: outros, comboioId: form.comboioId, litros: form.litros, bombaInicialManual: form.bombaInicial }), [form.bombaInicial, form.comboioId, form.litros, outros]);
  const ultimo = equipamento ? outros.find(item => item.equipamentoId === equipamento.id) : undefined;
  const consumo = useMemo(() => {
    if (!equipamento) return undefined;
    return montarConsumoPorEquipamento({ registros: abastecimentos.filter(item => item.equipamentoId === equipamento.id), equipamentos: [equipamento], empresas })[0];
  }, [abastecimentos, empresas, equipamento]);

  // Sugestões: as que estão operando sem diesel hoje e as últimas abastecidas.
  const semDiesel = useMemo(() => operandoSemAbastecer(cartoes, abastecimentos, form.data).slice(0, 8), [abastecimentos, cartoes, form.data]);
  const recentes = useMemo(() => {
    const vistos = new Set<string>();
    const lista: Equipamento[] = [];
    for (const item of abastecimentos) {
      const maquina = porId.get(item.equipamentoId);
      if (!maquina || vistos.has(maquina.id)) continue;
      vistos.add(maquina.id);
      lista.push(maquina);
      if (lista.length === 8) break;
    }
    return lista;
  }, [abastecimentos, porId]);
  const opcoes = useMemo(() => {
    const termo = semAcento(form.prefixo.split('·')[0].trim());
    if (!termo) return [];
    const comeca = equipamentos.filter(item => semAcento(item.prefixo).startsWith(termo));
    const contem = equipamentos.filter(item => !semAcento(item.prefixo).startsWith(termo) && semAcento(`${item.prefixo} ${item.nome}`).includes(termo));
    return [...comeca, ...contem].slice(0, 8);
  }, [equipamentos, form.prefixo]);

  // Ao achar a máquina, puxa operador, canteiro e combustível que a pessoa ainda não mexeu.
  useEffect(() => {
    if (!equipamento) return;
    const ultimoCombustivel = abastecimentos.find(item => item.equipamentoId === equipamento.id && item.tipoCombustivelId)?.tipoCombustivelId;
    setForm(atual => ({
      ...atual,
      tipoCombustivelId: mexidos.has('tipoCombustivelId') ? atual.tipoCombustivelId : ultimoCombustivel || atual.tipoCombustivelId || combustivelPadraoId,
      operador: mexidos.has('operador') || atual.operador ? atual.operador : contexto?.operador || '',
      local: mexidos.has('local') || atual.local ? atual.local : contexto?.canteiro || contexto?.frente || '',
    }));
    // Só quando a máquina ou o dia mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipamento?.id, form.data]);

  useEffect(() => {
    const raizAtual = raiz.current;
    if (!raizAtual || reduzMovimento()) return;
    gsap.fromTo(raizAtual.querySelectorAll('[data-lanc-reveal]'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, []);

  useEffect(() => {
    const alvo = prefixoInicial || emEdicao ? document.getElementById('lanc-litros') : prefixoRef.current;
    window.setTimeout(() => (alvo as HTMLInputElement | null)?.focus(), 60);
    // Foco só ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mudar = (campo: keyof Formulario, valor: string) => {
    setForm(atual => (campo === 'comboioId' ? { ...atual, comboioId: valor, bombaInicial: bombaInicialDoComboio(valor) } : { ...atual, [campo]: valor }));
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
    if (event.key !== 'Enter' || event.shiftKey || (event.target as HTMLElement).tagName === 'TEXTAREA') return;
    event.preventDefault();
    if (!proximoCampo(event.target as HTMLElement)) salvar(!emEdicao);
  };

  const aoTeclarPrefixo = (event: KeyboardEvent<HTMLInputElement>) => {
    if (listaAberta && opcoes.length > 0) {
      if (event.key === 'ArrowDown') { event.preventDefault(); setDestaque(atual => Math.min(opcoes.length - 1, atual + 1)); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); setDestaque(atual => Math.max(0, atual - 1)); return; }
      if (event.key === 'Enter' && !equipamento) { event.preventDefault(); escolherMaquina(opcoes[destaque] || opcoes[0]); return; }
      if (event.key === 'Escape') { setListaAberta(false); return; }
    }
    aoTeclar(event);
  };

  const limpar = () => {
    setForm(atual => ({ ...formularioInicial(), data: atual.data, comboioId: atual.comboioId, bombaInicial: bombaInicialDoComboio(atual.comboioId), tipoCombustivelId: atual.tipoCombustivelId, prefixo: '' }));
    setMexidos(new Set());
    setErro('');
    window.setTimeout(() => prefixoRef.current?.focus(), 30);
  };

  function salvar(outro: boolean) {
    const hora = normalizeQuickTime(form.hora);
    const litros = parseFuelFormNumber(form.litros, 0);
    if (!equipamento) { setErro('Escolha a máquina na lista do prefixo.'); prefixoRef.current?.focus(); return; }
    if (litros <= 0) { setErro('Informe quantos litros foram abastecidos.'); document.getElementById('lanc-litros')?.focus(); return; }
    if (!hora.valid) { setErro('Digite a hora como 1005 ou 10:05.'); document.getElementById('lanc-hora')?.focus(); return; }
    if (!form.comboioId) { setErro('Escolha o comboio que abasteceu.'); return; }
    if (!form.tipoCombustivelId) { setErro('Escolha o combustível.'); return; }
    if (bomba.bombaInicial <= 0) { setErro('Digite a leitura inicial da bomba deste comboio.'); document.getElementById('lanc-bomba')?.focus(); return; }
    const agora = new Date().toISOString();
    const registro = buildMacroFuelingRecord({
      id: emEdicao?.id || crypto.randomUUID(), equipment: equipamento, records: [...outros], data: form.data, hora: form.hora,
      litros: form.litros, horimetro: form.horimetro, km: form.km, tipoCombustivelId: form.tipoCombustivelId, comboioId: form.comboioId,
      responsavel: form.responsavel, bombaInicialManual: form.bombaInicial, operador: form.operador, local: form.local, observacao: form.observacao, nowIso: agora,
    });
    if (emEdicao) {
      // Corrigir não muda de onde o registro veio nem quando nasceu.
      onSalvar({ ...emEdicao, ...registro, origem: emEdicao.origem || registro.origem, criadoEm: emEdicao.criadoEm || registro.criadoEm, alertas: undefined }, false);
      onAviso(`Abastecimento de ${equipamento.prefixo} corrigido.`);
      onFechar();
      return;
    }
    onSalvar(registro, true);
    onAviso(`${equipamento.prefixo} abastecido com ${litrosTexto(litros)}.`);
    setLancadosAgora(atual => [registro.id, ...atual].slice(0, 12));
    if (!outro) { onFechar(); return; }
    setForm(atual => ({
      ...formularioInicial(), data: atual.data, comboioId: atual.comboioId, tipoCombustivelId: atual.tipoCombustivelId, responsavel: atual.responsavel,
      bombaInicial: bomba.bombaFinal > 0 ? paraCampo(bomba.bombaFinal) : bombaInicialDoComboio(atual.comboioId), prefixo: '', hora: agoraHora(),
    }));
    setMexidos(new Set());
    window.setTimeout(() => {
      corpoRef.current?.scrollTo({ top: 0 });
      prefixoRef.current?.focus({ preventScroll: true });
    }, 30);
  }

  useEffect(() => {
    const teclar = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        salvar(!emEdicao);
      }
    };
    document.addEventListener('keydown', teclar);
    return () => document.removeEventListener('keydown', teclar);
  });

  const lancados = lancadosAgora.map(id => abastecimentos.find(item => item.id === id)).filter((item): item is Abastecimento => Boolean(item));
  const totalLancado = lancados.reduce((soma, item) => soma + Number(item.quantidadeLitros || 0), 0);
  const diferenca = (digitado: number | undefined, anterior?: { valor: number }) => (digitado !== undefined && anterior && digitado >= anterior.valor ? digitado - anterior.valor : undefined);
  const horasDesde = diferenca(horimetroDigitado, contexto?.ultimoHorimetro);
  const kmDesde = diferenca(kmDigitado, contexto?.ultimoKm);
  const litrosDigitados = parseFuelFormNumber(form.litros, 0);
  const consumoAgora = horasDesde && horasDesde > 0 && litrosDigitados > 0 ? litrosDigitados / horasDesde : undefined;
  const sugestoes = semDiesel.length > 0 ? semDiesel.map(item => porId.get(item.equipamentoId)).filter((item): item is Equipamento => Boolean(item)) : recentes;

  return (
    <form ref={raiz} onFocus={event => { const alvo = event.target as HTMLElement; if (alvo instanceof HTMLInputElement && alvo.dataset.campo !== undefined && alvo.id !== 'lanc-prefixo') alvo.select(); }} onSubmit={event => { event.preventDefault(); salvar(!emEdicao); }} className="flex flex-col gap-2 pb-20 xl:min-h-0 xl:flex-1 xl:pb-0" data-testid="combustivel-form" noValidate>
      <div className="grid gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section data-lanc-reveal className={`${CARTAO} flex flex-col xl:min-h-0 xl:overflow-hidden`}>
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${emEdicao ? 'bg-orange-50 text-[#f26a2e]' : 'bg-emerald-50 text-[#176b4d]'}`}>{emEdicao ? <Pencil className="size-5" aria-hidden="true" /> : <Fuel className="size-5" aria-hidden="true" />}</span>
              <div>
                <h2 className="text-lg font-black text-slate-950">{emEdicao ? 'Corrigir abastecimento' : 'Novo abastecimento'}</h2>
                <p className="text-xs font-semibold text-slate-500">Enter passa para o próximo campo · Ctrl + S salva · mês do diesel: {mesDoDiesel(form.data)}</p>
              </div>
            </div>
            <div className="hidden gap-2 xl:flex">
              {emEdicao
                ? <button type="button" onClick={onFechar} className={`${BOTAO_SECUNDARIO} min-h-10 px-3`}><X className="size-4" aria-hidden="true" />Cancelar</button>
                : <button type="button" onClick={limpar} className={`${BOTAO_SECUNDARIO} min-h-10 px-3`}><RotateCcw className="size-4" aria-hidden="true" />Limpar</button>}
              {!emEdicao && <button type="button" onClick={() => salvar(false)} className={`${BOTAO_SECUNDARIO} min-h-10 px-3`}><Save className="size-4" aria-hidden="true" />Salvar e sair</button>}
              <button type="submit" className={`${BOTAO_PRIMARIO} min-h-10 px-4`} data-testid="combustivel-salvar"><CheckCircle2 className="size-4" aria-hidden="true" />{emEdicao ? 'Salvar correção' : 'Salvar e lançar outro'}</button>
            </div>
          </header>

          <div ref={corpoRef} className="px-4 py-4 xl:min-h-0 xl:flex-1 xl:overflow-auto">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="relative lg:col-span-2">
                <label htmlFor="lanc-prefixo" className={ROTULO_CAMPO}>Máquina</label>
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input id="lanc-prefixo" ref={prefixoRef} data-campo value={form.prefixo} autoComplete="off" role="combobox" aria-expanded={listaAberta && opcoes.length > 0} aria-controls="lanc-opcoes"
                    onChange={event => { mudar('prefixo', event.target.value.toUpperCase()); setListaAberta(true); setDestaque(0); }}
                    onFocus={() => setListaAberta(true)} onBlur={() => window.setTimeout(() => setListaAberta(false), 150)} onKeyDown={aoTeclarPrefixo}
                    placeholder="Digite o prefixo ou o nome, ex.: LO279" className={`${CAMPO_GRANDE} pl-10 uppercase placeholder:normal-case`} data-testid="combustivel-prefixo" />
                  {equipamento && <CheckCircle2 className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-[#176b4d]" aria-label="Máquina encontrada" />}
                </span>
                {listaAberta && !equipamento && opcoes.length > 0 && (
                  <ul id="lanc-opcoes" role="listbox" className="absolute inset-x-0 z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    {opcoes.map((item, indice) => (
                      <li key={item.id} role="option" aria-selected={indice === destaque}>
                        <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => escolherMaquina(item)}
                          className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left ${indice === destaque ? 'bg-emerald-50' : 'hover:bg-[#f7f8f6]'}`}>
                          <span className="font-mono font-black text-slate-950">{item.prefixo}</span>
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{item.nome}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!equipamento && form.prefixo.trim() && opcoes.length === 0 && <p className="mt-1 text-sm font-semibold text-amber-800">Nenhuma máquina com esse prefixo no cadastro.</p>}
                {!equipamento && sugestoes.length > 0 && (
                  <div className="mt-2">
                    <p className="mb-1 text-xs font-bold text-slate-500">{semDiesel.length > 0 ? 'Operando hoje e ainda sem diesel' : 'Abastecidas por último'}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sugestoes.map(item => (
                        <button key={item.id} type="button" onClick={() => escolherMaquina(item)} title={item.nome}
                          className={`min-h-9 rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-sm font-bold text-slate-800 transition hover:border-[#176b4d] hover:text-[#176b4d] ${FOCO}`}>{item.prefixo}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="lanc-litros" className={ROTULO_CAMPO}>Litros</label>
                <input id="lanc-litros" data-campo inputMode="decimal" value={form.litros} onChange={event => mudar('litros', event.target.value)} onKeyDown={aoTeclar} placeholder="0" className={`${CAMPO_GRANDE} text-[#176b4d]`} data-testid="combustivel-litros" />
                {consumoAgora !== undefined && consumo?.consumoHabitual && consumo.unidade === 'L/h' && (
                  <p className={`mt-1 text-xs font-semibold ${consumoAgora >= consumo.consumoHabitual * 1.5 ? 'text-[#f26a2e]' : 'text-slate-500'}`}>
                    Dá {numeroTexto(consumoAgora)} L/h; ela costuma gastar {textoConsumo(consumo.consumoHabitual, 'L/h')}.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                <div>
                  <label htmlFor="lanc-data" className={ROTULO_CAMPO}>Dia</label>
                  <input id="lanc-data" type="date" value={form.data} max={isoDay(new Date())} onChange={event => mudar('data', event.target.value || isoDay(new Date()))} className={CAMPO} />
                </div>
                <div>
                  <label htmlFor="lanc-hora" className={ROTULO_CAMPO}>Hora</label>
                  <span className="relative block">
                    <input id="lanc-hora" data-campo inputMode="numeric" value={form.hora} onChange={event => mudar('hora', event.target.value)} onKeyDown={aoTeclar}
                      onBlur={() => { const hora = normalizeQuickTime(form.hora); if (hora.valid) setForm(atual => ({ ...atual, hora: hora.value })); }} placeholder="10:05" className={`${CAMPO} pr-11 font-mono`} />
                    <button type="button" onClick={() => mudar('hora', agoraHora())} aria-label="Usar a hora de agora" title="Agora" className={`absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:text-[#176b4d] ${FOCO}`}><Clock className="size-4" aria-hidden="true" /></button>
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="lanc-horimetro" className={ROTULO_CAMPO}>Horímetro</label>
                <input id="lanc-horimetro" data-campo inputMode="decimal" value={form.horimetro} onChange={event => mudar('horimetro', event.target.value)} onKeyDown={aoTeclar}
                  placeholder={contexto?.ultimoHorimetro ? `último ${numeroTexto(contexto.ultimoHorimetro.valor)}` : 'se tiver'} className={`${CAMPO} font-mono`} data-testid="combustivel-horimetro" />
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {horasDesde !== undefined ? `+${numeroTexto(horasDesde)} h desde ${dataCurta(contexto?.ultimoHorimetro?.data || '')}` : contexto?.ultimoHorimetro ? `Último: ${numeroTexto(contexto.ultimoHorimetro.valor)} h em ${dataCurta(contexto.ultimoHorimetro.data)}` : 'Deixe vazio se a máquina não tem horímetro.'}
                </p>
              </div>
              <div>
                <label htmlFor="lanc-km" className={ROTULO_CAMPO}>KM</label>
                <input id="lanc-km" data-campo inputMode="decimal" value={form.km} onChange={event => mudar('km', event.target.value)} onKeyDown={aoTeclar}
                  placeholder={contexto?.ultimoKm ? `último ${numeroTexto(contexto.ultimoKm.valor)}` : 'se tiver'} className={`${CAMPO} font-mono`} data-testid="combustivel-km" />
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {kmDesde !== undefined ? `+${numeroTexto(kmDesde)} km desde ${dataCurta(contexto?.ultimoKm?.data || '')}` : contexto?.ultimoKm ? `Último: ${numeroTexto(contexto.ultimoKm.valor)} km em ${dataCurta(contexto.ultimoKm.data)}` : 'Para caminhão e carro.'}
                </p>
              </div>

              <fieldset className="lg:col-span-2">
                <legend className={ROTULO_CAMPO}>Comboio</legend>
                {comboios.length <= 6 ? (
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Comboio">
                    {comboios.map(item => (
                      <button key={item.id} type="button" role="radio" aria-checked={form.comboioId === item.id} onClick={() => mudar('comboioId', item.id)}
                        className={`min-h-11 rounded-xl border px-4 text-sm font-bold transition ${form.comboioId === item.id ? 'border-[#176b4d] bg-emerald-50 text-[#176b4d]' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'} ${FOCO}`}>{item.nome}</button>
                    ))}
                    {comboios.length === 0 && <p className="text-sm text-slate-500">Nenhum comboio no cadastro.</p>}
                  </div>
                ) : (
                  <select value={form.comboioId} onChange={event => mudar('comboioId', event.target.value)} className={CAMPO} aria-label="Comboio">
                    <option value="">Escolha o comboio</option>
                    {comboios.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                  </select>
                )}
              </fieldset>

              <div>
                <label htmlFor="lanc-bomba" className={ROTULO_CAMPO}>Bomba inicial</label>
                <input id="lanc-bomba" data-campo inputMode="decimal" value={form.bombaInicial} onChange={event => mudar('bombaInicial', event.target.value)} onKeyDown={aoTeclar}
                  placeholder={form.comboioId ? 'leitura da bomba antes' : 'escolha o comboio'} className={`${CAMPO} font-mono`} data-testid="combustivel-bomba-inicial" />
                <p className="mt-1 text-xs font-semibold text-slate-500">Vem da última leitura do comboio. Corrija se a bomba mostrar outro número.</p>
              </div>
              <div>
                <span className={ROTULO_CAMPO}>Bomba final</span>
                <output className="flex min-h-11 items-center rounded-xl bg-[#f7f8f6] px-3 font-mono text-base font-black text-slate-900 ring-1 ring-inset ring-slate-200" data-testid="combustivel-bomba-final">{bomba.bombaFinal > 0 ? numeroTexto(bomba.bombaFinal) : '—'}</output>
                <p className="mt-1 text-xs font-semibold text-slate-500">Inicial + litros, calculado sozinho.</p>
              </div>

              <div className="lg:col-span-2">
                <button type="button" aria-expanded={detalhes} onClick={() => { setDetalhes(atual => { gravarLocal(CHAVE_DETALHES, atual ? '0' : '1'); return !atual; }); }}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-bold text-[#176b4d] ${FOCO}`}>
                  <ChevronDown className={`size-4 transition ${detalhes ? '' : '-rotate-90'}`} aria-hidden="true" />Mais detalhes (combustível, operador, local, observação)
                </button>
                {detalhes && (
                  <div className="mt-2 grid gap-3 rounded-xl bg-[#f7f8f6] p-3 sm:grid-cols-2">
                    <label><span className={ROTULO_CAMPO}>Combustível</span>
                      <select value={form.tipoCombustivelId} onChange={event => mudar('tipoCombustivelId', event.target.value)} className={CAMPO} data-testid="combustivel-tipo">
                        <option value="">Escolha</option>
                        {combustiveis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                      </select>
                    </label>
                    <label><span className={ROTULO_CAMPO}>Operador</span><input value={form.operador} onChange={event => mudar('operador', event.target.value)} onKeyDown={aoTeclar} placeholder="quem estava na máquina" className={CAMPO} /></label>
                    <label><span className={ROTULO_CAMPO}>Local</span><input value={form.local} onChange={event => mudar('local', event.target.value)} onKeyDown={aoTeclar} placeholder="canteiro ou frente" className={CAMPO} /></label>
                    <label><span className={ROTULO_CAMPO}>Quem lançou</span><input value={form.responsavel} onChange={event => mudar('responsavel', event.target.value)} onKeyDown={aoTeclar} className={CAMPO} /></label>
                    <label className="sm:col-span-2"><span className={ROTULO_CAMPO}>Observação</span><textarea value={form.observacao} onChange={event => mudar('observacao', event.target.value)} rows={2} className={`${CAMPO} py-2`} /></label>
                  </div>
                )}
              </div>
            </div>
            {erro && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 ring-1 ring-inset ring-rose-200" data-testid="combustivel-erro"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{erro}</p>}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-2 xl:overflow-auto" aria-label="Sobre a máquina">
          <section data-lanc-reveal className={`${CARTAO} p-4`} data-testid="lanc-maquina">
            {equipamento ? (
              <>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{empresas.find(item => item.id === equipamento.empresaId)?.nome || 'Sem empresa'}</p>
                <p className="font-mono text-2xl font-black text-slate-950">{equipamento.prefixo}</p>
                <p className="text-sm text-slate-600">{equipamento.nome}</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div><dt className="text-xs font-bold text-slate-500">Hoje</dt><dd className="font-semibold text-slate-900">{contexto?.situacao || '—'}</dd></div>
                  <div><dt className="text-xs font-bold text-slate-500">Operador</dt><dd className="truncate font-semibold text-slate-900">{contexto?.operador || '—'}</dd></div>
                  <div><dt className="text-xs font-bold text-slate-500">Último diesel</dt><dd className="font-semibold text-slate-900">{ultimo ? `${dataCurta(ultimo.data)} · ${litrosTexto(Number(ultimo.quantidadeLitros || 0))}` : 'nenhum'}</dd></div>
                  <div><dt className="text-xs font-bold text-slate-500">Costuma gastar</dt><dd className="font-semibold text-slate-900">{textoConsumo(consumo?.consumoHabitual, consumo?.unidade)}</dd></div>
                </dl>
              </>
            ) : (
              <div className="flex items-center gap-3 text-sm text-slate-500"><Gauge className="size-8 shrink-0 text-slate-300" aria-hidden="true" />Escolha a máquina para ver a última leitura e quanto ela costuma gastar.</div>
            )}
          </section>

          {avisos.length > 0 && (
            <ul data-lanc-reveal className="space-y-1.5" data-testid="combustivel-avisos">
              {avisos.map(item => (
                <li key={item.texto} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-inset ${item.tom === 'alerta' ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-white text-slate-700 ring-slate-200'}`}>
                  {item.tom === 'alerta' ? <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}{item.texto}
                </li>
              ))}
            </ul>
          )}

          {!emEdicao && (
            <section data-lanc-reveal className={`${CARTAO} flex min-h-0 flex-col overflow-hidden`} aria-label="Lançados agora">
              <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
                <h3 className="text-sm font-black text-slate-900">Lançados agora</h3>
                <span className="text-sm font-black tabular-nums text-[#176b4d]">{litrosTexto(totalLancado)}</span>
              </header>
              {lancados.length === 0
                ? <p className="px-4 py-5 text-sm text-slate-500">O que você salvar aparece aqui, para conferir ou corrigir na hora.</p>
                : <ul className="divide-y divide-slate-100" data-testid="lanc-lancados">
                    {lancados.map(item => (
                      <li key={item.id} className="flex items-center gap-2 px-4 py-2">
                        <span className="font-mono text-sm font-black text-slate-950">{porId.get(item.equipamentoId)?.prefixo || item.prefixoInformado}</span>
                        <span className="text-xs text-slate-500">{item.hora}</span>
                        <span className="ml-auto text-sm font-black tabular-nums text-[#176b4d]">{litrosTexto(Number(item.quantidadeLitros || 0))}</span>
                        <button type="button" onClick={() => onEditar(item)} aria-label={`Corrigir ${porId.get(item.equipamentoId)?.prefixo || 'lançamento'}`} className={`grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#176b4d] ${FOCO}`}><Pencil className="size-4" aria-hidden="true" /></button>
                      </li>
                    ))}
                  </ul>}
            </section>
          )}
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-slate-200 bg-white p-3 xl:hidden">
        {emEdicao
          ? <button type="button" onClick={onFechar} className={`${BOTAO_SECUNDARIO} flex-1`}>Cancelar</button>
          : <button type="button" onClick={() => salvar(false)} className={`${BOTAO_SECUNDARIO} flex-1`}>Salvar e sair</button>}
        <button type="submit" className={`${BOTAO_PRIMARIO} flex-[1.4]`}><CheckCircle2 className="size-4" aria-hidden="true" />{emEdicao ? 'Salvar correção' : 'Salvar e outro'}</button>
      </div>
    </form>
  );
}
