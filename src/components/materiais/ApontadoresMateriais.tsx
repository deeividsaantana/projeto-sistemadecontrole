import { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, ClipboardCopy, ImageOff, Link2, MapPin, MessageCircle, Send, Undo2, UserRound, Users, type LucideIcon } from 'lucide-react';
import type { MovimentoMaterial } from '../../types';
import { SEM_NOME, enviosDoCampo, mensagemDoLink, resumoPorApontador, semEnvioNoDia, type EnvioCampo, type FiltroEnvios } from '../../modules/materials/apontadores';
import { cancelMaterialMovement } from '../../modules/materials/materialFieldUse';
import { fieldReportTime } from '../../utils/fieldReports';
import { enderecoDaFoto } from '../../utils/fotoDoCampo';
import { formatarData, numero } from '../../utils/formato';
import { getSecurePublicMaterialLink } from '../../publicApi';
import { ConfirmDialog, CountUp, EmptyState } from '../../shared/ui';
import { useEntradaDeLista } from '../../shared/hooks/useEntradaDeLista';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO } from '../cadastros/estilos';

type Subaba = 'envios' | 'pessoas' | 'link';

const SUBABAS: ReadonlyArray<{ id: Subaba; nome: string; curto: string; Icone: LucideIcon }> = [
  { id: 'envios', nome: 'Envios do campo', curto: 'Envios', Icone: Send },
  { id: 'pessoas', nome: 'Por apontador', curto: 'Pessoas', Icone: Users },
  { id: 'link', nome: 'Link do campo', curto: 'Link', Icone: Link2 },
];

const somarDias = (dia: string, dias: number) => new Date(new Date(`${dia}T12:00:00Z`).getTime() + dias * 86_400_000).toISOString().slice(0, 10);
const plural = (quantos: number, um: string, varios: string) => `${quantos.toLocaleString('pt-BR')} ${quantos === 1 ? um : varios}`;

interface Props {
  hoje: string;
  movimentos: readonly MovimentoMaterial[];
  responsavel: string;
  podeEditar: boolean;
  onUpdateMovimentos: (movimentos: MovimentoMaterial[], descricao: string, acao?: 'Editou' | 'Excluiu') => void;
  onIrParaUso: () => void;
}

function Foto({ caminho, numeroFoto, ramo }: { caminho: string; numeroFoto: number; ramo: string }) {
  const [url, setUrl] = useState('');
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let ativa = true;
    enderecoDaFoto(caminho).then(valor => { if (ativa) setUrl(valor); }).catch(() => { if (ativa) setFalhou(true); });
    return () => { ativa = false; };
  }, [caminho]);
  const moldura = 'grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100';
  if (falhou) return <span className={`${moldura} text-slate-400`} title="Foto indisponível"><ImageOff className="size-5" aria-label="Foto indisponível" /></span>;
  if (!url) return <span className={`${moldura} animate-pulse motion-reduce:animate-none`} aria-label="Carregando foto" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir foto ${numeroFoto} de ${ramo}`} className={`${moldura} transition duration-200 hover:border-emerald-500 hover:shadow-md ${FOCO}`}>
      <img src={url} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 hover:scale-105 motion-reduce:transition-none" />
    </a>
  );
}

/**
 * Apontadores: o que chegou do link do campo, quem mandou e o próprio link.
 * Só lê os movimentos; desfazer um envio marca os itens como desfeitos, sem
 * apagar nada, como o Desfazer de Movimentos.
 */
export default function ApontadoresMateriais({ hoje, movimentos, responsavel, podeEditar, onUpdateMovimentos, onIrParaUso }: Props) {
  const [subaba, setSubaba] = useState<Subaba>('envios');
  const [filtro, setFiltro] = useState<FiltroEnvios>(() => ({ de: somarDias(hoje, -6), ate: hoje, apontador: '', ramo: '' }));
  const [desfazendo, setDesfazendo] = useState<EnvioCampo | null>(null);
  const [link, setLink] = useState<{ estado: 'parado' | 'carregando' | 'pronto' | 'erro'; url?: string; erro?: string; copiado?: boolean }>({ estado: 'parado' });

  const todos = useMemo(() => enviosDoCampo(movimentos), [movimentos]);
  const envios = useMemo(() => enviosDoCampo(movimentos, filtro), [filtro, movimentos]);
  const pessoas = useMemo(() => resumoPorApontador(todos), [todos]);
  const faltamHoje = useMemo(() => semEnvioNoDia(todos, hoje), [hoje, todos]);
  const deHoje = useMemo(() => todos.filter(envio => envio.data === hoje), [hoje, todos]);
  const opcoes = useMemo(() => ({
    apontadores: pessoas.map(pessoa => pessoa.nome),
    ramos: [...new Set(todos.map(envio => envio.ramo))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  }), [pessoas, todos]);
  const fotosNoFiltro = envios.reduce((soma, envio) => soma + envio.fotos.length, 0);
  const lista = useEntradaDeLista<HTMLDivElement>([subaba, filtro]);

  const atalhos: ReadonlyArray<{ nome: string; de: string; ate: string }> = [
    { nome: 'Hoje', de: hoje, ate: hoje },
    { nome: 'Ontem', de: somarDias(hoje, -1), ate: somarDias(hoje, -1) },
    { nome: '7 dias', de: somarDias(hoje, -6), ate: hoje },
    { nome: '30 dias', de: somarDias(hoje, -29), ate: hoje },
  ];

  const desfazer = () => {
    if (!desfazendo) return;
    const alterados = desfazendo.movimentos.filter(item => !item.canceladoEm).map(item => cancelMaterialMovement(item, responsavel));
    onUpdateMovimentos(alterados, `Desfez o envio do campo de ${desfazendo.apontador} no ${desfazendo.ramo} (${formatarData(desfazendo.data)}), com ${alterados.length} material(is).`, 'Excluiu');
    setDesfazendo(null);
  };

  const gerarLink = async () => {
    setLink({ estado: 'carregando' });
    try {
      setLink({ estado: 'pronto', url: await getSecurePublicMaterialLink() });
    } catch (error) {
      setLink({ estado: 'erro', erro: error instanceof Error ? error.message : 'Não foi possível gerar o link.' });
    }
  };

  const copiar = async () => {
    if (!link.url) return;
    try {
      await navigator.clipboard.writeText(mensagemDoLink(link.url));
      setLink(atual => ({ ...atual, copiado: true }));
    } catch {
      setLink(atual => ({ ...atual, erro: 'O navegador não deixou copiar. Selecione o endereço e copie.' }));
    }
  };

  const indicadores: ReadonlyArray<{ rotulo: string; valor: number; detalhe: string; alerta?: boolean }> = [
    { rotulo: 'Envios hoje', valor: deHoje.length, detalhe: plural(new Set(deHoje.map(envio => envio.ramo)).size, 'ramo', 'ramos') },
    { rotulo: 'Apontadores', valor: pessoas.filter(pessoa => pessoa.nome !== SEM_NOME).length, detalhe: 'já mandaram pelo link' },
    { rotulo: 'Ainda não mandaram hoje', valor: faltamHoje.length, detalhe: faltamHoje.length ? faltamHoje.slice(0, 2).join(', ') + (faltamHoje.length > 2 ? '...' : '') : 'todos mandaram', alerta: faltamHoje.length > 0 },
    { rotulo: 'Fotos no período', valor: fotosNoFiltro, detalhe: plural(envios.length, 'envio', 'envios') },
  ];

  return (
    <div className="space-y-4">
      <section data-materiais-reveal aria-label="Resumo dos apontadores" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {indicadores.map(item => (
          <article key={item.rotulo} className={`${CARTAO} min-w-0 p-4`}>
            <p className="text-sm font-semibold text-slate-600">{item.rotulo}</p>
            <CountUp value={item.valor} className={`mt-1 block text-3xl font-black tabular-nums ${item.alerta ? 'text-[#f26a2e]' : 'text-slate-950'}`} />
            <span className="block truncate text-xs text-slate-500" title={item.detalhe}>{item.detalhe}</span>
          </article>
        ))}
      </section>

      <div role="tablist" aria-label="Apontadores" data-materiais-reveal className="grid grid-cols-3 gap-2">
        {SUBABAS.map(({ id, nome, curto, Icone }) => {
          const ativa = subaba === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={ativa}
              data-testid={`apontadores-aba-${id}`}
              onClick={() => setSubaba(id)}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-2 text-center text-sm font-bold transition duration-200 sm:justify-start sm:px-4 sm:text-base ${FOCO} ${ativa
                ? 'border-[#176b4d] bg-[#176b4d] text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500 hover:text-[#176b4d]'}`}
            >
              <Icone className="size-5 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">{curto}</span>
              <span className="hidden sm:inline">{nome}</span>
            </button>
          );
        })}
      </div>

      {subaba === 'envios' && (
        <div className="space-y-3">
          <section data-materiais-reveal aria-label="Filtros dos envios" className={`${CARTAO} space-y-3 p-4`}>
            <div className="flex flex-wrap gap-2">
              {atalhos.map(atalho => {
                const ativo = filtro.de === atalho.de && filtro.ate === atalho.ate;
                return (
                  <button key={atalho.nome} type="button" aria-pressed={ativo} onClick={() => setFiltro({ ...filtro, de: atalho.de, ate: atalho.ate })} className={`min-h-11 rounded-full border px-4 text-sm font-bold transition duration-200 ${FOCO} ${ativo ? 'border-[#176b4d] bg-[#176b4d] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500 hover:text-[#176b4d]'}`}>
                    {atalho.nome}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <label className="block space-y-1">
                <span className={ROTULO}>De</span>
                <input type="date" value={filtro.de} max={filtro.ate} onChange={event => setFiltro({ ...filtro, de: event.target.value })} className={CAMPO} />
              </label>
              <label className="block space-y-1">
                <span className={ROTULO}>Até</span>
                <input type="date" value={filtro.ate} min={filtro.de} onChange={event => setFiltro({ ...filtro, ate: event.target.value })} className={CAMPO} />
              </label>
              <label className="block space-y-1">
                <span className={ROTULO}>Apontador</span>
                <select value={filtro.apontador} onChange={event => setFiltro({ ...filtro, apontador: event.target.value })} className={CAMPO}>
                  <option value="">Todos</option>
                  {opcoes.apontadores.map(nome => <option key={nome} value={nome}>{nome}</option>)}
                </select>
              </label>
              <label className="block space-y-1">
                <span className={ROTULO}>Ramo</span>
                <select value={filtro.ramo} onChange={event => setFiltro({ ...filtro, ramo: event.target.value })} className={CAMPO}>
                  <option value="">Todos</option>
                  {opcoes.ramos.map(ramo => <option key={ramo} value={ramo}>{ramo}</option>)}
                </select>
              </label>
            </div>
          </section>

          <div ref={lista} className="grid grid-cols-1 items-start gap-3 2xl:grid-cols-2">
            {envios.length === 0 ? (
              <div data-materiais-reveal className={`${CARTAO} p-4 2xl:col-span-2`}>
                <EmptyState
                  icon={Camera}
                  title={todos.length ? 'Nenhum envio com esse período e esses filtros' : 'Nenhum envio do campo ainda'}
                  description={todos.length ? 'Toque em 30 dias ou escolha Todos nos filtros.' : 'Mande o link para os apontadores na aba Link do campo. O que eles salvam aparece aqui.'}
                />
                {!todos.length && (
                  <div className="-mt-4 flex justify-center pb-4">
                    <button type="button" onClick={() => setSubaba('link')} className={BOTAO_PRIMARIO}>
                      <Link2 className="size-5" aria-hidden="true" />
                      Ver o link do campo
                    </button>
                  </div>
                )}
              </div>
            ) : envios.slice(0, 60).map(envio => {
              const hora = fieldReportTime(envio.enviadoEm);
              return (
                <article key={envio.id} data-linha-lista className={`${CARTAO} materiais-vivo overflow-hidden`} aria-label={`Envio de ${envio.apontador} no ${envio.ramo}`}>
                  <header className="flex flex-wrap items-start gap-3 border-b border-slate-100 px-4 py-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#176b4d]"><MapPin className="size-5" aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-slate-900">{envio.ramo}</h3>
                      <p className="text-sm text-slate-600">
                        {formatarData(envio.data)}{hora ? ` às ${hora}` : ''} · <span className="font-semibold text-slate-800">{envio.apontador}</span>
                      </p>
                    </div>
                    <div className="flex basis-full items-center justify-between gap-2 sm:basis-auto sm:justify-end">
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${envio.fotos.length ? 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200'}`}>
                        {envio.fotos.length ? plural(envio.fotos.length, 'foto', 'fotos') : 'sem foto'}
                      </span>
                      {podeEditar && (
                        <button type="button" onClick={() => setDesfazendo(envio)} aria-label={`Desfazer envio de ${envio.apontador} no ${envio.ramo}`} className={`-my-1 inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-sm font-bold text-rose-700 transition duration-200 hover:bg-rose-50 ${FOCO}`}>
                          <Undo2 className="size-4" aria-hidden="true" />
                          Desfazer
                        </button>
                      )}
                    </div>
                  </header>
                  <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                      {envio.itens.map(item => (
                        <li key={item.movimentoId} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm">
                          <span className="min-w-0 break-words font-semibold text-slate-800 sm:truncate" title={item.material}>{item.material}</span>
                          <strong className="shrink-0 tabular-nums text-slate-950">{numero(item.quantidade)} {item.unidade}</strong>
                        </li>
                      ))}
                    </ul>
                    {envio.fotos.length > 0 && (
                      <div className="flex flex-wrap gap-2" aria-label="Fotos do envio">
                        {envio.fotos.slice(0, 3).map((caminho, posicao) => <Foto key={caminho} caminho={caminho} numeroFoto={posicao + 1} ramo={envio.ramo} />)}
                      </div>
                    )}
                  </div>
                  {envio.observacao && <p className="border-t border-slate-100 px-4 py-2 text-sm text-slate-600">Observação: {envio.observacao}</p>}
                </article>
              );
            })}
            {envios.length > 60 && <p className="px-1 text-sm text-slate-500 2xl:col-span-2">Mostrando os 60 envios mais novos de {envios.length.toLocaleString('pt-BR')}. Diminua o período para ver os outros.</p>}
          </div>
        </div>
      )}

      {subaba === 'pessoas' && (
        <section data-materiais-reveal aria-labelledby="apontadores-pessoas" className={`${CARTAO} overflow-hidden`}>
          <header className="border-b border-slate-100 px-4 py-3">
            <h2 id="apontadores-pessoas" className="text-base font-bold text-slate-900">Por apontador</h2>
            <p className="text-sm text-slate-500">Todos os envios do link, desde o primeiro. O nome é o que a pessoa escreveu no celular.</p>
          </header>
          {pessoas.length === 0 ? (
            <EmptyState icon={UserRound} title="Ninguém mandou pelo link ainda" description="Quando um apontador salvar o primeiro uso, ele aparece aqui." />
          ) : (
            <div ref={lista}>
              <table className="hidden w-full text-left text-sm md:table">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="p-3">Apontador</th>
                    <th scope="col" className="p-3 text-right">Envios</th>
                    <th scope="col" className="p-3 text-right">Dias</th>
                    <th scope="col" className="p-3 text-right">Com foto</th>
                    <th scope="col" className="p-3">Ramos</th>
                    <th scope="col" className="p-3 text-right">Último</th>
                    <th scope="col" className="p-3"><span className="sr-only">Ver envios</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pessoas.map((pessoa, posicao) => {
                    const mandouHoje = pessoa.ultimo === hoje;
                    return (
                      <tr key={pessoa.chave} data-linha-lista={posicao < 20 ? '' : undefined} className="transition-colors duration-150 hover:bg-emerald-50/50">
                        <th scope="row" className="p-3 font-semibold text-slate-900">
                          <span className="flex items-center gap-2">
                            {mandouHoje ? <CheckCircle2 className="size-4 shrink-0 text-[#176b4d]" aria-label="Mandou hoje" /> : <span className="size-4 shrink-0" aria-hidden="true" />}
                            {pessoa.nome}
                          </span>
                        </th>
                        <td className="p-3 text-right tabular-nums text-slate-700">{pessoa.envios.toLocaleString('pt-BR')}</td>
                        <td className="p-3 text-right tabular-nums text-slate-700">{pessoa.dias.toLocaleString('pt-BR')}</td>
                        <td className="p-3 text-right tabular-nums text-slate-700">{Math.round((pessoa.comFoto / pessoa.envios) * 100)}%</td>
                        <td className="max-w-[16rem] truncate p-3 text-slate-600" title={pessoa.ramos.join(', ')}>{pessoa.ramos.join(', ')}</td>
                        <td className="whitespace-nowrap p-3 text-right tabular-nums text-slate-600">{formatarData(pessoa.ultimo)}</td>
                        <td className="p-3 text-right">
                          <button type="button" onClick={() => { setFiltro({ de: somarDias(hoje, -29), ate: hoje, apontador: pessoa.nome, ramo: '' }); setSubaba('envios'); }} className={`min-h-10 rounded-xl px-3 text-sm font-bold text-[#176b4d] hover:bg-emerald-50 ${FOCO}`}>Ver envios</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <ul className="divide-y divide-slate-100 md:hidden">
                {pessoas.map((pessoa, posicao) => (
                  <li key={pessoa.chave} data-linha-lista={posicao < 20 ? '' : undefined}>
                    <button type="button" onClick={() => { setFiltro({ de: somarDias(hoje, -29), ate: hoje, apontador: pessoa.nome, ramo: '' }); setSubaba('envios'); }} className={`flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-slate-50 ${FOCO}`}>
                      <span className="min-w-0">
                        <strong className="flex items-center gap-2 text-base text-slate-900">
                          {pessoa.ultimo === hoje && <CheckCircle2 className="size-4 shrink-0 text-[#176b4d]" aria-label="Mandou hoje" />}
                          {pessoa.nome}
                        </strong>
                        <span className="block text-sm text-slate-600">{plural(pessoa.envios, 'envio', 'envios')} · {plural(pessoa.dias, 'dia', 'dias')} · {Math.round((pessoa.comFoto / pessoa.envios) * 100)}% com foto</span>
                        <span className="block truncate text-xs text-slate-500">{pessoa.ramos.join(', ')}</span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-slate-500">{formatarData(pessoa.ultimo)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {subaba === 'link' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section data-materiais-reveal aria-labelledby="apontadores-link" className={`${CARTAO} space-y-3 p-4`}>
            <div>
              <h2 id="apontadores-link" className="text-base font-bold text-slate-900">Link do campo</h2>
              <p className="text-sm text-slate-500">Um link só para todos os apontadores. Quem tem o link aponta o uso sem entrar no sistema.</p>
            </div>
            {link.estado !== 'pronto' ? (
              <button type="button" onClick={gerarLink} disabled={link.estado === 'carregando'} className={`${BOTAO_PRIMARIO} w-full sm:w-auto`} data-testid="apontadores-gerar-link">
                <Link2 className="size-5" aria-hidden="true" />
                {link.estado === 'carregando' ? 'Buscando o link...' : 'Mostrar o link'}
              </button>
            ) : (
              <div className="space-y-2">
                <input readOnly value={link.url} onFocus={event => event.currentTarget.select()} aria-label="Endereço do link do campo" className={`${CAMPO} font-mono text-xs`} />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <a href={`https://wa.me/?text=${encodeURIComponent(mensagemDoLink(link.url || ''))}`} target="_blank" rel="noopener noreferrer" className={`${BOTAO_PRIMARIO} flex-1`}>
                    <MessageCircle className="size-5" aria-hidden="true" />
                    Mandar pelo WhatsApp
                  </a>
                  <button type="button" onClick={copiar} className={`${BOTAO_SECUNDARIO} flex-1`}>
                    {link.copiado ? <CheckCircle2 className="size-5 text-[#176b4d]" aria-hidden="true" /> : <ClipboardCopy className="size-5" aria-hidden="true" />}
                    {link.copiado ? 'Copiado com o passo a passo' : 'Copiar com o passo a passo'}
                  </button>
                </div>
              </div>
            )}
            {link.erro && <p role="alert" className="text-sm font-semibold text-rose-700">{link.erro}</p>}
          </section>

          <section data-materiais-reveal aria-labelledby="apontadores-como" className={`${CARTAO} p-4`}>
            <h2 id="apontadores-como" className="text-base font-bold text-slate-900">Como o apontador usa</h2>
            <ol className="mt-3 space-y-2">
              {[
                'Abre o link no celular e escreve o nome (o celular lembra depois).',
                'Escolhe o ramo onde o material foi aplicado.',
                'Diz quanto usou de cada material e tira até 3 fotos.',
                'Toca em Salvar uso. O envio aparece em Envios do campo e já conta em Uso por ramo.',
              ].map((passo, posicao) => (
                <li key={passo} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-sm font-black text-[#176b4d]">{posicao + 1}</span>
                  <span className="pt-0.5">{passo}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <button type="button" onClick={onIrParaUso} className={`${BOTAO_SECUNDARIO} w-full sm:w-auto`}>Apontar pelo escritório em Uso por ramo</button>
            </div>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(desfazendo)}
        title="Desfazer este envio?"
        description={desfazendo ? `O uso de ${plural(desfazendo.itens.length, 'material', 'materiais')} que ${desfazendo.apontador} mandou para o ${desfazendo.ramo} deixa de contar. Nada é apagado: fica marcado como desfeito nos movimentos.` : ''}
        confirmLabel="Desfazer envio"
        onConfirm={desfazer}
        onCancel={() => setDesfazendo(null)}
      />
    </div>
  );
}
