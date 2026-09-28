import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { AlertOctagon, HardHat, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Flag, ListChecks, ListTodo, Moon, NotebookPen, type LucideIcon } from 'lucide-react';
import type { BlocoRotina, FrenteServico, ModeloRotina, PendenciaRotina, PlanejamentoItem, RegistroProducao, RotinaDiaria, ServicoObra } from '../types';
import { blocosDaPessoa, concluidasNoDia, contarPorPrioridade, diaFechado, idDaRotina, pendenciasAbertas, prioridadesDeOntem, progresso, rotinaVazia, temModeloProprio } from '../modules/rotina/checklistDiario';
import { formatarData } from '../utils/formato';
import { CountUp, PageHeader, isoDay } from '../shared/ui';
import { ChecklistDoDia } from './meuDia/ChecklistDoDia';
import { PendenciasDoDia, type AcaoPendencia } from './meuDia/PendenciasDoDia';
import { FrentesDoDia } from './meuDia/FrentesDoDia';
import { BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO } from './cadastros/estilos';
import './meuDia/MeuDia.css';

type Parte = 'checklist' | 'frentes' | 'pendencias' | 'anotacoes' | 'fechamento';

const PARTES: ReadonlyArray<{ id: Parte; nome: string; Icone: LucideIcon }> = [
  { id: 'checklist', nome: 'Checklist', Icone: ListChecks },
  { id: 'frentes', nome: 'Frentes', Icone: HardHat },
  { id: 'pendencias', nome: 'Pendências', Icone: ListTodo },
  { id: 'anotacoes', nome: 'Anotações', Icone: NotebookPen },
  { id: 'fechamento', nome: 'Fechamento', Icone: Moon },
];

/** As perguntas da regra principal: o dia não acaba sem saber responder. */
const PERGUNTAS_DO_FIM = [
  'O que foi executado hoje? Onde? Quanto?',
  'Quanto temos acumulado? Qual o avanço em %? Quanto falta?',
  'O que chegou de material? Quanto temos em estoque?',
  'Quais equipamentos trabalharam e quais ficaram parados? Por quê?',
  'Quais problemas aconteceram? O que precisa ser cobrado?',
  'O que precisa ser feito amanhã?',
];

const somarDias = (dia: string, dias: number) => new Date(new Date(`${dia}T12:00:00Z`).getTime() + dias * 86_400_000).toISOString().slice(0, 10);
const diaDaSemana = (dia: string) => new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' });

interface Props {
  responsavel: string;
  rotinas: readonly RotinaDiaria[];
  pendencias: readonly PendenciaRotina[];
  modelos: readonly ModeloRotina[];
  onSaveRotina: (rotina: RotinaDiaria) => void;
  onSavePendencia: (pendencia: PendenciaRotina, descricao: string, acao: AcaoPendencia) => void;
  onSaveModelo: (modelo: ModeloRotina, descricao: string) => void;
  /** Avanço físico por frente: sai da produção lançada e do previsto de Planejamento. */
  frentes: readonly FrenteServico[];
  servicos: readonly ServicoObra[];
  producao: readonly RegistroProducao[];
  planos: readonly PlanejamentoItem[];
  /** Só vem para quem pode lançar produção ou planejar. */
  onSaveProducao?: (registro: RegistroProducao, isNew: boolean) => void;
  onSavePlano?: (plano: PlanejamentoItem, isNew: boolean) => void;
}

function Indicador({ titulo, valor, sufixo, detalhe, Icone, tom, onClick }: { titulo: string; valor: number; sufixo?: string; detalhe: string; Icone: LucideIcon; tom: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} data-meu-dia-reveal className={`meu-dia-vivo ${CARTAO} flex min-h-24 items-start gap-3 p-4 text-left ${FOCO}`}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl max-sm:hidden ${tom}`}>
        <Icone className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-600">{titulo}</span>
        <CountUp value={valor} suffix={sufixo} className="block text-2xl font-bold text-slate-900" />
        <span className="block text-xs text-slate-500">{detalhe}</span>
      </span>
    </button>
  );
}

/** Campo de texto que grava ao sair dele, para não mandar à nuvem a cada letra. */
function Anotacao({ rotulo, ajuda, valor, onGravar, linhas = 4 }: { rotulo: string; ajuda: string; valor: string; onGravar: (texto: string) => void; linhas?: number }) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);
  return (
    <label className="block space-y-1.5">
      <span className={ROTULO}>{rotulo}</span>
      <span className="block text-sm text-slate-500">{ajuda}</span>
      <textarea
        className={`${CAMPO} py-2 leading-relaxed`}
        rows={linhas}
        maxLength={4000}
        value={texto}
        onChange={event => setTexto(event.target.value)}
        onBlur={() => { if (texto !== valor) onGravar(texto); }}
      />
    </label>
  );
}

export default function MeuDiaTab({ responsavel, rotinas, pendencias, modelos, onSaveRotina, onSavePendencia, onSaveModelo, frentes, servicos, producao, planos, onSaveProducao, onSavePlano }: Props) {
  const pessoa = responsavel.trim() || 'Sem nome';
  const hoje = isoDay(new Date());
  const [dia, setDia] = useState(hoje);
  const [parte, setParte] = useState<Parte>('checklist');
  const escopo = useRef<HTMLDivElement>(null);
  const jaEntrou = useRef(false);

  const blocos = useMemo(() => blocosDaPessoa(modelos, pessoa), [modelos, pessoa]);
  const proprio = temModeloProprio(modelos, pessoa);
  const rotina = useMemo(() => rotinas.find(item => item.id === idDaRotina(dia, pessoa)) ?? rotinaVazia(dia, pessoa), [rotinas, dia, pessoa]);
  const conta = useMemo(() => progresso(rotina, blocos), [rotina, blocos]);
  const fechado = diaFechado(rotina, blocos);
  const abertas = useMemo(() => pendenciasAbertas(pendencias, dia, pessoa), [pendencias, dia, pessoa]);
  const porPrioridade = contarPorPrioridade(abertas);
  const resolvidas = concluidasNoDia(pendencias, dia, pessoa).length;
  const deOntem = useMemo(() => prioridadesDeOntem(rotinas, dia, pessoa), [rotinas, dia, pessoa]);
  const itensDoFim = blocos.filter(bloco => bloco.momento === 'fechamento').reduce((soma, bloco) => soma + bloco.itens.length, 0);
  const feitosDoFim = blocos.filter(bloco => bloco.momento === 'fechamento').reduce((soma, bloco) => soma + (conta.porBloco[bloco.id]?.feitos || 0), 0);

  const mudarRotina = (nova: RotinaDiaria) => onSaveRotina({ ...nova, atualizadoEm: new Date().toISOString() });
  const salvarBlocos = (novos: BlocoRotina[], descricao: string) => {
    const agora = new Date().toISOString();
    const atual = modelos.find(item => item.id === pessoa);
    onSaveModelo({ id: pessoa, responsavel: pessoa, blocos: novos, criadoEm: atual?.criadoEm || agora, atualizadoEm: agora }, descricao);
  };
  const mudarAmanha = (posicao: number, texto: string) => {
    const amanha = [...rotina.amanha];
    while (amanha.length < 3) amanha.push('');
    amanha[posicao] = texto;
    mudarRotina({ ...rotina, amanha });
  };

  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Na primeira vez entra tudo; ao trocar de parte ou de dia só o conteúdo.
    const primeira = !jaEntrou.current;
    jaEntrou.current = true;
    const blocosVisiveis = raiz.querySelectorAll(primeira ? '[data-meu-dia-reveal]' : '#meu-dia-conteudo [data-meu-dia-reveal]');
    gsap.fromTo(blocosVisiveis, { opacity: 0, y: primeira ? 14 : 8 }, { opacity: 1, y: 0, duration: primeira ? 0.45 : 0.3, stagger: 0.035, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, { scope: escopo, dependencies: [parte, dia] });

  const passado = dia < hoje;

  return (
    <div ref={escopo} id="meu-dia-tab" data-testid="meu-dia-tab" className="erp-module space-y-4">
      <div data-meu-dia-reveal>
        <PageHeader
          eyebrow="Rotina"
          title="Meu dia"
          description="Seu checklist, suas pendências e o fechamento. Cada pessoa monta o seu do próprio jeito."
          actions={(
            <div className="flex items-center gap-1.5" role="group" aria-label="Escolher o dia">
              <button type="button" className={`${BOTAO_SECUNDARIO} px-3`} onClick={() => setDia(atual => somarDias(atual, -1))} aria-label="Dia anterior">
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <label className="relative">
                <span className="sr-only">Dia</span>
                <input type="date" className={`${CAMPO} w-40`} value={dia} max={hoje} onChange={event => { if (event.target.value) setDia(event.target.value > hoje ? hoje : event.target.value); }} />
              </label>
              <button type="button" className={`${BOTAO_SECUNDARIO} px-3`} onClick={() => setDia(atual => (atual < hoje ? somarDias(atual, 1) : atual))} disabled={!passado} aria-label="Próximo dia">
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
              {passado && <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setDia(hoje)}>Hoje</button>}
            </div>
          )}
        />
      </div>

      <p data-meu-dia-reveal className="flex flex-wrap items-center gap-2 px-1 text-sm text-slate-600">
        <CalendarDays className="size-4 text-[#718087]" aria-hidden="true" />
        <span className="font-bold capitalize text-slate-800">{diaDaSemana(dia)}, {formatarData(dia)}</span>
        {passado && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-inset ring-amber-200">Dia que já passou</span>}
        <span>· {pessoa}</span>
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador titulo="Críticas em aberto" valor={porPrioridade.critico} detalhe="🔴 resolver agora" Icone={AlertOctagon} tom="bg-rose-50 text-rose-700" onClick={() => setParte('pendencias')} />
        <Indicador titulo="Importantes em aberto" valor={porPrioridade.importante} detalhe={`🟠 hoje · ${abertas.length} no total`} Icone={Flag} tom="bg-orange-50 text-[#f26a2e]" onClick={() => setParte('pendencias')} />
        <Indicador titulo="Checklist feito" valor={conta.percentual} sufixo="%" detalhe={`${conta.feitos} de ${conta.total} itens`} Icone={ClipboardCheck} tom="bg-emerald-50 text-[#176b4d]" onClick={() => setParte('checklist')} />
        <Indicador titulo={fechado ? 'Dia fechado' : 'Falta para fechar'} valor={fechado ? resolvidas : Math.max(itensDoFim - feitosDoFim, 0)} detalhe={fechado ? 'pendências resolvidas no dia' : 'itens do fim do dia'} Icone={fechado ? CheckCircle2 : Moon} tom={fechado ? 'bg-emerald-50 text-[#176b4d]' : 'bg-slate-100 text-[#718087]'} onClick={() => setParte('fechamento')} />
      </div>

      {deOntem && deOntem.itens.length > 0 && (
        <section data-meu-dia-reveal className={`${CARTAO} border-l-4 border-l-[#f26a2e] p-4`} aria-labelledby="meu-dia-ontem">
          <h2 id="meu-dia-ontem" className="text-sm font-bold text-slate-900">Prioridades que você deixou em {formatarData(deOntem.dia)}</h2>
          <ol className="mt-2 grid gap-1.5 sm:grid-cols-3">
            {deOntem.itens.map((texto, posicao) => (
              <li key={`${posicao}-${texto}`} className="flex gap-2 rounded-xl bg-[#f7f8f6] px-3 py-2 text-sm text-slate-800">
                <span className="font-bold text-[#f26a2e]">{posicao + 1}.</span>
                <span className="min-w-0 break-words">{texto}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <nav data-meu-dia-reveal className="grid grid-cols-3 gap-1 rounded-2xl sm:grid-cols-5 border border-slate-200 bg-white p-1" aria-label="Partes do meu dia">
        {PARTES.map(({ id, nome, Icone }) => {
          const ativa = parte === id;
          const numero = id === 'pendencias' ? abertas.length : null;
          return (
            <button
              key={id}
              type="button"
              aria-current={ativa ? 'page' : undefined}
              onClick={() => setParte(id)}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-sm font-bold transition-colors duration-200 sm:min-h-12 sm:flex-row sm:gap-2 ${FOCO} ${ativa ? 'bg-[#176b4d] text-white' : 'text-slate-600 hover:bg-[#f7f8f6] hover:text-[#176b4d]'}`}
            >
              <Icone className="size-5" aria-hidden="true" />
              <span>{nome}{numero ? <span className="max-sm:hidden"> ({numero})</span> : null}{numero ? <span className={`ml-1 rounded-full px-1.5 text-xs sm:hidden ${ativa ? 'bg-white text-[#176b4d]' : 'bg-[#f26a2e] text-white'}`}>{numero}</span> : null}</span>
            </button>
          );
        })}
      </nav>

      <div id="meu-dia-conteudo" key={`${parte}-${dia}`}>
        {parte === 'checklist' && (
          <ChecklistDoDia rotina={rotina} blocos={blocos} proprio={proprio} onMudarRotina={mudarRotina} onSalvarBlocos={salvarBlocos} />
        )}

        {parte === 'frentes' && (
          <FrentesDoDia dia={dia} responsavel={pessoa} frentes={frentes} servicos={servicos} registros={producao} planos={planos} onSaveProducao={onSaveProducao} onSavePlano={onSavePlano} />
        )}

        {parte === 'pendencias' && (
          <PendenciasDoDia dia={dia} responsavel={pessoa} pendencias={pendencias} onSalvar={onSavePendencia} />
        )}

        {parte === 'anotacoes' && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div data-meu-dia-reveal className={`${CARTAO} p-4`}>
              <Anotacao rotulo="O que preciso levantar" ajuda="Informação que falta: quem cobrar, o que confirmar." valor={rotina.levantar} onGravar={texto => mudarRotina({ ...rotina, levantar: texto })} linhas={8} />
            </div>
            <div data-meu-dia-reveal className={`${CARTAO} p-4`}>
              <Anotacao rotulo="Dúvida técnica" ajuda="Para perguntar ao engenheiro ou à topografia." valor={rotina.duvida} onGravar={texto => mudarRotina({ ...rotina, duvida: texto })} linhas={8} />
            </div>
            <div data-meu-dia-reveal className={`${CARTAO} p-4`}>
              <Anotacao rotulo="O que aprendi hoje" ajuda="Um trecho do projeto, um serviço, uma conta." valor={rotina.aprendi} onGravar={texto => mudarRotina({ ...rotina, aprendi: texto })} linhas={8} />
            </div>
          </div>
        )}

        {parte === 'fechamento' && (
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
            <div className="min-w-0 space-y-4">
              <div data-meu-dia-reveal className={`${CARTAO} flex items-center gap-3 p-4 ${fechado ? 'border-emerald-200 bg-emerald-50/60' : ''}`}>
                {fechado ? <CheckCircle2 className="size-7 shrink-0 text-[#176b4d]" aria-hidden="true" /> : <Moon className="size-7 shrink-0 text-[#718087]" aria-hidden="true" />}
                <div>
                  <p className="font-bold text-slate-900">{fechado ? 'Dia fechado' : itensDoFim ? `Faltam ${itensDoFim - feitosDoFim} de ${itensDoFim} itens para fechar o dia` : 'Seu checklist não tem bloco de fim do dia'}</p>
                  <p className="text-sm text-slate-600">{fechado ? `${resolvidas} pendências resolvidas e ${abertas.length} ficam para os próximos dias.` : 'Marque o que já sabe responder antes de ir embora.'}</p>
                </div>
              </div>
              <ChecklistDoDia rotina={rotina} blocos={blocos} somente="fechamento" proprio={proprio} onMudarRotina={mudarRotina} />
            </div>
            <div className="space-y-4">
              <section data-meu-dia-reveal className={`${CARTAO} p-4`} aria-labelledby="meu-dia-amanha">
                <h2 id="meu-dia-amanha" className="font-bold text-slate-900">3 prioridades para amanhã</h2>
                <p className="text-sm text-slate-600">Aparecem no alto da tela no próximo dia.</p>
                <div className="mt-3 space-y-2">
                  {[0, 1, 2].map(posicao => (
                    <AmanhaCampo key={posicao} posicao={posicao} valor={rotina.amanha[posicao] || ''} onGravar={texto => mudarAmanha(posicao, texto)} />
                  ))}
                </div>
              </section>
              <section data-meu-dia-reveal className={`${CARTAO} p-4`} aria-labelledby="meu-dia-regra">
                <h2 id="meu-dia-regra" className="font-bold text-slate-900">Antes de ir embora, saiba responder</h2>
                <ul className="mt-2 space-y-1.5">
                  {PERGUNTAS_DO_FIM.map(pergunta => (
                    <li key={pergunta} className="flex gap-2 text-sm text-slate-700">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#f26a2e]" aria-hidden="true" />
                      {pergunta}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AmanhaCampo({ posicao, valor, onGravar }: { posicao: number; valor: string; onGravar: (texto: string) => void }) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);
  return (
    <label className="flex items-center gap-2">
      <span className="w-5 shrink-0 text-right font-bold text-[#f26a2e]">{posicao + 1}.</span>
      <span className="sr-only">Prioridade {posicao + 1} para amanhã</span>
      <input
        className={CAMPO}
        value={texto}
        maxLength={200}
        onChange={event => setTexto(event.target.value)}
        onBlur={() => { if (texto !== valor) onGravar(texto.trim()); }}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
      />
    </label>
  );
}
