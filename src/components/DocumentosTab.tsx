/**
 * Documentos com validade: CNH, ASO, CRLV, licenças, contratos. O vínculo é por
 * id — nome e dados do colaborador ou equipamento continuam no cadastro de
 * origem. O anexo usa o mesmo upload já validado dos anexos operacionais.
 */
import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, FileText, Paperclip, Plus, Search } from 'lucide-react';
import type {
  DocumentoArquivo,
  Equipamento,
  FichaVerificacaoServico,
  Funcionario,
  ObraLocal,
  TipoDocumento,
  VinculoDocumento,
} from '../types';
import { documentosParaAlertar, painelDocumentos, situacaoDocumento, validarDocumento } from '../utils/documentos';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { validateOperationalAttachment } from '../utils/operationalAttachmentRules';
import { usePaginacao } from '../shared/hooks/usePaginacao';
import { formatarData } from '../utils/formato';
import {
  Badge,
  EmptyState,
  Modal,
  PageHeader,
  SegmentedControl,
  Pagination,
  SearchInput,
  StatCard,
  TableBody,
  TableHead,
  TableShell,
  isoDay,
} from '../shared/ui';

interface DocumentosTabProps {
  documentos: DocumentoArquivo[];
  funcionarios: Funcionario[];
  equipamentos: Equipamento[];
  obras: ObraLocal[];
  fichasFvs: FichaVerificacaoServico[];
  responsavel: string;
  podeEditar: boolean;
  onSave: (documento: DocumentoArquivo, isNew: boolean) => void;
  /** Sobe o arquivo pelo mesmo caminho validado dos anexos operacionais. */
  onUpload?: (documento: DocumentoArquivo, arquivo: File) => Promise<void>;
}

const TIPOS: TipoDocumento[] = ['CNH', 'ASO', 'CRLV', 'Licença', 'Contrato', 'ART/RRT', 'Certificado', 'Projeto', 'Outro'];
const VINCULOS: VinculoDocumento[] = ['Colaborador', 'Equipamento', 'Obra', 'FVS', 'Ordem de Serviço', 'Não Conformidade', 'Geral'];


const tomDaSituacao = (situacao: ReturnType<typeof situacaoDocumento>) => {
  if (situacao === 'Vencido') return 'danger' as const;
  if (situacao === 'Vence em breve') return 'warning' as const;
  if (situacao === 'Válido') return 'success' as const;
  return 'neutral' as const;
};

export default function DocumentosTab({
  documentos,
  funcionarios,
  equipamentos,
  obras,
  fichasFvs,
  responsavel,
  podeEditar,
  onSave,
  onUpload,
}: DocumentosTabProps) {
  const hoje = isoDay(new Date());
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'alertas'>('todos');
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(false);
  const [editado, setEditado] = useState<DocumentoArquivo | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [form, setForm] = useState({
    titulo: '',
    tipo: 'CNH' as TipoDocumento,
    vinculo: 'Colaborador' as VinculoDocumento,
    vinculoId: '',
    numero: '',
    emissao: '',
    validade: '',
    obraId: '',
    observacao: '',
  });

  const ativos = useMemo(() => documentos.filter(item => item.ativo !== false), [documentos]);
  const painel = useMemo(() => painelDocumentos(ativos, hoje), [ativos, hoje]);
  const alertas = useMemo(() => documentosParaAlertar(ativos, hoje), [ativos, hoje]);

  const opcoesDoVinculo = (vinculo: VinculoDocumento) => {
    if (vinculo === 'Colaborador') return funcionarios.map(item => ({ id: item.id, nome: `${item.matricula ? `${item.matricula} · ` : ''}${item.nome}` }));
    if (vinculo === 'Equipamento') return equipamentos.map(item => ({ id: item.id, nome: item.prefixo }));
    if (vinculo === 'Obra') return obras.map(item => ({ id: item.id, nome: item.nome }));
    if (vinculo === 'FVS') return fichasFvs.map(item => ({ id: item.id, nome: `${item.numero} · ${item.local}` }));
    return [];
  };

  const nomeDoVinculo = (documento: DocumentoArquivo) => {
    if (!documento.vinculoId) return '—';
    return opcoesDoVinculo(documento.vinculo).find(item => item.id === documento.vinculoId)?.nome || documento.vinculoId;
  };

  const termo = normalizeComparable(busca).trim();
  const listados = useMemo(() => {
    const base = filtro === 'alertas' ? alertas.map(item => item.documento) : ativos;
    return [...base]
      .filter(item => !termo || normalizeComparable(`${item.titulo} ${item.tipo} ${item.numero || ''} ${item.vinculo}`).includes(termo))
      .sort((a, b) => (a.validade || '9999').localeCompare(b.validade || '9999') || a.titulo.localeCompare(b.titulo, 'pt-BR'));
  }, [ativos, alertas, filtro, termo]);

  const paginacao = usePaginacao(listados);

  const abrir = (documento?: DocumentoArquivo) => {
    setEditado(documento || null);
    setArquivo(null);
    setForm(documento
      ? {
        titulo: documento.titulo,
        tipo: documento.tipo,
        vinculo: documento.vinculo,
        vinculoId: documento.vinculoId || '',
        numero: documento.numero || '',
        emissao: documento.emissao || '',
        validade: documento.validade || '',
        obraId: documento.obraId || '',
        observacao: documento.observacao || '',
      }
      : { titulo: '', tipo: 'CNH', vinculo: 'Colaborador', vinculoId: '', numero: '', emissao: '', validade: '', obraId: '', observacao: '' });
    setErro('');
    setAberto(true);
  };

  const salvar = () => {
    const problema = validarDocumento({
      titulo: form.titulo,
      vinculo: form.vinculo,
      vinculoId: form.vinculoId || undefined,
      emissao: form.emissao || undefined,
      validade: form.validade || undefined,
    });
    if (problema) {
      setErro(problema);
      return;
    }
    if (arquivo) {
      try {
        validateOperationalAttachment(arquivo);
      } catch (falha) {
        setErro(falha instanceof Error ? falha.message : 'Arquivo inválido.');
        return;
      }
    }
    const agora = new Date().toISOString();
    const documento: DocumentoArquivo = {
      id: editado?.id || `doc-${Date.now()}`,
      titulo: form.titulo.trim(),
      tipo: form.tipo,
      vinculo: form.vinculo,
      vinculoId: form.vinculo === 'Geral' ? undefined : form.vinculoId,
      numero: form.numero.trim() || undefined,
      emissao: form.emissao || undefined,
      validade: form.validade || undefined,
      obraId: form.obraId || undefined,
      observacao: form.observacao.trim() || undefined,
      anexo: editado?.anexo,
      responsavel: editado?.responsavel || responsavel,
      ativo: editado?.ativo ?? true,
      criadoEm: editado?.criadoEm || agora,
      atualizadoEm: agora,
    };
    onSave(documento, !editado);
    if (arquivo && onUpload) {
      onUpload(documento, arquivo).catch(falha => {
        setErro(falha instanceof Error ? falha.message : 'Falha ao enviar o arquivo.');
      });
    }
    setErro('');
    setAberto(false);
  };

  return (
    <div id="documentos-tab" className="renea-page min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        eyebrow="Acervo técnico"
        photo="ponte-construcao"
        title="Documentos"
        description="CNH, ASO, CRLV, licenças e contratos com controle de validade e vínculo ao registro de origem."
        actions={podeEditar ? (
          <button type="button" onClick={() => abrir()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800">
            <Plus className="h-4 w-4" /> Novo documento
          </button>
        ) : undefined}
      />

      {painel.vencidos + painel.vencendo > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            {painel.vencidos} vencido(s) e {painel.vencendo} vencendo em até 30 dias
          </p>
          <p className="mt-1 text-[11px] text-amber-800">
            {alertas.slice(0, 5).map(item => `${item.documento.titulo}${item.documento.validade ? ` (${formatarData(item.documento.validade)})` : ''}`).join(' · ')}
          </p>
        </div>
      )}

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Documentos', valor: painel.total, tone: 'info' as const, icone: FileText },
          { label: 'Vencidos', valor: painel.vencidos, tone: 'danger' as const, icone: AlertTriangle },
          { label: 'Vencendo', valor: painel.vencendo, tone: 'warning' as const, icone: FileText },
          { label: 'Sem arquivo', valor: painel.semAnexo, tone: 'warning' as const, icone: FileText },
        ].map(item => (
          <StatCard key={item.label} label={item.label} value={item.valor} tone={item.tone} icon={item.icone} />
        ))}
      </section>

      <SegmentedControl
        className="mt-4"
        label="Filtro de documentos"
        items={[{ id: 'todos', label: 'Todos' }, { id: 'alertas', label: 'Vencidos e vencendo' }] as const}
        value={filtro}
        onChange={setFiltro}
      />

      <SearchInput
        className="mt-3"
        label="Buscar documento"
        value={busca}
        onChange={setBusca}
        placeholder="Título, tipo, número ou vínculo"
      />

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {listados.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhum documento" description="Cadastre documentos com validade e vincule ao colaborador, equipamento ou obra." />
        ) : (
          <TableShell minWidth={1020}>
            <TableHead>
              <tr>
                <th className="p-3">Documento</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Vínculo</th>
                <th className="p-3">Número</th>
                <th className="p-3">Validade</th>
                <th className="p-3">Situação</th>
                <th className="p-3">Arquivo</th>
                {podeEditar && <th className="p-3 text-right">Ações</th>}
              </tr>
            </TableHead>
            <TableBody>
              {paginacao.visiveis.map(item => {
                const situacao = situacaoDocumento(item, hoje);
                return (
                  <tr key={item.id} className={`transition-colors hover:bg-slate-50 ${situacao === 'Vencido' ? 'bg-rose-50/50' : ''}`}>
                    <td className="p-3 font-bold text-slate-800">{item.titulo}</td>
                    <td className="p-3 text-slate-600">{item.tipo}</td>
                    <td className="p-3 text-slate-600">{item.vinculo === 'Geral' ? 'Geral' : `${item.vinculo}: ${nomeDoVinculo(item)}`}</td>
                    <td className="p-3 font-mono text-slate-600">{item.numero || '—'}</td>
                    <td className="p-3 text-slate-600">{item.validade ? formatarData(item.validade) : '—'}</td>
                    <td className="p-3"><Badge tone={tomDaSituacao(situacao)}>{situacao}</Badge></td>
                    <td className="p-3 text-slate-600">
                      {item.anexo ? <span className="inline-flex items-center gap-1 text-[11px]"><Paperclip className="h-3.5 w-3.5" />{item.anexo.name}</span> : '—'}
                    </td>
                    {podeEditar && (
                      <td className="p-3 text-right">
                        <button type="button" onClick={() => abrir(item)} className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Editar</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </TableBody>
          </TableShell>
        )}
      </div>

      {paginacao.totalPaginas > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500">
            {paginacao.visiveis.length} de {paginacao.total} registro(s)
          </span>
          <Pagination page={paginacao.pagina} totalPages={paginacao.totalPaginas} onChange={paginacao.setPagina} />
        </div>
      )}

      <Modal
        open={aberto}
        title={editado ? `Editar ${editado.titulo}` : 'Novo documento'}
        onSubmit={salvar}
        size="md"
        onClose={() => setAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setAberto(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvar} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar documento</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Título
            <input value={form.titulo} onChange={event => setForm({ ...form, titulo: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Tipo
            <select value={form.tipo} onChange={event => setForm({ ...form, tipo: event.target.value as TipoDocumento })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              {TIPOS.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Número
            <input value={form.numero} onChange={event => setForm({ ...form, numero: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Vínculo
            <select value={form.vinculo} onChange={event => setForm({ ...form, vinculo: event.target.value as VinculoDocumento, vinculoId: '' })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              {VINCULOS.map(vinculo => <option key={vinculo} value={vinculo}>{vinculo}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Registro vinculado
            <select
              value={form.vinculoId}
              onChange={event => setForm({ ...form, vinculoId: event.target.value })}
              disabled={form.vinculo === 'Geral' || opcoesDoVinculo(form.vinculo).length === 0}
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500 disabled:bg-slate-50"
            >
              <option value="">{form.vinculo === 'Geral' ? 'Não se aplica' : 'Selecione'}</option>
              {opcoesDoVinculo(form.vinculo).map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Emissão
            <input type="date" value={form.emissao} onChange={event => setForm({ ...form, emissao: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Validade
            <input type="date" value={form.validade} onChange={event => setForm({ ...form, validade: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Arquivo (PDF, imagem ou planilha, até 10 MB)
            <input
              type="file"
              onChange={event => setArquivo(event.target.files?.[0] || null)}
              className="mt-1 block w-full text-xs font-normal text-slate-600 file:mr-3 file:min-h-10 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:text-xs file:font-bold file:text-slate-600"
            />
            {editado?.anexo && <span className="mt-1 block text-[11px] text-slate-500">Arquivo atual: {editado.anexo.name}</span>}
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Observação
            <textarea value={form.observacao} onChange={event => setForm({ ...form, observacao: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          {erro && <p className="sm:col-span-2 text-xs font-bold text-rose-700">{erro}</p>}
        </div>
      </Modal>
    </div>
  );
}
