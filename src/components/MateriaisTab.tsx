/**
 * Materiais: cadastro, movimentação e estoque. O saldo é sempre a soma dos
 * movimentos — não existe contador guardado para divergir do histórico.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, Package, Plus, Search } from 'lucide-react';
import type { Empresa, Material, MovimentoMaterial, TipoMovimentoMaterial } from '../types';
import { posicaoEstoque, saldoDoMaterial, validarMovimento } from '../utils/estoque';
import { normalizeComparable } from '../utils/canonicalIdentity';
import {
  Badge,
  EmptyState,
  Modal,
  PageHeader,
  TableBody,
  TableHead,
  TableShell,
  isoDay,
} from '../shared/ui';

interface MateriaisTabProps {
  materiais: Material[];
  movimentos: MovimentoMaterial[];
  empresas: Empresa[];
  responsavel: string;
  podeEditar: boolean;
  onSaveMaterial: (material: Material, isNew: boolean) => void;
  onSaveMovimento: (movimento: MovimentoMaterial) => void;
}

const TIPOS: TipoMovimentoMaterial[] = ['Entrada', 'Saída', 'Transferência', 'Ajuste'];
const UNIDADES = ['m³', 't', 'kg', 'un', 'm', 'm²', 'L', 'sc'];

const formatarData = (valor: string) => valor.split('-').reverse().join('/');
const numero = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

export default function MateriaisTab({
  materiais,
  movimentos,
  empresas,
  responsavel,
  podeEditar,
  onSaveMaterial,
  onSaveMovimento,
}: MateriaisTabProps) {
  const hoje = isoDay(new Date());
  const [aba, setAba] = useState<'estoque' | 'movimentos' | 'cadastro'>('estoque');
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [formMaterial, setFormMaterial] = useState<Material | null>(null);
  const [materialAberto, setMaterialAberto] = useState(false);
  const [movimentoAberto, setMovimentoAberto] = useState(false);
  const [cadastro, setCadastro] = useState({ codigo: '', descricao: '', categoria: '', unidade: 'm³', estoqueMinimo: 0, fornecedorPadraoId: '', observacao: '' });
  const [movimento, setMovimento] = useState({
    data: hoje,
    tipo: 'Entrada' as TipoMovimentoMaterial,
    materialId: '',
    quantidade: 0,
    fornecedorId: '',
    notaFiscal: '',
    destino: '',
    origem: '',
    servico: '',
    observacao: '',
  });

  const ativos = useMemo(() => materiais.filter(item => item.ativo !== false), [materiais]);
  const posicoes = useMemo(() => posicaoEstoque(ativos, movimentos), [ativos, movimentos]);
  const abaixoDoMinimo = posicoes.filter(item => item.abaixoDoMinimo);

  const termo = normalizeComparable(busca).trim();
  const posicoesFiltradas = posicoes.filter(item => !termo
    || normalizeComparable(`${item.material.codigo} ${item.material.descricao} ${item.material.categoria}`).includes(termo));
  const movimentosFiltrados = useMemo(() => [...movimentos]
    .filter(item => !termo || normalizeComparable(`${item.materialDescricao} ${item.tipo} ${item.destino || ''} ${item.fornecedorNome || ''} ${item.notaFiscal || ''}`).includes(termo))
    .sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm)), [movimentos, termo]);

  const abrirCadastro = (material?: Material) => {
    setFormMaterial(material || null);
    setCadastro(material
      ? {
        codigo: material.codigo,
        descricao: material.descricao,
        categoria: material.categoria,
        unidade: material.unidade,
        estoqueMinimo: material.estoqueMinimo || 0,
        fornecedorPadraoId: material.fornecedorPadraoId || '',
        observacao: material.observacao || '',
      }
      : { codigo: '', descricao: '', categoria: '', unidade: 'm³', estoqueMinimo: 0, fornecedorPadraoId: '', observacao: '' });
    setErro('');
    setMaterialAberto(true);
  };

  const salvarMaterial = () => {
    if (!cadastro.descricao.trim()) {
      setErro('Informe a descrição do material.');
      return;
    }
    const agora = new Date().toISOString();
    onSaveMaterial({
      id: formMaterial?.id || `mat-${Date.now()}`,
      codigo: cadastro.codigo.trim(),
      descricao: cadastro.descricao.trim(),
      categoria: cadastro.categoria.trim(),
      unidade: cadastro.unidade,
      estoqueMinimo: Number(cadastro.estoqueMinimo) || undefined,
      fornecedorPadraoId: cadastro.fornecedorPadraoId || undefined,
      observacao: cadastro.observacao.trim() || undefined,
      ativo: formMaterial?.ativo ?? true,
      criadoEm: formMaterial?.criadoEm || agora,
      atualizadoEm: agora,
    }, !formMaterial);
    setMaterialAberto(false);
  };

  const salvarMovimento = () => {
    const material = materiais.find(item => item.id === movimento.materialId);
    const candidato = {
      id: `mov-${Date.now()}`,
      tipo: movimento.tipo,
      materialId: movimento.materialId,
      quantidade: Number(movimento.quantidade),
    };
    const problema = validarMovimento(movimentos, candidato);
    if (problema || !material) {
      setErro(problema || 'Selecione o material.');
      return;
    }
    const fornecedor = empresas.find(item => item.id === movimento.fornecedorId);
    onSaveMovimento({
      id: candidato.id,
      data: movimento.data,
      tipo: movimento.tipo,
      materialId: material.id,
      materialDescricao: material.descricao,
      quantidade: Number(movimento.quantidade),
      unidade: material.unidade,
      fornecedorId: fornecedor?.id,
      fornecedorNome: fornecedor?.nome,
      notaFiscal: movimento.notaFiscal.trim() || undefined,
      destino: movimento.destino.trim() || undefined,
      origem: movimento.origem.trim() || undefined,
      servico: movimento.servico.trim() || undefined,
      responsavel,
      observacao: movimento.observacao.trim() || undefined,
      criadoEm: new Date().toISOString(),
    });
    setMovimento({ ...movimento, quantidade: 0, notaFiscal: '', destino: '', origem: '', servico: '', observacao: '' });
    setErro('');
    setMovimentoAberto(false);
  };

  const saldoAtualDoForm = movimento.materialId ? saldoDoMaterial(movimentos, movimento.materialId) : 0;

  return (
    <div id="materiais-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Materiais"
        description="Cadastro, movimentação e estoque. O saldo vem da soma dos movimentos."
        actions={podeEditar ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => abrirCadastro()} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Novo material</button>
            <button type="button" onClick={() => { setErro(''); setMovimentoAberto(true); }} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800">
              <Plus className="h-4 w-4" /> Movimentar
            </button>
          </div>
        ) : undefined}
      />

      {abaixoDoMinimo.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            {abaixoDoMinimo.length} material(is) abaixo do estoque mínimo
          </p>
          <p className="mt-1 text-[11px] text-amber-800">
            {abaixoDoMinimo.slice(0, 6).map(item => `${item.material.descricao} (${numero(item.saldo)} ${item.material.unidade})`).join(' · ')}
          </p>
        </div>
      )}

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Materiais ativos', valor: String(ativos.length) },
          { label: 'Movimentos', valor: String(movimentos.length) },
          { label: 'Abaixo do mínimo', valor: String(abaixoDoMinimo.length) },
          { label: 'Sem saldo', valor: String(posicoes.filter(item => item.saldo <= 0).length) },
        ].map(item => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">{item.label}</p>
            <strong className="mt-1.5 block text-2xl font-black tabular-nums text-slate-900">{item.valor}</strong>
          </div>
        ))}
      </section>

      <div className="mt-4 flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {([['estoque', 'Estoque'], ['movimentos', 'Movimentos'], ['cadastro', 'Cadastro']] as const).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            aria-pressed={aba === id}
            className={`min-h-10 flex-1 rounded-md text-xs font-bold transition-colors ${aba === id ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <label className="relative mt-3 block">
        <span className="sr-only">Buscar material</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={busca}
          onChange={event => setBusca(event.target.value)}
          placeholder="Código, descrição, categoria, fornecedor ou nota"
          className="min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500"
        />
      </label>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {aba === 'movimentos' ? (
          movimentosFiltrados.length === 0 ? (
            <EmptyState icon={Boxes} title="Nenhum movimento" description="Registre entradas, saídas, transferências e ajustes." />
          ) : (
            <TableShell minWidth={980}>
              <TableHead>
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Material</th>
                  <th className="p-3">Quantidade</th>
                  <th className="p-3">Origem / Destino</th>
                  <th className="p-3">Fornecedor / Nota</th>
                  <th className="p-3">Responsável</th>
                </tr>
              </TableHead>
              <TableBody>
                {movimentosFiltrados.map(item => (
                  <tr key={item.id} className="transition-colors hover:bg-slate-50">
                    <td className="p-3 text-slate-600">{formatarData(item.data)}</td>
                    <td className="p-3">
                      <Badge tone={item.tipo === 'Entrada' ? 'success' : item.tipo === 'Saída' ? 'danger' : 'neutral'}>{item.tipo}</Badge>
                    </td>
                    <td className="p-3 font-bold text-slate-800">{item.materialDescricao}</td>
                    <td className="p-3 font-mono text-slate-900">{numero(item.quantidade)} {item.unidade}</td>
                    <td className="p-3 text-slate-600">{[item.origem, item.destino].filter(Boolean).join(' → ') || '—'}</td>
                    <td className="p-3 text-slate-600">{[item.fornecedorNome, item.notaFiscal && `NF ${item.notaFiscal}`].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="p-3 text-slate-600">{item.responsavel}</td>
                  </tr>
                ))}
              </TableBody>
            </TableShell>
          )
        ) : posicoesFiltradas.length === 0 ? (
          <EmptyState icon={Package} title="Nenhum material cadastrado" description="Cadastre os materiais que a obra usa." />
        ) : (
          <TableShell minWidth={aba === 'cadastro' ? 900 : 760}>
            <TableHead>
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Material</th>
                <th className="p-3">Categoria</th>
                {aba === 'estoque' ? (
                  <>
                    <th className="p-3">Entradas</th>
                    <th className="p-3">Saídas</th>
                    <th className="p-3">Saldo</th>
                    <th className="p-3">Mínimo</th>
                  </>
                ) : (
                  <>
                    <th className="p-3">Unidade</th>
                    <th className="p-3">Mínimo</th>
                    <th className="p-3">Fornecedor padrão</th>
                    {podeEditar && <th className="p-3 text-right">Ações</th>}
                  </>
                )}
              </tr>
            </TableHead>
            <TableBody>
              {posicoesFiltradas.map(item => (
                <tr key={item.material.id} className="transition-colors hover:bg-slate-50">
                  <td className="p-3 font-mono text-slate-600">{item.material.codigo || '—'}</td>
                  <td className="p-3 font-bold text-slate-800">{item.material.descricao}</td>
                  <td className="p-3 text-slate-600">{item.material.categoria || '—'}</td>
                  {aba === 'estoque' ? (
                    <>
                      <td className="p-3 font-mono text-slate-600">{numero(item.entradas)}</td>
                      <td className="p-3 font-mono text-slate-600">{numero(item.saidas)}</td>
                      <td className={`p-3 font-mono font-bold ${item.abaixoDoMinimo ? 'text-amber-700' : 'text-slate-900'}`}>
                        {numero(item.saldo)} {item.material.unidade}
                      </td>
                      <td className="p-3 text-slate-600">{item.material.estoqueMinimo ? numero(item.material.estoqueMinimo) : '—'}</td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 text-slate-600">{item.material.unidade}</td>
                      <td className="p-3 text-slate-600">{item.material.estoqueMinimo ? numero(item.material.estoqueMinimo) : '—'}</td>
                      <td className="p-3 text-slate-600">{empresas.find(empresa => empresa.id === item.material.fornecedorPadraoId)?.nome || '—'}</td>
                      {podeEditar && (
                        <td className="p-3 text-right">
                          <button type="button" onClick={() => abrirCadastro(item.material)} className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Editar</button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </TableBody>
          </TableShell>
        )}
      </div>

      <Modal
        open={materialAberto}
        title={formMaterial ? `Editar ${formMaterial.descricao}` : 'Novo material'}
        size="md"
        onClose={() => setMaterialAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setMaterialAberto(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvarMaterial} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar material</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Código
            <input value={cadastro.codigo} onChange={event => setCadastro({ ...cadastro, codigo: event.target.value })} placeholder="Ex: BR-01" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Unidade
            <select value={cadastro.unidade} onChange={event => setCadastro({ ...cadastro, unidade: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500">
              {UNIDADES.map(item => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Descrição
            <input value={cadastro.descricao} onChange={event => setCadastro({ ...cadastro, descricao: event.target.value })} placeholder="Ex: Brita 1" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Categoria
            <input value={cadastro.categoria} onChange={event => setCadastro({ ...cadastro, categoria: event.target.value })} placeholder="Ex: Agregado" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Estoque mínimo
            <input type="number" min="0" step="0.001" value={cadastro.estoqueMinimo} onChange={event => setCadastro({ ...cadastro, estoqueMinimo: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Fornecedor padrão
            <select value={cadastro.fornecedorPadraoId} onChange={event => setCadastro({ ...cadastro, fornecedorPadraoId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Sem fornecedor padrão</option>
              {empresas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Observação
            <textarea value={cadastro.observacao} onChange={event => setCadastro({ ...cadastro, observacao: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
        </div>
        {erro && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-700">{erro}</p>}
      </Modal>

      <Modal
        open={movimentoAberto}
        title="Movimentar material"
        size="md"
        onClose={() => setMovimentoAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setMovimentoAberto(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvarMovimento} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Registrar</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Data
            <input type="date" value={movimento.data} onChange={event => setMovimento({ ...movimento, data: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Tipo
            <select value={movimento.tipo} onChange={event => setMovimento({ ...movimento, tipo: event.target.value as TipoMovimentoMaterial })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500">
              {TIPOS.map(item => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Material
            <select value={movimento.materialId} onChange={event => setMovimento({ ...movimento, materialId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Selecione</option>
              {ativos.map(item => <option key={item.id} value={item.id}>{item.descricao}{item.codigo ? ` · ${item.codigo}` : ''}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Quantidade{movimento.tipo === 'Ajuste' ? ' (use sinal negativo para baixar)' : ''}
            <input type="number" step="0.001" value={movimento.quantidade} onChange={event => setMovimento({ ...movimento, quantidade: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          {movimento.tipo === 'Entrada' && (
            <>
              <label className="text-xs font-bold text-slate-600">
                Nota fiscal
                <input value={movimento.notaFiscal} onChange={event => setMovimento({ ...movimento, notaFiscal: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
              </label>
              <label className="text-xs font-bold text-slate-600 sm:col-span-2">
                Fornecedor
                <select value={movimento.fornecedorId} onChange={event => setMovimento({ ...movimento, fornecedorId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500">
                  <option value="">Sem fornecedor informado</option>
                  {empresas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </label>
            </>
          )}
          {movimento.tipo === 'Transferência' && (
            <label className="text-xs font-bold text-slate-600">
              Origem
              <input value={movimento.origem} onChange={event => setMovimento({ ...movimento, origem: event.target.value })} placeholder="De onde saiu" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
            </label>
          )}
          {movimento.tipo !== 'Ajuste' && (
            <label className="text-xs font-bold text-slate-600">
              Destino / frente
              <input value={movimento.destino} onChange={event => setMovimento({ ...movimento, destino: event.target.value })} placeholder="Ex: Ramo 200" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
            </label>
          )}
          {movimento.tipo === 'Saída' && (
            <label className="text-xs font-bold text-slate-600">
              Serviço
              <input value={movimento.servico} onChange={event => setMovimento({ ...movimento, servico: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
            </label>
          )}
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Observação
            <textarea value={movimento.observacao} onChange={event => setMovimento({ ...movimento, observacao: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
        </div>
        {movimento.materialId && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            {movimento.tipo === 'Saída' ? <ArrowUpFromLine className="h-4 w-4 text-rose-600" /> : <ArrowDownToLine className="h-4 w-4 text-emerald-600" />}
            Saldo atual: <strong>{numero(saldoAtualDoForm)}</strong>
          </p>
        )}
        {erro && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-700">{erro}</p>}
      </Modal>
    </div>
  );
}
