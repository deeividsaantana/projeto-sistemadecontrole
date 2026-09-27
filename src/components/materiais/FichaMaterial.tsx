import { useMemo } from 'react';
import { Boxes, PackageCheck, PackageMinus, PackageSearch, Pencil, Truck } from 'lucide-react';
import type { Material, MovimentoMaterial } from '../../types';
import type { PosicaoEstoque } from '../../utils/estoque';
import { numero, formatarData } from '../../utils/formato';
import { fornecedoresDoMaterial } from '../../modules/materials/fichaMaterial';
import { Modal } from '../../shared/ui/Modal';
import { BOTAO_SECUNDARIO, CARTAO, FOCO } from '../cadastros/estilos';
import GraficoSaldoMaterial from './GraficoSaldoMaterial';
import { ListaMovimentos } from './MateriaisListas';

const HISTORICO_INICIAL = 20;

interface Props {
  aberto: boolean;
  material: Material | null;
  posicao?: PosicaoEstoque;
  movimentos: readonly MovimentoMaterial[];
  hoje: string;
  podeEditar: boolean;
  onFechar: () => void;
  onEditar: (material: Material) => void;
  onVerMovimentos: (busca: string) => void;
}

const Kpi = ({ Icone, rotulo, valor, tom = 'text-slate-900' }: { Icone: typeof Boxes; rotulo: string; valor: string; tom?: string }) => (
  <div className={`${CARTAO} flex items-center gap-3 p-3`}>
    <Icone className="size-8 shrink-0 text-slate-400" aria-hidden="true" />
    <div className="min-w-0">
      <p className="text-xs font-semibold text-slate-500">{rotulo}</p>
      <p className={`break-words text-base font-black tabular-nums sm:text-lg ${tom}`}>{valor}</p>
    </div>
  </div>
);

/**
 * Tudo sobre um material num lugar só: quanto sobra, como o saldo andou nas
 * últimas semanas, quem entregou e o histórico completo de movimentos. Abre
 * ao tocar no nome do material em Estoque ou em Cadastro.
 */
export default function FichaMaterial({ aberto, material, posicao, movimentos, hoje, podeEditar, onFechar, onEditar, onVerMovimentos }: Props) {
  const doMaterial = useMemo(
    () => (material ? movimentos.filter(item => item.materialId === material.id) : []),
    [material, movimentos],
  );
  const fornecedores = useMemo(() => (material ? fornecedoresDoMaterial(movimentos, material.id) : []), [material, movimentos]);

  if (!material) return null;
  const unidade = material.unidade;
  const saldo = posicao?.saldo ?? 0;

  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      size="xl"
      className="sm:!max-w-4xl"
      telaCheia="materiais-ficha"
      title={material.descricao}
      description={[material.codigo, material.categoria].filter(Boolean).join(' · ') || 'Sem código nem categoria'}
      footer={podeEditar ? (
        <div className="flex justify-end">
          <button type="button" onClick={() => onEditar(material)} className={BOTAO_SECUNDARIO}>
            <Pencil className="size-4" aria-hidden="true" />
            Editar cadastro
          </button>
        </div>
      ) : undefined}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi Icone={PackageSearch} rotulo="Saldo atual" valor={`${numero(saldo)} ${unidade}`} tom={saldo < 0 ? 'text-rose-700' : posicao?.abaixoDoMinimo ? 'text-amber-700' : 'text-slate-900'} />
          <Kpi Icone={PackageCheck} rotulo="Entrou no total" valor={`${numero(posicao?.entradas ?? 0)} ${unidade}`} />
          <Kpi Icone={PackageMinus} rotulo="Saiu no total" valor={`${numero(posicao?.saidas ?? 0)} ${unidade}`} />
          <Kpi Icone={Truck} rotulo="Mínimo" valor={material.estoqueMinimo ? `${numero(Number(material.estoqueMinimo))} ${unidade}` : 'Sem mínimo'} />
        </div>

        <div className={`${CARTAO} p-4`}>
          <GraficoSaldoMaterial materialId={material.id} unidade={unidade} hoje={hoje} movimentos={movimentos} />
        </div>

        <div className={`${CARTAO} overflow-hidden`}>
          <header className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-900">Fornecedores</h3>
            <p className="text-xs text-slate-500">Quem entregou este material, do que mais trouxe para o que menos.</p>
          </header>
          {fornecedores.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Nenhuma entrada com fornecedor registrado.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {fornecedores.map(item => (
                <li key={item.nome} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <strong className="block truncate text-slate-900">{item.nome}</strong>
                    <span className="text-xs text-slate-500">{item.recebimentos.toLocaleString('pt-BR')} recebimento(s) · último em {formatarData(item.ultimoRecebimento)}</span>
                  </div>
                  <span className="shrink-0 font-bold tabular-nums text-slate-900">{numero(item.quantidade)} {unidade}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">Histórico de movimentos</h3>
            {doMaterial.length > HISTORICO_INICIAL && (
              <button type="button" onClick={() => onVerMovimentos(material.descricao)} className={`rounded-lg px-2 text-sm font-bold text-[#176b4d] hover:bg-emerald-50 ${FOCO}`}>
                Ver todos os {doMaterial.length.toLocaleString('pt-BR')} na aba Movimentos
              </button>
            )}
          </div>
          <ListaMovimentos movimentos={doMaterial.slice(0, HISTORICO_INICIAL)} chave={material.id} />
        </div>
      </div>
    </Modal>
  );
}
