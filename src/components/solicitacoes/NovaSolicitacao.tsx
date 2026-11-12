/**
 * Abrir solicitação no modelo de lançamento: etapas na ordem em que a pessoa
 * pensa (onde, o quê) e a conferência ao lado. O aviso de cada item aparece
 * enquanto ela digita, antes de enviar.
 */
import { useEffect, useState, type RefObject } from 'react';
import { Plus, Send, Trash2 } from 'lucide-react';
import { Campo, Conferencia, Conferido, Etapa } from '../../shared/ui/Lancamento';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO } from '../cadastros/estilos';
import { UNIDADES, problemasDoItem, problemasPorCampo, type CampoDoItem, type DadosAbertura, type ItemDigitado } from '../../utils/solicitacoes';

const itemVazio = (): ItemDigitado => ({ tipo: 'Material', descricao: '', quantidade: '', unidade: 'un', prazoDesejado: '', permiteParcial: null, quantidadePrimeiraEntrega: '' });

interface NovaSolicitacaoProps {
  solicitante: string;
  /** Devolve a mensagem de erro, ou null quando salvou. */
  onEnviar: (dados: DadosAbertura) => string | null;
  formRef?: RefObject<HTMLFormElement | null>;
}

export function NovaSolicitacao({ solicitante, onEnviar, formRef }: NovaSolicitacaoProps) {
  const [frente, setFrente] = useState('');
  const [estacamento, setEstacamento] = useState('');
  const [itens, setItens] = useState<ItemDigitado[]>([itemVazio()]);
  const [erro, setErro] = useState('');
  const [tentou, setTentou] = useState(false);
  const chaveRascunho = `renea:solicitacao:rascunho:${solicitante}`;

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(chaveRascunho);
      if (!salvo) return;
      const rascunho = JSON.parse(salvo) as { frente?: string; estacamento?: string; itens?: ItemDigitado[] };
      if (typeof rascunho.frente === 'string') setFrente(rascunho.frente);
      if (typeof rascunho.estacamento === 'string') setEstacamento(rascunho.estacamento);
      if (Array.isArray(rascunho.itens) && rascunho.itens.length) setItens(rascunho.itens);
    } catch { /* rascunho corrompido não impede novo lançamento */ }
  }, [chaveRascunho]);

  useEffect(() => {
    try { localStorage.setItem(chaveRascunho, JSON.stringify({ frente, estacamento, itens })); } catch { /* armazenamento indisponível não bloqueia o lançamento */ }
  }, [chaveRascunho, frente, estacamento, itens]);

  const mudar = (indice: number, mudanca: Partial<ItemDigitado>) =>
    setItens(atual => atual.map((item, i) => (i === indice ? { ...item, ...mudanca } : item)));

  const problemas = itens.map(problemasDoItem);
  const porCampo = itens.map(problemasPorCampo);
  const itensProntos = problemas.filter(lista => lista.length === 0).length;
  const pronto = frente.trim().length > 0 && itensProntos === itens.length;

  const enviar = () => {
    setTentou(true);
    if (!pronto) return;
    const resposta = onEnviar({ solicitante, frente, estacamento, itens });
    setErro(resposta ?? '');
    if (!resposta) { try { localStorage.removeItem(chaveRascunho); } catch { /* segue após salvar */ } }
  };

  return (
    <form ref={formRef} onSubmit={event => { event.preventDefault(); enviar(); }} data-testid="solicitacao-nova-form" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="grid min-w-0 gap-4">
        <Etapa numero={1} titulo="Onde vai ser usado" feita={frente.trim().length > 0}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Frente de trabalho ou ramo" para="sol-frente" obrigatorio erro={tentou && frente.trim().length === 0 ? 'Informe a frente de trabalho ou o ramo.' : null}>
              <input id="sol-frente" value={frente} onChange={event => setFrente(event.target.value)} placeholder="Ramo 1400, OAE Marginal..." className={CAMPO} />
            </Campo>
            <Campo rotulo="Estaca ou aplicação (opcional)" para="sol-estaca">
              <input id="sol-estaca" value={estacamento} onChange={event => setEstacamento(event.target.value)} placeholder="Estaca 1401+0,00 ou Apoio 18" className={CAMPO} />
            </Campo>
          </div>
        </Etapa>

        <Etapa numero={2} titulo="O que precisa" ajuda="Aço, drenagem e pavimentação pedem a medida técnica na descrição (bitola, DN, faixa)." feita={itensProntos === itens.length}>
          <ol className="grid gap-3">
            {itens.map((item, indice) => {
              const mostrar = tentou || Boolean(item.descricao);
              const erroDe = (campo: CampoDoItem) => (mostrar ? porCampo[indice][campo] ?? null : null);
              return (
                <li key={indice} className={`${CARTAO} grid gap-3 p-3 sm:grid-cols-6`}>
                  <div className="flex items-center justify-between sm:col-span-6">
                    <strong className="text-sm text-slate-900">Item {indice + 1}</strong>
                    {itens.length > 1 && (
                      <button type="button" onClick={() => setItens(atual => atual.filter((_, i) => i !== indice))} aria-label={`Tirar item ${indice + 1}`} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-bold text-rose-700 hover:bg-rose-50">
                        <Trash2 className="size-4" aria-hidden="true" /> Tirar
                      </button>
                    )}
                  </div>
                  <Campo rotulo="Tipo" para={`sol-tipo-${indice}`} className="sm:col-span-2">
                    <select id={`sol-tipo-${indice}`} value={item.tipo} onChange={event => mudar(indice, { tipo: event.target.value })} className={CAMPO}>
                      <option>Material</option>
                      <option>Serviço</option>
                    </select>
                  </Campo>
                  <Campo rotulo="Descrição com especificação" para={`sol-desc-${indice}`} obrigatorio erro={erroDe('descricao') ?? erroDe('especificacao')} className="sm:col-span-4">
                    <input id={`sol-desc-${indice}`} value={item.descricao} onChange={event => mudar(indice, { descricao: event.target.value })} placeholder="Ex.: Vergalhão CA-50 ø 12,5 mm" className={CAMPO} />
                  </Campo>
                  <Campo rotulo="Quantidade" para={`sol-qtd-${indice}`} obrigatorio erro={erroDe('quantidade')} className="sm:col-span-2">
                    <input id={`sol-qtd-${indice}`} inputMode="decimal" value={item.quantidade} onChange={event => mudar(indice, { quantidade: event.target.value })} placeholder="0" className={CAMPO} />
                  </Campo>
                  <Campo rotulo="Unidade" para={`sol-un-${indice}`} className="sm:col-span-1">
                    <select id={`sol-un-${indice}`} value={item.unidade} onChange={event => mudar(indice, { unidade: event.target.value })} className={CAMPO}>
                      {UNIDADES.map(unidade => <option key={unidade}>{unidade}</option>)}
                    </select>
                  </Campo>
                  <Campo rotulo="Prazo desejado" para={`sol-prazo-${indice}`} obrigatorio erro={erroDe('prazoDesejado')} className="sm:col-span-3">
                    <input id={`sol-prazo-${indice}`} type="date" value={item.prazoDesejado} onChange={event => mudar(indice, { prazoDesejado: event.target.value })} className={CAMPO} />
                  </Campo>
                  <fieldset className="sm:col-span-6">
                    <legend className="mb-1 text-sm font-bold text-slate-700">Aceita entrega parcial?</legend>
                    <div className="flex gap-2">
                      {[{ valor: true, rotulo: 'Sim' }, { valor: false, rotulo: 'Não' }].map(opcao => (
                        <button key={opcao.rotulo} type="button" aria-pressed={item.permiteParcial === opcao.valor} onClick={() => mudar(indice, { permiteParcial: opcao.valor })}
                          className={`${BOTAO_SECUNDARIO} flex-1 sm:flex-none sm:px-6 ${item.permiteParcial === opcao.valor ? 'border-[#176b4d] bg-emerald-50 text-[#176b4d]' : ''}`}>
                          {opcao.rotulo}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  {item.permiteParcial === true && (
                    <Campo rotulo="Quantidade da 1ª entrega" para={`sol-primeira-${indice}`} obrigatorio erro={erroDe('quantidadePrimeiraEntrega')} className="sm:col-span-3">
                      <input id={`sol-primeira-${indice}`} inputMode="decimal" value={item.quantidadePrimeiraEntrega ?? ''} onChange={event => mudar(indice, { quantidadePrimeiraEntrega: event.target.value })} placeholder="Ex.: 10" className={CAMPO} />
                    </Campo>
                  )}
                  {erroDe('permiteParcial') && (
                    <p className="text-sm font-semibold text-[#c2410c] sm:col-span-6">{erroDe('permiteParcial')}</p>
                  )}
                </li>
              );
            })}
          </ol>
          <button type="button" onClick={() => setItens(atual => [...atual, itemVazio()])} className={`${BOTAO_SECUNDARIO} mt-3`}>
            <Plus className="size-4" aria-hidden="true" /> Mais um item
          </button>
        </Etapa>
      </div>

      <Conferencia subtitulo="Ao enviar, a solicitação entra na fila de Suprimentos.">
        <dl className="divide-y divide-slate-100">
          <Conferido rotulo="Solicitante" valor={solicitante} ok />
          <Conferido rotulo="Frente" valor={frente.trim() || '—'} ok={frente.trim().length > 0} />
          <Conferido rotulo="Itens prontos" valor={`${itensProntos} de ${itens.length}`} ok={itensProntos === itens.length} />
        </dl>
        {erro && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{erro}</p>}
        <button type="submit" className={`${BOTAO_PRIMARIO} w-full`} aria-disabled={!pronto}>
          <Send className="size-4" aria-hidden="true" /> Enviar para Suprimentos
        </button>
      </Conferencia>
    </form>
  );
}
