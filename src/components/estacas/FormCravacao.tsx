import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, Hammer, SkipForward, X } from 'lucide-react';
import type { ControleEstacas, CravacaoEstaca, ObraLocal } from '../../types';
import {
  SEM_FRENTE,
  estaCravada,
  frenteDaEstaca,
  nomeDaEstaca,
  ordemDasEstacas,
} from '../../modules/estacas/avancoEstacas';
import { suggestStakeLot } from '../../utils/stakeOperations';
import { numero } from '../../utils/formato';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO } from '../cadastros/estilos';
import { Campo, Conferencia, Conferido, Etapa } from '../../shared/ui/Lancamento';

export interface PedidoDeCravacao {
  /** Estaca a cravar (prevista) ou já cravada para corrigir. */
  estacaId?: string;
  frente?: string;
}

interface Props {
  hoje: string;
  controle: ControleEstacas;
  obras: readonly ObraLocal[];
  responsavel: string;
  pedido: PedidoDeCravacao;
  onSalvar: (estaca: CravacaoEstaca, anteriorId?: string) => void;
  onCancelar: () => void;
}

const NOVA = '__nova__';
const OUTRA_FRENTE = '__outra__';
const uid = () => `cravacao-estaca-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const lerNumero = (valor: string) => {
  const n = Number(String(valor).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const paraCampo = (valor: number | undefined) => (Number(valor) > 0 ? String(valor).replace('.', ',') : '');

/**
 * Lançar a cravação, no modelo do Combustível (10/11/2026): duas etapas, qual
 * estaca e quanto cravou, e ao lado a conferência do que vai ser salvo. A
 * próxima estaca da frente já vem marcada. "Salvar e
 * cravar a próxima" deixa a folha pronta para a estaca seguinte da frente.
 */
export default function FormCravacao({ hoje, controle, obras, responsavel, pedido, onSalvar, onCancelar }: Props) {
  const estacas = controle.cravacoes;
  const frentes = useMemo(() => Array.from(new Set(estacas.map(frenteDaEstaca))).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })), [estacas]);
  const editando = pedido.estacaId ? estacas.find(item => item.id === pedido.estacaId && estaCravada(item)) : undefined;

  const [frente, setFrente] = useState('');
  const [frenteNova, setFrenteNova] = useState('');
  const [estacaId, setEstacaId] = useState(NOVA);
  const [nome, setNome] = useState('');
  const [data, setData] = useState(hoje);
  const [comprimento, setComprimento] = useState('');
  const [cravado, setCravado] = useState('');
  const [perda, setPerda] = useState('');
  const [obraLocalId, setObraLocalId] = useState('');
  const [loteId, setLoteId] = useState('');
  const [quem, setQuem] = useState(responsavel);
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState('');
  const campoCravado = useRef<HTMLInputElement>(null);

  const frenteEscolhida = frente === OUTRA_FRENTE ? frenteNova.trim() : frente;
  const aCravar = useMemo(
    () => estacas.filter(item => !estaCravada(item) && frenteDaEstaca(item) === (frenteEscolhida || SEM_FRENTE)).sort(ordemDasEstacas),
    [estacas, frenteEscolhida],
  );

  const carregar = (estaca: CravacaoEstaca | undefined, frenteInicial: string) => {
    setErro('');
    setFrente(frenteInicial);
    setFrenteNova('');
    setEstacaId(estaca?.id ?? NOVA);
    setNome(estaca ? nomeDaEstaca(estaca) : '');
    setData(estaca && estaCravada(estaca) ? estaca.data : hoje);
    setComprimento(paraCampo(estaca?.comprimentoM));
    setCravado(paraCampo(estaca?.comprimentoCravadoM));
    setPerda(paraCampo(estaca?.perdaM));
    setObraLocalId(estaca?.obraLocalId ?? '');
    setLoteId(estaca?.loteId ?? '');
    setQuem(estaca && estaCravada(estaca) ? estaca.responsavel || responsavel : responsavel);
    setObservacao(estaca && estaCravada(estaca) ? estaca.observacao : '');
  };

  // Abre já com a estaca pedida ou com a próxima da frente.
  useEffect(() => {
    const alvo = pedido.estacaId ? estacas.find(item => item.id === pedido.estacaId) : undefined;
    const frenteInicial = alvo ? frenteDaEstaca(alvo) : pedido.frente || frentes[0] || '';
    const proxima = alvo ?? estacas.filter(item => !estaCravada(item) && frenteDaEstaca(item) === frenteInicial).sort(ordemDasEstacas)[0];
    carregar(proxima, frenteInicial === SEM_FRENTE ? '' : frenteInicial);
    setSalvo('');
    // Só quando o pedido muda: o resto do estado é do formulário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido]);

  const escolherFrente = (valor: string) => {
    setFrente(valor);
    if (valor === OUTRA_FRENTE) { setEstacaId(NOVA); return; }
    const proxima = estacas.filter(item => !estaCravada(item) && frenteDaEstaca(item) === (valor || SEM_FRENTE)).sort(ordemDasEstacas)[0];
    setEstacaId(proxima?.id ?? NOVA);
    setNome(proxima ? nomeDaEstaca(proxima) : '');
    if (proxima && Number(proxima.comprimentoM) > 0) setComprimento(paraCampo(proxima.comprimentoM));
  };

  const escolherEstaca = (valor: string) => {
    setEstacaId(valor);
    const estaca = estacas.find(item => item.id === valor);
    setNome(estaca ? nomeDaEstaca(estaca) : '');
    if (estaca && Number(estaca.comprimentoM) > 0) setComprimento(paraCampo(estaca.comprimentoM));
  };

  const numeros = { comprimento: lerNumero(comprimento), cravado: lerNumero(cravado), perda: lerNumero(perda) };
  const sobra = Math.max(0, numeros.comprimento - numeros.cravado - numeros.perda);

  const salvar = (event: FormEvent, seguir: boolean) => {
    event.preventDefault();
    setSalvo('');
    if (!frenteEscolhida) return setErro('Escolha a frente onde a estaca foi cravada.');
    if (estacaId === NOVA && !nome.trim()) return setErro('Escreva o nome ou número da estaca.');
    if (numeros.comprimento <= 0) return setErro('Informe o comprimento da estaca em metros.');
    if (numeros.cravado <= 0) return setErro('Informe quantos metros a estaca entrou na terra.');
    if (numeros.cravado + numeros.perda > numeros.comprimento + 0.001) {
      return setErro('A profundidade cravada mais a perda passou do comprimento da estaca. Se houve emenda, some o comprimento das peças.');
    }
    const anterior = estacas.find(item => item.id === (editando?.id ?? estacaId));
    const agora = new Date().toISOString();
    const rascunho: CravacaoEstaca = {
      ...(anterior ?? {
        id: uid(),
        item: '',
        servico: 'Cravação de estaca prancha',
        origem: 'Manual' as const,
        criadoEm: agora,
      }),
      data,
      identificacao: frenteEscolhida,
      perfil: anterior && estacaId !== NOVA ? anterior.perfil : nome.trim(),
      comprimentoM: numeros.comprimento,
      comprimentoCravadoM: numeros.cravado,
      perdaM: numeros.perda,
      sobraM: sobra,
      obraLocalId: obraLocalId || undefined,
      responsavel: quem.trim() || responsavel,
      observacao: observacao.trim(),
      atualizadoEm: agora,
    } as CravacaoEstaca;
    const lote = loteId || suggestStakeLot(rascunho, controle)?.id;
    const estaca = { ...rascunho, loteId: lote || undefined };
    onSalvar(estaca, anterior?.id);
    const texto = `${nomeDaEstaca(estaca)} salva: ${numero(estaca.comprimentoCravadoM, 2)} m cravados.`;
    if (seguir) {
      const proxima = aCravar.find(item => item.id !== estaca.id);
      carregar(proxima, frente);
      setData(data);
      if (!proxima) setComprimento(paraCampo(numeros.comprimento));
      setSalvo(proxima ? `${texto} Agora é a ${nomeDaEstaca(proxima)}.` : `${texto} Não sobrou estaca prevista nesta frente.`);
      requestAnimationFrame(() => campoCravado.current?.focus());
    } else {
      onCancelar();
    }
  };

  const lotes = controle.lotes;

  const nomeNaConferencia = editando ? nomeDaEstaca(editando) : estacaId === NOVA ? nome.trim() : nome;
  const estacaOk = Boolean(frenteEscolhida && nomeNaConferencia);
  const medidasOk = numeros.comprimento > 0 && numeros.cravado > 0 && numeros.cravado + numeros.perda <= numeros.comprimento + 0.001;

  return (
    <form data-estacas-reveal onSubmit={event => salvar(event, !editando)} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]" aria-label={editando ? 'Corrigir cravação' : 'Lançar cravação'} noValidate>
      <div className="grid min-w-0 gap-4">
        <Etapa numero={1} titulo={editando ? `Corrigindo ${nomeDaEstaca(editando)}` : 'Qual estaca foi cravada?'} ajuda="A próxima estaca da frente já vem marcada." feita={estacaOk}>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <Campo rotulo="Frente" para="crav-frente">
              <select id="crav-frente" value={frente} onChange={event => escolherFrente(event.target.value)} className={CAMPO} disabled={Boolean(editando)}>
                {!frentes.length && <option value="">Escolha</option>}
                {frentes.map(item => <option key={item} value={item === SEM_FRENTE ? '' : item}>{item}</option>)}
                <option value={OUTRA_FRENTE}>Outra frente…</option>
              </select>
            </Campo>
            {frente === OUTRA_FRENTE && (
              <Campo rotulo="Nome da frente" para="crav-frente-nova">
                <input id="crav-frente-nova" value={frenteNova} onChange={event => setFrenteNova(event.target.value)} placeholder="Ex.: AP 12 ferradura" className={CAMPO} />
              </Campo>
            )}
            {!editando && (
              <Campo rotulo="Estaca" para="crav-estaca">
                <select id="crav-estaca" value={estacaId} onChange={event => escolherEstaca(event.target.value)} className={CAMPO}>
                  {aCravar.map((item, indice) => <option key={item.id} value={item.id}>{nomeDaEstaca(item)}{indice === 0 ? ' (próxima)' : ''}</option>)}
                  <option value={NOVA}>Estaca nova, fora do previsto</option>
                </select>
              </Campo>
            )}
            {!editando && estacaId === NOVA && (
              <Campo rotulo="Nome ou número da estaca" para="crav-nome">
                <input id="crav-nome" value={nome} onChange={event => setNome(event.target.value)} placeholder="Ex.: Estaca 21" className={CAMPO} />
              </Campo>
            )}
            <Campo rotulo="Dia da cravação" para="crav-dia">
              <input id="crav-dia" type="date" value={data} onChange={event => setData(event.target.value)} className={CAMPO} />
            </Campo>
          </div>
        </Etapa>

        <Etapa numero={2} titulo="Quanto cravou?" ajuda="Em metros. A sobra é a conta do que ficou acima do chão." feita={medidasOk}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Campo rotulo="Comprimento" para="crav-comprimento">
              <input id="crav-comprimento" inputMode="decimal" value={comprimento} onChange={event => setComprimento(event.target.value)} placeholder="Ex.: 12" className={CAMPO} />
            </Campo>
            <Campo rotulo="Entrou na terra" para="crav-cravado">
              <input id="crav-cravado" ref={campoCravado} inputMode="decimal" value={cravado} onChange={event => setCravado(event.target.value)} placeholder="Ex.: 10,5" className={CAMPO} />
            </Campo>
            <Campo rotulo="Perda, se houve" para="crav-perda">
              <input id="crav-perda" inputMode="decimal" value={perda} onChange={event => setPerda(event.target.value)} placeholder="0" className={CAMPO} />
            </Campo>
            <Campo rotulo="Sobra">
              <output className="flex min-h-11 items-center rounded-xl bg-[#f7f8f6] px-3 text-base font-bold tabular-nums text-slate-900 ring-1 ring-inset ring-slate-200" aria-live="polite">{numero(sobra, 2)} m</output>
            </Campo>
          </div>
          <details className="mt-4 rounded-xl border border-slate-200 px-4 py-2">
            <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-slate-700">Mais detalhes (local, lote da nota, responsável, observação)</summary>
            <div className="grid gap-4 pb-3 pt-2 sm:grid-cols-2">
              <Campo rotulo="Obra ou local" para="crav-local">
                <select id="crav-local" value={obraLocalId} onChange={event => setObraLocalId(event.target.value)} className={CAMPO}>
                  <option value="">Não informar</option>
                  {obras.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Lote da nota fiscal" para="crav-lote">
                <select id="crav-lote" value={loteId} onChange={event => setLoteId(event.target.value)} className={CAMPO}>
                  <option value="">O sistema escolhe</option>
                  {lotes.filter(item => !item.inativoEm).map(item => <option key={item.id} value={item.id}>NF {item.notaFiscal} · {item.perfilModelo || item.descricao}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Responsável" para="crav-quem">
                <input id="crav-quem" value={quem} onChange={event => setQuem(event.target.value)} className={CAMPO} />
              </Campo>
              <Campo rotulo="Observação" para="crav-obs">
                <input id="crav-obs" value={observacao} onChange={event => setObservacao(event.target.value)} className={CAMPO} />
              </Campo>
            </div>
          </details>
        </Etapa>
      </div>

      <Conferencia subtitulo={editando ? 'Correção de uma estaca já cravada.' : 'Confira antes de salvar.'}>
        <dl className="divide-y divide-slate-100">
          <Conferido rotulo="Frente" ok={Boolean(frenteEscolhida)} valor={frenteEscolhida || 'falta'} />
          <Conferido rotulo="Estaca" ok={Boolean(nomeNaConferencia)} valor={nomeNaConferencia || 'falta'} />
          <Conferido rotulo="Comprimento" ok={numeros.comprimento > 0} valor={numeros.comprimento > 0 ? `${numero(numeros.comprimento, 2)} m` : 'falta'} />
          <Conferido rotulo="Cravado" ok={numeros.cravado > 0} valor={numeros.cravado > 0 ? `${numero(numeros.cravado, 2)} m` : 'falta'} />
          <Conferido rotulo="Sobra" ok={medidasOk} valor={`${numero(sobra, 2)} m`} />
        </dl>
        {salvo && (
          <p role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-bold text-[#176b4d]">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {salvo}
          </p>
        )}
        {erro && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-bold text-rose-700">{erro}</p>}
        <div className="grid gap-2">
          {editando ? (
            <button type="submit" className={BOTAO_PRIMARIO}><CheckCircle2 className="size-5" aria-hidden="true" /> Salvar correção</button>
          ) : (
            <>
              <button type="submit" className={BOTAO_PRIMARIO} data-testid="estacas-salvar-proxima"><SkipForward className="size-5" aria-hidden="true" /> Salvar e cravar a próxima</button>
              <button type="button" onClick={event => salvar(event, false)} className={BOTAO_SECUNDARIO}><Hammer className="size-5" aria-hidden="true" /> Salvar e fechar</button>
            </>
          )}
          <button type="button" onClick={onCancelar} className={BOTAO_SECUNDARIO}><X className="size-5" aria-hidden="true" /> Fechar</button>
        </div>
      </Conferencia>
    </form>
  );
}
