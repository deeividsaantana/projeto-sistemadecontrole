import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { ClipboardPaste, Copy, Plus, Trash2 } from 'lucide-react';
import type { Empresa, Material, MovimentoMaterial, TipoMovimentoMaterial } from '../../types';
import {
  lerColagem,
  lerNumeroBR,
  linhaViagemPreenchida,
  montarViagens,
  pareceTabela,
  proximaLinha,
  recentes,
  type ColunaViagem,
  type LinhaViagem,
} from '../../modules/materials/lancamentoRapido';
import { numero } from '../../utils/formato';
import { Modal } from '../../shared/ui';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, FOCO } from '../cadastros/estilos';
import CampoEscolha from './CampoEscolha';
import { useTelaLarga } from './MateriaisListas';

const TIPOS: ReadonlyArray<{ id: TipoMovimentoMaterial; nome: string }> = [
  { id: 'Entrada', nome: 'Entrada' },
  { id: 'Saída', nome: 'Saída' },
  { id: 'Transferência', nome: 'Transporte' },
  { id: 'Ajuste', nome: 'Ajuste' },
];

const CELULA = `min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 transition duration-150 focus:border-emerald-500 ${FOCO}`;
const INICIAIS = 3;

interface Props {
  aberto: boolean;
  hoje: string;
  materiais: readonly Material[];
  movimentos: MovimentoMaterial[];
  empresas: readonly Empresa[];
  responsavel: string;
  onSalvar: (movimentos: MovimentoMaterial[], descricao: string) => void;
  onFechar: () => void;
}

/**
 * Várias viagens de uma vez, do jeito da planilha: Enter desce para a linha de
 * baixo, a linha nova já vem com data, material, fornecedor e local da de
 * cima, e dá para colar direto do Excel. No celular cada viagem é um cartão.
 */
export default function GradeViagens({ aberto, hoje, materiais, movimentos, empresas, responsavel, onSalvar, onFechar }: Props) {
  const [linhas, setLinhas] = useState<LinhaViagem[]>(() => [proximaLinha(undefined, hoje)]);
  const [erro, setErro] = useState('');
  const [linhaComErro, setLinhaComErro] = useState<number | null>(null);
  const [avisosColagem, setAvisosColagem] = useState<string[]>([]);
  const [comValores, setComValores] = useState(false);
  const focarDepois = useRef<{ linha: number; coluna: ColunaViagem } | null>(null);
  const gradeRef = useRef<HTMLDivElement>(null);
  const telaLarga = useTelaLarga();

  useEffect(() => {
    if (!aberto) return;
    setErro('');
    setLinhaComErro(null);
    setAvisosColagem([]);
    setLinhas(atuais => (atuais.some(linhaViagemPreenchida) ? atuais : Array.from({ length: INICIAIS }, () => proximaLinha(undefined, hoje))));
  }, [aberto, hoje]);

  // Depois de criar uma linha pelo Enter, o foco vai para a mesma coluna dela.
  useEffect(() => {
    const alvo = focarDepois.current;
    if (!alvo) return;
    focarDepois.current = null;
    gradeRef.current?.querySelector<HTMLElement>(`[data-linha="${alvo.linha}"][data-coluna="${alvo.coluna}"]`)?.focus();
  });

  const ativos = useMemo(() => materiais.filter(item => item.ativo !== false), [materiais]);
  const opcoesMaterial = useMemo(() => ativos.map(item => ({ id: item.id, nome: item.descricao, apelido: item.codigo || undefined })), [ativos]);
  const opcoesFornecedor = useMemo(() => empresas.map(item => ({ id: item.id, nome: item.nome })), [empresas]);
  const materiaisRecentes = useMemo(() => (aberto ? recentes(movimentos, item => item.materialId) : []), [aberto, movimentos]);
  const fornecedoresRecentes = useMemo(() => (aberto ? recentes(movimentos, item => item.fornecedorId) : []), [aberto, movimentos]);
  const destinosRecentes = useMemo(() => (aberto ? recentes(movimentos, item => item.destino, 12) : []), [aberto, movimentos]);

  const mudar = (indice: number, campo: keyof LinhaViagem, valor: string) => {
    setLinhas(atuais => atuais.map((linha, posicao) => (posicao === indice ? { ...linha, [campo]: valor } : linha)));
    if (linhaComErro === indice) { setErro(''); setLinhaComErro(null); }
  };

  const adicionar = () => setLinhas(atuais => [...atuais, proximaLinha(atuais[atuais.length - 1], hoje)]);
  const repetir = (indice: number) => setLinhas(atuais => [...atuais.slice(0, indice + 1), { ...atuais[indice] }, ...atuais.slice(indice + 1)]);
  const remover = (indice: number) => setLinhas(atuais => (atuais.length > 1 ? atuais.filter((_, posicao) => posicao !== indice) : [proximaLinha(undefined, hoje)]));

  const descer = (indice: number, coluna: ColunaViagem) => {
    focarDepois.current = { linha: indice + 1, coluna };
    if (indice === linhas.length - 1) adicionar();
    else setLinhas(atuais => [...atuais]);
  };

  const teclar = (indice: number, coluna: ColunaViagem) => (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' || event.ctrlKey || event.metaKey || event.shiftKey) return;
    // Enter na grade desce de linha, como no Excel. Ctrl+Enter continua salvando.
    event.preventDefault();
    event.stopPropagation();
    descer(indice, coluna);
  };

  const colar = (event: ClipboardEvent<HTMLDivElement>) => {
    // Colar do Excel só na grade do computador; no celular os campos estão em outra ordem.
    if (!telaLarga) return;
    const alvo = (event.target as HTMLElement).closest<HTMLElement>('[data-coluna]');
    const texto = event.clipboardData.getData('text/plain');
    if (!alvo || !pareceTabela(texto)) return;
    event.preventDefault();
    const inicio = Number(alvo.dataset.linha);
    const coluna = alvo.dataset.coluna as ColunaViagem;
    const { linhas: coladas, avisos } = lerColagem(texto, coluna, { materiais: opcoesMaterial, fornecedores: opcoesFornecedor });
    setLinhas(atuais => {
      const proximas = [...atuais];
      coladas.forEach((parcial, deslocamento) => {
        const posicao = inicio + deslocamento;
        const base = proximas[posicao] ?? proximaLinha(proximas[posicao - 1], hoje);
        proximas[posicao] = { ...base, ...parcial };
      });
      return proximas;
    });
    if (coladas.some(linha => linha.valorUnitario || linha.valorTotal)) setComValores(true);
    setAvisosColagem([`${coladas.length.toLocaleString('pt-BR')} linha(s) coladas do Excel. Confira antes de salvar.`, ...avisos.slice(0, 8), ...(avisos.length > 8 ? [`E mais ${avisos.length - 8} aviso(s).`] : [])]);
  };

  const salvar = () => {
    const { movimentos: novos, erro: problema, linhaComErro: indice } = montarViagens(linhas, {
      hoje, responsavel, agora: new Date().toISOString(), materiais, empresas, movimentos,
    });
    if (problema) {
      setErro(problema);
      setLinhaComErro(indice ?? null);
      if (indice !== undefined) gradeRef.current?.querySelector<HTMLElement>(`[data-linha="${indice}"][data-coluna="materialId"]`)?.focus();
      return;
    }
    onSalvar(novos, `Lançou ${novos.length} viagem(ns) de material de uma vez.`);
    setLinhas([proximaLinha(undefined, hoje)]);
    onFechar();
  };

  const preenchidas = linhas.filter(linhaViagemPreenchida);
  const totaisPorMaterial = useMemo(() => {
    const mapa = new Map<string, { nome: string; unidade: string; total: number }>();
    for (const linha of linhas) {
      const material = materiais.find(item => item.id === linha.materialId);
      const quantidade = lerNumeroBR(linha.quantidade) ?? 0;
      if (!material || !quantidade) continue;
      const atual = mapa.get(material.id) ?? { nome: material.descricao, unidade: material.unidade, total: 0 };
      atual.total += quantidade;
      mapa.set(material.id, atual);
    }
    return [...mapa.values()];
  }, [linhas, materiais]);

  const celula = (indice: number, coluna: ColunaViagem) => ({ 'data-linha': indice, 'data-coluna': coluna, onKeyDown: teclar(indice, coluna) });
  const unidadeDa = (linha: LinhaViagem) => materiais.find(item => item.id === linha.materialId)?.unidade ?? '';
  const totalDa = (linha: LinhaViagem) => (lerNumeroBR(linha.valorUnitario) ?? 0) * Math.abs(lerNumeroBR(linha.quantidade) ?? 0);

  const campoMaterial = (linha: LinhaViagem, indice: number) => (
    <div data-linha={indice} data-coluna="materialId">
      <CampoEscolha
        compacto
        opcoes={opcoesMaterial}
        recentes={materiaisRecentes}
        valor={linha.materialId}
        onEscolher={id => mudar(indice, 'materialId', id)}
        rotuloAcessivel={`Material da viagem ${indice + 1}`}
        placeholder="Material"
        onEnter={() => gradeRef.current?.querySelector<HTMLElement>(`[data-linha="${indice}"][data-coluna="quantidade"]`)?.focus()}
      />
    </div>
  );
  const campoFornecedor = (linha: LinhaViagem, indice: number) => (
    <div data-linha={indice} data-coluna="fornecedorId">
      <CampoEscolha
        compacto
        opcoes={opcoesFornecedor}
        recentes={fornecedoresRecentes}
        valor={linha.fornecedorId}
        onEscolher={id => mudar(indice, 'fornecedorId', id)}
        vazio="Sem fornecedor"
        rotuloAcessivel={`Fornecedor da viagem ${indice + 1}`}
        placeholder="Fornecedor"
        onEnter={() => descer(indice, 'fornecedorId')}
      />
    </div>
  );
  const botoesLinha = (indice: number) => (
    <div className="flex justify-end gap-1">
      <button type="button" onClick={() => repetir(indice)} aria-label={`Repetir a viagem ${indice + 1}`} title="Repetir esta linha" className={`grid size-10 place-items-center rounded-lg text-slate-500 transition hover:bg-emerald-50 hover:text-[#176b4d] ${FOCO}`}>
        <Copy className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => remover(indice)} aria-label={`Tirar a viagem ${indice + 1}`} title="Tirar esta linha" className={`grid size-10 place-items-center rounded-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 ${FOCO}`}>
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <Modal
      open={aberto}
      title="Lançar várias viagens"
      description={telaLarga
        ? 'Uma linha por viagem. Enter desce para a linha de baixo, e a linha nova já vem com o material e o fornecedor da de cima. Dá para colar do Excel.'
        : 'Um cartão por viagem. O próximo já vem com o material e o fornecedor do anterior.'}
      size="xl"
      className="sm:!max-w-[min(96vw,88rem)]"
      telaCheia="materiais-viagens"
      onSubmit={salvar}
      onClose={onFechar}
      footer={(
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-slate-600" aria-live="polite">
            <strong className="text-slate-900">{preenchidas.length.toLocaleString('pt-BR')} viagem(ns)</strong>
            {totaisPorMaterial.map(item => <span key={item.nome}> · {numero(item.total)} {item.unidade} de {item.nome}</span>)}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onFechar} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button type="button" onClick={adicionar} className={BOTAO_SECUNDARIO}>
              <Plus className="size-4" aria-hidden="true" />
              Mais uma viagem
            </button>
            <button type="button" onClick={salvar} disabled={!preenchidas.length} className={`${BOTAO_PRIMARIO} px-5`} data-testid="viagens-salvar">
              {preenchidas.length ? `Salvar ${preenchidas.length.toLocaleString('pt-BR')} viagem(ns)` : 'Salvar viagens'}
            </button>
          </div>
        </div>
      )}
    >
      <div ref={gradeRef} onPaste={colar} className="space-y-3">
        {telaLarga && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <ClipboardPaste className="size-4 shrink-0" aria-hidden="true" />
              Para colar do Excel, copie as colunas na ordem da grade e cole na primeira célula.
            </p>
            <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={comValores} onChange={event => setComValores(event.target.checked)} className="size-5 accent-[#176b4d]" />
              Mostrar valor (R$)
            </label>
          </div>
        )}

        {avisosColagem.length > 0 && (
          <ul role="status" className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {avisosColagem.map(aviso => <li key={aviso}>{aviso}</li>)}
          </ul>
        )}

        <datalist id="viagens-destinos">{destinosRecentes.map(item => <option key={item} value={item} />)}</datalist>

        {telaLarga ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className={`w-full border-collapse text-left text-sm ${comValores ? 'min-w-[1260px]' : 'min-w-[1040px]'}`} data-testid="viagens-grade">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="w-10 px-2 py-2 text-center">#</th>
                  <th scope="col" className="w-36 px-1 py-2">Data</th>
                  <th scope="col" className="w-32 px-1 py-2">Tipo</th>
                  <th scope="col" className="px-1 py-2">Material</th>
                  <th scope="col" className="w-28 px-1 py-2">Quantidade</th>
                  <th scope="col" className="w-44 px-1 py-2">Fornecedor</th>
                  <th scope="col" className="w-24 px-1 py-2">Placa</th>
                  <th scope="col" className="w-24 px-1 py-2">Ticket</th>
                  <th scope="col" className="w-40 px-1 py-2">Local</th>
                  {comValores && <th scope="col" className="w-28 px-1 py-2">Valor unit.</th>}
                  {comValores && <th scope="col" className="w-28 px-1 py-2">Valor total</th>}
                  <th scope="col" className="w-24 px-2 py-2"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linhas.map((linha, indice) => (
                  <tr key={indice} className={linhaComErro === indice ? 'bg-rose-50' : ''}>
                    <td className="px-2 text-center text-xs font-bold tabular-nums text-slate-400">{indice + 1}</td>
                    <td className="p-1"><input type="date" value={linha.data} onChange={event => mudar(indice, 'data', event.target.value)} aria-label={`Data da viagem ${indice + 1}`} className={CELULA} {...celula(indice, 'data')} /></td>
                    <td className="p-1">
                      <select value={linha.tipo} onChange={event => mudar(indice, 'tipo', event.target.value)} aria-label={`Tipo da viagem ${indice + 1}`} className={CELULA} {...celula(indice, 'tipo')}>
                        {TIPOS.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                      </select>
                    </td>
                    <td className="p-1">{campoMaterial(linha, indice)}</td>
                    <td className="p-1">
                      <div className="relative">
                        <input inputMode="decimal" value={linha.quantidade} onChange={event => mudar(indice, 'quantidade', event.target.value)} aria-label={`Quantidade da viagem ${indice + 1}`} className={`${CELULA} pr-9 font-semibold tabular-nums`} {...celula(indice, 'quantidade')} />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">{unidadeDa(linha)}</span>
                      </div>
                    </td>
                    <td className="p-1">{campoFornecedor(linha, indice)}</td>
                    <td className="p-1"><input value={linha.placa} onChange={event => mudar(indice, 'placa', event.target.value.toUpperCase())} aria-label={`Placa da viagem ${indice + 1}`} className={`${CELULA} uppercase`} {...celula(indice, 'placa')} /></td>
                    <td className="p-1"><input value={linha.ticket} onChange={event => mudar(indice, 'ticket', event.target.value)} aria-label={`Ticket da viagem ${indice + 1}`} className={CELULA} {...celula(indice, 'ticket')} /></td>
                    <td className="p-1"><input value={linha.destino} onChange={event => mudar(indice, 'destino', event.target.value)} list="viagens-destinos" aria-label={`Local da viagem ${indice + 1}`} className={CELULA} {...celula(indice, 'destino')} /></td>
                    {comValores && <td className="p-1"><input inputMode="decimal" value={linha.valorUnitario} onChange={event => mudar(indice, 'valorUnitario', event.target.value)} aria-label={`Valor unitário da viagem ${indice + 1}`} className={`${CELULA} tabular-nums`} {...celula(indice, 'valorUnitario')} /></td>}
                    {comValores && <td className="p-1"><input inputMode="decimal" value={linha.valorTotal} onChange={event => mudar(indice, 'valorTotal', event.target.value)} placeholder={totalDa(linha) ? totalDa(linha).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''} aria-label={`Valor total da viagem ${indice + 1}`} className={`${CELULA} tabular-nums`} {...celula(indice, 'valorTotal')} /></td>}
                    <td className="px-1">{botoesLinha(indice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ol className="space-y-3" data-testid="viagens-cartoes">
            {linhas.map((linha, indice) => (
              <li key={indice} className={`space-y-2 rounded-2xl border p-3 ${linhaComErro === indice ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center justify-between">
                  <strong className="text-sm text-slate-700">Viagem {indice + 1}</strong>
                  {botoesLinha(indice)}
                </div>
                {campoMaterial(linha, indice)}
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input inputMode="decimal" value={linha.quantidade} onChange={event => mudar(indice, 'quantidade', event.target.value)} placeholder="Quantidade" aria-label={`Quantidade da viagem ${indice + 1}`} className={`${CELULA} min-h-11 pr-9 text-base font-semibold`} {...celula(indice, 'quantidade')} />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">{unidadeDa(linha)}</span>
                  </div>
                  <select value={linha.tipo} onChange={event => mudar(indice, 'tipo', event.target.value)} aria-label={`Tipo da viagem ${indice + 1}`} className={`${CELULA} min-h-11 text-base`}>
                    {TIPOS.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                  </select>
                  <input type="date" value={linha.data} onChange={event => mudar(indice, 'data', event.target.value)} aria-label={`Data da viagem ${indice + 1}`} className={`${CELULA} min-h-11 text-base`} />
                  <input value={linha.placa} onChange={event => mudar(indice, 'placa', event.target.value.toUpperCase())} placeholder="Placa" aria-label={`Placa da viagem ${indice + 1}`} className={`${CELULA} min-h-11 text-base uppercase`} />
                </div>
                {campoFornecedor(linha, indice)}
                <div className="grid grid-cols-2 gap-2">
                  <input value={linha.ticket} onChange={event => mudar(indice, 'ticket', event.target.value)} placeholder="Ticket" aria-label={`Ticket da viagem ${indice + 1}`} className={`${CELULA} min-h-11 text-base`} />
                  <input value={linha.destino} onChange={event => mudar(indice, 'destino', event.target.value)} list="viagens-destinos" placeholder="Local" aria-label={`Local da viagem ${indice + 1}`} className={`${CELULA} min-h-11 text-base`} />
                </div>
              </li>
            ))}
          </ol>
        )}

        {erro && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{erro}</p>}
      </div>
    </Modal>
  );
}
