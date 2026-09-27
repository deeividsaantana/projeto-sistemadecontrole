/**
 * Ramos e locais de Materiais: a lista única de lugares da obra com o código
 * SGE, os nomes que a planilha usa para cada um e a tabela de códigos de
 * viagem. Tudo o que se grava aqui é o cadastro de ramos; os movimentos
 * continuam como vieram e acham o local pelo nome.
 */
import { useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { AlertTriangle, CheckCircle2, ChevronDown, Link2, ListChecks, MapPin, Pencil, Plus, Route, Truck, X } from 'lucide-react';
import type { EtapaServico, MovimentoMaterial, TipoLocalObra } from '../../types';
import {
  EXPLICA_TIPO,
  ROTAS_VIAGEM_SGE,
  TIPOS_LOCAL,
  chaveLocal,
  grupoDoLocal,
  indiceDeLocais,
  ligarNome,
  localDoMovimento,
  locaisParaEscolher,
  nomesSemLocal,
  ordemDoGrupo,
  ordemDoRamo,
  planoCargaSge,
  resolverLocal,
  rotuloDoLocal,
} from '../../modules/materials/locaisSge';
import { EmptyState, Modal } from '../../shared/ui';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO, reduzMovimento } from '../cadastros/estilos';

type Vista = 'locais' | 'sem-local' | 'viagens';

interface Props {
  etapas: EtapaServico[];
  movimentos: MovimentoMaterial[];
  /** Busca do topo de Materiais, já sem acento e em minúsculas. */
  termo: string;
  podeEditar: boolean;
  onSaveEtapas: (etapas: EtapaServico[], descricao: string) => void;
}

interface Edicao {
  id: string | null;
  nome: string;
  codigoSge: string;
  tipoLocal: TipoLocalObra;
  ramo: string;
  apelidos: string[];
  novoApelido: string;
}

const POR_PAGINA = 30;

const novoId = () => `etapa-local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const plural = (quantidade: number, um: string, varios: string) => `${quantidade.toLocaleString('pt-BR')} ${quantidade === 1 ? um : varios}`;

const Codigo = ({ codigo }: { codigo?: string }) => (codigo
  ? <span className="inline-flex min-w-12 shrink-0 self-start justify-center rounded-lg bg-emerald-50 px-2 py-1 font-mono text-sm font-bold tabular-nums text-[#176b4d] ring-1 ring-inset ring-emerald-200">{codigo}</span>
  : <span className="inline-flex min-w-12 shrink-0 self-start justify-center rounded-lg bg-slate-50 px-2 py-1 text-sm font-semibold text-slate-400 ring-1 ring-inset ring-slate-200" title="Sem código SGE">—</span>);

export default function LocaisMateriais({ etapas, movimentos, termo, podeEditar, onSaveEtapas }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const [vista, setVista] = useState<Vista>('locais');
  const [cargaAberta, setCargaAberta] = useState(false);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [limite, setLimite] = useState(POR_PAGINA);
  const [servicosAbertos, setServicosAbertos] = useState(false);

  const plano = useMemo(() => planoCargaSge(etapas), [etapas]);
  const indice = useMemo(() => indiceDeLocais(etapas), [etapas]);
  const faltando = useMemo(() => nomesSemLocal(movimentos, etapas), [movimentos, etapas]);
  const movimentosSemLocal = faltando.reduce((soma, item) => soma + item.movimentos, 0);

  // Quantos movimentos chegaram ou saíram de cada local, pelo vínculo ou pelo nome.
  const usoPorLocal = useMemo(() => {
    const porId = new Map(etapas.map(item => [item.id, item]));
    const contagem = new Map<string, number>();
    for (const movimento of movimentos) {
      if (movimento.canceladoEm) continue;
      const tocados = new Set<string>();
      const destino = localDoMovimento(movimento, porId, indice);
      if (destino) tocados.add(destino.id);
      const origem = resolverLocal(movimento.origem, indice);
      if (origem) tocados.add(origem.id);
      tocados.forEach(id => contagem.set(id, (contagem.get(id) || 0) + 1));
    }
    return contagem;
  }, [etapas, indice, movimentos]);

  const grupos = useMemo(() => {
    const filtrados = etapas.filter(etapa => !termo
      || chaveLocal(`${etapa.nome} ${etapa.codigoSge || ''} ${etapa.ramo || ''} ${(etapa.apelidos || []).join(' ')}`).includes(chaveLocal(termo)));
    const mapa = new Map<string, EtapaServico[]>();
    filtrados.forEach(etapa => {
      const grupo = grupoDoLocal(etapa);
      mapa.set(grupo, [...(mapa.get(grupo) || []), etapa]);
    });
    return [...mapa.entries()]
      .map(([nome, itens]) => ({
        nome,
        itens: itens.sort((a, b) => (a.tipoLocal === 'Ramo' ? 0 : 1) - (b.tipoLocal === 'Ramo' ? 0 : 1)
          || (Number(a.codigoSge) || 999) - (Number(b.codigoSge) || 999)
          || a.nome.localeCompare(b.nome, 'pt-BR')),
        movimentos: itens.reduce((soma, item) => soma + (usoPorLocal.get(item.id) || 0), 0),
      }))
      .sort((a, b) => ordemDoGrupo(a.nome) - ordemDoGrupo(b.nome) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [etapas, termo, usoPorLocal]);

  const faltandoFiltrados = useMemo(() => faltando.filter(item => !termo || chaveLocal(item.texto).includes(chaveLocal(termo))), [faltando, termo]);
  const rotasFiltradas = useMemo(() => ROTAS_VIAGEM_SGE.filter(rota => !termo
    || chaveLocal(`${rota.codigo} ${rota.origem} ${rota.destino}`).includes(chaveLocal(termo))), [termo]);

  // Locais em que faz sentido ligar um nome da planilha: serviço de horas fica de fora.
  const opcoesLocal = useMemo(() => locaisParaEscolher(etapas), [etapas]);
  const ramosConhecidos = useMemo(() => [...new Set(etapas.map(item => item.ramo).filter(Boolean) as string[])]
    .sort((a, b) => ordemDoRamo(a) - ordemDoRamo(b)), [etapas]);

  useGSAP(() => {
    if (!raiz.current || reduzMovimento()) return;
    gsap.fromTo(raiz.current.querySelectorAll('[data-locais-reveal]'), { opacity: 0, y: 12 }, {
      opacity: 1, y: 0, duration: 0.4, stagger: 0.035, ease: 'power3.out', clearProps: 'transform,opacity',
    });
  }, { scope: raiz, dependencies: [vista] });

  const escolherVista = (proxima: Vista) => {
    setVista(proxima);
    setLimite(POR_PAGINA);
    setAviso('');
  };

  const carregarLista = () => {
    const itens = [...plano.completadas, ...plano.novas];
    onSaveEtapas(itens, `Carregou a lista de códigos SGE: ${plano.novas.length} local(is) novo(s) e ${plano.completadas.length} completado(s) com código, tipo e nomes da planilha.`);
    setCargaAberta(false);
    const partes = [plano.novas.length && plural(plano.novas.length, 'local novo', 'locais novos'), plano.completadas.length && plural(plano.completadas.length, 'completado', 'completados')].filter(Boolean);
    setAviso(`Lista carregada: ${partes.join(' e ')}. Nada foi apagado.`);
  };

  const ligar = (texto: string, sugestaoId?: string) => {
    const escolhido = etapas.find(item => item.id === (escolhas[texto] ?? sugestaoId));
    if (!escolhido) return;
    onSaveEtapas([ligarNome(escolhido, texto)], `Ligou o nome "${texto}" da planilha ao local ${escolhido.nome}.`);
    setAviso(`"${texto}" agora conta em ${escolhido.nome}.`);
  };

  const abrirEdicao = (etapa?: EtapaServico) => {
    setErro('');
    setEdicao(etapa
      ? { id: etapa.id, nome: etapa.nome, codigoSge: etapa.codigoSge || '', tipoLocal: etapa.tipoLocal || 'Frente', ramo: etapa.ramo || '', apelidos: [...(etapa.apelidos || [])], novoApelido: '' }
      : { id: null, nome: '', codigoSge: '', tipoLocal: 'Frente', ramo: '', apelidos: [], novoApelido: '' });
  };

  const adicionarApelido = () => setEdicao(atual => {
    if (!atual) return atual;
    const texto = atual.novoApelido.trim();
    if (!texto || atual.apelidos.some(item => chaveLocal(item) === chaveLocal(texto)) || chaveLocal(texto) === chaveLocal(atual.nome)) return { ...atual, novoApelido: '' };
    return { ...atual, apelidos: [...atual.apelidos, texto], novoApelido: '' };
  });

  const salvarEdicao = () => {
    if (!edicao) return;
    const nome = edicao.nome.trim();
    const codigo = edicao.codigoSge.trim();
    if (!nome) {
      setErro('Escreva o nome do local.');
      return;
    }
    if (codigo && !/^\d{1,4}$/.test(codigo)) {
      setErro('O código SGE é só número, por exemplo 102.');
      return;
    }
    const outro = etapas.find(item => item.id !== edicao.id && (chaveLocal(item.nome) === chaveLocal(nome) || (codigo && item.codigoSge === codigo)));
    if (outro) {
      setErro(outro.codigoSge === codigo && codigo ? `O código ${codigo} já é de ${outro.nome}.` : `Já existe o local ${outro.nome}.`);
      return;
    }
    const pendente = edicao.novoApelido.trim();
    const apelidos = [...edicao.apelidos, ...(pendente ? [pendente] : [])];
    // Um nome da planilha aponta para um lugar só: não deixa roubar o apelido de outro.
    const dono = apelidos.map(apelido => ({ apelido, local: resolverLocal(apelido, indice) })).find(item => item.local && item.local.id !== edicao.id);
    if (dono?.local) {
      setErro(`"${dono.apelido}" já conta em ${dono.local.nome}. Tire de lá antes de ligar aqui.`);
      return;
    }
    const anterior = etapas.find(item => item.id === edicao.id);
    const registro: EtapaServico = {
      ...anterior,
      id: edicao.id || novoId(),
      nome,
      codigoSge: codigo || undefined,
      tipoLocal: edicao.tipoLocal,
      ramo: edicao.ramo.trim() || undefined,
      apelidos: apelidos.filter(item => chaveLocal(item) !== chaveLocal(nome)),
    };
    onSaveEtapas([registro], `${anterior ? 'Editou' : 'Cadastrou'} o local ${nome}${codigo ? ` (SGE ${codigo})` : ''}.`);
    setEdicao(null);
    setAviso(`${anterior ? 'Salvo' : 'Cadastrado'}: ${nome}.`);
  };

  const indicadores = [
    { rotulo: 'Ramos e locais', valor: etapas.filter(item => item.tipoLocal !== 'Serviço').length, detalhe: 'no cadastro' },
    { rotulo: 'Com código SGE', valor: etapas.filter(item => item.codigoSge).length, detalhe: 'prontos para apropriar' },
    { rotulo: 'Nomes sem local', valor: faltando.length, detalhe: faltando.length ? `${plural(movimentosSemLocal, 'movimento', 'movimentos')} fora da conta` : 'tudo reconhecido', alerta: faltando.length > 0 },
  ];

  const vistas: ReadonlyArray<{ id: Vista; nome: string; curto: string; Icone: typeof MapPin; contagem?: number; alerta?: boolean }> = [
    { id: 'locais', nome: 'Locais', curto: 'Locais', Icone: MapPin },
    { id: 'sem-local', nome: 'Nomes sem local', curto: 'Sem local', Icone: Link2, contagem: faltando.length, alerta: faltando.length > 0 },
    { id: 'viagens', nome: 'Códigos de viagem', curto: 'Viagens', Icone: Route },
  ];

  const listaLocais = () => {
    if (!etapas.length) {
      return (
        <EmptyState
          icon={MapPin}
          title="Nenhum ramo ou local cadastrado"
          description={podeEditar ? 'Carregue a lista de códigos SGE acima para começar com todos os ramos e locais da obra.' : 'Peça para quem cuida de Materiais carregar a lista de códigos SGE.'}
        />
      );
    }
    if (!grupos.length) return <EmptyState icon={MapPin} title="Nada encontrado" description="Nenhum local com esse nome, código ou apelido." />;
    return (
      // Colunas em vez de grade: ramo grande e ramo pequeno lado a lado não deixam buraco.
      <div className="space-y-3 xl:columns-2 xl:gap-3 xl:space-y-0">
        {grupos.map(grupo => {
          const servicos = grupo.nome === 'Serviços (só horas)';
          const fechado = servicos && !servicosAbertos && !termo;
          return (
            <section key={grupo.nome} data-locais-reveal aria-labelledby={`locais-${chaveLocal(grupo.nome).replace(/ /g, '-')}`} className={`${CARTAO} overflow-hidden xl:mb-3 xl:break-inside-avoid`}>
              <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                <h3 id={`locais-${chaveLocal(grupo.nome).replace(/ /g, '-')}`} className="min-w-0 text-base font-bold text-slate-900">{grupo.nome}</h3>
                {servicos && !termo ? (
                  <button type="button" onClick={() => setServicosAbertos(atual => !atual)} aria-expanded={!fechado} className={`inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-white hover:text-[#176b4d] ${FOCO}`}>
                    {fechado ? `Ver os ${grupo.itens.length}` : 'Esconder'}
                    <ChevronDown className={`size-4 transition duration-200 ${fechado ? '' : 'rotate-180'}`} aria-hidden="true" />
                  </button>
                ) : (
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-500">{plural(grupo.movimentos, 'movimento', 'movimentos')}</span>
                )}
              </header>
              {fechado ? (
                <p className="px-4 py-3 text-sm text-slate-500">Códigos da lista de horas que não recebem material (fornecimento, transporte, guindaste).</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {grupo.itens.map(etapa => {
                    const uso = usoPorLocal.get(etapa.id) || 0;
                    const conteudo = (
                      <>
                        <Codigo codigo={etapa.codigoSge} />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-x-2">
                            <strong className="text-base font-bold text-slate-900 sm:text-sm">{etapa.nome}</strong>
                            <span className="text-xs font-semibold text-[#718087]">{etapa.tipoLocal || 'Sem tipo'}</span>
                          </span>
                          {(etapa.apelidos || []).length > 0 && (
                            <span className="mt-0.5 block text-xs leading-snug text-slate-500">Na planilha: {(etapa.apelidos || []).join(' · ')}</span>
                          )}
                        </span>
                        <span className={`shrink-0 text-sm font-bold tabular-nums ${uso ? 'text-slate-700' : 'text-slate-300'}`}>
                          {uso.toLocaleString('pt-BR')}
                          <span className="sr-only"> movimentos</span>
                        </span>
                        {podeEditar && <Pencil className="size-4 shrink-0 text-slate-400 transition duration-200 group-hover:text-[#176b4d]" aria-hidden="true" />}
                      </>
                    );
                    return (
                      <li key={etapa.id}>
                        {podeEditar ? (
                          <button type="button" onClick={() => abrirEdicao(etapa)} aria-label={`Editar ${etapa.nome}`} className={`group flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition duration-200 hover:bg-emerald-50/60 active:bg-emerald-50 ${FOCO}`}>
                            {conteudo}
                          </button>
                        ) : (
                          <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">{conteudo}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    );
  };

  const listaSemLocal = () => {
    if (!faltando.length) {
      return <EmptyState icon={CheckCircle2} title="Todos os nomes da planilha têm local" description="Cada viagem e cada entrega já conta no ramo certo." />;
    }
    if (!faltandoFiltrados.length) return <EmptyState icon={Link2} title="Nada encontrado" description="Nenhum nome sem local com essa busca." />;
    return (
      <section data-locais-reveal className={`${CARTAO} overflow-hidden`} aria-labelledby="locais-sem-local">
        <header className="border-b border-amber-200 bg-amber-50 px-4 py-3">
          <h3 id="locais-sem-local" className="flex items-center gap-2 text-base font-bold text-amber-900">
            <AlertTriangle className="size-5 shrink-0 text-[#f26a2e]" aria-hidden="true" />
            {plural(faltando.length, 'nome da planilha ainda não conta em nenhum local', 'nomes da planilha ainda não contam em nenhum local')}
          </h3>
          <p className="mt-0.5 text-sm text-amber-900">Escolha o local de cada um e toque em Ligar. O nome passa a valer para as viagens que já estão aqui e para as próximas importações.</p>
        </header>
        <ul className="divide-y divide-slate-100">
          {faltandoFiltrados.slice(0, limite).map(item => {
            const escolhido = escolhas[item.texto] ?? item.sugestao?.id ?? '';
            return (
              <li key={item.texto} className="grid gap-2 p-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)_auto] md:items-center md:gap-3 md:py-3">
                <div className="min-w-0">
                  <strong className="block break-words text-base font-bold text-slate-900 sm:text-sm">{item.texto}</strong>
                  <span className="text-sm tabular-nums text-slate-500">{plural(item.movimentos, 'movimento', 'movimentos')}{item.sugestao ? ' · sugestão pelo número do ramo' : ''}</span>
                </div>
                {podeEditar && (
                  <>
                    <label className="block min-w-0">
                      <span className="sr-only">Local de {item.texto}</span>
                      <select value={escolhido} onChange={event => setEscolhas(atual => ({ ...atual, [item.texto]: event.target.value }))} className={CAMPO}>
                        <option value="">Escolha o local</option>
                        {opcoesLocal.map(([grupo, itens]) => (
                          <optgroup key={grupo} label={grupo}>
                            {itens.map(etapa => <option key={etapa.id} value={etapa.id}>{rotuloDoLocal(etapa)}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    <button type="button" disabled={!escolhido} onClick={() => ligar(item.texto, item.sugestao?.id)} className={`${BOTAO_PRIMARIO} w-full md:w-auto`}>
                      <Link2 className="size-4" aria-hidden="true" />
                      Ligar
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        {faltandoFiltrados.length > limite && (
          <div className="border-t border-slate-100 p-3">
            <button type="button" onClick={() => setLimite(atual => atual + POR_PAGINA)} className={`${BOTAO_SECUNDARIO} w-full`}>
              Mostrar mais {Math.min(POR_PAGINA, faltandoFiltrados.length - limite)} de {faltandoFiltrados.length - limite}
            </button>
          </div>
        )}
      </section>
    );
  };

  const lado = (texto: string) => {
    const local = resolverLocal(texto, indice);
    return (
      <span className="flex min-w-0 items-start gap-1.5">
        {local
          ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#176b4d]" aria-label="Local reconhecido" />
          : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-label="Local ainda não cadastrado" />}
        <span className="min-w-0 break-words">{texto}{local && chaveLocal(local.nome) !== chaveLocal(texto) ? <span className="block text-xs text-slate-500">conta em {local.nome}</span> : null}</span>
      </span>
    );
  };

  const listaViagens = () => {
    if (!rotasFiltradas.length) return <EmptyState icon={Route} title="Nada encontrado" description="Nenhum código de viagem com essa origem, destino ou número." />;
    return (
      <section data-locais-reveal className={`${CARTAO} overflow-hidden`} aria-labelledby="locais-viagens">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
          <h3 id="locais-viagens" className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Truck className="size-5 text-[#176b4d]" aria-hidden="true" />
            Apropriação de viagens no SGE
          </h3>
          <span className="text-sm font-semibold tabular-nums text-slate-500">{plural(rotasFiltradas.length, 'código', 'códigos')}</span>
        </header>
        <table className="hidden w-full text-left text-sm md:table">
          <caption className="sr-only">Código SGE de cada viagem, por origem e destino</caption>
          <thead className="bg-white text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="w-20 p-3">SGE</th><th className="p-3">Origem</th><th className="p-3">Destino</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rotasFiltradas.map(rota => (
              <tr key={rota.codigo} className="align-top">
                <td className="p-3"><Codigo codigo={rota.codigo} /></td>
                <td className="p-3 text-slate-700">{lado(rota.origem)}</td>
                <td className="p-3 text-slate-700">{lado(rota.destino)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="divide-y divide-slate-100 md:hidden">
          {rotasFiltradas.map(rota => (
            <li key={rota.codigo} className="flex gap-3 p-4">
              <Codigo codigo={rota.codigo} />
              <div className="min-w-0 flex-1 space-y-1 text-base text-slate-700">
                {lado(rota.origem)}
                <span className="block pl-5 text-xs font-semibold uppercase tracking-wide text-[#718087]">para</span>
                {lado(rota.destino)}
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  };

  const pendentesDaLista = plano.novas.length + plano.completadas.length;

  return (
    <div ref={raiz} className="space-y-3" data-testid="materiais-locais">
      <section aria-label="Resumo dos locais" className="grid grid-cols-3 gap-2 sm:gap-3">
        {indicadores.map(item => (
          <article key={item.rotulo} data-locais-reveal className={`${CARTAO} p-3 sm:p-4`}>
            <p className="text-xs font-semibold leading-tight text-slate-600 sm:text-sm">{item.rotulo}</p>
            <strong className={`mt-1 block text-2xl font-black tabular-nums sm:text-3xl ${item.alerta ? 'text-[#f26a2e]' : 'text-slate-950'}`}>{item.valor.toLocaleString('pt-BR')}</strong>
            <span className="hidden text-xs text-slate-500 sm:block">{item.detalhe}</span>
          </article>
        ))}
      </section>

      {podeEditar && pendentesDaLista > 0 && (
        <section data-locais-reveal aria-labelledby="locais-carga" className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center">
          <ListChecks className="size-8 shrink-0 text-[#176b4d] max-sm:hidden" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h3 id="locais-carga" className="text-base font-bold text-emerald-950">Lista de códigos SGE da obra</h3>
            <p className="text-sm text-emerald-900">
              {[plano.novas.length && plural(plano.novas.length, 'local novo', 'locais novos'), plano.completadas.length && `${plural(plano.completadas.length, 'local', 'locais')} que já existem ganham código e nomes da planilha`].filter(Boolean).join(' e ')}. Nada é apagado nem renomeado.
            </p>
          </div>
          <button type="button" onClick={() => setCargaAberta(true)} className={`${BOTAO_PRIMARIO} sm:shrink-0`} data-testid="locais-carregar-sge">
            <ListChecks className="size-5" aria-hidden="true" />
            Carregar lista SGE
          </button>
        </section>
      )}

      {plano.conflitos.length > 0 && podeEditar && (
        <p data-locais-reveal role="status" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <span>Código diferente do PDF: {plano.conflitos.map(item => `${item.etapa.nome} está com ${item.etapa.codigoSge}, o PDF diz ${item.codigoDaLista}`).join('; ')}. Confira e corrija no local.</span>
        </p>
      )}

      {aviso && (
        <p role="status" className="flex items-start justify-between gap-2 rounded-2xl border border-emerald-200 bg-white p-3 text-sm font-semibold text-emerald-900">
          <span className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#176b4d]" aria-hidden="true" />{aviso}</span>
          <button type="button" onClick={() => setAviso('')} className={`shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-100 ${FOCO}`} aria-label="Fechar aviso"><X className="size-4" aria-hidden="true" /></button>
        </p>
      )}

      <div data-locais-reveal className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="O que ver em ramos e locais" className="grid min-w-0 flex-1 grid-cols-3 gap-2 sm:flex">
          {vistas.map(({ id, nome, curto, Icone, contagem, alerta }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={vista === id}
              onClick={() => escolherVista(id)}
              data-testid={`locais-vista-${id}`}
              className={`relative inline-flex min-h-11 min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-full border px-2 text-sm sm:gap-2 sm:px-4 font-semibold transition duration-200 active:scale-[0.98] ${FOCO} ${vista === id
                ? 'border-[#176b4d] bg-[#176b4d] text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500'}`}
            >
              <Icone className="size-4 shrink-0 max-sm:hidden" aria-hidden="true" />
              <span className="truncate sm:hidden">{curto}</span>
              <span className="max-sm:hidden">{nome}</span>
              {contagem && alerta ? <span className="absolute right-2.5 top-2 size-2 rounded-full bg-[#f26a2e] sm:hidden" aria-hidden="true" /> : null}
              {contagem ? (
                <span className={`rounded-full px-2 max-sm:sr-only py-0.5 text-xs font-bold tabular-nums ${vista === id ? 'bg-white text-[#f26a2e]' : alerta ? 'bg-[#f26a2e] text-white' : 'bg-slate-100 text-slate-600'}`}>{contagem.toLocaleString('pt-BR')}</span>
              ) : null}
            </button>
          ))}
        </div>
        {podeEditar && vista === 'locais' && (
          <button type="button" onClick={() => abrirEdicao()} className={`${BOTAO_SECUNDARIO} max-sm:w-full`} data-testid="locais-novo">
            <Plus className="size-5" aria-hidden="true" />
            Novo local
          </button>
        )}
      </div>

      <div role="tabpanel">
        {vista === 'locais' && listaLocais()}
        {vista === 'sem-local' && listaSemLocal()}
        {vista === 'viagens' && listaViagens()}
      </div>

      <Modal
        open={cargaAberta}
        title="Carregar a lista de códigos SGE?"
        size="sm"
        onSubmit={carregarLista}
        onClose={() => setCargaAberta(false)}
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setCargaAberta(false)} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button type="button" onClick={carregarLista} className={BOTAO_PRIMARIO} data-testid="locais-confirmar-carga">Carregar lista</button>
          </div>
        )}
      >
        <ul className="space-y-2 text-sm text-slate-700">
          {plano.novas.length > 0 && <li className="flex gap-2"><Plus className="mt-0.5 size-4 shrink-0 text-[#176b4d]" aria-hidden="true" />Entram {plural(plano.novas.length, 'local novo', 'locais novos')}, cada um com código, tipo e ramo.</li>}
          {plano.completadas.length > 0 && <li className="flex gap-2"><Pencil className="mt-0.5 size-4 shrink-0 text-[#176b4d]" aria-hidden="true" />{plural(plano.completadas.length, 'local que você já tem ganha', 'locais que você já tem ganham')} o que falta, sem mudar o nome.</li>}
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#176b4d]" aria-hidden="true" />Nenhum local é apagado. Dá para editar cada um depois.</li>
        </ul>
      </Modal>

      <Modal
        open={Boolean(edicao)}
        title={edicao?.id ? `Editar ${edicao.nome || 'local'}` : 'Novo local'}
        size="md"
        onSubmit={salvarEdicao}
        onClose={() => setEdicao(null)}
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setEdicao(null)} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button type="button" onClick={salvarEdicao} className={BOTAO_PRIMARIO}>Salvar local</button>
          </div>
        )}
      >
        {edicao && (
          <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <label className="block">
              <span className={ROTULO}>Código SGE</span>
              <input value={edicao.codigoSge} onChange={event => setEdicao({ ...edicao, codigoSge: event.target.value.replace(/\D/g, '') })} inputMode="numeric" placeholder="Ex.: 102" className={`mt-1 ${CAMPO} font-mono tabular-nums`} />
            </label>
            <label className="block">
              <span className={ROTULO}>Nome do local</span>
              <input value={edicao.nome} onChange={event => setEdicao({ ...edicao, nome: event.target.value })} placeholder="Ex.: Espinha Ramo 900" className={`mt-1 ${CAMPO}`} />
            </label>
            <label className="block sm:col-span-2">
              <span className={ROTULO}>O que é</span>
              <select value={edicao.tipoLocal} onChange={event => setEdicao({ ...edicao, tipoLocal: event.target.value as TipoLocalObra })} className={`mt-1 ${CAMPO}`}>
                {TIPOS_LOCAL.map(tipo => <option key={tipo} value={tipo}>{tipo}: {EXPLICA_TIPO[tipo].toLocaleLowerCase('pt-BR')}</option>)}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className={ROTULO}>Ramo a que pertence</span>
              <input value={edicao.ramo} onChange={event => setEdicao({ ...edicao, ramo: event.target.value })} list="locais-ramos" placeholder="Ex.: Ramo 900 (deixe vazio se não é de um ramo)" className={`mt-1 ${CAMPO}`} />
              <datalist id="locais-ramos">{ramosConhecidos.map(ramo => <option key={ramo} value={ramo} />)}</datalist>
              <span className="mt-1 block text-xs text-slate-500">O previsto do mês soma todas as frentes do mesmo ramo.</span>
            </label>
            <div className="sm:col-span-2">
              <span className={ROTULO}>Como a planilha escreve este local</span>
              {edicao.apelidos.length > 0 ? (
                <ul className="mt-1 flex flex-wrap gap-2">
                  {edicao.apelidos.map(apelido => (
                    <li key={apelido} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm font-semibold text-slate-700">
                      {apelido}
                      <button type="button" onClick={() => setEdicao({ ...edicao, apelidos: edicao.apelidos.filter(item => item !== apelido) })} aria-label={`Tirar ${apelido}`} className={`grid size-7 place-items-center rounded-full text-slate-500 hover:bg-white hover:text-rose-700 ${FOCO}`}>
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-sm text-slate-500">Nenhum outro nome ainda.</p>}
              <div className="mt-2 flex gap-2">
                <input
                  value={edicao.novoApelido}
                  onChange={event => setEdicao({ ...edicao, novoApelido: event.target.value })}
                  onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); adicionarApelido(); } }}
                  placeholder="Ex.: CS RAMO 900"
                  aria-label="Outro nome deste local"
                  className={CAMPO}
                />
                <button type="button" onClick={adicionarApelido} className={`${BOTAO_SECUNDARIO} shrink-0`}>Juntar</button>
              </div>
            </div>
            {erro && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 sm:col-span-2">{erro}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
