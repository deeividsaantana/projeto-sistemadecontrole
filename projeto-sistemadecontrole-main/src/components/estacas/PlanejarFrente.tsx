import { useEffect, useMemo, useState } from 'react';
import type { CravacaoEstaca } from '../../types';
import { SEM_FRENTE, estacasPorFrente, nomeDaEstaca, planejarFrente } from '../../modules/estacas/avancoEstacas';
import { Modal } from '../../shared/ui';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, ROTULO } from '../cadastros/estilos';

interface Props {
  aberto: boolean;
  frenteInicial?: string;
  hoje: string;
  responsavel: string;
  estacas: readonly CravacaoEstaca[];
  onFechar: () => void;
  /** Novas estacas a cravar e ids das a cravar que sobram (vão ser inativadas). */
  onAplicar: (novas: CravacaoEstaca[], sobrando: string[], frente: string, total: number) => void;
}

const OUTRA = '__outra__';

/**
 * "Quantas estacas esta frente precisa?" Com o total, o sistema cria as que
 * faltam como "a cravar" (ou tira as que sobram, se o total diminuiu), e a
 * porcentagem passa a contar sobre esse total.
 */
export default function PlanejarFrente({ aberto, frenteInicial, hoje, responsavel, estacas, onFechar, onAplicar }: Props) {
  const frentes = useMemo(() => estacasPorFrente(estacas).filter(item => item.frente !== SEM_FRENTE), [estacas]);
  const [frente, setFrente] = useState('');
  const [frenteNova, setFrenteNova] = useState('');
  const [total, setTotal] = useState('');
  const [prefixo, setPrefixo] = useState('Estaca');
  const [comprimento, setComprimento] = useState('');

  useEffect(() => {
    if (!aberto) return;
    const inicial = frenteInicial && frentes.some(item => item.frente === frenteInicial) ? frenteInicial : frentes[0]?.frente ?? OUTRA;
    setFrente(inicial);
    setFrenteNova('');
    setTotal(String(frentes.find(item => item.frente === inicial)?.previstas ?? ''));
    setPrefixo('Estaca');
    setComprimento('');
    // Só ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const nomeDaFrente = frente === OUTRA ? frenteNova.trim() : frente;
  const atual = frentes.find(item => item.frente === nomeDaFrente);
  const pedido = Math.floor(Number(total.replace(',', '.')) || 0);
  const resultado = useMemo(() => (nomeDaFrente && pedido > 0
    ? planejarFrente(estacas, { frente: nomeDaFrente, total: pedido, prefixo, comprimentoM: Number(comprimento.replace(',', '.')) || 0, data: hoje, responsavel })
    : null), [estacas, nomeDaFrente, pedido, prefixo, comprimento, hoje, responsavel]);

  const resumo = !resultado
    ? 'Escolha a frente e digite o total.'
    : pedido < resultado.minimo
      ? `Esta frente já tem ${resultado.minimo} estacas cravadas; o total não pode ser menor.`
      : resultado.novas.length
        ? `Vai criar ${resultado.novas.length} estaca(s) a cravar: de ${nomeDaEstaca(resultado.novas[0])} até ${nomeDaEstaca(resultado.novas[resultado.novas.length - 1])}.`
        : resultado.sobrando.length
          ? `Vai tirar ${resultado.sobrando.length} estaca(s) a cravar do fim da lista. Elas ficam guardadas e podem voltar.`
          : 'O total já é esse. Nada muda.';

  const podeAplicar = Boolean(resultado && pedido >= resultado.minimo && (resultado.novas.length || resultado.sobrando.length));

  const aplicar = () => {
    if (podeAplicar && resultado) onAplicar(resultado.novas, resultado.sobrando, nomeDaFrente, pedido);
  };

  return (
    <Modal
      open={aberto}
      title="Total previsto da frente"
      description="Quantas estacas a frente precisa, contando as que já foram cravadas."
      onClose={onFechar}
      onSubmit={aplicar}
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onFechar} className={BOTAO_SECUNDARIO}>Cancelar</button>
          <button type="button" onClick={aplicar} disabled={!podeAplicar} className={BOTAO_PRIMARIO} data-testid="estacas-aplicar-previsto">Salvar total</button>
        </div>
      )}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className={ROTULO}>Frente</span>
          <select value={frente} onChange={event => { setFrente(event.target.value); setTotal(String(frentes.find(item => item.frente === event.target.value)?.previstas ?? '')); }} className={CAMPO}>
            {frentes.map(item => <option key={item.frente} value={item.frente}>{item.frente}</option>)}
            <option value={OUTRA}>Frente nova…</option>
          </select>
        </label>
        {frente === OUTRA && (
          <label className="space-y-1.5">
            <span className={ROTULO}>Nome da frente nova</span>
            <input value={frenteNova} onChange={event => setFrenteNova(event.target.value)} placeholder="Ex.: Ramo 900 lado esquerdo" className={CAMPO} />
          </label>
        )}
        <label className="space-y-1.5">
          <span className={ROTULO}>Total de estacas da frente</span>
          <input inputMode="numeric" value={total} onChange={event => setTotal(event.target.value.replace(/\D/g, ''))} placeholder="Ex.: 120" className={CAMPO} />
        </label>
        <label className="space-y-1.5">
          <span className={ROTULO}>Nome das novas</span>
          <input value={prefixo} onChange={event => setPrefixo(event.target.value)} className={CAMPO} />
        </label>
        <label className="space-y-1.5">
          <span className={ROTULO}>Comprimento de projeto (m), se souber</span>
          <input inputMode="decimal" value={comprimento} onChange={event => setComprimento(event.target.value)} placeholder="Ex.: 12" className={CAMPO} />
        </label>
      </div>
      {atual && (
        <p className="mt-4 text-sm text-slate-600">Hoje: {atual.previstas} estaca(s) na frente, {atual.cravadas} cravada(s), {atual.faltam} a cravar.</p>
      )}
      <p className="mt-2 rounded-xl bg-[#f7f8f6] p-3 text-sm font-semibold text-slate-800" aria-live="polite">{resumo}</p>
    </Modal>
  );
}
