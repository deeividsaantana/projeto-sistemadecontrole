/**
 * Bota-fora: para onde foi o solo contaminado e o lixo da obra, quantas
 * viagens, quanto pesou e quanto custou, de onde saiu e o código SGE da
 * viagem. Só lê os movimentos; nada é gravado aqui.
 */
import { useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { AlertTriangle, MapPinned, Truck } from 'lucide-react';
import type { EtapaServico, MovimentoMaterial } from '../../types';
import { resumirBotaFora, viagensDeBotaFora, type ResumoDestino, type ViagemBotaFora } from '../../modules/materials/botaFora';
import { nomeDoMes } from '../../modules/materials/previstoMateriais';
import { normalizeComparable } from '../../utils/canonicalIdentity';
import { moeda, numero } from '../../utils/formato';
import { EmptyState } from '../../shared/ui';
import { BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO, reduzMovimento } from '../cadastros/estilos';

interface Props {
  movimentos: MovimentoMaterial[];
  etapas: EtapaServico[];
  /** Busca do topo de Materiais, já sem acento e em minúsculas. */
  termo: string;
  onIrParaLocais: () => void;
}

const POR_PAGINA = 30;
// Uma cor por destino, na ordem de quem recebeu mais viagens: sempre a mesma em toda a tela.
// A obra tem três bota-foras; um quarto repete o cinza.
const CORES = ['#176b4d', '#f26a2e', '#718087'];
const COR_RESTO = '#718087';

const maiuscula = (texto: string) => texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1);
const plural = (quantidade: number, um: string, varios: string) => `${numero(quantidade, 0)} ${quantidade === 1 ? um : varios}`;
const dataCurta = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(2, 4)}`;
const quantidadeDa = (viagem: ViagemBotaFora) => `${numero(Math.abs(Number(viagem.movimento.quantidade) || 0), 2)} ${viagem.movimento.unidade}`;

export default function BotaForaMateriais({ movimentos, etapas, termo, onIrParaLocais }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const [mes, setMes] = useState('');
  const [limite, setLimite] = useState(POR_PAGINA);
  const [destaque, setDestaque] = useState<string | null>(null);

  const viagens = useMemo(() => viagensDeBotaFora(movimentos, etapas), [etapas, movimentos]);
  const geral = useMemo(() => resumirBotaFora(viagens), [viagens]);
  const resumo = useMemo(() => (mes ? resumirBotaFora(viagens, mes) : geral), [geral, mes, viagens]);
  const corDe = useMemo(() => {
    const ordem = geral.porDestino.map(item => item.destino.id);
    return (id: string) => CORES[ordem.indexOf(id)] ?? COR_RESTO;
  }, [geral]);

  const lista = useMemo(() => viagens.filter(viagem => (!mes || viagem.movimento.data.startsWith(mes))
    && (!termo || normalizeComparable(`${viagem.destino.nome} ${viagem.residuo} ${viagem.origem?.nome || ''} ${viagem.origemTexto || ''} ${viagem.movimento.placa || ''} ${viagem.movimento.notaFiscal || ''} ${viagem.movimento.ticket || ''} ${viagem.codigoSge || ''}`).includes(termo))),
  [mes, termo, viagens]);

  const maiorMes = Math.max(1, ...geral.porMes.map(ponto => ponto.total));
  const pontoDestaque = geral.porMes.find(ponto => ponto.mes === (destaque ?? mes));
  const origensSemLocal = resumo.porOrigem.filter(item => !item.conhecida && item.origem !== 'Sem origem na planilha');

  useGSAP(() => {
    if (!raiz.current || reduzMovimento()) return;
    gsap.fromTo(raiz.current.querySelectorAll('[data-botafora-reveal]'), { opacity: 0, y: 12 }, {
      opacity: 1, y: 0, duration: 0.4, stagger: 0.04, ease: 'power3.out', clearProps: 'transform,opacity',
    });
    gsap.from(raiz.current.querySelectorAll('[data-botafora-barra]'), { scaleY: 0, transformOrigin: 'bottom center', duration: 0.6, ease: 'power2.out', stagger: 0.03, clearProps: 'transform' });
  }, { scope: raiz, dependencies: [mes] });

  const escolherMes = (proximo: string) => {
    setMes(proximo);
    setLimite(POR_PAGINA);
  };

  if (!viagens.length) {
    return (
      <div ref={raiz} data-testid="materiais-botafora" className={`${CARTAO} p-4`}>
        <EmptyState icon={Truck} title="Nenhuma viagem de bota-fora ainda" description="As viagens para Itaquareia, Lara e São Bento aparecem aqui quando a planilha é importada ou quando alguém lança um transporte para um desses lugares." />
      </div>
    );
  }

  const cartaoDestino = (item: ResumoDestino) => (
    <article key={item.destino.id} data-botafora-reveal className={`${CARTAO} flex flex-col p-4`} aria-labelledby={`botafora-${item.destino.id}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 id={`botafora-${item.destino.id}`} className="flex items-center gap-2 text-base font-bold text-slate-900">
          <i className="size-3 shrink-0 rounded-full" style={{ backgroundColor: corDe(item.destino.id) }} aria-hidden="true" />
          {item.destino.nome}
        </h3>
        {item.ultima && <span className="shrink-0 text-xs text-slate-500">última {dataCurta(item.ultima)}</span>}
      </div>
      <p className="mt-1 flex flex-wrap gap-1.5">
        {item.residuos.map(parte => (
          <span key={parte.residuo} className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${parte.residuo === 'Solo contaminado' ? 'bg-orange-50 text-orange-800 ring-orange-200' : 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
            {parte.residuo}{item.residuos.length > 1 ? ` · ${numero(parte.viagens, 0)}` : ''}
          </span>
        ))}
      </p>
      <p className="mt-3">
        <strong className="text-3xl font-black tabular-nums text-slate-950">{numero(item.viagens, 0)}</strong>
        <span className="ml-1.5 text-sm font-semibold text-slate-600">{item.viagens === 1 ? 'viagem' : 'viagens'}</span>
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-sm">
        <div><dt className="text-xs text-slate-500">Custo</dt><dd className="font-bold tabular-nums text-slate-900">{moeda(item.custo)}</dd></div>
        <div><dt className="text-xs text-slate-500">Por viagem</dt><dd className="font-bold tabular-nums text-slate-900">{item.viagens ? moeda(item.custo / item.viagens) : '—'}</dd></div>
        {item.toneladas > 0 && (
          <div>
            <dt className="text-xs text-slate-500">Pesado</dt>
            <dd className="font-bold tabular-nums text-slate-900">{numero(item.toneladas, 1)} t</dd>
            {item.viagensPesadas < item.viagens && <dd className="text-xs text-slate-500">em {plural(item.viagensPesadas, 'viagem', 'viagens')}</dd>}
          </div>
        )}
        {item.metrosCubicos > 0 && (
          <div>
            <dt className="text-xs text-slate-500">Medido</dt>
            <dd className="font-bold tabular-nums text-slate-900">{numero(item.metrosCubicos, 1)} m³</dd>
            {item.viagensMedidas < item.viagens && <dd className="text-xs text-slate-500">em {plural(item.viagensMedidas, 'viagem', 'viagens')}</dd>}
          </div>
        )}
      </dl>
    </article>
  );

  return (
    <div ref={raiz} className="space-y-3" data-testid="materiais-botafora">
      <section data-botafora-reveal className={`${CARTAO} flex flex-col gap-3 p-4 sm:flex-row sm:items-end`} aria-label="Período do bota-fora">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-slate-900">Viagens para os bota-foras</h3>
          <p className="text-sm text-slate-500">Solo contaminado e lixo que saíram da obra. Cada linha da planilha é uma viagem.</p>
        </div>
        <label className="block sm:w-60">
          <span className={ROTULO}>Período</span>
          <select value={mes} onChange={event => escolherMes(event.target.value)} className={`mt-1 ${CAMPO}`} data-testid="botafora-periodo">
            <option value="">Todos os meses</option>
            {[...geral.meses].reverse().map(opcao => <option key={opcao} value={opcao}>{maiuscula(nomeDoMes(opcao))}</option>)}
          </select>
        </label>
      </section>

      <section aria-label="Total do período" className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {[
          { rotulo: 'Viagens', valor: numero(resumo.totais.viagens, 0) },
          // No celular o custo ocupa a linha toda: valor em reais não cabe num terço da tela.
          { rotulo: 'Custo', valor: moeda(resumo.totais.custo), largo: true },
          { rotulo: 'Por viagem', valor: resumo.totais.viagens ? moeda(resumo.totais.custo / resumo.totais.viagens) : '—' },
        ].map(item => (
          <article key={item.rotulo} data-botafora-reveal className={`${CARTAO} p-3 sm:p-4 ${'largo' in item ? 'max-sm:order-last max-sm:col-span-2' : ''}`}>
            <p className="text-xs font-semibold text-slate-600 sm:text-sm">{item.rotulo}</p>
            <strong className="mt-1 block whitespace-nowrap text-xl font-black tabular-nums text-slate-950 sm:text-2xl">{item.valor}</strong>
          </article>
        ))}
      </section>

      {resumo.porDestino.length ? (
        <div className="grid gap-3 md:grid-cols-3">{resumo.porDestino.map(cartaoDestino)}</div>
      ) : (
        <div data-botafora-reveal className={`${CARTAO} p-4`}>
          <EmptyState icon={Truck} title={`Nenhuma viagem em ${nomeDoMes(mes)}`} description="Escolha outro mês ou veja todos os meses." />
        </div>
      )}

      <article data-botafora-reveal className={`${CARTAO} p-4`} aria-labelledby="botafora-meses">
        <h3 id="botafora-meses" className="text-base font-bold text-slate-900">Viagens por mês</h3>
        <p className="text-sm text-slate-500">Toque num mês para ver só ele.</p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600" aria-label="Legenda do gráfico">
          {geral.porDestino.map(item => (
            <span key={item.destino.id} className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ backgroundColor: corDe(item.destino.id) }} aria-hidden="true" />{item.destino.nome}</span>
          ))}
        </div>
        <div className="relative mt-3">
          <span className="absolute left-0 top-0 text-xs tabular-nums text-slate-400">{numero(maiorMes, 0)}</span>
          <div className="ml-8 grid h-44 items-end gap-1 border-b border-slate-200 sm:gap-2" style={{ gridTemplateColumns: `repeat(${geral.porMes.length}, minmax(0, 1fr))` }} onMouseLeave={() => setDestaque(null)}>
            {geral.porMes.map(ponto => {
              const escolhido = mes === ponto.mes;
              return (
                <button
                  key={ponto.mes}
                  type="button"
                  aria-pressed={escolhido}
                  aria-label={`${maiuscula(nomeDoMes(ponto.mes))}: ${plural(ponto.total, 'viagem', 'viagens')}. ${escolhido ? 'Tocar mostra todos os meses.' : 'Tocar mostra só este mês.'}`}
                  onMouseEnter={() => setDestaque(ponto.mes)}
                  onFocus={() => setDestaque(ponto.mes)}
                  onBlur={() => setDestaque(null)}
                  onClick={() => escolherMes(escolhido ? '' : ponto.mes)}
                  className={`flex h-full min-w-0 flex-col justify-end rounded-t-lg px-1 transition-colors sm:px-2 ${escolhido ? 'bg-emerald-50' : destaque === ponto.mes ? 'bg-slate-100' : ''} ${FOCO}`}
                >
                  <span data-botafora-barra className={`flex w-full flex-col-reverse overflow-hidden rounded-t-[4px] ${mes && !escolhido ? 'opacity-40' : ''}`} style={{ height: `max(2px, ${(ponto.total / maiorMes) * 100}%)` }}>
                    {geral.porDestino.map(item => {
                      const parte = ponto.porDestino[item.destino.id] || 0;
                      return parte ? <span key={item.destino.id} className="block w-full" style={{ height: `${(parte / ponto.total) * 100}%`, backgroundColor: corDe(item.destino.id) }} /> : null;
                    })}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="ml-8 grid gap-1 pt-1 sm:gap-2" style={{ gridTemplateColumns: `repeat(${geral.porMes.length}, minmax(0, 1fr))` }} aria-hidden="true">
            {geral.porMes.map(ponto => (
              <span key={ponto.mes} className="text-center text-[11px] leading-tight tabular-nums text-slate-500">
                <span className="block">{nomeDoMes(ponto.mes).slice(0, 3)}</span>
                <span className="block">{ponto.mes.slice(2, 4)}</span>
              </span>
            ))}
          </div>
          <p className="mt-2 min-h-10 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700" aria-live="polite">
            {pontoDestaque ? (
              <>
                <strong className="text-slate-900">{maiuscula(nomeDoMes(pontoDestaque.mes))}:</strong>{' '}
                {geral.porDestino.map(item => `${numero(pontoDestaque.porDestino[item.destino.id] || 0, 0)} para ${item.destino.nome}`).join(', ')}.
              </>
            ) : 'Passe o mouse ou toque num mês para ver os números.'}
          </p>
        </div>
      </article>

      <article data-botafora-reveal className={`${CARTAO} overflow-hidden`} aria-labelledby="botafora-origens">
        <header className="border-b border-slate-100 px-4 py-3">
          <h3 id="botafora-origens" className="text-base font-bold text-slate-900">De onde saíram</h3>
          <p className="text-sm text-slate-500">Local de carga de cada viagem e o código SGE da rota, quando existe.</p>
        </header>
        <ul className="divide-y divide-slate-100">
          {resumo.porOrigem.map(item => (
            <li key={item.chave} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
              {item.codigoSge
                ? <span className="inline-flex min-w-12 shrink-0 justify-center rounded-lg bg-emerald-50 px-2 py-1 font-mono text-sm font-bold tabular-nums text-[#176b4d] ring-1 ring-inset ring-emerald-200" title="Código SGE da viagem">{item.codigoSge}</span>
                : <span className="inline-flex min-w-12 shrink-0 justify-center rounded-lg bg-slate-50 px-2 py-1 text-sm font-semibold text-slate-400 ring-1 ring-inset ring-slate-200" title="Sem código SGE">—</span>}
              <span className="min-w-0 flex-1">
                <strong className={`block break-words text-base font-bold sm:text-sm ${item.conhecida ? 'text-slate-900' : 'text-slate-600'}`}>{item.origem}</strong>
                <span className="text-sm text-slate-500">para {item.destino}</span>
              </span>
              <strong className="shrink-0 text-sm font-bold tabular-nums text-slate-700">{plural(item.viagens, 'viagem', 'viagens')}</strong>
            </li>
          ))}
        </ul>
        {origensSemLocal.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
            <p className="flex min-w-0 flex-1 items-start gap-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#f26a2e]" aria-hidden="true" />
              {plural(origensSemLocal.length, 'origem ainda não tem', 'origens ainda não têm')} local no cadastro, por isso ficam sem código SGE. Ligue em Ramos e locais.
            </p>
            <button type="button" onClick={onIrParaLocais} className={`${BOTAO_SECUNDARIO} sm:shrink-0`}>
              <MapPinned className="size-5" aria-hidden="true" />
              Ramos e locais
            </button>
          </div>
        )}
      </article>

      <article data-botafora-reveal className={`${CARTAO} overflow-hidden`} aria-labelledby="botafora-lista">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h3 id="botafora-lista" className="text-base font-bold text-slate-900">Viagens{mes ? ` de ${nomeDoMes(mes)}` : ''}</h3>
          <span className="text-sm tabular-nums text-slate-500">{plural(lista.length, 'lançamento', 'lançamentos')}{termo ? ' com a busca' : ''}</span>
        </header>
        {!lista.length ? (
          <EmptyState icon={Truck} title="Nada encontrado" description="Nenhuma viagem com essa busca no período." />
        ) : (
          <>
            <table className="hidden w-full text-left text-sm md:table">
              <caption className="sr-only">Viagens de bota-fora, da mais recente para a mais antiga</caption>
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Data</th>
                  <th className="px-4 py-2">Destino</th>
                  <th className="px-4 py-2">Origem</th>
                  <th className="px-4 py-2">Placa · nota</th>
                  <th className="px-4 py-2 text-right">Quantidade</th>
                  <th className="px-4 py-2 text-right">Custo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.slice(0, limite).map(viagem => (
                  <tr key={viagem.movimento.id}>
                    <td className="px-4 py-2.5 tabular-nums text-slate-700">{dataCurta(viagem.movimento.data)}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2 font-semibold text-slate-900"><i className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: corDe(viagem.destino.id) }} aria-hidden="true" />{viagem.destino.nome}</span>
                      <span className="text-xs text-slate-500">{viagem.residuo}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{viagem.origem?.nome || viagem.origemTexto || '—'}{viagem.codigoSge ? <span className="ml-1 font-mono text-xs text-[#176b4d]">({viagem.codigoSge})</span> : null}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{[viagem.movimento.placa, viagem.movimento.notaFiscal].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">{quantidadeDa(viagem)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">{viagem.custo ? moeda(viagem.custo) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-slate-100 md:hidden">
              {lista.slice(0, limite).map(viagem => (
                <li key={viagem.movimento.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <strong className="flex items-center gap-2 text-base font-bold text-slate-900"><i className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: corDe(viagem.destino.id) }} aria-hidden="true" />{viagem.destino.nome}</strong>
                    <span className="shrink-0 text-sm tabular-nums text-slate-500">{dataCurta(viagem.movimento.data)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">{viagem.residuo} · {quantidadeDa(viagem)}{viagem.custo ? ` · ${moeda(viagem.custo)}` : ''}</p>
                  <p className="text-sm text-slate-500">
                    {viagem.origem?.nome || viagem.origemTexto ? `De ${viagem.origem?.nome || viagem.origemTexto}` : 'Sem origem'}
                    {[viagem.movimento.placa, viagem.movimento.notaFiscal && `nota ${viagem.movimento.notaFiscal}`].filter(Boolean).map(texto => ` · ${texto}`).join('')}
                  </p>
                </li>
              ))}
            </ul>
            {lista.length > limite && (
              <div className="border-t border-slate-100 p-3 text-center">
                <button type="button" onClick={() => setLimite(atual => atual + POR_PAGINA)} className={BOTAO_SECUNDARIO}>
                  Ver mais {Math.min(POR_PAGINA, lista.length - limite)} de {numero(lista.length - limite, 0)}
                </button>
              </div>
            )}
          </>
        )}
      </article>
    </div>
  );
}

