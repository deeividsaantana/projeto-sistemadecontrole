/**
 * Lançar (ou corrigir) um abastecimento como no formulário da planilha
 * FORNECIMENTO DIESEL: uma janela inteira, os mesmos campos na mesma ordem
 * (mês, data, prefixo, descrição, empresa, KM, horímetro, litros, hora,
 * comboio, combustível, bombas) e os botões Salvar, Limpar e Fechar embaixo.
 * Descrição e empresa saem do cadastro, a bomba inicial é a última bomba final
 * do comboio e a final é inicial + litros. Enter passa de campo, Ctrl + S salva
 * e já deixa pronto para o próximo, Esc fecha.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { AlertTriangle, CheckCircle2, Clock, Info, RotateCcw, Search, X } from 'lucide-react';
import type { Abastecimento, Comboio, ControleEquipamentoDiario, Empresa, Equipamento, GrupoEquipe, TipoCombustivel } from '../../types';
import { isoDay } from '../../shared/ui';
import { montarQuadro } from '../../modules/frota/quadroFrota';
import { avisosDoAbastecimento, contextoDoAbastecimento, lerNumero } from '../../modules/frota/combustivelDoDia';
import { montarConsumoPorEquipamento, textoConsumo } from '../../modules/frota/consumoPorEquipamento';
import { buildMacroFuelingRecord, getDefaultDieselFuelId, parseFuelFormNumber, resolveMacroPumpReadings } from '../../utils/fuelMacroForm';
import { normalizeQuickTime } from '../../utils/combustivelValidation';
import { getFuelRecordCompetence } from '../../modules/frota/fuelReport';
import { nomeDoMes } from '../../modules/frota/planilhaDiesel';
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
const CAMPO_GRANDE = `min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-lg font-bold tabular-nums text-slate-900 placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-slate-400 transition duration-200 focus:border-emerald-500 ${FOCO}`;

/** Uma linha do formulário da planilha: nome à esquerda, campo à direita. */
function Linha({ rotulo, para, dica, children }: { rotulo: string; para?: string; dica?: ReactNode; children: ReactNode }) {
  return (
    <div data-lanc-reveal className="grid gap-1 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-start sm:gap-3 lg:grid-cols-[9rem_minmax(0,1fr)]">
      {para
        ? <label htmlFor={para} className="text-sm font-bold text-slate-700 sm:pt-3">{rotulo}</label>
        : <span className="text-sm font-bold text-slate-700 sm:pt-3">{rotulo}</span>}
      <div className="min-w-0">
        {children}
        {dica && <p className="mt-1 text-xs font-semibold text-slate-500">{dica}</p>}
      </div>
    </div>
  );
}

export default function LancamentoCombustivel({
  abastecimentos, equipamentos, empresas, comboios, combustiveis, registros = [], gruposEquipe = [], usuario,
  emEdicao, prefixoInicial = '', comboioInicial, onSalvar, onFechar, onAviso,
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

  const equipamento = useMemo(() => {
    const texto = semAcento(form.prefixo.trim());
    return texto ? equipamentos.find(item => semAcento(item.prefixo) === texto) : undefined;
  }, [equipamentos, form.prefixo]);

  const naoCadastrado = !equipamento && form.prefixo.trim().length > 0 && !listaAberta;
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
    const alvo = prefixoInicial || emEdicao ? document.getElementById('lanc-km') : prefixoRef.current;
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
    window.setTimeout(() => document.getElementById('lanc-km')?.focus(), 30);
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
    if (!equipamento) { setErro('Escolha a máquina na lista do prefixo.'); prefixoRef.current?.focus(); return; }
    if (litros <= 0) { setErro('Informe quantos litros foram abastecidos.'); document.getElementById('lanc-litros')?.focus(); return; }
    if (!hora.valid) { setErro('Digite a hora como 1005 ou 10:05.'); document.getElementById('lanc-hora')?.focus(); return; }
    if (!form.comboioId) { setErro('Escolha o comboio que abasteceu.'); document.getElementById('lanc-comboio')?.focus(); return; }
    if (!form.tipoCombustivelId) { setErro('Escolha o combustível.'); return; }
    if (bomba.bombaInicial <= 0) { setErro('Digite a leitura inicial da bomba deste comboio.'); document.getElementById('lanc-bomba')?.focus(); return; }
    const agora = new Date().toISOString();
    const registro = buildMacroFuelingRecord({
      id: emEdicao?.id || crypto.randomUUID(), equipment: equipamento, records: [...outros], data: form.data, hora: form.hora,
      litros: form.litros, horimetro: form.horimetro, km: form.km, tipoCombustivelId: form.tipoCombustivelId, comboioId: form.comboioId,
      responsavel: emEdicao?.responsavel || usuario, bombaInicialManual: form.bombaInicial,
      operador: emEdicao?.operadorNome || contexto?.operador || '', local: emEdicao?.localAbastecimento || contexto?.canteiro || contexto?.frente || '',
      observacao: emEdicao?.observacao || '', nowIso: agora,
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
    setLancadosAgora(atual => [registro.id, ...atual]);
    setStatus(`Salvo: ${equipamento.prefixo}, ${litrosTexto(litros)}. Pronto para o próximo.`);
    setForm(atual => ({
      ...formularioInicial(), data: atual.data, comboioId: atual.comboioId, tipoCombustivelId: atual.tipoCombustivelId,
      bombaInicial: bomba.bombaFinal > 0 ? paraCampo(bomba.bombaFinal) : bombaInicialDoComboio(atual.comboioId, atual.data, agoraHora()), prefixo: '', hora: agoraHora(),
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

  return (
    <form ref={raiz} onFocus={event => { const alvo = event.target as HTMLElement; if (alvo instanceof HTMLInputElement && alvo.dataset.campo !== undefined && alvo.id !== 'lanc-prefixo') alvo.select(); }}
      onSubmit={event => { event.preventDefault(); salvar(); }} className="flex min-h-0 flex-1 flex-col" data-testid="combustivel-form" noValidate>
      <div ref={corpoRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-6">
        <section className={`${CARTAO} w-full p-4 sm:px-6 sm:py-5 lg:min-h-full lg:text-base [&_input]:lg:min-h-12 [&_input]:lg:text-base [&_select]:lg:min-h-12 [&_select]:lg:text-base`}>
          <div className="grid gap-2.5">
            <div className="grid gap-3 md:grid-cols-2 md:gap-x-6">
              <Linha rotulo="Mês">
                <output className={`${SOMENTE_LEITURA} text-slate-900`} data-testid="combustivel-mes">{nomeDoMes(getFuelRecordCompetence({ data: form.data }))}</output>
              </Linha>
              <Linha rotulo="Data" para="lanc-data">
                <input id="lanc-data" type="date" value={form.data} max={isoDay(new Date())} onChange={event => mudar('data', event.target.value || isoDay(new Date()))} className={CAMPO} />
              </Linha>
            </div>

            <Linha rotulo="Prefixo" para="lanc-prefixo">
              <span className="relative block sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input id="lanc-prefixo" ref={prefixoRef} data-campo value={form.prefixo} autoComplete="off" role="combobox" aria-expanded={listaAberta && opcoes.length > 0} aria-controls="lanc-opcoes"
                  onChange={event => { mudar('prefixo', event.target.value.toUpperCase()); setListaAberta(true); setDestaque(0); }}
                  onFocus={() => setListaAberta(true)} onBlur={() => window.setTimeout(() => setListaAberta(false), 150)} onKeyDown={aoTeclarPrefixo}
                  placeholder="Digite o prefixo, ex.: LO279" className={`${CAMPO_GRANDE} pl-10 uppercase placeholder:normal-case`} data-testid="combustivel-prefixo" />
                {equipamento && <CheckCircle2 className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-[#176b4d]" aria-label="Máquina encontrada" />}
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
              </span>
            </Linha>
            <Linha rotulo="Descrição">
              <output className={`${SOMENTE_LEITURA} ${naoCadastrado ? 'text-rose-600' : 'text-slate-900'}`} data-testid="combustivel-descricao"><span className="truncate">{equipamento?.nome || (naoCadastrado ? 'NÃO CADASTRADO' : '—')}</span></output>
            </Linha>
            <Linha rotulo="Empresa">
              <output className={`${SOMENTE_LEITURA} ${naoCadastrado ? 'text-rose-600' : 'text-slate-900'}`} data-testid="combustivel-empresa"><span className="truncate">{equipamento ? empresaNome : naoCadastrado ? 'NÃO CADASTRADO' : '—'}</span></output>
            </Linha>

            <div className="grid gap-3 border-t border-slate-100 pt-2.5 md:grid-cols-2 md:gap-x-6">
              <Linha rotulo="KM inicial" para="lanc-km"
                dica={kmDesde !== undefined ? `+${numeroTexto(kmDesde)} km desde ${dataCurta(contexto?.ultimoKm?.data || '')}` : contexto?.ultimoKm ? `Último: ${numeroTexto(contexto.ultimoKm.valor)} km` : undefined}>
                <input id="lanc-km" data-campo inputMode="decimal" value={form.km} onChange={event => mudar('km', event.target.value)} onKeyDown={aoTeclar}
                  placeholder="se tiver" className={`${CAMPO} font-mono placeholder:font-sans`} data-testid="combustivel-km" />
              </Linha>
              <Linha rotulo="Horímetro" para="lanc-horimetro"
                dica={horasDesde !== undefined ? `+${numeroTexto(horasDesde)} h desde ${dataCurta(contexto?.ultimoHorimetro?.data || '')}` : contexto?.ultimoHorimetro ? `Último: ${numeroTexto(contexto.ultimoHorimetro.valor)} h` : undefined}>
                <input id="lanc-horimetro" data-campo inputMode="decimal" value={form.horimetro} onChange={event => mudar('horimetro', event.target.value)} onKeyDown={aoTeclar}
                  placeholder="se tiver" className={`${CAMPO} font-mono placeholder:font-sans`} data-testid="combustivel-horimetro" />
              </Linha>
              <Linha rotulo="Litros" para="lanc-litros"
                dica={gastoAlto && consumo ? <span className="text-[#f26a2e]">Dá {numeroTexto(consumoAgora ?? 0)} L/h; ela costuma gastar {textoConsumo(consumo.consumoHabitual, 'L/h')}.</span> : undefined}>
                <input id="lanc-litros" data-campo inputMode="decimal" value={form.litros} onChange={event => mudar('litros', event.target.value)} onKeyDown={aoTeclar} placeholder="0" className={`${CAMPO_GRANDE} text-[#176b4d]`} data-testid="combustivel-litros" />
              </Linha>
              <Linha rotulo="Hora" para="lanc-hora">
                <span className="relative block">
                  <input id="lanc-hora" data-campo inputMode="numeric" value={form.hora} onChange={event => mudar('hora', event.target.value)} onKeyDown={aoTeclar}
                    onBlur={() => { const hora = normalizeQuickTime(form.hora); if (hora.valid) setForm(atual => ({ ...atual, hora: hora.value })); }} placeholder="10:05" className={`${CAMPO_GRANDE} pr-11`} data-testid="combustivel-hora" />
                  <button type="button" onClick={() => mudar('hora', agoraHora())} aria-label="Usar a hora de agora" title="Agora" className={`absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:text-[#176b4d] ${FOCO}`}><Clock className="size-4" aria-hidden="true" /></button>
                </span>
              </Linha>
            </div>

            <div className="grid gap-3 border-t border-slate-100 pt-2.5 md:grid-cols-2 md:gap-x-6">
              <Linha rotulo="Comboio" para="lanc-comboio">
                <select id="lanc-comboio" value={form.comboioId} onChange={event => mudar('comboioId', event.target.value)} className={CAMPO} data-testid="combustivel-comboio">
                  <option value="">Escolha o comboio</option>
                  {comboios.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </Linha>
              <Linha rotulo="Combustível" para="lanc-tipo">
                <select id="lanc-tipo" value={form.tipoCombustivelId} onChange={event => mudar('tipoCombustivelId', event.target.value)} className={CAMPO} data-testid="combustivel-tipo">
                  <option value="">Escolha</option>
                  {combustiveis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </Linha>
            </div>

            <div className="grid gap-3 border-t border-slate-100 pt-2.5 md:grid-cols-2 md:gap-x-6">
              <Linha rotulo="Bomba inicial" para="lanc-bomba" dica="Vem da última bomba final do comboio.">
                <input id="lanc-bomba" data-campo inputMode="decimal" value={form.bombaInicial} onChange={event => mudar('bombaInicial', event.target.value)} onKeyDown={aoTeclar}
                  placeholder={form.comboioId ? 'leitura antes' : 'escolha o comboio'} className={`${CAMPO} font-mono placeholder:font-sans`} data-testid="combustivel-bomba-inicial" />
              </Linha>
              <Linha rotulo="Bomba final" dica="Inicial + litros.">
                <output className={`${SOMENTE_LEITURA} font-mono font-black text-slate-900`} data-testid="combustivel-bomba-final">{bomba.bombaFinal > 0 ? numeroTexto(bomba.bombaFinal) : '—'}</output>
              </Linha>
            </div>

            <p role="status" data-lanc-reveal className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold ${erro || naoCadastrado ? 'bg-rose-50 text-rose-700' : avisos.length ? 'bg-amber-50 text-amber-900' : equipamento ? 'bg-emerald-50 text-[#176b4d]' : 'bg-[#f7f8f6] text-slate-600'}`} data-testid="combustivel-status">
              {erro || naoCadastrado || avisos.length ? <AlertTriangle className="size-4 shrink-0" aria-hidden="true" /> : <Info className="size-4 shrink-0" aria-hidden="true" />}
              <span data-testid={erro ? 'combustivel-erro' : undefined}>{erro || (naoCadastrado ? 'Prefixo não encontrado no cadastro.' : avisos[0]?.texto || (equipamento && status.startsWith('Pronto') ? 'Equipamento localizado.' : status))}</span>
            </p>
          </div>
        </section>
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-white px-3 py-3 sm:px-6">
        <div className="flex w-full flex-wrap items-center gap-2">
          {!emEdicao && lancadosAgora.length > 0 && (
            <p className="w-full text-sm font-bold text-slate-600 sm:w-auto sm:flex-1" data-testid="lanc-lancados">
              {lancadosAgora.length} lançado(s) agora · <span className="tabular-nums text-[#176b4d]">{litrosTexto(totalLancado)}</span>
            </p>
          )}
          <div className="ml-auto grid w-full grid-cols-[1fr_1fr_1.4fr] gap-2 sm:flex sm:w-auto">
            <button type="button" onClick={onFechar} className={`${BOTAO_SECUNDARIO} min-w-0 px-2 sm:px-4`}><X className="size-4" aria-hidden="true" />{emEdicao ? 'Cancelar' : 'Fechar'}</button>
            <button type="button" onClick={emEdicao ? () => setForm(formularioInicial()) : limpar} className={`${BOTAO_SECUNDARIO} min-w-0 px-2 sm:px-4`}><RotateCcw className="size-4" aria-hidden="true" />Limpar</button>
            <button type="submit" className={`${BOTAO_PRIMARIO} min-w-0 px-2 sm:min-w-40 sm:px-6`} data-testid="combustivel-salvar"><CheckCircle2 className="size-4" aria-hidden="true" />{emEdicao ? 'Salvar correção' : 'Salvar'}</button>
          </div>
        </div>
      </footer>
    </form>
  );
}
