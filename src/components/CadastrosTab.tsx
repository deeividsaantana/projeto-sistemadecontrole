/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import type ExcelJS from 'exceljs';
import { createCorporateWorkbook, loadValidatedWorkbook } from '../utils/excelCorporate';
import SpreadsheetImportReview from './SpreadsheetImportReview';
import { 
  Empresa, 
  ObraLocal, 
  Equipamento, 
  Funcionario, 
  Comboio, 
  TipoCombustivel, 
  ProdutoLubrificacao, 
  EtapaServico,
  OrdemServico,
} from '../types';
import MasterDataReviewCenter from './MasterDataReviewCenter';
import type { MasterWorkbookAnalysis } from '../masterData/masterWorkbook';
import EquipmentOperationsPanel from './EquipmentOperationsPanel';
import CentralRegistryOverview from './CentralRegistryOverview';
import OrganizationChart from './OrganizationChart';
import { validateEquipmentMasterRecord } from '../utils/equipmentOperations';
import {
  isActiveCollaborator,
  isSupplier,
  isVehicle,
  nextMasterId,
} from '../masterData/centralRegistry';

import { 
  Building2, 
  MapPin, 
  Truck, 
  Users, 
  Fuel, 
  Droplets, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  AlertTriangle, 
  X, 
  CheckCircle,
  Upload
} from 'lucide-react';

type SubTab = 'empresas' | 'fornecedores' | 'obras' | 'equipamentos' | 'veiculos' | 'funcionarios' | 'comboios' | 'combustiveis' | 'lubrificantes' | 'etapas';

interface CadastrosTabProps {
  empresas: Empresa[];
  obras: ObraLocal[];
  equipamentos: Equipamento[];
  funcionarios: Funcionario[];
  comboios: Comboio[];
  combustiveis: TipoCombustivel[];
  lubrificantes: ProdutoLubrificacao[];
  etapas: EtapaServico[];
  ordensServico: OrdemServico[];

  onSaveEmpresa: (item: Empresa, isNew: boolean) => void;
  onDeleteEmpresa: (id: string) => void;
  onSaveObra: (item: ObraLocal, isNew: boolean) => void;
  onDeleteObra: (id: string) => void;
  onSaveEquipamento: (item: Equipamento, isNew: boolean) => void;
  onDeleteEquipamento: (id: string) => void;
  onSaveFuncionario: (item: Funcionario, isNew: boolean) => void;
  onDeleteFuncionario: (id: string) => void;
  onSaveComboio: (item: Comboio, isNew: boolean) => void;
  onDeleteComboio: (id: string) => void;
  onSaveTipoCombustivel: (item: TipoCombustivel, isNew: boolean) => void;
  onDeleteTipoCombustivel: (id: string) => void;
  onSaveProdutoLubrificacao: (item: ProdutoLubrificacao, isNew: boolean) => void;
  onDeleteProdutoLubrificacao: (id: string) => void;
  onSaveEtapaServico: (item: EtapaServico, isNew: boolean) => void;
  onDeleteEtapaServico: (id: string) => void;
  onImportCadastros: (target: SubTab, rows: Record<string, string>[]) => { success: boolean; message: string };
  onApplyMasterWorkbook: (analysis: MasterWorkbookAnalysis) => Promise<{ success: boolean; message: string }>;
}

export default function CadastrosTab({
  empresas,
  obras,
  equipamentos,
  funcionarios,
  comboios,
  combustiveis,
  lubrificantes,
  etapas,
  ordensServico,
  onSaveEmpresa,
  onDeleteEmpresa,
  onSaveObra,
  onDeleteObra,
  onSaveEquipamento,
  onDeleteEquipamento,
  onSaveFuncionario,
  onDeleteFuncionario,
  onSaveComboio,
  onDeleteComboio,
  onSaveTipoCombustivel,
  onDeleteTipoCombustivel,
  onSaveProdutoLubrificacao,
  onDeleteProdutoLubrificacao,
  onSaveEtapaServico,
  onDeleteEtapaServico,
  onImportCadastros,
  onApplyMasterWorkbook,
}: CadastrosTabProps) {

  // Current subtab state
  const [subTab, setSubTab] = useState<SubTab>('equipamentos');

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Advanced filters (contextuais por sub-aba)
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterEmpresaId, setFilterEmpresaId] = useState<string>('todos');
  const [filterObraId, setFilterObraId] = useState<string>('todos');
  const [filterAtivo, setFilterAtivo] = useState<string>('todos');
  const [filterTipoEquipamento, setFilterTipoEquipamento] = useState<string>('todos');
  const [filterCargo, setFilterCargo] = useState<string>('todos');
  const [activeFuncionarioId, setActiveFuncionarioId] = useState<string | null>(null);

  // Form togglers & editing identifiers
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Deletion confirmations
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [importFeedback, setImportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [pendingImport, setPendingImport] = useState<{ fileName: string; rows: Record<string, string>[] } | null>(null);
  const [isConfirmingImport, setIsConfirmingImport] = useState(false);

  // Field validation warnings
  const [validationError, setValidationError] = useState<string>('');

  // 1. Temporary states for Form fields
  // Empresa Fields
  const [empNome, setEmpNome] = useState('');
  const [empCnpj, setEmpCnpj] = useState('');
  const [empTelefone, setEmpTelefone] = useState('');
  const [empResponsavel, setEmpResponsavel] = useState('');

  // Obra Fields
  const [obrNome, setObrNome] = useState('');
  const [obrEndereco, setObrEndereco] = useState('');
  const [obrResponsavel, setObrResponsavel] = useState('');
  const [obrStatus, setObrStatus] = useState<'Ativa' | 'Concluída' | 'Planejada'>('Ativa');

  // Equipamento Fields
  const [eqPrefixo, setEqPrefixo] = useState('');
  const [eqNome, setEqNome] = useState('');
  const [eqTipo, setEqTipo] = useState('');
  const [eqMarca, setEqMarca] = useState('');
  const [eqModelo, setEqModelo] = useState('');
  const [eqSeriePlaca, setEqSeriePlaca] = useState('');
  const [eqPlaca, setEqPlaca] = useState('');
  const [eqEmpresaId, setEqEmpresaId] = useState('');
  const [eqStatus, setEqStatus] = useState<Equipamento['status']>('Ativo');
  const [eqLocalId, setEqLocalId] = useState('');
  const [eqObservacao, setEqObservacao] = useState('');
  const [eqFoto, setEqFoto] = useState<string>('');
  const [eqHorasDisponiveis, setEqHorasDisponiveis] = useState<number>(0);
  const [eqHorasIndisponiveis, setEqHorasIndisponiveis] = useState<number>(0);
  const [eqCategoriaFrota, setEqCategoriaFrota] = useState<NonNullable<Equipamento['categoriaFrota']>>('Equipamento');
  const [eqCodigoSge, setEqCodigoSge] = useState('');
  const [eqFamilia, setEqFamilia] = useState('');
  const [eqMobilizado, setEqMobilizado] = useState(false);
  const [eqMetaDisponibilidade, setEqMetaDisponibilidade] = useState<number>(80);
  const [eqDataMobilizacao, setEqDataMobilizacao] = useState('');
  const [eqDataDesmobilizacao, setEqDataDesmobilizacao] = useState('');
  const [eqOperadorResponsavelId, setEqOperadorResponsavelId] = useState('');
  const [eqCombustivelId, setEqCombustivelId] = useState('');
  const [eqCapacidadeTanque, setEqCapacidadeTanque] = useState<number>(0);
  const [eqEquipamentoVinculadoId, setEqEquipamentoVinculadoId] = useState('');

  // Funcionario Fields
  const [funNome, setFunNome] = useState('');
  const [funMatricula, setFunMatricula] = useState('');
  const [funCargo, setFunCargo] = useState('');
  const [funTelefone, setFunTelefone] = useState('');
  const [funEmpresaId, setFunEmpresaId] = useState('');
  const [funAtivo, setFunAtivo] = useState(true);
  const [funStatus, setFunStatus] = useState<NonNullable<Funcionario['status']>>('ATIVO');
  const [funDivisao, setFunDivisao] = useState('');
  const [funSecao, setFunSecao] = useState('');
  const [funLiderId, setFunLiderId] = useState('');
  const [funArea, setFunArea] = useState('');
  const [funResponsavelArea, setFunResponsavelArea] = useState('');
  const [funDataMobilizacao, setFunDataMobilizacao] = useState('');
  const [funDataDesmobilizacao, setFunDataDesmobilizacao] = useState('');
  const [funSituacaoRh, setFunSituacaoRh] = useState('');
  const [funObservacao, setFunObservacao] = useState('');

  // Comboio Fields
  const [comNome, setComNome] = useState('');
  const [comPlaca, setComPlaca] = useState('');
  const [comCapacidade, setComCapacidade] = useState<number>(3000);
  const [comResponsavel, setComResponsavel] = useState('');

  // Simple item lists (combustivel, lubrificante, etapas) Fields
  const [simpleName, setSimpleName] = useState('');

  // Clear fields helper
  const resetFormState = () => {
    setEditingId(null);
    setValidationError('');
    setEmpNome(''); setEmpCnpj(''); setEmpTelefone(''); setEmpResponsavel('');
    setObrNome(''); setObrEndereco(''); setObrResponsavel(''); setObrStatus('Ativa');
    setEqPrefixo(''); setEqNome(''); setEqTipo(''); setEqMarca(''); setEqModelo(''); setEqSeriePlaca(''); setEqPlaca(''); setEqEmpresaId(''); setEqStatus('Ativo'); setEqLocalId(''); setEqObservacao(''); setEqFoto(''); setEqHorasDisponiveis(0); setEqHorasIndisponiveis(0);
    setEqCategoriaFrota('Equipamento'); setEqCodigoSge(''); setEqFamilia(''); setEqMobilizado(false); setEqMetaDisponibilidade(80); setEqDataMobilizacao(''); setEqDataDesmobilizacao(''); setEqOperadorResponsavelId(''); setEqCombustivelId(''); setEqCapacidadeTanque(0); setEqEquipamentoVinculadoId('');
    setFunNome(''); setFunMatricula(''); setFunCargo(''); setFunTelefone(''); setFunEmpresaId(''); setFunAtivo(true); setFunStatus('ATIVO');
    setFunDivisao(''); setFunSecao(''); setFunLiderId(''); setFunArea(''); setFunResponsavelArea(''); setFunDataMobilizacao(''); setFunDataDesmobilizacao(''); setFunSituacaoRh(''); setFunObservacao('');
    setComNome(''); setComPlaca(''); setComCapacidade(3000); setComResponsavel('');
    setSimpleName('');
  };

  // 2. Open Form for creation or editing
  const handleOpenCreate = () => {
    resetFormState();
    // Pre-fill some defaults if available
    if (subTab === 'equipamentos' || subTab === 'veiculos') {
      if (empresas.length > 0) setEqEmpresaId(empresas[0].id);
      if (obras.length > 0) setEqLocalId(obras[0].id);
      if (subTab === 'veiculos') setEqCategoriaFrota('Veículo');
    } else if (subTab === 'funcionarios') {
      if (empresas.length > 0) setFunEmpresaId(empresas[0].id);
    }
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    resetFormState();
    setEditingId(item.id);
    setValidationError('');

    if (subTab === 'empresas' || subTab === 'fornecedores') {
      const x = item as Empresa;
      setEmpNome(x.nome); setEmpCnpj(x.cnpj); setEmpTelefone(x.telefone); setEmpResponsavel(x.responsavel);
    } else if (subTab === 'obras') {
      const x = item as ObraLocal;
      setObrNome(x.nome); setObrEndereco(x.endereco); setObrResponsavel(x.responsavel); setObrStatus(x.status);
    } else if (subTab === 'equipamentos' || subTab === 'veiculos') {
      const x = item as Equipamento;
      setEqPrefixo(x.prefixo); setEqNome(x.nome); setEqTipo(x.tipo); setEqMarca(x.marca); setEqModelo(x.modelo); setEqSeriePlaca(x.seriePlaca); setEqEmpresaId(x.empresaId); setEqStatus(x.status); setEqLocalId(x.localAtualId); setEqObservacao(x.observacao);
      setEqPlaca(x.placa || ''); setEqFoto(x.foto || ''); setEqHorasDisponiveis(x.horasDisponiveis || 0); setEqHorasIndisponiveis(x.horasIndisponiveis || 0);
      setEqCategoriaFrota(x.categoriaFrota || 'Equipamento'); setEqCodigoSge(x.codigoSge || ''); setEqFamilia(x.familia || ''); setEqMobilizado(Boolean(x.mobilizado)); setEqMetaDisponibilidade(x.metaDisponibilidade ?? 80); setEqDataMobilizacao(x.dataMobilizacao || ''); setEqDataDesmobilizacao(x.dataDesmobilizacao || ''); setEqOperadorResponsavelId(x.operadorResponsavelId || ''); setEqCombustivelId(x.combustivelId || ''); setEqCapacidadeTanque(x.capacidadeTanqueLitros || 0); setEqEquipamentoVinculadoId(x.equipamentoVinculadoId || '');
    } else if (subTab === 'funcionarios') {
      const x = item as Funcionario;
      const leader = funcionarios.find(person => person.matricula && person.matricula === x.liderMatricula);
      setFunNome(x.nome); setFunMatricula(x.matricula || ''); setFunCargo(x.cargo); setFunTelefone(x.telefone); setFunEmpresaId(x.empresaId); setFunAtivo(x.ativo); setFunStatus(x.status || (x.ativo ? 'ATIVO' : 'INATIVO'));
      setFunDivisao(x.divisao || ''); setFunSecao(x.secao || ''); setFunLiderId(leader?.id || ''); setFunArea(x.area || ''); setFunResponsavelArea(x.responsavelArea || ''); setFunDataMobilizacao(x.dataMobilizacao || ''); setFunDataDesmobilizacao(x.dataDesmobilizacao || ''); setFunSituacaoRh(x.situacaoRh || ''); setFunObservacao(x.observacao || '');
    } else if (subTab === 'comboios') {
      const x = item as Comboio;
      setComNome(x.nome); setComPlaca(x.placa); setComCapacidade(x.capacidadeLitros); setComResponsavel(x.responsavel);
    } else {
      setSimpleName(item.nome);
    }
    setIsFormOpen(true);
  };

  // 3. Form Submit with validation
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    const isNew = editingId === null;
    const currentId = isNew
      ? subTab === 'funcionarios'
        ? nextMasterId('COL', funcionarios.map(item => item.id))
        : subTab === 'equipamentos'
          ? nextMasterId('EQ', equipamentos.map(item => item.id))
          : subTab === 'veiculos'
            ? nextMasterId('VEI', equipamentos.map(item => item.id))
            : subTab === 'fornecedores'
              ? nextMasterId('FOR', empresas.map(item => item.id))
              : subTab === 'empresas'
                ? nextMasterId('EMP', empresas.map(item => item.id))
                : `${subTab.substring(0, 3).toUpperCase()}-${Date.now()}`
      : editingId!;

    if (subTab === 'empresas' || subTab === 'fornecedores') {
      if (!empNome.trim()) {
        setValidationError('Nome da empresa/fornecedor é obrigatório!');
        return;
      }
      const previous = empresas.find(item => item.id === currentId);
      onSaveEmpresa({
        id: currentId,
        nome: empNome.trim(),
        cnpj: empCnpj.trim(),
        telefone: empTelefone.trim(),
        responsavel: empResponsavel.trim(),
        tipos: Array.from(new Set([...(previous?.tipos || []), subTab === 'fornecedores' ? 'FORNECEDOR' as const : 'EMPRESA' as const])),
        status: previous?.status || 'ATIVO',
        criadoEm: previous?.criadoEm,
      }, isNew);

    } else if (subTab === 'obras') {
      if (!obrNome.trim() || !obrEndereco.trim()) {
        setValidationError('Descrição da obra e Endereço/local são obrigatórios!');
        return;
      }
      onSaveObra({
        id: currentId,
        nome: obrNome.trim(),
        endereco: obrEndereco.trim(),
        responsavel: obrResponsavel.trim(),
        status: obrStatus
      }, isNew);

    } else if (subTab === 'equipamentos' || subTab === 'veiculos') {
      const responsibleOperator = funcionarios.find(item => item.id === eqOperadorResponsavelId);
      const equipmentToSave: Equipamento = {
        id: currentId,
        prefixo: eqPrefixo.trim().toUpperCase(),
        nome: eqNome.trim(),
        tipo: eqTipo.trim() || 'Outro',
        marca: eqMarca.trim(),
        modelo: eqModelo.trim(),
        seriePlaca: eqSeriePlaca.trim().toUpperCase(),
        placa: eqPlaca.trim().toUpperCase() || undefined,
        empresaId: eqEmpresaId,
        status: eqStatus,
        localAtualId: eqLocalId || (obras[0] ? obras[0].id : ''),
        observacao: eqObservacao.trim(),
        foto: eqFoto || undefined,
        horasDisponiveis: Number(eqHorasDisponiveis) || 0,
        horasIndisponiveis: Number(eqHorasIndisponiveis) || 0,
        categoriaFrota: subTab === 'veiculos' ? 'Veículo' : eqCategoriaFrota,
        codigoSge: eqCodigoSge.trim() || undefined,
        familia: eqFamilia.trim() || undefined,
        mobilizado: eqMobilizado,
        metaDisponibilidade: Number(eqMetaDisponibilidade),
        dataMobilizacao: eqDataMobilizacao || undefined,
        dataDesmobilizacao: eqDataDesmobilizacao || undefined,
        operadorResponsavelId: eqOperadorResponsavelId || undefined,
        operadorResponsavelNome: responsibleOperator?.nome || undefined,
        combustivelId: eqCombustivelId || undefined,
        capacidadeTanqueLitros: Number(eqCapacidadeTanque) || undefined,
        equipamentoVinculadoId: eqEquipamentoVinculadoId || undefined,
      };
      const validation = validateEquipmentMasterRecord(equipmentToSave);
      if (validation.errors.length > 0) {
        setValidationError(validation.errors.join(' '));
        return;
      }
      onSaveEquipamento(equipmentToSave, isNew);

    } else if (subTab === 'funcionarios') {
      if (!funMatricula.trim() || !funNome.trim() || !funCargo.trim() || !funEmpresaId) {
        setValidationError('Matrícula, nome, função e empresa vinculada são obrigatórios!');
        return;
      }
      const leader = funcionarios.find(item => item.id === funLiderId);
      const previous = funcionarios.find(item => item.id === currentId);
      onSaveFuncionario({
        id: currentId,
        matricula: funMatricula.trim(),
        nome: funNome.trim(),
        cargo: funCargo.trim(),
        telefone: funTelefone.trim(),
        empresaId: funEmpresaId,
        ativo: !['INATIVO', 'DESMOBILIZADO'].includes(funStatus) && funAtivo,
        status: funStatus,
        liderMatricula: leader?.matricula,
        liderNome: leader?.nome,
        area: funArea.trim() || undefined,
        responsavelArea: funResponsavelArea.trim() || undefined,
        divisao: funDivisao.trim() || undefined,
        secao: funSecao.trim() || undefined,
        dataMobilizacao: funDataMobilizacao || undefined,
        dataDesmobilizacao: funDataDesmobilizacao || undefined,
        situacaoRh: funSituacaoRh.trim() || undefined,
        observacao: funObservacao.trim() || undefined,
        criadoEm: previous?.criadoEm,
      }, isNew);

    } else if (subTab === 'comboios') {
      if (!comNome.trim() || !comPlaca.trim() || !comResponsavel.trim()) {
        setValidationError('Identificação, Placa e Motorista Responsável do comboio são obrigatórios!');
        return;
      }
      onSaveComboio({
        id: currentId,
        nome: comNome.trim(),
        placa: comPlaca.trim().toUpperCase(),
        capacidadeLitros: Number(comCapacidade) || 3000,
        responsavel: comResponsavel.trim()
      }, isNew);

    } else if (subTab === 'combustiveis') {
      if (!simpleName.trim()) {
        setValidationError('Nome do combustível é obrigatório!');
        return;
      }
      onSaveTipoCombustivel({ id: currentId, nome: simpleName.trim() }, isNew);

    } else if (subTab === 'lubrificantes') {
      if (!simpleName.trim()) {
        setValidationError('Nome do produto é obrigatório!');
        return;
      }
      onSaveProdutoLubrificacao({ id: currentId, nome: simpleName.trim() }, isNew);

    } else if (subTab === 'etapas') {
      if (!simpleName.trim()) {
        setValidationError('Descrição da etapa de serviço é obrigatória!');
        return;
      }
      onSaveEtapaServico({ id: currentId, nome: simpleName.trim() }, isNew);
    }

    // Success close
    setIsFormOpen(false);
    resetFormState();
  };

  // 4. Delete Handler with safe prompt confirmation
  const handleDeleteTrigger = (id: string) => {
    setDeleteConfirmId(id);
  };

  const executeDeletion = (id: string) => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      if (subTab === 'empresas' || subTab === 'fornecedores') onDeleteEmpresa(id);
      else if (subTab === 'obras') onDeleteObra(id);
      else if (subTab === 'equipamentos' || subTab === 'veiculos') onDeleteEquipamento(id);
      else if (subTab === 'funcionarios') onDeleteFuncionario(id);
      else if (subTab === 'comboios') onDeleteComboio(id);
      else if (subTab === 'combustiveis') onDeleteTipoCombustivel(id);
      else if (subTab === 'lubrificantes') onDeleteProdutoLubrificacao(id);
      else if (subTab === 'etapas') onDeleteEtapaServico(id);

      setDeleteConfirmId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // 5. Query Filters
  const q = searchQuery.toLowerCase().trim();

  const filteredEmpresas = empresas.filter(x => x.nome.toLowerCase().includes(q) || x.cnpj.includes(q) || x.responsavel.toLowerCase().includes(q));
  const filteredFornecedores = filteredEmpresas.filter(isSupplier);
  const displayedEmpresas = subTab === 'fornecedores' ? filteredFornecedores : filteredEmpresas;
  const equipamentoTipos = Array.from(new Set(equipamentos.map(x => x.tipo).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const funcionarioCargos = Array.from(new Set(funcionarios.map(x => x.cargo).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const filteredObras = obras.filter(x => {
    if (filterStatus !== 'todos' && x.status !== filterStatus) return false;
    return x.nome.toLowerCase().includes(q) || x.endereco.toLowerCase().includes(q) || x.responsavel.toLowerCase().includes(q);
  });
  const filteredEquipamentos = equipamentos.filter(x => {
    if (filterStatus !== 'todos' && x.status !== filterStatus) return false;
    if (filterEmpresaId !== 'todos' && x.empresaId !== filterEmpresaId) return false;
    if (filterObraId !== 'todos' && x.localAtualId !== filterObraId) return false;
    if (filterTipoEquipamento !== 'todos' && x.tipo !== filterTipoEquipamento) return false;
    return x.prefixo.toLowerCase().includes(q) || x.nome.toLowerCase().includes(q) || x.seriePlaca.toLowerCase().includes(q) || (x.placa || '').toLowerCase().includes(q) || x.tipo.toLowerCase().includes(q);
  });
  const filteredVeiculos = filteredEquipamentos.filter(isVehicle);
  const displayedEquipamentos = subTab === 'veiculos'
    ? filteredVeiculos
    : filteredEquipamentos.filter(item => !isVehicle(item));
  const filteredFuncionarios = funcionarios.filter(x => {
    if (filterEmpresaId !== 'todos' && x.empresaId !== filterEmpresaId) return false;
    if (filterAtivo !== 'todos' && String(x.ativo) !== filterAtivo) return false;
    if (filterCargo !== 'todos' && x.cargo !== filterCargo) return false;
    return x.nome.toLowerCase().includes(q)
      || x.cargo.toLowerCase().includes(q)
      || (x.matricula || '').toLowerCase().includes(q)
      || (x.liderNome || '').toLowerCase().includes(q)
      || (x.area || '').toLowerCase().includes(q)
      || (x.responsavelArea || '').toLowerCase().includes(q);
  });
  const filteredComboios = comboios.filter(x => x.nome.toLowerCase().includes(q) || x.placa.toLowerCase().includes(q) || x.responsavel.toLowerCase().includes(q));
  const filteredCombustiveis = combustiveis.filter(x => x.nome.toLowerCase().includes(q));
  const filteredLubrificantes = lubrificantes.filter(x => x.nome.toLowerCase().includes(q));
  const filteredEtapas = etapas.filter(x => x.nome.toLowerCase().includes(q));
  const deleteTarget = deleteConfirmId
    ? subTab === 'empresas' || subTab === 'fornecedores'
      ? empresas.find(item => item.id === deleteConfirmId)
      : subTab === 'obras'
        ? obras.find(item => item.id === deleteConfirmId)
        : subTab === 'equipamentos' || subTab === 'veiculos'
          ? equipamentos.find(item => item.id === deleteConfirmId)
          : subTab === 'funcionarios'
            ? funcionarios.find(item => item.id === deleteConfirmId)
            : subTab === 'comboios'
              ? comboios.find(item => item.id === deleteConfirmId)
              : subTab === 'combustiveis'
                ? combustiveis.find(item => item.id === deleteConfirmId)
                : subTab === 'lubrificantes'
                  ? lubrificantes.find(item => item.id === deleteConfirmId)
                  : etapas.find(item => item.id === deleteConfirmId)
    : null;
  const deleteTargetName = deleteTarget && 'nome' in deleteTarget ? String(deleteTarget.nome || '') : deleteConfirmId || '';
  const deleteTargetCode = deleteTarget && 'prefixo' in deleteTarget
    ? String(deleteTarget.prefixo || '')
    : deleteTarget && 'placa' in deleteTarget
      ? String(deleteTarget.placa || '')
      : deleteTarget && 'cnpj' in deleteTarget
        ? String(deleteTarget.cnpj || '')
        : deleteConfirmId || '';

  const clearAdvancedFilters = () => {
    setFilterStatus('todos');
    setFilterEmpresaId('todos');
    setFilterObraId('todos');
    setFilterAtivo('todos');
    setFilterTipoEquipamento('todos');
    setFilterCargo('todos');
    setSearchQuery('');
  };

  const hasAdvancedFilters = filterStatus !== 'todos' || filterEmpresaId !== 'todos' || filterObraId !== 'todos' || filterAtivo !== 'todos' || filterTipoEquipamento !== 'todos' || filterCargo !== 'todos' || searchQuery !== '';

  const currentFilteredCount = subTab === 'empresas' ? filteredEmpresas.length
    : subTab === 'fornecedores' ? filteredFornecedores.length
    : subTab === 'obras' ? filteredObras.length
    : subTab === 'equipamentos' ? filteredEquipamentos.filter(item => !isVehicle(item)).length
    : subTab === 'veiculos' ? filteredVeiculos.length
    : subTab === 'funcionarios' ? filteredFuncionarios.length
    : subTab === 'comboios' ? filteredComboios.length
    : subTab === 'combustiveis' ? filteredCombustiveis.length
    : subTab === 'lubrificantes' ? filteredLubrificantes.length
    : filteredEtapas.length;

  // Get count of records
  const getSubTabCount = (tab: SubTab) => {
    if (tab === 'empresas') return empresas.length;
    if (tab === 'fornecedores') return empresas.filter(isSupplier).length;
    if (tab === 'obras') return obras.length;
    if (tab === 'equipamentos') return equipamentos.filter(item => !isVehicle(item)).length;
    if (tab === 'veiculos') return equipamentos.filter(isVehicle).length;
    if (tab === 'funcionarios') return funcionarios.length;
    if (tab === 'comboios') return comboios.length;
    if (tab === 'combustiveis') return combustiveis.length;
    if (tab === 'lubrificantes') return lubrificantes.length;
    return etapas.length;
  };

  const cellToText = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString().split('T')[0];
    if (typeof value === 'object') {
      if ('text' in value) return String(value.text ?? '').trim();
      if ('result' in value) return cellToText(value.result);
      if ('richText' in value && Array.isArray(value.richText)) {
        return value.richText.map((part: any) => part.text || '').join('').trim();
      }
    }
    return String(value).trim();
  };

  const parseCsvText = (text: string): Record<string, string>[] => {
    const delimiter = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    const parseLine = (line: string) => {
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];
        if (char === '"' && inQuotes && next === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current.trim());
      return cells;
    };

    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
    const headers = parseLine(lines[0] || '').map(header => header.trim());
    return lines.slice(1).map(line => {
      const cells = parseLine(line);
      return headers.reduce<Record<string, string>>((row, header, idx) => {
        row[header || `coluna_${idx + 1}`] = cells[idx] || '';
        return row;
      }, {});
    }).filter(row => Object.values(row).some(Boolean));
  };

  const parseWorkbookFile = async (file: File): Promise<Record<string, string>[]> => {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv')) {
      if (file.size === 0) throw new Error('O arquivo está vazio.');
      if (file.size > 10 * 1024 * 1024) throw new Error('O arquivo CSV/TSV ultrapassa o limite de 10 MB.');
      const text = await file.text();
      return lowerName.endsWith('.tsv')
        ? parseCsvText(text.replace(/\t/g, ';'))
        : parseCsvText(text);
    }

    const workbook = await loadValidatedWorkbook(file);
    const rows: Record<string, string>[] = [];
    workbook.worksheets.forEach(worksheet => {
      const headerRowNumber = Math.max(1, Array.from({ length: Math.min(10, worksheet.rowCount) }, (_, index) => index + 1)
        .find(rowNumber => {
          let filled = 0;
          worksheet.getRow(rowNumber).eachCell({ includeEmpty: false }, cell => {
            if (cellToText(cell.value)) filled += 1;
          });
          return filled >= 2;
        }) || 1);

      const headers: string[] = [];
      worksheet.getRow(headerRowNumber).eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = cellToText(cell.value) || `coluna_${colNumber}`;
      });

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= headerRowNumber) return;
        const record: Record<string, string> = { Aba: worksheet.name };
        headers.forEach((header, idx) => {
          record[header] = cellToText(row.getCell(idx + 1).value);
        });
        if (Object.values(record).some(Boolean)) rows.push(record);
      });
    });
    return rows;
  };

  const handleImportSpreadsheet = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setImportFeedback(null);
      const rows = await parseWorkbookFile(file);
      if (rows.length === 0) {
        setImportFeedback({ type: 'error', message: 'A planilha não possui linhas para importar.' });
        return;
      }
      setPendingImport({ fileName: file.name, rows });
    } catch (error: any) {
      console.error('Erro ao importar planilha de cadastros:', error);
      setImportFeedback({ type: 'error', message: error?.message || 'Não foi possível ler a planilha. Use CSV, TSV, XLSX ou XLSM.' });
    } finally {
      if (importFileInputRef.current) importFileInputRef.current.value = '';
    }
  };

  const confirmSpreadsheetImport = () => {
    if (!pendingImport || isConfirmingImport) return;
    setIsConfirmingImport(true);
    const result = onImportCadastros(subTab, pendingImport.rows);
    setImportFeedback({ type: result.success ? 'success' : 'error', message: result.message });
    setPendingImport(null);
    setIsConfirmingImport(false);
  };

  return (
    <div className="space-y-6" id="cadastros-container">
      <CentralRegistryOverview
        empresas={empresas}
        obras={obras}
        equipamentos={equipamentos}
        funcionarios={funcionarios}
        onSelectModule={module => { setSubTab(module); setIsFormOpen(false); clearAdvancedFilters(); resetFormState(); }}
      />
      <SpreadsheetImportReview
        open={Boolean(pendingImport)}
        title={`Importar ${subTab}`}
        fileName={pendingImport?.fileName || ''}
        validCount={pendingImport?.rows.length || 0}
        columns={pendingImport ? Object.keys(pendingImport.rows[0] || {}) : []}
        rows={pendingImport?.rows || []}
        note="Registros com a mesma chave serão atualizados. Confira a amostra antes de gravar no banco de dados."
        confirming={isConfirmingImport}
        onCancel={() => setPendingImport(null)}
        onConfirm={confirmSpreadsheetImport}
      />

      <MasterDataReviewCenter
        empresas={empresas}
        obras={obras}
        funcionarios={funcionarios}
        equipamentos={equipamentos}
        onApplyMasterWorkbook={onApplyMasterWorkbook}
      />
      
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-500" />
             Sistema Central de Cadastros e Controle de Obra
          </h1>
          <p className="text-xs text-slate-400 mt-1">Cadastre uma única vez e reutilize os dados oficiais no efetivo, combustível, viagens, equipamentos e estacas.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => importFileInputRef.current?.click()}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-4 text-xs font-black text-slate-200 transition-colors hover:border-emerald-500 hover:text-white"
          >
            <Upload className="w-4.5 h-4.5" />
            Importar planilha
          </button>
          <input
            ref={importFileInputRef}
            type="file"
            accept=".xlsx,.xlsm,.csv,.tsv"
            onChange={handleImportSpreadsheet}
            className="hidden"
          />
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all  flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4.5 h-4.5" />
            {subTab === 'funcionarios' ? 'NOVO COLABORADOR' : 'NOVO REGISTRO'}
          </button>
        </div>
      </div>

      {/* Auxiliary Tabs Grid Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5" id="subtab-selector">
        {[
          { id: 'funcionarios', label: 'Colaboradores', icon: Users },
          { id: 'equipamentos', label: 'Equipamentos', icon: Truck },
          { id: 'veiculos', label: 'Veículos', icon: Truck },
          { id: 'fornecedores', label: 'Fornecedores', icon: Building2 },
          { id: 'empresas', label: 'Empresas', icon: Building2 },
          { id: 'obras', label: 'Locais', icon: MapPin },
          { id: 'etapas', label: 'Ramos / Trechos', icon: MapPin },
          { id: 'comboios', label: 'Comboios', icon: Fuel },
          { id: 'combustiveis', label: 'Combustíveis', icon: Fuel },
          { id: 'lubrificantes', label: 'Lubrificantes', icon: Droplets }
        ].map(tab => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setSubTab(tab.id as SubTab); setIsFormOpen(false); setSearchQuery(''); clearAdvancedFilters(); resetFormState(); }}
              className={`py-3.5 px-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${active ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400 font-extrabold' : 'bg-slate-900 border-slate-850 text-slate-400 hover:border-slate-800 hover:text-slate-200'}`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] uppercase font-bold tracking-tight block leading-none">{tab.label}</span>
              <span className="text-[9px] font-mono opacity-60">({getSubTabCount(tab.id as SubTab)})</span>
            </button>
          );
        })}
      </div>

      {/* Main Filter Action Bar */}
      <div className="bg-slate-900 border border-slate-850 p-3 rounded-lg space-y-2.5">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-600" />
            <input 
              type="text"
              placeholder="Pesquisa rápida por qualquer termo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="text-xs text-slate-500 hover:text-white underline font-bold px-2 cursor-pointer"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Contextual advanced filters per sub-tab */}
        {(subTab === 'equipamentos' || subTab === 'veiculos' || subTab === 'funcionarios' || subTab === 'obras') && (
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[10px] font-bold text-slate-500 font-mono uppercase mr-0.5">Filtros:</span>

            {subTab === 'obras' && (
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="todos">Todos os Status</option>
                <option value="Ativa">Ativa</option>
                <option value="Concluída">Concluída</option>
                <option value="Planejada">Planejada</option>
              </select>
            )}

            {(subTab === 'equipamentos' || subTab === 'veiculos') && (
              <>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="todos">Todos os Status</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Parado">Parado</option>
                  <option value="Manutenção">Manutenção</option>
                  <option value="Mobilizado">Mobilizado</option>
                  <option value="Desmobilizado">Desmobilizado</option>
                  <option value="Esperando motorista">Esperando motorista</option>
                </select>

                <select
                  value={filterObraId}
                  onChange={(e) => setFilterObraId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="todos">Todas as Obras</option>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>

                <select
                  value={filterTipoEquipamento}
                  onChange={(e) => setFilterTipoEquipamento(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="todos">Todos os Tipos</option>
                  {equipamentoTipos.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
              </>
            )}

            {subTab === 'funcionarios' && (
              <>
                <select
                  value={filterAtivo}
                  onChange={(e) => setFilterAtivo(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="todos">Ativos e Inativos</option>
                  <option value="true">Somente Ativos</option>
                  <option value="false">Somente Inativos</option>
                </select>

                <select
                  value={filterCargo}
                  onChange={(e) => setFilterCargo(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="todos">Todos os Cargos</option>
                  {funcionarioCargos.map(cargo => <option key={cargo} value={cargo}>{cargo}</option>)}
                </select>
              </>
            )}

            {(subTab === 'equipamentos' || subTab === 'veiculos' || subTab === 'funcionarios') && (
              <select
                value={filterEmpresaId}
                onChange={(e) => setFilterEmpresaId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="todos">Todas as Empresas</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            )}

            {hasAdvancedFilters && (
              <button
                onClick={clearAdvancedFilters}
                className="text-[11px] font-bold text-rose-400 hover:underline cursor-pointer"
              >
                Limpar filtros
              </button>
            )}

            <span className="text-[10px] text-slate-600 font-mono ml-auto">
              {currentFilteredCount} resultado{currentFilteredCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {!(subTab === 'equipamentos' || subTab === 'veiculos' || subTab === 'funcionarios' || subTab === 'obras') && (searchQuery || true) && (
          <div className="text-[10px] text-slate-600 font-mono px-1">
            {currentFilteredCount} resultado{currentFilteredCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {importFeedback && (
        <div className={`border rounded-lg p-3 text-xs font-bold flex items-start gap-2 ${importFeedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
          {importFeedback.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{importFeedback.message}</span>
        </div>
      )}

      {/* Inline Form Panel (Expandable above list) */}
      {isFormOpen && (
        <div className="bg-slate-900 border border-emerald-500/30 p-6 rounded-lg  relative" id="inline-form-card">
          <button 
            onClick={() => { setIsFormOpen(false); resetFormState(); }}
            className="absolute top-4 right-4 p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <h3 className="text-sm uppercase tracking-widest font-black text-emerald-400 font-mono mb-5 flex items-center gap-2">
            {editingId ? '✏️ Editando Registro' : '➕ Novo Cadastro'} • {subTab.toUpperCase()}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Conditional Form Fields based on Subtab */}
            {(subTab === 'empresas' || subTab === 'fornecedores') && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Nome Fantasia / Razão Social *</label>
                  <input type="text" value={empNome} onChange={e => setEmpNome(e.target.value)} placeholder="Ex: RENEA INFRAESTRUTURA" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">CNPJ *</label>
                  <input type="text" value={empCnpj} onChange={e => setEmpCnpj(e.target.value)} placeholder="00.000.000/0001-00" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Telefone</label>
                  <input type="text" value={empTelefone} onChange={e => setEmpTelefone(e.target.value)} placeholder="(11) 99999-9999" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Engenheiro ou Gestor Responsável</label>
                  <input type="text" value={empResponsavel} onChange={e => setEmpResponsavel(e.target.value)} placeholder="Ex: Eng. Roberto Santos" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
              </div>
            )}

            {subTab === 'obras' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Descrição do Local / Obra *</label>
                  <input type="text" value={obrNome} onChange={e => setObrNome(e.target.value)} placeholder="Ex: Duplicação BR-101 KM 230" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Endereço / Cidade *</label>
                  <input type="text" value={obrEndereco} onChange={e => setObrEndereco(e.target.value)} placeholder="Ex: Palhoça - SC" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Encarregado / Engenheiro Responsável</label>
                  <input type="text" value={obrResponsavel} onChange={e => setObrResponsavel(e.target.value)} placeholder="Ex: Eng. Aline Lima" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Status Operacional</label>
                  <select value={obrStatus} onChange={e => setObrStatus(e.target.value as any)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer">
                    <option value="Ativa" className="bg-slate-900 text-slate-100">Ativa</option>
                    <option value="Concluída" className="bg-slate-900 text-slate-100">Concluída</option>
                    <option value="Planejada" className="bg-slate-900 text-slate-100">Planejada</option>
                  </select>
                </div>
              </div>
            )}

            {(subTab === 'equipamentos' || subTab === 'veiculos') && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Prefixo de Frota *</label>
                  <input type="text" value={eqPrefixo} onChange={e => setEqPrefixo(e.target.value)} placeholder="Ex: ESC-01, CAM-05" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Nome / Descrição Equipamento *</label>
                  <input type="text" value={eqNome} onChange={e => setEqNome(e.target.value)} placeholder="Ex: Escavadeira Caterpillar 320D" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Tipo de Equipamento</label>
                  <input type="text" value={eqTipo} onChange={e => setEqTipo(e.target.value)} placeholder="Ex: Escavadeira, Caçamba, Rolo" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Marca</label>
                  <input type="text" value={eqMarca} onChange={e => setEqMarca(e.target.value)} placeholder="Ex: Caterpillar, Volvo" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Modelo</label>
                  <input type="text" value={eqModelo} onChange={e => setEqModelo(e.target.value)} placeholder="Ex: 320D L" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Número de Série ou Placa</label>
                  <input type="text" value={eqSeriePlaca} onChange={e => setEqSeriePlaca(e.target.value)} placeholder="Ex: CAT320-123X ou BRA-3E45" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Placa (se houver)</label>
                  <input type="text" value={eqPlaca} onChange={e => setEqPlaca(e.target.value)} placeholder="Ex: BRA-3E45" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Empresa Proprietária *</label>
                  <select value={eqEmpresaId} onChange={e => setEqEmpresaId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer" required>
                    <option value="">Selecione...</option>
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id} className="bg-slate-900 text-white">{emp.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Status Operacional</label>
                  <select value={eqStatus} onChange={e => setEqStatus(e.target.value as any)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer">
                    <option value="Ativo" className="bg-slate-900 text-white">Ativo</option>
                    <option value="Parado" className="bg-slate-900 text-white">Parado</option>
                    <option value="Manutenção" className="bg-slate-900 text-white">Manutenção</option>
                    <option value="Mobilizado" className="bg-slate-900 text-white">Mobilizado</option>
                    <option value="Desmobilizado" className="bg-slate-900 text-white">Desmobilizado</option>
                    <option value="Esperando motorista" className="bg-slate-900 text-white">Esperando motorista</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Local / Obra Atual</label>
                  <select value={eqLocalId} onChange={e => setEqLocalId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer">
                    <option value="">Selecione...</option>
                    {obras.map(obr => (
                      <option key={obr.id} value={obr.id} className="bg-slate-900 text-white">{obr.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Categoria da Frota</label>
                  <select value={eqCategoriaFrota} onChange={e => setEqCategoriaFrota(e.target.value as NonNullable<Equipamento['categoriaFrota']>)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer">
                    <option value="Equipamento">Equipamento</option>
                    <option value="Veículo">Veículo</option>
                    <option value="Implemento">Implemento</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Código de Integração SGE</label>
                  <input type="text" value={eqCodigoSge} onChange={e => setEqCodigoSge(e.target.value)} placeholder="Ex: 726" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Família</label>
                  <input type="text" value={eqFamilia} onChange={e => setEqFamilia(e.target.value)} placeholder="Ex: Basculantes, Escavadeira" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <label className="flex min-h-[62px] items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5">
                  <input type="checkbox" checked={eqMobilizado} onChange={e => setEqMobilizado(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
                  <span>
                    <strong className="block text-xxs uppercase tracking-wider text-slate-300">Mobilizado</strong>
                    <span className="text-[9px] text-slate-500">Mantém o histórico por período.</span>
                  </span>
                </label>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Meta de Disponibilidade (%)</label>
                  <input type="number" min="0" max="100" step="0.1" value={eqMetaDisponibilidade} onChange={e => setEqMetaDisponibilidade(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Data de Mobilização</label>
                  <input type="date" value={eqDataMobilizacao} onChange={e => setEqDataMobilizacao(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Data de Desmobilização</label>
                  <input type="date" value={eqDataDesmobilizacao} onChange={e => setEqDataDesmobilizacao(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Operador / Responsável</label>
                  <select value={eqOperadorResponsavelId} onChange={e => setEqOperadorResponsavelId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer">
                    <option value="">Sem responsável fixo</option>
                    {funcionarios.filter(item => item.ativo).map(item => (
                      <option key={item.id} value={item.id}>{item.nome}{item.matricula ? ` - ${item.matricula}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Combustível Padrão</label>
                  <select value={eqCombustivelId} onChange={e => setEqCombustivelId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer">
                    <option value="">Não informado</option>
                    {combustiveis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Capacidade do Tanque (L)</label>
                  <input type="number" min="0" step="0.1" value={eqCapacidadeTanque || ''} onChange={e => setEqCapacidadeTanque(Number(e.target.value))} placeholder="Ex: 400" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Equipamento Vinculado</label>
                  <select value={eqEquipamentoVinculadoId} onChange={e => setEqEquipamentoVinculadoId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer">
                    <option value="">Sem vínculo</option>
                    {equipamentos.filter(item => item.id !== editingId).map(item => (
                      <option key={item.id} value={item.id}>{item.prefixo} - {item.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Observações Extras</label>
                  <input type="text" value={eqObservacao} onChange={e => setEqObservacao(e.target.value)} placeholder="Ex: Operador fixo: Roberto" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>

                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Horas Disponíveis (período)</label>
                  <input type="number" min="0" step="0.5" value={eqHorasDisponiveis} onChange={e => setEqHorasDisponiveis(Number(e.target.value))} placeholder="Ex: 220" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Horas Indisponíveis (quebra/manutenção)</label>
                  <input type="number" min="0" step="0.5" value={eqHorasIndisponiveis} onChange={e => setEqHorasIndisponiveis(Number(e.target.value))} placeholder="Ex: 12" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Taxa de Disponibilidade / Deficiência</label>
                  <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 flex items-center justify-between">
                    {(() => {
                      const total = (Number(eqHorasDisponiveis) || 0) + (Number(eqHorasIndisponiveis) || 0);
                      const disp = total > 0 ? ((Number(eqHorasDisponiveis) || 0) / total) * 100 : 0;
                      const def = total > 0 ? 100 - disp : 0;
                      return (
                        <>
                          <span className="text-emerald-400 font-bold">{disp.toFixed(1)}% disp.</span>
                          <span className="text-rose-400 font-bold">{def.toFixed(1)}% defic.</span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="md:col-span-4 space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Foto do Equipamento</label>
                  <div className="flex items-center gap-3">
                    {eqFoto && (
                      <img src={eqFoto} alt="Pré-visualização" className="w-16 h-16 rounded-xl object-cover border border-slate-800" />
                    )}
                    <label className="flex-1 cursor-pointer bg-slate-950 border border-dashed border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-400 hover:border-emerald-500 hover:text-emerald-400 transition-colors text-center">
                      {eqFoto ? 'Trocar foto...' : 'Clique para enviar uma foto (câmera ou galeria)'}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => setEqFoto(reader.result as string);
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    {eqFoto && (
                      <button type="button" onClick={() => setEqFoto('')} className="p-2.5 bg-slate-800 text-slate-300 hover:text-rose-400 rounded-xl transition-colors cursor-pointer" title="Remover foto">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

            )}

            {subTab === 'funcionarios' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">ID Mestre</label>
                  <input type="text" value={editingId || 'Gerado automaticamente ao salvar'} disabled className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Matrícula *</label>
                  <input type="text" value={funMatricula} onChange={e => setFunMatricula(e.target.value)} placeholder="Ex: 102200" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Nome do Colaborador / Operador *</label>
                  <input type="text" value={funNome} onChange={e => setFunNome(e.target.value)} placeholder="Ex: Carlos Alberto Silva" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Cargo / Função *</label>
                  <input type="text" value={funCargo} onChange={e => setFunCargo(e.target.value)} placeholder="Ex: Operador de Escavadeira" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Divisão</label>
                  <input type="text" value={funDivisao} onChange={e => setFunDivisao(e.target.value)} placeholder="Ex: DIRETO DE OBRA" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Seção</label>
                  <input type="text" value={funSecao} onChange={e => setFunSecao(e.target.value)} placeholder="Ex: MÃO DE OBRA" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Líder</label>
                  <select value={funLiderId} onChange={e => setFunLiderId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer">
                    <option value="">Sem líder definido</option>
                    {funcionarios.filter(item => item.id !== editingId && isActiveCollaborator(item)).map(item => (
                      <option key={item.id} value={item.id}>{item.matricula || 'Sem matrícula'} — {item.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Área</label>
                  <input type="text" value={funArea} onChange={e => setFunArea(e.target.value)} placeholder="Ex: TERRAPLENAGEM" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Responsável</label>
                  <input type="text" value={funResponsavelArea} onChange={e => setFunResponsavelArea(e.target.value)} placeholder="Responsável da área" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Telefone Contato</label>
                  <input type="text" value={funTelefone} onChange={e => setFunTelefone(e.target.value)} placeholder="(48) 99999-9999" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Empresa Vinculada *</label>
                  <select value={funEmpresaId} onChange={e => setFunEmpresaId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer" required>
                    <option value="">Selecione...</option>
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id} className="bg-slate-900 text-white">{emp.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Situação Cadastral</label>
                  <select value={funStatus} onChange={e => { const status = e.target.value as NonNullable<Funcionario['status']>; setFunStatus(status); setFunAtivo(!['INATIVO', 'DESMOBILIZADO'].includes(status)); }} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer">
                    <option value="ATIVO">ATIVO</option>
                    <option value="INATIVO">INATIVO</option>
                    <option value="FÉRIAS">FÉRIAS</option>
                    <option value="AFASTADO">AFASTADO</option>
                    <option value="DESMOBILIZADO">DESMOBILIZADO</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Data de mobilização</label>
                  <input type="date" value={funDataMobilizacao} onChange={e => setFunDataMobilizacao(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Data de desmobilização</label>
                  <input type="date" value={funDataDesmobilizacao} onChange={e => setFunDataDesmobilizacao(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Situação RH</label>
                  <input type="text" value={funSituacaoRh} onChange={e => setFunSituacaoRh(e.target.value)} placeholder="Situação registrada pelo RH" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="md:col-span-3 space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Observação</label>
                  <input type="text" value={funObservacao} onChange={e => setFunObservacao(e.target.value)} placeholder="Informações adicionais" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
              </div>
            )}

            {subTab === 'comboios' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Identificação do Comboio / Posto Móvel *</label>
                  <input type="text" value={comNome} onChange={e => setComNome(e.target.value)} placeholder="Ex: Comboio 01 - Mercedes Benz" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Placa do Veículo *</label>
                  <input type="text" value={comPlaca} onChange={e => setComPlaca(e.target.value)} placeholder="BRA-9A12" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Capacidade Volumétrica (Litros) *</label>
                  <input type="number" value={comCapacidade} onChange={e => setComCapacidade(Number(e.target.value))} placeholder="4000" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Motorista / Responsável pelo Fornecimento *</label>
                  <input type="text" value={comResponsavel} onChange={e => setComResponsavel(e.target.value)} placeholder="Ex: José da Silva Costa" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                </div>
              </div>
            )}

            {/* Simple Text items (Combustível, lubrificante e etapa) */}
            {(subTab === 'combustiveis' || subTab === 'lubrificantes' || subTab === 'etapas') && (
              <div className="space-y-1 max-w-md">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">
                  {subTab === 'combustiveis' ? 'Nome do Combustível *' : subTab === 'lubrificantes' ? 'Nome do Produto de Lubrificação *' : 'Nome da Etapa/Ramo de Serviço *'}
                </label>
                <input 
                  type="text" 
                  value={simpleName} 
                  onChange={e => setSimpleName(e.target.value)} 
                  placeholder={subTab === 'combustiveis' ? 'Ex: Diesel S10, Arla 32' : subTab === 'lubrificantes' ? 'Ex: Graxa de Lítio NLGI 2, Óleo Motor 15W40' : 'Ex: Terraplenagem / Escavação'} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" 
                  required 
                />
              </div>
            )}

            {validationError && (
              <div className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl">
                ⚠️ {validationError}
              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-2.5 pt-3">
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl  transition-all cursor-pointer"
              >
                {editingId ? 'Salvar Alterações' : 'Cadastrar Registro'}
              </button>
              <button
                type="button"
                onClick={() => { setIsFormOpen(false); resetFormState(); }}
                className="px-5 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Database Lists (Tables) */}
      <div className="bg-slate-900 border border-slate-850 rounded-lg overflow-hidden" id="database-lists-viewport">
        
        {/* Table View Conditional rendering */}
        {(subTab === 'empresas' || subTab === 'fornecedores') && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 uppercase text-[10px] font-bold bg-slate-950/20 font-mono">
                  <th className="py-3.5 px-5">Empresa</th>
                  <th className="py-3.5 px-5">CNPJ</th>
                  <th className="py-3.5 px-5">Responsável</th>
                  <th className="py-3.5 px-5">Contato</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {displayedEmpresas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500 italic">Nenhuma empresa encontrada com os termos de busca.</td>
                  </tr>
                ) : (
                  displayedEmpresas.map(item => (
                    <tr key={item.id} className="hover:bg-slate-950/20 transition-colors">
                      <td className="py-4 px-5 font-black text-slate-100">{item.nome}</td>
                      <td className="py-4 px-5 font-mono text-slate-300">{item.cnpj}</td>
                      <td className="py-4 px-5 text-slate-300">{item.responsavel || '—'}</td>
                      <td className="py-4 px-5 text-slate-300">{item.telefone || '—'}</td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenEdit(item)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition-colors cursor-pointer" title="Editar"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteTrigger(item.id)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-rose-400 rounded-lg transition-colors cursor-pointer" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {subTab === 'obras' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 uppercase text-[10px] font-bold bg-slate-950/20 font-mono">
                  <th className="py-3.5 px-5">Local / Canteiro</th>
                  <th className="py-3.5 px-5">Endereço</th>
                  <th className="py-3.5 px-5">Responsável Técnico</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredObras.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500 italic">Nenhuma obra cadastrada.</td>
                  </tr>
                ) : (
                  filteredObras.map(item => {
                    const statusColor = item.status === 'Ativa' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : item.status === 'Concluída' 
                      ? 'bg-slate-800 text-slate-400 border-slate-700/60' 
                      : 'bg-blue-500/10 text-blue-400 border-blue-500/20';

                    return (
                      <tr key={item.id} className="hover:bg-slate-950/20 transition-colors">
                        <td className="py-4 px-5 font-black text-slate-100">{item.nome}</td>
                        <td className="py-4 px-5 text-slate-300">{item.endereco}</td>
                        <td className="py-4 px-5 text-slate-300">{item.responsavel || '—'}</td>
                        <td className="py-4 px-5">
                          <span className={`px-2 py-0.5 border text-[9px] font-bold rounded-full ${statusColor}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleOpenEdit(item)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteTrigger(item.id)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {(subTab === 'equipamentos' || subTab === 'veiculos') && (
          <>
          <EquipmentOperationsPanel
            equipamentos={equipamentos}
            ordensServico={ordensServico}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 uppercase text-[10px] font-bold bg-slate-950/20 font-mono">
                  <th className="py-3.5 px-5">Prefixo / Nome</th>
                  <th className="py-3.5 px-5">Marca/Modelo</th>
                  <th className="py-3.5 px-5">Proprietário</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5">Local Atual</th>
                  <th className="py-3.5 px-5">Disponibilidade</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {displayedEquipamentos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500 italic">Nenhum equipamento correspondente encontrado.</td>
                  </tr>
                ) : (
                  displayedEquipamentos.map(item => {
                    const emp = empresas.find(e => e.id === item.empresaId);
                    const local = obras.find(o => o.id === item.localAtualId);
                    
                    const statusColor = item.status === 'Ativo' || item.status === 'Mobilizado'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : item.status === 'Manutenção'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : item.status === 'Esperando motorista'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : 'bg-slate-800 text-slate-400 border-slate-700/60';

                    return (
                      <tr key={item.id} className="hover:bg-slate-950/20 transition-colors">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            {item.foto ? (
                              <img src={item.foto} alt={item.nome} className="w-8 h-8 rounded-lg object-cover border border-slate-800 shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                                <Truck className="w-3.5 h-3.5 text-slate-600" />
                              </div>
                            )}
                            <span className="font-mono font-black text-emerald-400 text-xs bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-md">
                              {item.prefixo}
                            </span>
                            <span className="font-bold text-slate-100">{item.nome}</span>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-slate-300">
                          <span className="block font-semibold">{item.marca} • {item.modelo}</span>
                          <span className="text-[10px] text-slate-500 uppercase font-mono block">Série: {item.seriePlaca || 'SEM SÉRIE'}</span>
                          {item.placa && <span className="text-[10px] text-emerald-400 uppercase font-mono block">Placa: {item.placa}</span>}
                          <span className="text-[10px] text-cyan-400 uppercase font-mono block">
                            {item.categoriaFrota || 'Equipamento'} · SGE {item.codigoSge || '—'}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-slate-400 max-w-[150px] truncate" title={emp ? emp.nome : ''}>
                          {emp ? emp.nome : '—'}
                        </td>
                        <td className="py-4 px-5">
                          <span className={`px-2 py-0.5 border text-[9px] font-bold rounded-full ${statusColor}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-slate-300 max-w-[140px] truncate" title={local ? local.nome : ''}>
                          {local ? local.nome : '—'}
                        </td>
                        <td className="py-4 px-5">
                          {(() => {
                            const disp = item.horasDisponiveis || 0;
                            const indisp = item.horasIndisponiveis || 0;
                            const total = disp + indisp;
                            if (total === 0) return <span className="text-[10px] text-slate-600 italic">Sem registro</span>;
                            const taxaDisp = (disp / total) * 100;
                            const taxaDef = 100 - taxaDisp;
                            return (
                              <div className="flex flex-col gap-0.5 min-w-[90px]">
                                <span className="text-[10px] font-bold text-emerald-400">{taxaDisp.toFixed(1)}% disp.</span>
                                <span className="text-[9px] font-semibold text-rose-400">{taxaDef.toFixed(1)}% defic.</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleOpenEdit(item)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteTrigger(item.id)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          </>
        )}

        {subTab === 'funcionarios' && (
          <>
          <OrganizationChart
            funcionarios={filteredFuncionarios}
            empresas={empresas}
            activeId={activeFuncionarioId}
            onActiveIdChange={setActiveFuncionarioId}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 uppercase text-[10px] font-bold bg-slate-950/20 font-mono">
                  <th className="py-3.5 px-5">Matrícula / Colaborador</th>
                  <th className="py-3.5 px-5">Cargo / Função</th>
                  <th className="py-3.5 px-5">Empresa Vínculo</th>
                  <th className="py-3.5 px-5">Contato</th>
                  <th className="py-3.5 px-5">Situação</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredFuncionarios.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500 italic">Nenhum funcionário encontrado.</td>
                  </tr>
                ) : (
                  filteredFuncionarios.map(item => {
                    const emp = empresas.find(e => e.id === item.empresaId);
                    return (
                      <tr
                        id={`func-row-${item.id}`}
                        key={item.id}
                        onMouseEnter={() => setActiveFuncionarioId(item.id)}
                        onMouseLeave={() => setActiveFuncionarioId(null)}
                        className={`transition-colors ${activeFuncionarioId === item.id ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200' : 'hover:bg-slate-50'}`}
                      >
                        <td className="py-4 px-5">
                          <span className="block font-mono text-[10px] text-emerald-400">{item.matricula || 'SEM MATRÍCULA'}</span>
                          <span className="font-black text-slate-100">{item.nome}</span>
                          {item.liderNome && <span className="block text-[10px] text-slate-500">Líder: {item.liderNome}</span>}
                        </td>
                        <td className="py-4 px-5 text-slate-300">{item.cargo}</td>
                        <td className="py-4 px-5 text-slate-400 truncate max-w-[150px]">{emp ? emp.nome : '—'}</td>
                        <td className="py-4 px-5 text-slate-400 font-mono">{item.telefone || '—'}</td>
                        <td className="py-4 px-5">
                          <span className={`px-2 py-0.5 border text-[9px] font-bold rounded-full ${item.ativo ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                            {item.status || (item.ativo ? 'ATIVO' : 'INATIVO')}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleOpenEdit(item)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteTrigger(item.id)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          </>
        )}

        {subTab === 'comboios' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 uppercase text-[10px] font-bold bg-slate-950/20 font-mono">
                  <th className="py-3.5 px-5">Identificação</th>
                  <th className="py-3.5 px-5">Placa</th>
                  <th className="py-3.5 px-5">Capacidade Máxima</th>
                  <th className="py-3.5 px-5">Responsável / Motorista</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredComboios.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500 italic">Nenhum comboio cadastrado.</td>
                  </tr>
                ) : (
                  filteredComboios.map(item => (
                    <tr key={item.id} className="hover:bg-slate-950/20 transition-colors">
                      <td className="py-4 px-5 font-black text-slate-100">{item.nome}</td>
                      <td className="py-4 px-5 font-mono text-emerald-400">{item.placa}</td>
                      <td className="py-4 px-5 font-mono text-slate-200 font-bold">{item.capacidadeLitros.toLocaleString('pt-BR')} Litros</td>
                      <td className="py-4 px-5 text-slate-300">{item.responsavel}</td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenEdit(item)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteTrigger(item.id)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Simple Item list render for Combustiveis, Lubrificantes, Etapas */}
        {(subTab === 'combustiveis' || subTab === 'lubrificantes' || subTab === 'etapas') && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 uppercase text-[10px] font-bold bg-slate-950/20 font-mono">
                  <th className="py-3.5 px-5">ID Interno</th>
                  <th className="py-3.5 px-5">Descrição / Nome do Item</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {((subTab === 'combustiveis' ? filteredCombustiveis : subTab === 'lubrificantes' ? filteredLubrificantes : filteredEtapas)).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-slate-500 italic">Nenhum item cadastrado nesta categoria.</td>
                  </tr>
                ) : (
                  (subTab === 'combustiveis' ? filteredCombustiveis : subTab === 'lubrificantes' ? filteredLubrificantes : filteredEtapas).map(item => (
                    <tr key={item.id} className="hover:bg-slate-950/20 transition-colors">
                      <td className="py-4 px-5 font-mono text-slate-500 text-xxs">{item.id}</td>
                      <td className="py-4 px-5 font-black text-slate-100 text-xs">{item.nome}</td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenEdit(item)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteTrigger(item.id)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Safe inline Prompt Deletion Confirmation Dialog overlay */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="cadastro-delete-title">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-lg p-6  space-y-4">
            <div className="p-3 bg-rose-500/10 text-rose-400 rounded-lg w-fit">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 id="cadastro-delete-title" className="text-sm uppercase tracking-wider font-black text-white font-mono">Confirmar inativacao?</h3>
              <p className="text-xxs text-slate-400 mt-1 leading-relaxed">
                O registro continuará no histórico e nos lançamentos existentes. {subTab === 'equipamentos' || subTab === 'veiculos' ? 'A frota será marcada como desmobilizada.' : 'O cadastro será marcado como inativo.'}
              </p>
              <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-3">
                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Registro selecionado</span>
                <strong className="mt-1 block truncate text-sm text-white">{deleteTargetName || 'Registro sem nome'}</strong>
                <span className="mt-1 block truncate font-mono text-[10px] text-slate-400">{deleteTargetCode}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => executeDeletion(deleteConfirmId)}
                disabled={isDeleting}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? 'PROCESSANDO...' : subTab === 'equipamentos' || subTab === 'veiculos' ? 'DESMOBILIZAR' : 'INATIVAR'}
              </button>
              <button 
                onClick={() => setDeleteConfirmId(null)}
                disabled={isDeleting}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                Não, Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
