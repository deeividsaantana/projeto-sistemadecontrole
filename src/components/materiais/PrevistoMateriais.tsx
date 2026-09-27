/**
 * Previsto do mês: quanto de cada material cada ramo deve receber e quanto
 * já chegou, com a porcentagem e o ritmo. Só o previsto é digitado aqui; o
 * realizado é a soma dos movimentos, pelo local de cada entrega.
 */
import { useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Copy, MapPinned, Pencil, Plus, Target, X } from 'lucide-react';
import type { EtapaServico, Material, MovimentoMaterial, PrevistoMaterial } from '../../types';
import {
  SITUACAO_PREVISTO,
  acompanharMes,
  copiarPrevistos,
  diasNoMes,
  mesDe,
  nomeDoMes,
  ramosDaObra,
  somarMes,
  validarPrevisto,
  type ChegouSemPrevisto,
  type LinhaPrevisto,
} from '../../modules/materials/previstoMateriais';
import { chaveLocal } from '../../modules/materials/locaisSge';
import { numero } from '../../utils/formato';
import { EmptyState, Modal } from '../../shared/ui';
import CampoEscolha from './CampoEscolha';
import { BOTAO_PERIGO, BOTAO_PERIGO_LEVE, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO, reduzMovimento } from '../cadastros/estilos';

interface Props {
  hoje: string;
  materiais: Material[];
  movimentos: MovimentoMaterial[];
  etapas: EtapaServico[];
  previstos: PrevistoMaterial[];
  responsavel: string;
  podeEditar: boolean;
  onSavePrevistos: (previstos: PrevistoMaterial[], descricao: string) => void;
  onIrParaLocais: () => void;
}

interface Edicao {
  id: string | null;
  mes: string;
  ramo: string;
  materialId: string;
  quantidade: string;
  observacao: string;
}

const novoId = () => `previsto-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const plural = (quantidade: number, um: string, varios: string) => `${quantidade.toLocaleString('pt-BR')} ${quantidade === 1 ? um : varios}`;
const diaMes = (dia?: string) => (dia ? `${dia.slice(8, 10)}/${dia.slice(5, 7)}` : '');
const maiuscula = (texto: string) => texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1);
/** Seis meses para trás e doze para a frente, mais o mês que já está no previsto. */
const mesesParaEscolher = (mesHoje: string, atual: string) => {
  const meses = Array.from({ length: 19 }, (_, indice) => somarMes(mesHoje, indice - 6));
  return meses.includes(atual) ? meses : [...meses, atual].sort();
};
const lerNumero = (texto: string) => Number(texto.replace(/\./g, '').replace(',', '.'));

const TOM_CHIP = {
  ok: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  alerta: 'bg-orange-50 text-orange-800 ring-orange-200',
  neutro: 'bg-slate-100 text-slate-600 ring-slate-200',
} as const;
const TOM_BARRA = { ok: 'bg-[#176b4d]', alerta: 'bg-[#f26a2e]', neutro: 'bg-[#718087]' } as const;

export default function PrevistoMateriais({ hoje, materiais, movimentos, etapas, previstos, responsavel, podeEditar, onSavePrevistos, onIrParaLocais }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const quantidadeRef = useRef<HTMLInputElement>(null);
  const mesHoje = mesDe(hoje);
  const [mes, setMes] = useState(mesHoje);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [confirmarTirar, setConfirmarTirar] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  // Sem nada previsto, a lista do que chegou já vem aberta: é o ponto de partida.
  const [semPrevistoAberto, setSemPrevistoAberto] = useState<boolean | null>(null);

  const ativos = useMemo(() => materiais.filter(item => item.ativo !== false), [materiais]);
  const ramos = useMemo(() => ramosDaObra(etapas), [etapas]);
  const { linhas, semPrevisto } = useMemo(
    () => acompanharMes({ mes, hoje, previstos, movimentos, etapas, materiais }),
    [etapas, hoje, materiais, mes, movimentos, previstos],
  );
  const listaAberta = semPrevistoAberto ?? linhas.length === 0;
  const mesAnterior = somarMes(mes, -1);
  const paraCopiar = useMemo(
    () => copiarPrevistos(previstos, mesAnterior, mes, responsavel, '', () => ''),
    [mes, mesAnterior, previstos, responsavel],
  );

  const grupos = useMemo(() => {
    const mapa = new Map<string, { ramo: string; linhas: LinhaPrevisto[] }>();
    linhas.forEach(linha => {
      const chave = chaveLocal(linha.previsto.ramo);
      const grupo = mapa.get(chave) ?? { ramo: linha.previsto.ramo, linhas: [] };
      grupo.linhas.push(linha);
      mapa.set(chave, grupo);
    });
    return [...mapa.values()];
  }, [linhas]);

  const atencao = linhas.filter(linha => SITUACAO_PREVISTO[linha.situacao].tom === 'alerta').length;
  const atingidos = linhas.filter(linha => linha.situacao === 'atingido' || linha.situacao === 'passou').length;
  const passouDoMes = mes === mesHoje ? Math.round((Number(hoje.slice(8, 10)) / diasNoMes(mes)) * 100) : null;

  useGSAP(() => {
    if (!raiz.current || reduzMovimento()) return;
    gsap.fromTo(raiz.current.querySelectorAll('[data-previsto-reveal]'), { opacity: 0, y: 12 }, {
      opacity: 1, y: 0, duration: 0.4, stagger: 0.035, ease: 'power3.out', clearProps: 'transform,opacity',
    });
    // A barra enche até a porcentagem: dá para ver de longe quem está atrasado.
    gsap.from(raiz.current.querySelectorAll('[data-previsto-barra]'), { scaleX: 0, transformOrigin: 'left center', duration: 0.7, ease: 'power2.out', stagger: 0.03, clearProps: 'transform' });
  }, { scope: raiz, dependencies: [mes] });

  const trocarMes = (quantos: number) => {
    setMes(atual => somarMes(atual, quantos));
    setAviso('');
  };

  const abrir = (linha?: LinhaPrevisto, base?: Partial<Edicao>) => {
    setErro('');
    setConfirmarTirar(false);
    setEdicao(linha
      ? { id: linha.previsto.id, mes: linha.previsto.mes, ramo: linha.previsto.ramo, materialId: linha.previsto.materialId, quantidade: String(linha.previsto.quantidade).replace('.', ','), observacao: linha.previsto.observacao || '' }
      : { id: null, mes, ramo: '', materialId: '', quantidade: '', observacao: '', ...base });
  };

  const materialEscolhido = ativos.find(item => item.id === edicao?.materialId) ?? materiais.find(item => item.id === edicao?.materialId);

  const salvar = () => {
    if (!edicao) return;
    const quantidade = lerNumero(edicao.quantidade);
    const problema = validarPrevisto({ id: edicao.id || '', mes: edicao.mes, ramo: edicao.ramo, materialId: edicao.materialId, quantidade }, previstos);
    if (problema || !materialEscolhido) {
      setErro(problema || 'Escolha o material.');
      return;
    }
    const agora = new Date().toISOString();
    const anterior = previstos.find(item => item.id === edicao.id);
    const registro: PrevistoMaterial = {
      ...anterior,
      id: edicao.id || novoId(),
      mes: edicao.mes,
      ramo: edicao.ramo,
      materialId: materialEscolhido.id,
      materialDescricao: materialEscolhido.descricao,
      // A unidade vale a do dia em que o previsto foi feito: mudar o cadastro depois não troca a conta.
      unidade: anterior?.materialId === materialEscolhido.id ? anterior.unidade : materialEscolhido.unidade,
      quantidade,
      observacao: edicao.observacao.trim() || undefined,
      responsavel: anterior?.responsavel || responsavel,
      ativo: true,
      criadoEm: anterior?.criadoEm || agora,
      atualizadoEm: agora,
    };
    const texto = `${numero(quantidade)} ${registro.unidade} de ${registro.materialDescricao} no ${registro.ramo} em ${nomeDoMes(registro.mes)}`;
    onSavePrevistos([registro], `${anterior ? 'Editou o previsto' : 'Previu'} ${texto}.`);
    setEdicao(null);
    setMes(registro.mes);
    setAviso(`${anterior ? 'Previsto salvo' : 'Previsto'}: ${texto}.`);
  };

  const tirar = () => {
    const anterior = previstos.find(item => item.id === edicao?.id);
    if (!anterior) return;
    onSavePrevistos([{ ...anterior, ativo: false, atualizadoEm: new Date().toISOString() }], `Tirou o previsto de ${anterior.materialDescricao} no ${anterior.ramo} em ${nomeDoMes(anterior.mes)}.`);
    setEdicao(null);
    setAviso(`Previsto de ${anterior.materialDescricao} no ${anterior.ramo} tirado. O que chegou continua nos movimentos.`);
  };

  const copiar = () => {
    const agora = new Date().toISOString();
    const copiados = copiarPrevistos(previstos, mesAnterior, mes, responsavel, agora, novoId);
    if (!copiados.length) return;
    onSavePrevistos(copiados, `Copiou ${copiados.length} previsto(s) de ${nomeDoMes(mesAnterior)} para ${nomeDoMes(mes)}.`);
    setAviso(`${plural(copiados.length, 'previsto copiado', 'previstos copiados')} de ${nomeDoMes(mesAnterior)}. Confira as quantidades e ajuste o que mudou.`);
  };

  const linhaPrevisto = (linha: LinhaPrevisto) => {
    const { previsto } = linha;
    const info = SITUACAO_PREVISTO[linha.situacao];
    const largura = Math.min(100, linha.porcentagem);
    const marca = linha.esperadoAteHoje != null && previsto.quantidade > 0 ? Math.min(100, (linha.esperadoAteHoje / previsto.quantidade) * 100) : null;
    const detalhes = [
      linha.entregas ? `${plural(linha.entregas, 'entrega', 'entregas')}, a última em ${diaMes(linha.ultimaEntrega)}` : 'Nenhuma entrega no mês',
      linha.esperadoAteHoje != null && linha.situacao !== 'atingido' && linha.situacao !== 'passou' ? `até hoje deviam ter chegado ${numero(linha.esperadoAteHoje, 1)} ${previsto.unidade}` : '',
      linha.aplicado ? `${numero(linha.aplicado)} ${previsto.unidade} aplicado` : '',
    ].filter(Boolean);
    const conteudo = (
      <>
        <span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <strong className="min-w-0 break-words text-base font-bold text-slate-900 sm:text-sm">{previsto.materialDescricao}</strong>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${TOM_CHIP[info.tom]}`} title={info.explica}>{info.nome}</span>
        </span>
        <span className="mt-1 flex items-baseline justify-between gap-3">
          <span className="text-sm text-slate-600">
            <strong className="text-lg font-black tabular-nums text-slate-950">{numero(linha.recebido, 1)}</strong>
            {' '}de {numero(previsto.quantidade, 1)} {previsto.unidade}
          </span>
          <strong className={`text-2xl font-black tabular-nums ${info.tom === 'alerta' ? 'text-[#f26a2e]' : info.tom === 'ok' ? 'text-[#176b4d]' : 'text-slate-500'}`}>
            {Math.round(linha.porcentagem).toLocaleString('pt-BR')}%
          </strong>
        </span>
        <span className="relative mt-1.5 block">
        <span
          className="block h-3 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(largura)}
          aria-label={`${previsto.materialDescricao}: ${Math.round(linha.porcentagem)}% do previsto`}
        >
          <span data-previsto-barra className={`block h-full rounded-full ${TOM_BARRA[info.tom]}`} style={{ width: `${largura}%` }} />
        </span>
          {/* Traço de onde a barra já deveria estar hoje, no passo do mês. */}
          {marca != null && marca > 0 && marca < 100 && (
            <span className="absolute -inset-y-1 w-1 -translate-x-1/2 rounded-full bg-slate-600 ring-2 ring-white" style={{ left: `${marca}%` }} title="Esperado até hoje" aria-hidden="true" />
          )}
        </span>
        <span className="mt-1.5 block text-xs leading-snug text-slate-500">{detalhes.join(' · ')}</span>
        {linha.foraDaUnidade > 0 && (
          <span className="mt-1 flex items-start gap-1 text-xs font-semibold text-amber-800">
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            {plural(linha.foraDaUnidade, 'entrega gravada', 'entregas gravadas')} em outra unidade {linha.foraDaUnidade === 1 ? 'ficou' : 'ficaram'} fora da conta.
          </span>
        )}
        {previsto.observacao && <span className="mt-1 block text-xs italic text-slate-500">{previsto.observacao}</span>}
      </>
    );
    return (
      <li key={previsto.id}>
        {podeEditar ? (
          <button type="button" onClick={() => abrir(linha)} aria-label={`Editar previsto de ${previsto.materialDescricao} no ${previsto.ramo}`} className={`group relative block w-full px-4 py-3 pr-10 text-left transition duration-200 hover:bg-emerald-50/60 active:bg-emerald-50 ${FOCO}`}>
            {conteudo}
            <Pencil className="absolute right-4 top-4 size-4 text-slate-400 transition duration-200 group-hover:text-[#176b4d]" aria-hidden="true" />
          </button>
        ) : (
          <div className="px-4 py-3">{conteudo}</div>
        )}
      </li>
    );
  };

  const listaSemPrevisto = (itens: ChegouSemPrevisto[]) => (
    <ul className="divide-y divide-slate-100">
      {itens.map(item => (
        <li key={`${item.ramo}-${item.materialId}-${item.unidade}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
          <span className="min-w-0 flex-1">
            <strong className="block break-words text-base font-bold text-slate-900 sm:text-sm">{item.materialDescricao}</strong>
            <span className="text-sm text-slate-500">{item.ramo} · {plural(item.entregas, 'entrega', 'entregas')}</span>
          </span>
          <strong className="shrink-0 text-sm font-bold tabular-nums text-slate-700">{numero(item.recebido, 1)} {item.unidade}</strong>
          {podeEditar && (
            <button type="button" onClick={() => abrir(undefined, { ramo: item.ramo, materialId: item.materialId })} className={`${BOTAO_SECUNDARIO} shrink-0 px-3`} aria-label={`Prever ${item.materialDescricao} no ${item.ramo}`}>
              <Target className="size-4" aria-hidden="true" />
              Prever
            </button>
          )}
        </li>
      ))}
    </ul>
  );

  const semRamos = !ramos.length;

  return (
    <div ref={raiz} className="space-y-3" data-testid="materiais-previsto">
      <section data-previsto-reveal aria-label="Mês do previsto" className={`${CARTAO} flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4`}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button type="button" onClick={() => trocarMes(-1)} aria-label={`Ver ${nomeDoMes(somarMes(mes, -1))}`} className={`grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-700 transition duration-200 hover:border-emerald-500 hover:text-[#176b4d] active:scale-[0.97] ${FOCO}`}>
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h3 className="text-lg font-black text-slate-950" aria-live="polite" data-testid="previsto-mes">{maiuscula(nomeDoMes(mes))}</h3>
            <p className="text-xs text-slate-500">
              {passouDoMes != null ? `${passouDoMes}% dos dias já passaram. O traço escuro na barra marca onde ela devia estar hoje.` : mes < mesHoje ? 'Mês fechado' : 'Mês que vem'}
            </p>
          </div>
          <button type="button" onClick={() => trocarMes(1)} aria-label={`Ver ${nomeDoMes(somarMes(mes, 1))}`} className={`grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-700 transition duration-200 hover:border-emerald-500 hover:text-[#176b4d] active:scale-[0.97] ${FOCO}`}>
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {mes !== mesHoje && (
            <button type="button" onClick={() => setMes(mesHoje)} className={`${BOTAO_SECUNDARIO} flex-1 sm:flex-none`}>Voltar para este mês</button>
          )}
          {podeEditar && !semRamos && (
            <button type="button" onClick={() => abrir()} className={`${BOTAO_PRIMARIO} flex-1 sm:flex-none`} data-testid="previsto-novo">
              <Plus className="size-5" aria-hidden="true" />
              Novo previsto
            </button>
          )}
        </div>
      </section>

      {linhas.length > 0 && (
        <section aria-label="Resumo do previsto" className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { rotulo: 'Previstos', valor: linhas.length, detalhe: `em ${plural(grupos.length, 'ramo', 'ramos')}` },
            { rotulo: 'Atingidos', valor: atingidos, detalhe: 'já chegou tudo', ok: atingidos > 0 },
            { rotulo: 'Pedem atenção', valor: atencao, detalhe: atencao ? 'atrasados ou acima' : 'nenhum atraso', alerta: atencao > 0 },
          ].map(item => (
            <article key={item.rotulo} data-previsto-reveal className={`${CARTAO} p-3 sm:p-4`}>
              <p className="text-xs font-semibold leading-tight text-slate-600 sm:text-sm">{item.rotulo}</p>
              <strong className={`mt-1 block text-2xl font-black tabular-nums sm:text-3xl ${item.alerta ? 'text-[#f26a2e]' : item.ok ? 'text-[#176b4d]' : 'text-slate-950'}`}>{item.valor.toLocaleString('pt-BR')}</strong>
              <span className="hidden text-xs text-slate-500 sm:block">{item.detalhe}</span>
            </article>
          ))}
        </section>
      )}

      {aviso && (
        <p role="status" className="flex items-start justify-between gap-2 rounded-2xl border border-emerald-200 bg-white p-3 text-sm font-semibold text-emerald-900">
          <span className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#176b4d]" aria-hidden="true" />{aviso}</span>
          <button type="button" onClick={() => setAviso('')} className={`shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-100 ${FOCO}`} aria-label="Fechar aviso"><X className="size-4" aria-hidden="true" /></button>
        </p>
      )}

      {podeEditar && paraCopiar.length > 0 && (
        <section data-previsto-reveal aria-labelledby="previsto-copiar" className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center">
          <Copy className="size-7 shrink-0 text-[#176b4d] max-sm:hidden" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h3 id="previsto-copiar" className="text-base font-bold text-emerald-950">Repetir o previsto de {nomeDoMes(mesAnterior)}?</h3>
            <p className="text-sm text-emerald-900">{plural(paraCopiar.length, 'previsto de lá ainda não está', 'previstos de lá ainda não estão')} em {nomeDoMes(mes)}. Depois é só ajustar o que mudou.</p>
          </div>
          <button type="button" onClick={copiar} className={`${BOTAO_PRIMARIO} sm:shrink-0`} data-testid="previsto-copiar">
            <Copy className="size-5" aria-hidden="true" />
            Copiar {paraCopiar.length}
          </button>
        </section>
      )}

      {semRamos ? (
        <div data-previsto-reveal className={`${CARTAO} p-4`}>
          <EmptyState icon={MapPinned} title="Ainda não há ramos no cadastro" description="O previsto é feito por ramo. Carregue a lista de códigos SGE em Ramos e locais." />
          <div className="flex justify-center">
            <button type="button" onClick={onIrParaLocais} className={BOTAO_SECUNDARIO}>
              <MapPinned className="size-5" aria-hidden="true" />
              Ir para Ramos e locais
            </button>
          </div>
        </div>
      ) : !linhas.length ? (
        <div data-previsto-reveal className={`${CARTAO} p-4`}>
          <EmptyState
            icon={Target}
            title={`Nada previsto para ${nomeDoMes(mes)}`}
            description={podeEditar ? 'Diga quanto de cada material cada ramo deve receber no mês. A porcentagem sobe sozinha com as entregas.' : 'Quem cuida de Materiais ainda não lançou o previsto deste mês.'}
          />
          {podeEditar && (
            <div className="-mt-4 flex justify-center pb-4">
              <button type="button" onClick={() => abrir()} className={BOTAO_PRIMARIO}>
                <Plus className="size-5" aria-hidden="true" />
                Fazer o previsto do mês
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 xl:columns-2 xl:gap-3 xl:space-y-0">
          {grupos.map(grupo => (
            <section key={grupo.ramo} data-previsto-reveal aria-labelledby={`previsto-${chaveLocal(grupo.ramo).replace(/ /g, '-')}`} className={`${CARTAO} overflow-hidden xl:mb-3 xl:break-inside-avoid`}>
              <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                <h3 id={`previsto-${chaveLocal(grupo.ramo).replace(/ /g, '-')}`} className="min-w-0 text-base font-bold text-slate-900">{grupo.ramo}</h3>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-500">{plural(grupo.linhas.length, 'material', 'materiais')}</span>
              </header>
              <ul className="divide-y divide-slate-100">{grupo.linhas.map(linhaPrevisto)}</ul>
            </section>
          ))}
        </div>
      )}

      {semPrevisto.length > 0 && (
        <section data-previsto-reveal aria-labelledby="previsto-sem" className={`${CARTAO} overflow-hidden`}>
          <button type="button" onClick={() => setSemPrevistoAberto(!listaAberta)} aria-expanded={listaAberta} className={`flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition duration-200 hover:bg-slate-50 ${FOCO}`}>
            <span className="min-w-0 flex-1">
              <span id="previsto-sem" className="block text-base font-bold text-slate-900">Chegou sem previsto</span>
              <span className="block text-sm text-slate-500">{plural(semPrevisto.length, 'material chegou', 'materiais chegaram')} a um ramo em {nomeDoMes(mes)} sem nada previsto.</span>
            </span>
            <ChevronDown className={`size-5 shrink-0 text-slate-500 transition duration-200 ${listaAberta ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {listaAberta && <div className="border-t border-slate-100">{listaSemPrevisto(semPrevisto)}</div>}
        </section>
      )}

      <Modal
        open={Boolean(edicao)}
        title={edicao?.id ? 'Editar previsto' : 'Novo previsto'}
        size="md"
        onSubmit={confirmarTirar ? undefined : salvar}
        onClose={() => setEdicao(null)}
        footer={confirmarTirar ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <p className="text-sm font-semibold text-rose-800 sm:mr-auto">Tirar este previsto? O que chegou continua nos movimentos.</p>
            <button type="button" onClick={() => setConfirmarTirar(false)} className={BOTAO_SECUNDARIO}>Voltar</button>
            <button type="button" onClick={tirar} className={BOTAO_PERIGO} data-testid="previsto-confirmar-tirar">Tirar previsto</button>
          </div>
        ) : (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {edicao?.id && <button type="button" onClick={() => setConfirmarTirar(true)} className={`${BOTAO_PERIGO_LEVE} sm:mr-auto`}>Tirar previsto</button>}
            <button type="button" onClick={() => setEdicao(null)} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button type="button" onClick={salvar} className={BOTAO_PRIMARIO} data-testid="previsto-salvar">Salvar previsto</button>
          </div>
        )}
      >
        {edicao && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={ROTULO}>Mês</span>
              <select value={edicao.mes} onChange={event => setEdicao({ ...edicao, mes: event.target.value })} className={`mt-1 ${CAMPO}`} data-testid="previsto-mes-campo">
                {mesesParaEscolher(mesHoje, edicao.mes).map(opcao => <option key={opcao} value={opcao}>{maiuscula(nomeDoMes(opcao))}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={ROTULO}>Ramo</span>
              <select value={edicao.ramo} onChange={event => setEdicao({ ...edicao, ramo: event.target.value })} className={`mt-1 ${CAMPO}`} data-testid="previsto-ramo">
                <option value="">Escolha o ramo</option>
                {[...ramos, ...(edicao.ramo && !ramos.some(ramo => chaveLocal(ramo) === chaveLocal(edicao.ramo)) ? [edicao.ramo] : [])].map(ramo => <option key={ramo} value={ramo}>{ramo}</option>)}
              </select>
            </label>
            <div className="sm:col-span-2">
              <label htmlFor="previsto-material" className={ROTULO}>Material</label>
              <div className="mt-1">
                <CampoEscolha
                  id="previsto-material"
                  testId="previsto-material"
                  opcoes={ativos.map(item => ({ id: item.id, nome: item.descricao, apelido: [item.codigo, item.categoria].filter(Boolean).join(' · ') }))}
                  valor={edicao.materialId}
                  onEscolher={id => setEdicao(atual => (atual ? { ...atual, materialId: id } : atual))}
                  placeholder="Digite o nome ou o código"
                  onEnter={() => quantidadeRef.current?.focus()}
                />
              </div>
            </div>
            <label className="block sm:col-span-2">
              <span className={ROTULO}>Quanto deve chegar no mês</span>
              <span className="mt-1 flex items-center gap-2">
                <input
                  ref={quantidadeRef}
                  value={edicao.quantidade}
                  onChange={event => setEdicao({ ...edicao, quantidade: event.target.value.replace(/[^\d.,]/g, '') })}
                  inputMode="decimal"
                  placeholder="Ex.: 40"
                  className={`${CAMPO} font-mono text-lg tabular-nums`}
                  data-testid="previsto-quantidade"
                />
                <span className="min-w-12 shrink-0 text-base font-bold text-slate-700">{materialEscolhido?.unidade || '—'}</span>
              </span>
              <span className="mt-1 block text-xs text-slate-500">Conta toda entrega do mês que chegou a qualquer local deste ramo (frente, espinha, coluna de brita).</span>
            </label>
            <label className="block sm:col-span-2">
              <span className={ROTULO}>Observação (se quiser)</span>
              <input value={edicao.observacao} onChange={event => setEdicao({ ...edicao, observacao: event.target.value })} placeholder="Ex.: base do aterro, segunda camada" className={`mt-1 ${CAMPO}`} />
            </label>
            {erro && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 sm:col-span-2">{erro}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
