/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Empresa, 
  ObraLocal, 
  Equipamento, 
  Funcionario, 
  Comboio, 
  TipoCombustivel, 
  ProdutoLubrificacao, 
  Abastecimento, 
  Lubrificacao, 
  ListaPresenca,
  ApontamentoRamoRegistro
} from '../types';

import { 
  FileSpreadsheet, 
  Printer, 
  Filter, 
  Search, 
  Calendar, 
  Building2, 
  Truck, 
  MapPin, 
  Fuel, 
  Droplets, 
  ClipboardList, 
  CheckCircle, 
  AlertTriangle,
  BarChart3,
  FilterX
} from 'lucide-react';
import { totalQuantidade } from '../utils/apontamentoRamosConfig';

import reneaLogoFull from '../assets/images/renea_logo_new.png';
import spmarLogo from '../assets/images/spmar_logo.png';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { addCorporateSummarySheet, configureCorporateWorkbook, downloadCorporateWorkbook, styleCorporateWorksheet } from '../utils/excelCorporate';

interface RelatoriosTabProps {
  empresas: Empresa[];
  obras: ObraLocal[];
  equipamentos: Equipamento[];
  funcionarios: Funcionario[];
  comboios: Comboio[];
  combustiveis: TipoCombustivel[];
  lubrificantes: ProdutoLubrificacao[];

  abastecimentos: Abastecimento[];
  lubrificacoes: Lubrificacao[];
  listasPresenca: ListaPresenca[];
  apontamentoRamoRegistros: ApontamentoRamoRegistro[];
}

const formatFuelReportNumber = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

type ReportType = 
  | 'consumo_frota' 
  | 'consumo_empresa' 
  | 'consumo_periodo' 
  | 'lubrificacao_frota' 
  | 'equipamentos_mobilizados' 
  | 'equipamentos_manutencao' 
  | 'resumo_obra'
  | 'presenca_lista'
  | 'apontamentos_ramos';

const getCurrentMonthRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const toInput = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().split('T')[0];
  };
  return { start: toInput(start), end: toInput(end) };
};

export default function RelatoriosTab({
  empresas,
  obras,
  equipamentos,
  funcionarios,
  comboios,
  combustiveis,
  lubrificantes,
  abastecimentos,
  lubrificacoes,
  listasPresenca,
  apontamentoRamoRegistros
}: RelatoriosTabProps) {

  // Selected report type
  const [reportType, setReportType] = useState<ReportType>('consumo_frota');
  const initialRange = getCurrentMonthRange();

  // Filters state
  const [dataInicio, setDataInicio] = useState(initialRange.start);
  const [dataFim, setDataFim] = useState(initialRange.end);
  const [filtroEmpresaId, setFiltroEmpresaId] = useState('');
  const [filtroEquipamentoId, setFiltroEquipamentoId] = useState('');
  const [filtroObraId, setFiltroObraId] = useState('');
  const [filtroCombustivelId, setFiltroCombustivelId] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [fuelSort, setFuelSort] = useState<'data_desc' | 'litros_desc' | 'litros_asc'>('litros_desc');

  const normalizeKey = (value: string) =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const isWithinSelectedPeriod = (date: string) =>
    (!dataInicio || date >= dataInicio) && (!dataFim || date <= dataFim);
  const invalidDateRange = Boolean(dataInicio && dataFim && dataInicio > dataFim);
  const apontamentoCanteiros = Array.from(new Set(apontamentoRamoRegistros.map(reg => reg.canteiroNome))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const clearReportFilters = () => {
    const nextRange = getCurrentMonthRange();
    setDataInicio(nextRange.start);
    setDataFim(nextRange.end);
    setFiltroEmpresaId('');
    setFiltroEquipamentoId('');
    setFiltroObraId('');
    setFiltroCombustivelId('');
    setFiltroResponsavel('');
    setFuelSort('litros_desc');
  };

  // Run the report filtering logic
  const getFilteredData = () => {
    switch (reportType) {
      
      case 'consumo_frota': {
        // Pivot: uma linha por frota, uma coluna por produto (combustível ou lubrificante)
        type LinhaFrota = { eq: Pick<Equipamento, 'id' | 'prefixo' | 'nome'>; company: string; localizacao: string; produtos: { [nomeProduto: string]: number } };
        const grouped: { [id: string]: LinhaFrota } = {};

        const getOrCreate = (eq: Pick<Equipamento, 'id' | 'prefixo' | 'nome'>, companyName?: string, localizacaoNome?: string): LinhaFrota => {
          if (!grouped[eq.id]) {
            const fullEq = equipamentos.find(item => item.id === eq.id);
            const company = companyName || empresas.find(em => em.id === fullEq?.empresaId)?.nome || 'Sem cadastro';
            const localizacao = localizacaoNome || obras.find(o => o.id === fullEq?.localAtualId)?.nome || 'NÃO LOCALIZADO';
            grouped[eq.id] = { eq, company, localizacao, produtos: {} };
          }
          return grouped[eq.id];
        };

        abastecimentos.forEach(ab => {
          if (!isWithinSelectedPeriod(ab.data)) return;
          if (filtroCombustivelId && ab.tipoCombustivelId !== filtroCombustivelId) return;
          if (filtroResponsavel && !ab.responsavel.toLowerCase().includes(filtroResponsavel.toLowerCase())) return;

          const eq = equipamentos.find(e => e.id === ab.equipamentoId);
          if (eq) {
            if (filtroEmpresaId && eq.empresaId !== filtroEmpresaId) return;
            if (filtroEquipamentoId && eq.id !== filtroEquipamentoId) return;
            if (filtroObraId && eq.localAtualId !== filtroObraId) return;
          } else {
            if (filtroEmpresaId || filtroEquipamentoId || filtroObraId) return;
          }

          const produtoNome = combustiveis.find(c => c.id === ab.tipoCombustivelId)?.nome || 'Combustível';
          const linha = getOrCreate(eq || {
            id: `sem-cadastro-${ab.prefixoInformado || ab.id}`,
            prefixo: ab.prefixoInformado || 'Sem prefixo',
            nome: 'Pendente de cadastro',
          });
          linha.produtos[produtoNome] = (linha.produtos[produtoNome] || 0) + ab.quantidadeLitros;
        });

        lubrificacoes.forEach(lub => {
          if (!isWithinSelectedPeriod(lub.data)) return;
          if (filtroResponsavel && !lub.responsavel.toLowerCase().includes(filtroResponsavel.toLowerCase())) return;

          const eq = equipamentos.find(e => e.id === lub.equipamentoId);
          if (!eq) return;
          if (filtroEmpresaId && eq.empresaId !== filtroEmpresaId) return;
          if (filtroEquipamentoId && eq.id !== filtroEquipamentoId) return;
          if (filtroObraId && eq.localAtualId !== filtroObraId) return;

          const produtoNome = lubrificantes.find(p => p.id === lub.produtoLubrificacaoId)?.nome || 'Lubrificante';
          const linha = getOrCreate(eq);
          linha.produtos[produtoNome] = (linha.produtos[produtoNome] || 0) + lub.quantidade;
        });

        return Object.values(grouped).sort((a, b) => {
          const totalA = Object.values(a.produtos).reduce((sum, value) => sum + value, 0);
          const totalB = Object.values(b.produtos).reduce((sum, value) => sum + value, 0);
          if (fuelSort === 'litros_desc') return totalB - totalA || a.eq.prefixo.localeCompare(b.eq.prefixo);
          if (fuelSort === 'litros_asc') return totalA - totalB || a.eq.prefixo.localeCompare(b.eq.prefixo);
          return a.eq.prefixo.localeCompare(b.eq.prefixo);
        });
      }

      case 'consumo_empresa': {
        // Group fuel by company
        const grouped: { [name: string]: { companyName: string; liters: number; vehiclesCount: number; countAbas: number } } = {};

        abastecimentos.forEach(ab => {
          if (!isWithinSelectedPeriod(ab.data)) return;
          if (filtroCombustivelId && ab.tipoCombustivelId !== filtroCombustivelId) return;
          if (filtroResponsavel && !ab.responsavel.toLowerCase().includes(filtroResponsavel.toLowerCase())) return;

          const eq = equipamentos.find(e => e.id === ab.equipamentoId);
          if (!eq && (filtroEmpresaId || filtroEquipamentoId || filtroObraId)) return;

          if (eq && filtroEmpresaId && eq.empresaId !== filtroEmpresaId) return;
          if (eq && filtroEquipamentoId && eq.id !== filtroEquipamentoId) return;
          if (eq && filtroObraId && eq.localAtualId !== filtroObraId) return;

          const company = eq ? empresas.find(em => em.id === eq.empresaId) : undefined;
          const cName = company ? company.nome : 'Sem cadastro de frota';

          if (!grouped[cName]) {
            grouped[cName] = { companyName: cName, liters: 0, vehiclesCount: 0, countAbas: 0 };
          }
          grouped[cName].liters += ab.quantidadeLitros;
          grouped[cName].countAbas += 1;
        });

        return Object.values(grouped).sort((a,b) => {
          if (fuelSort === 'litros_asc') return a.liters - b.liters;
          return b.liters - a.liters;
        });
      }

      case 'consumo_periodo': {
        // Timeline of abastecimentos
        return abastecimentos.filter(ab => {
          if (!isWithinSelectedPeriod(ab.data)) return false;
          
          if (filtroCombustivelId && ab.tipoCombustivelId !== filtroCombustivelId) return false;
          if (filtroResponsavel && !ab.responsavel.toLowerCase().includes(filtroResponsavel.toLowerCase())) return false;

          const eq = equipamentos.find(e => e.id === ab.equipamentoId);
          if (eq) {
            if (filtroEmpresaId && eq.empresaId !== filtroEmpresaId) return false;
            if (filtroEquipamentoId && eq.id !== filtroEquipamentoId) return false;
            if (filtroObraId && eq.localAtualId !== filtroObraId) return false;
          } else {
            if (filtroEmpresaId || filtroEquipamentoId || filtroObraId) return false;
          }
          return true;
        }).sort((a,b) => {
          if (fuelSort === 'litros_desc') return b.quantidadeLitros - a.quantidadeLitros || b.data.localeCompare(a.data);
          if (fuelSort === 'litros_asc') return a.quantidadeLitros - b.quantidadeLitros || b.data.localeCompare(a.data);
          return b.data.localeCompare(a.data) || b.hora.localeCompare(a.hora);
        });
      }

      case 'lubrificacao_frota': {
        // Filter lubrication logs
        return lubrificacoes.filter(lub => {
          if (!isWithinSelectedPeriod(lub.data)) return false;
          if (filtroResponsavel && !lub.responsavel.toLowerCase().includes(filtroResponsavel.toLowerCase())) return false;

          const eq = equipamentos.find(e => e.id === lub.equipamentoId);
          if (eq) {
            if (filtroEmpresaId && eq.empresaId !== filtroEmpresaId) return false;
            if (filtroEquipamentoId && eq.id !== filtroEquipamentoId) return false;
            if (filtroObraId && eq.localAtualId !== filtroObraId) return false;
          } else {
            if (filtroEmpresaId || filtroEquipamentoId || filtroObraId) return false;
          }
          return true;
        }).sort((a,b) => b.data.localeCompare(a.data));
      }

      case 'equipamentos_mobilizados': {
        // List active/mobilized heavy machinery
        return equipamentos.filter(eq => {
          if (eq.status !== 'Ativo' && eq.status !== 'Mobilizado') return false;
          if (filtroEmpresaId && eq.empresaId !== filtroEmpresaId) return false;
          if (filtroEquipamentoId && eq.id !== filtroEquipamentoId) return false;
          if (filtroObraId && eq.localAtualId !== filtroObraId) return false;
          return true;
        }).sort((a,b) => a.prefixo.localeCompare(b.prefixo));
      }

      case 'equipamentos_manutencao': {
        // List machinery in maintenance
        return equipamentos.filter(eq => {
          if (eq.status !== 'Manutenção') return false;
          if (filtroEmpresaId && eq.empresaId !== filtroEmpresaId) return false;
          if (filtroEquipamentoId && eq.id !== filtroEquipamentoId) return false;
          if (filtroObraId && eq.localAtualId !== filtroObraId) return false;
          return true;
        }).sort((a,b) => a.prefixo.localeCompare(b.prefixo));
      }

      case 'resumo_obra': {
        const normalized = (value: string) => value.trim().toLocaleLowerCase('pt-BR');
        const selectedCompanyName = empresas.find(empresa => empresa.id === filtroEmpresaId)?.nome || '';

        return obras
          .filter(site => !filtroObraId || site.id === filtroObraId)
          .map(site => {
            const siteEquipment = equipamentos.filter(eq => {
              if (eq.localAtualId !== site.id) return false;
              if (filtroEmpresaId && eq.empresaId !== filtroEmpresaId) return false;
              if (filtroEquipamentoId && eq.id !== filtroEquipamentoId) return false;
              return true;
            });
            const siteEquipmentIds = new Set(siteEquipment.map(eq => eq.id));
            const fuelRecords = abastecimentos.filter(ab =>
              isWithinSelectedPeriod(ab.data) && siteEquipmentIds.has(ab.equipamentoId)
            );
            const lubricationRecords = lubrificacoes.filter(lub =>
              isWithinSelectedPeriod(lub.data) && siteEquipmentIds.has(lub.equipamentoId)
            );
            const presenceRecords = listasPresenca
              .filter(lista => lista.obraId === site.id && isWithinSelectedPeriod(lista.data))
              .flatMap(lista => lista.funcionarios)
              .filter(item => {
                if (!filtroEmpresaId) return true;
                return funcionarios.find(funcionario => funcionario.id === item.funcionarioId)?.empresaId === filtroEmpresaId;
              });
            const pointingRecords = apontamentoRamoRegistros.filter(registro => {
              if (!isWithinSelectedPeriod(registro.data)) return false;
              if (normalized(registro.canteiroNome) !== normalized(site.nome)) return false;
              if (selectedCompanyName && normalized(registro.empresa) !== normalized(selectedCompanyName)) return false;
              return true;
            });

            return {
              site,
              activeEquipment: siteEquipment.filter(eq => eq.status === 'Ativo' || eq.status === 'Mobilizado').length,
              maintenanceEquipment: siteEquipment.filter(eq => eq.status === 'Manutenção' || eq.status === 'Parado').length,
              fuelLiters: fuelRecords.reduce((sum, item) => sum + Number(item.quantidadeLitros || 0), 0),
              lubricationQuantity: lubricationRecords.reduce((sum, item) => sum + Number(item.quantidade || 0), 0),
              presenceRecords: presenceRecords.length,
              presentPeople: presenceRecords.filter(item => item.presente).length,
              pointingRecords: pointingRecords.length,
              pointedWorkers: pointingRecords.reduce((sum, item) => sum + totalQuantidade(item.funcoes), 0),
              pointedEquipment: pointingRecords.reduce((sum, item) => sum + totalQuantidade(item.equipamentos), 0),
            };
          })
          .filter(item =>
            item.activeEquipment > 0 ||
            item.maintenanceEquipment > 0 ||
            item.fuelLiters > 0 ||
            item.lubricationQuantity > 0 ||
            item.presenceRecords > 0 ||
            item.pointingRecords > 0
          )
          .sort((a, b) => b.fuelLiters - a.fuelLiters || a.site.nome.localeCompare(b.site.nome));
      }

      case 'presenca_lista': {
        // Flatten all attendance lists into individual rows: one row per worker per day
        type LinhaPresenca = { data: string; obraNome: string; funcionarioNome: string; cargo: string; presente: boolean; observacao: string; responsavel: string };
        const linhas: LinhaPresenca[] = [];

        listasPresenca.forEach(lista => {
          if (!isWithinSelectedPeriod(lista.data)) return;
          if (filtroObraId && lista.obraId !== filtroObraId) return;

          const obra = obras.find(o => o.id === lista.obraId);

          lista.funcionarios.forEach(item => {
            const func = funcionarios.find(f => f.id === item.funcionarioId);
            if (!func) return;
            if (filtroEmpresaId && func.empresaId !== filtroEmpresaId) return;
            if (filtroResponsavel && !lista.responsavel.toLowerCase().includes(filtroResponsavel.toLowerCase())) return;

            linhas.push({
              data: lista.data,
              obraNome: obra ? obra.nome : '—',
              funcionarioNome: func.nome,
              cargo: func.cargo,
              presente: item.presente,
              observacao: item.observacao || '',
              responsavel: lista.responsavel
            });
          });
        });

        return linhas.sort((a, b) => b.data.localeCompare(a.data) || a.funcionarioNome.localeCompare(b.funcionarioNome));
      }

      case 'apontamentos_ramos': {
        return apontamentoRamoRegistros.filter(reg => {
          if (!isWithinSelectedPeriod(reg.data)) return false;
          if (filtroObraId && normalizeKey(reg.canteiroNome) !== filtroObraId) return false;
          if (filtroEmpresaId) {
            const empresaNome = empresas.find(empresa => empresa.id === filtroEmpresaId)?.nome || '';
            if (empresaNome && !normalizeKey(reg.empresa).includes(normalizeKey(empresaNome)) && !normalizeKey(empresaNome).includes(normalizeKey(reg.empresa))) return false;
          }
          if (filtroResponsavel && !`${reg.responsavel} ${reg.ramoNome} ${reg.empresa}`.toLowerCase().includes(filtroResponsavel.toLowerCase())) return false;
          return true;
        }).sort((a, b) => b.data.localeCompare(a.data) || b.horaEnvio.localeCompare(a.horaEnvio));
      }

      default:
        return [];
    }
  };

  const results = invalidDateRange ? [] : getFilteredData();

  // Colunas de produto dinâmicas (combustíveis + lubrificantes), na ordem cadastrada,
  // usadas no relatório "Consumo por Frota" no padrão de planilha RENEA/SPMAR
  const produtoColunas = reportType === 'consumo_frota'
    ? Array.from(new Set([
        ...combustiveis.map(c => c.nome),
        ...lubrificantes.map(p => p.nome),
        ...(results as any[]).flatMap(r => Object.keys(r.produtos || {})),
      ]))
        .filter(nome => (results as any[]).some(r => r.produtos && r.produtos[nome] !== undefined))
    : [];

  const produtoTotais: { [nome: string]: number } = {};
  if (reportType === 'consumo_frota') {
    produtoColunas.forEach(nome => {
      produtoTotais[nome] = (results as any[]).reduce((sum, r) => sum + (r.produtos[nome] || 0), 0);
    });
  }

  const [isExporting, setIsExporting] = useState(false);

  // Helper to convert dynamic asset image URL to Base64
  const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Erro ao converter blob para Base64"));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Erro ao carregar imagem para conversão Base64:", error);
      throw error;
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Try to load the Renea logo
      let logoBase64 = '';
      try {
        logoBase64 = await getBase64ImageFromUrl(reneaLogoFull);
      } catch (e) {
        console.warn("Could not load logo as base64, using fallback text logo.", e);
      }

      // Try to load the SPMAR partner logo (parceiro/concessionária)
      let spmarLogoBase64 = '';
      try {
        spmarLogoBase64 = await getBase64ImageFromUrl(spmarLogo);
      } catch (e) {
        console.warn("Could not load SPMAR logo as base64.", e);
      }

      // Define table content based on reportType
      let tableHeaders: string[] = [];
      let tableRows: string[][] = [];
      let reportTitle = '';
      let reportDescription = '';

      if (reportType === 'consumo_frota') {
        reportTitle = 'Consumo de Combustível / Lubrificantes';
        reportDescription = `Consumo por frota e por produto no período de ${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}.`;
        tableHeaders = ['Frota', 'Descrição', 'Empresa', ...produtoColunas, 'Localização'];
        const totaisRow = [
          'TOTAIS', '', '',
          ...produtoColunas.map(nome => formatFuelReportNumber(produtoTotais[nome])),
          ''
        ];
        const dataRows = (results as any[]).map(r => [
          r.eq.prefixo,
          r.eq.nome,
          r.company,
          ...produtoColunas.map(nome => r.produtos[nome] !== undefined ? formatFuelReportNumber(r.produtos[nome]) : '-'),
          r.localizacao
        ]);
        tableRows = [totaisRow, ...dataRows];
      } else if (reportType === 'consumo_empresa') {
        reportTitle = 'Consumo de Combustível por Empresa';
        reportDescription = `Divisão do volume abastecido (litros) por empresa proprietária no período de ${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}.`;
        tableHeaders = ['Empresa Proprietária', 'Volume Abastecido', 'Lançamentos'];
        tableRows = (results as any[]).map(r => [
          r.companyName,
          `${r.liters.toLocaleString('pt-BR')} L`,
          r.countAbas.toString()
        ]);
      } else if (reportType === 'consumo_periodo') {
        reportTitle = 'Extrato Analítico de Abastecimentos por Período';
        reportDescription = `Histórico detalhado de todos os abastecimentos realizados de ${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}.`;
        tableHeaders = ['Data', 'Hora', 'Frota', 'Equipamento', 'Proprietário', 'Combustível', 'Volume', 'Inicial', 'Final', 'Responsável'];
        tableRows = (results as any[]).map(r => {
          const eq = equipamentos.find(e => e.id === r.equipamentoId);
          const emp = eq ? empresas.find(em => em.id === eq.empresaId)?.nome : '—';
          const comb = combustiveis.find(t => t.id === r.tipoCombustivelId)?.nome || '—';
          return [
            r.data.split('-').reverse().join('/'),
            r.hora,
            eq ? eq.prefixo : r.prefixoInformado || 'Sem prefixo',
            eq ? eq.nome : 'Pendente de cadastro',
            emp || '—',
            comb,
            `${r.quantidadeLitros} L`,
            r.bombaInicial.toString(),
            r.bombaFinal.toString(),
            r.responsavel
          ];
        });
      } else if (reportType === 'lubrificacao_frota') {
        reportTitle = 'Relatório de Lubrificações da Frota';
        reportDescription = `Histórico de trocas de óleos, graxas e lubrificantes de ${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}.`;
        tableHeaders = ['Data', 'Hora', 'Frota', 'Equipamento', 'Lubrificante', 'Compartimento', 'Qtd (L/kg)', 'Horímetro', 'Técnico'];
        tableRows = (results as any[]).map(r => {
          const eq = equipamentos.find(e => e.id === r.equipamentoId);
          const prod = lubrificantes.find(p => p.id === r.produtoLubrificacaoId)?.nome || '—';
          return [
            r.data.split('-').reverse().join('/'),
            r.hora,
            eq ? eq.prefixo : r.prefixoInformado || 'Sem prefixo',
            eq ? eq.nome : 'Pendente de cadastro',
            prod,
            r.compartimento,
            r.quantidade.toString(),
            r.horimetro.toString(),
            r.responsavel
          ];
        });
      } else if (reportType === 'equipamentos_mobilizados' || reportType === 'equipamentos_manutencao') {
        const isMaint = reportType === 'equipamentos_manutencao';
        reportTitle = isMaint ? 'Inventário de Frota em Manutenção (Oficina)' : 'Relatório de Equipamentos Ativos e Mobilizados';
        reportDescription = isMaint 
          ? 'Relação de todas as máquinas e frotas sob custódia da equipe de manutenção ou oficina de campo.'
          : 'Relação de equipamentos atualmente ativos e alocados nos canteiros de obra.';
        tableHeaders = ['Prefixo', 'Equipamento', 'Marca', 'Modelo', 'Placa/Série', 'Proprietário', 'Canteiro Alocado', 'Status'];
        tableRows = (results as any[]).map(eq => {
          const emp = empresas.find(e => e.id === eq.empresaId)?.nome || '—';
          const site = obras.find(o => o.id === eq.localAtualId)?.nome || '—';
          return [
            eq.prefixo,
            eq.nome,
            eq.marca,
            eq.modelo,
            [eq.placa ? `Placa: ${eq.placa}` : '', eq.seriePlaca ? `Série: ${eq.seriePlaca}` : ''].filter(Boolean).join(' / ') || '—',
            emp,
            site,
            eq.status
          ];
        });
      } else if (reportType === 'resumo_obra') {
        reportTitle = 'Consolidado Operacional por Canteiro de Obra';
        reportDescription = 'Visão integrada de frota, abastecimento, lubrificação, presença e apontamentos por canteiro.';
        tableHeaders = ['Canteiro', 'Frota ativa', 'Parados/manutenção', 'Combustível (L)', 'Lubrificação', 'Presentes', 'Apontamentos', 'Mão de obra apontada', 'Equipamentos apontados'];
        tableRows = (results as any[]).map(r => [
          r.site.nome,
          r.activeEquipment.toString(),
          r.maintenanceEquipment.toString(),
          formatFuelReportNumber(r.fuelLiters),
          formatFuelReportNumber(r.lubricationQuantity),
          `${r.presentPeople}/${r.presenceRecords}`,
          r.pointingRecords.toString(),
          r.pointedWorkers.toString(),
          r.pointedEquipment.toString(),
        ]);
      } else if (reportType === 'presenca_lista') {
        reportTitle = 'Lista de Presença';
        reportDescription = `Relação de funcionários presentes e ausentes no período de ${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}.`;
        tableHeaders = ['Data', 'Obra', 'Funcionário', 'Cargo', 'Situação', 'Observação'];
        tableRows = (results as any[]).map(r => [
          r.data.split('-').reverse().join('/'),
          r.obraNome,
          r.funcionarioNome,
          r.cargo,
          r.presente ? 'PRESENTE' : 'AUSENTE',
          r.observacao || '—'
        ]);
      } else if (reportType === 'apontamentos_ramos') {
        reportTitle = 'Apontamentos por Ramo';
        reportDescription = `Quantitativos diários de mão de obra e equipamentos apontados por ramo no período de ${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}.`;
        tableHeaders = ['Data', 'Hora', 'Canteiro', 'Ramo', 'Empresa', 'Apontador', 'Funções', 'Equipamentos', 'Tempo/Condição', 'Atividade'];
        tableRows = (results as any[]).map(r => [
          r.data.split('-').reverse().join('/'),
          r.horaEnvio,
          r.canteiroNome,
          r.ramoNome,
          r.empresa || '—',
          r.responsavel || '—',
          totalQuantidade(r.funcoes).toString(),
          totalQuantidade(r.equipamentos).toString(),
          `M: ${r.clima.Manhã}/${r.condicao.Manhã} | T: ${r.clima.Tarde}/${r.condicao.Tarde} | N: ${r.clima.Noite}/${r.condicao.Noite}`,
          r.descricaoAtividade || '—'
        ]);
      }

      // Drawing header on each page
      const drawHeaderAndFooter = (data: any) => {
        doc.setFillColor(248, 250, 252); 
        doc.rect(0, 0, pageWidth, 35, 'F');

        doc.setFillColor(15, 81, 50); 
        doc.rect(0, 0, pageWidth, 4, 'F');

        // Logo RENEA (esquerda)
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', 12, 9, 34, 16);
        } else {
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(16);
          doc.setTextColor(15, 81, 50);
          doc.text("RENEA", 12, 18);
          doc.setFontSize(8);
          doc.setTextColor(120);
          doc.text("INFRAESTRUTURA", 12, 23);
        }

        // Logo do parceiro/concessionária SPMAR (direita)
        if (spmarLogoBase64) {
          const spmarW = 32;
          const spmarH = spmarW * (193 / 889);
          doc.addImage(spmarLogoBase64, 'PNG', pageWidth - 12 - spmarW, 17 - spmarH / 2, spmarW, spmarH);
        }

        // Título centralizado (padrão de planilha: nome do relatório + período)
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.text(reportTitle.toUpperCase(), pageWidth / 2, 13, { align: 'center' });

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100);
        const periodStr = `Período: ${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}`;
        doc.text(periodStr, pageWidth / 2, 19, { align: 'center' });

        const generatedAt = `Gerado em: ${new Date().toLocaleString('pt-BR')}`;
        doc.text(generatedAt, pageWidth / 2, 24, { align: 'center' });

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(0, 35, pageWidth, 35);

        // Footer
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100);
        
        doc.setDrawColor(241, 245, 249);
        doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);

        const footerText = 'Sistema Renea • Controle Integrado de Frota e Diário de Obras';
        doc.text(footerText, 15, pageHeight - 10);
        
        const pageInfo = `Página ${data.pageNumber} de ${data.pageCount || 'X'}`;
        doc.text(pageInfo, pageWidth - 15, pageHeight - 10, { align: 'right' });
      };

      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const splitDescription = doc.splitTextToSize(reportDescription, pageWidth - 30);
      doc.text(splitDescription, 15, 43);

      autoTable(doc, {
        startY: 50,
        head: [tableHeaders],
        body: tableRows,
        theme: 'striped',
        headStyles: {
          fillColor: [15, 81, 50], 
          textColor: [255, 255, 255],
          font: 'Helvetica',
          fontStyle: 'bold',
          fontSize: 8.5,
          halign: 'left',
          valign: 'middle'
        },
        bodyStyles: {
          font: 'Helvetica',
          fontSize: 8,
          textColor: [51, 65, 85],
          cellPadding: 3
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] 
        },
        margin: { top: 38, bottom: 20, left: 15, right: 15 },
        didDrawPage: drawHeaderAndFooter
      });

      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100);
        doc.setFillColor(255, 255, 255);
        doc.rect(pageWidth - 35, pageHeight - 13, 20, 5, 'F');
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - 15, pageHeight - 10, { align: 'right' });
      }

      doc.save(`Renea_Relatorio_${reportType}_${dataInicio}_a_${dataFim}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcelFormatted = async () => {
    setIsExporting(true);
    try {
      let logoBase64 = '';
      try {
        logoBase64 = await getBase64ImageFromUrl(reneaLogoFull);
      } catch (e) {
        console.warn("Could not load logo as base64 for excel.", e);
      }

      let spmarLogoBase64Excel = '';
      try {
        spmarLogoBase64Excel = await getBase64ImageFromUrl(spmarLogo);
      } catch (e) {
        console.warn("Could not load SPMAR logo as base64 for excel.", e);
      }

      const filename = `Renea_Relatorio_${reportType}_${dataInicio}_a_${dataFim}.xls`;
      const periodo = `${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}`;

      let headers: string[] = [];
      let rows: string[][] = [];
      let title = '';
      let totalsRow: string[] | null = null;

      if (reportType === 'consumo_frota') {
        title = 'Consumo de Combustível / Lubrificantes';
        headers = ['Frota', 'Descrição', 'Empresa', ...produtoColunas, 'Localização'];
        totalsRow = [
          'TOTAIS', '', '',
          ...produtoColunas.map(nome => formatFuelReportNumber(produtoTotais[nome])),
          ''
        ];
        rows = (results as any[]).map(r => [
          r.eq.prefixo,
          r.eq.nome,
          r.company,
          ...produtoColunas.map(nome => r.produtos[nome] !== undefined ? formatFuelReportNumber(r.produtos[nome]) : '-'),
          r.localizacao
        ]);
      } else if (reportType === 'consumo_empresa') {
        title = 'Consumo por Empresa';
        headers = ['Empresa Proprietária', 'Volume Abastecido (Litros)', 'Quantidade Lançamentos'];
        rows = (results as any[]).map(r => [
          r.companyName,
          r.liters.toString(),
          r.countAbas.toString()
        ]);
      } else if (reportType === 'consumo_periodo') {
        title = 'Consumo por Período';
        headers = ['Data', 'Hora', 'Frota', 'Equipamento', 'Proprietário', 'Combustível', 'Volume (L)', 'Bomba Inicial', 'Bomba Final', 'Responsável', 'Obs'];
        rows = (results as any[]).map(r => {
          const eq = equipamentos.find(e => e.id === r.equipamentoId);
          const emp = eq ? empresas.find(em => em.id === eq.empresaId)?.nome : '—';
          const comb = combustiveis.find(t => t.id === r.tipoCombustivelId)?.nome || '—';
          return [
            r.data.split('-').reverse().join('/'),
            r.hora,
            eq ? eq.prefixo : r.prefixoInformado || 'Sem prefixo',
            eq ? eq.nome : 'Pendente de cadastro',
            emp || '—',
            comb,
            r.quantidadeLitros.toString(),
            r.bombaInicial.toString(),
            r.bombaFinal.toString(),
            r.responsavel,
            r.observacao
          ];
        });
      } else if (reportType === 'lubrificacao_frota') {
        title = 'Lubrificações da Frota';
        headers = ['Data', 'Hora', 'Frota', 'Equipamento', 'Lubrificante', 'Compartimento', 'Qtd (L/kg)', 'Horímetro', 'Técnico', 'Obs'];
        rows = (results as any[]).map(r => {
          const eq = equipamentos.find(e => e.id === r.equipamentoId);
          const prod = lubrificantes.find(p => p.id === r.produtoLubrificacaoId)?.nome || '—';
          return [
            r.data.split('-').reverse().join('/'),
            r.hora,
            eq ? eq.prefixo : '—',
            eq ? eq.nome : '—',
            prod,
            r.compartimento,
            r.quantidade.toString(),
            r.horimetro.toString(),
            r.responsavel,
            r.observacao
          ];
        });
      } else if (reportType === 'equipamentos_mobilizados' || reportType === 'equipamentos_manutencao') {
        title = reportType === 'equipamentos_manutencao' ? 'Frota em Manutenção' : 'Equipamentos Ativos';
        headers = ['Prefixo', 'Equipamento', 'Marca', 'Modelo', 'Placa/Série', 'Proprietário', 'Canteiro Alocado', 'Status Atual'];
        rows = (results as any[]).map(eq => {
          const emp = empresas.find(e => e.id === eq.empresaId)?.nome || '—';
          const site = obras.find(o => o.id === eq.localAtualId)?.nome || '—';
          return [
            eq.prefixo,
            eq.nome,
            eq.marca,
            eq.modelo,
            [eq.placa ? `Placa: ${eq.placa}` : '', eq.seriePlaca ? `Série: ${eq.seriePlaca}` : ''].filter(Boolean).join(' / ') || '—',
            emp,
            site,
            eq.status
          ];
        });
      } else if (reportType === 'resumo_obra') {
        title = 'Consolidado Operacional por Obra';
        headers = ['Canteiro', 'Frota ativa', 'Parados/manutenção', 'Combustível (L)', 'Lubrificação', 'Presentes', 'Apontamentos', 'Mão de obra apontada', 'Equipamentos apontados'];
        rows = (results as any[]).map(r => [
          r.site.nome,
          r.activeEquipment.toString(),
          r.maintenanceEquipment.toString(),
          r.fuelLiters,
          r.lubricationQuantity,
          `${r.presentPeople}/${r.presenceRecords}`,
          r.pointingRecords.toString(),
          r.pointedWorkers.toString(),
          r.pointedEquipment.toString(),
        ]);
      } else if (reportType === 'presenca_lista') {
        title = 'Lista de Presença';
        headers = ['Data', 'Obra', 'Funcionário', 'Cargo', 'Situação', 'Observação'];
        rows = (results as any[]).map(r => [
          r.data.split('-').reverse().join('/'),
          r.obraNome,
          r.funcionarioNome,
          r.cargo,
          r.presente ? 'PRESENTE' : 'AUSENTE',
          r.observacao || '—'
        ]);
      } else if (reportType === 'apontamentos_ramos') {
        title = 'Apontamentos por Ramo';
        headers = ['Data', 'Hora', 'Canteiro', 'Ramo', 'Empresa', 'Apontador', 'Funções', 'Equipamentos', 'Tempo/Condição', 'Atividade', 'Observação'];
        rows = (results as any[]).map(r => [
          r.data.split('-').reverse().join('/'),
          r.horaEnvio,
          r.canteiroNome,
          r.ramoNome,
          r.empresa || '—',
          r.responsavel || '—',
          totalQuantidade(r.funcoes).toString(),
          totalQuantidade(r.equipamentos).toString(),
          `M: ${r.clima.Manhã}/${r.condicao.Manhã} | T: ${r.clima.Tarde}/${r.condicao.Tarde} | N: ${r.clima.Noite}/${r.condicao.Noite}`,
          r.descricaoAtividade || '—',
          r.observacao || '—'
        ]);
      }

      const colCount = headers.length;
      const isResumo = reportType === 'resumo_obra';
      const titleFontSize = isResumo ? '16pt' : '14pt';
      const headerRowNumber = 3; // linha de logos/título (1) + linha de subtítulo/período (1) + cabeçalho da tabela (3)
      const totalDataRowsForFilter = rows.length + (totalsRow ? 1 : 0);
      const autoFilterEndRow = headerRowNumber + Math.max(totalDataRowsForFilter, 1);

      const escapeHtml = (value: string | number | null | undefined) => String(value ?? '—')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\r?\n/g, '<br />');

      const colWidth = (header: string) => {
        const lower = header.toLowerCase();
        if (lower.includes('obs') || lower.includes('pend') || lower.includes('serviço') || lower.includes('localização')) return 220;
        if (lower.includes('equipamento') || lower.includes('propriet') || lower.includes('canteiro') || lower.includes('empresa')) return 170;
        if (lower.includes('data') || lower.includes('hora') || lower.includes('frota') || lower.includes('prefixo')) return 85;
        if (lower.includes('volume') || lower.includes('bomba') || lower.includes('quantidade') || lower.includes('total')) return 105;
        return 130;
      };
      const wb = new ExcelJS.Workbook();
      configureCorporateWorkbook(wb, title);

      const ws = wb.addWorksheet(title.substring(0, 31), {
        views: [{ state: 'frozen', ySplit: headerRowNumber }],
        pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: 'landscape' }
      });

      // Larguras de coluna (convertendo px aproximado para unidade de caractere do Excel)
      ws.columns = headers.map(h => ({ width: Math.max(10, Math.round(colWidth(h) / 7)) }));

      // Linha 1: logos + título central + logo parceiro (em células de texto; logos como imagem flutuante)
      ws.mergeCells(1, 1, 1, colCount);
      const titleCell = ws.getCell(1, 1);
      titleCell.value = title.toUpperCase();
      titleCell.font = { name: 'Arial', bold: true, size: isResumo ? 16 : 14, color: { argb: 'FF1E293B' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 34;

      // Linha 2: período / gerado em
      ws.mergeCells(2, 1, 2, colCount);
      const subtitleCell = ws.getCell(2, 1);
      subtitleCell.value = `Período: ${periodo} • Gerado em ${new Date().toLocaleString('pt-BR')}`;
      subtitleCell.font = { name: 'Arial', size: 10, color: { argb: 'FF000000' } };
      subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(2).height = 18;

      // Linha 3: cabeçalho da tabela
      const headerRow = ws.getRow(headerRowNumber);
      headers.forEach((h, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = h;
        cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F5132' } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      });
      headerRow.height = 24;

      // Linha de totais (se houver)
      let currentRowNum = headerRowNumber + 1;
      if (totalsRow) {
        const tRow = ws.getRow(currentRowNum);
        totalsRow.forEach((val, idx) => {
          const cell = tRow.getCell(idx + 1);
          cell.value = val;
          cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF0F5132' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
        });
        currentRowNum++;
      }

      // Linhas de dados
      if (rows.length === 0) {
        ws.mergeCells(currentRowNum, 1, currentRowNum, colCount);
        const emptyCell = ws.getCell(currentRowNum, 1);
        emptyCell.value = 'Nenhum registro encontrado para os filtros selecionados.';
        emptyCell.font = { name: 'Arial', italic: true, size: 10, color: { argb: 'FF64748B' } };
        emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(currentRowNum).height = 22;
        currentRowNum++;
      } else {
        rows.forEach(row => {
          const dataRow = ws.getRow(currentRowNum);
          row.forEach((val, idx) => {
            const cell = dataRow.getCell(idx + 1);
            cell.value = val;
            cell.font = { name: 'Arial', size: 10, color: { argb: 'FF000000' } };
            cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF000000' } },
              left: { style: 'thin', color: { argb: 'FF000000' } },
              bottom: { style: 'thin', color: { argb: 'FF000000' } },
              right: { style: 'thin', color: { argb: 'FF000000' } }
            };
          });
          currentRowNum++;
        });
      }

      // Autofiltro na faixa do cabeçalho até a última linha de dados
      const lastDataRow = Math.max(currentRowNum - 1, headerRowNumber);
      ws.autoFilter = {
        from: { row: headerRowNumber, column: 1 },
        to: { row: lastDataRow, column: colCount }
      };
      styleCorporateWorksheet(ws, {
        title,
        headerRow: headerRowNumber,
        lastColumn: colCount,
        dataStartRow: headerRowNumber + 1,
        recordCount: rows.length,
        filters: [`Período: ${periodo}`, `Tipo: ${reportType}`],
        autoFit: false,
      });
      addCorporateSummarySheet(wb, title, [
        ['Registros exportados', rows.length],
        ['Período', periodo],
        ['Tipo de relatório', reportType],
      ], [`Período: ${periodo}`]);

      // Logos como objetos de imagem nativos do Excel (resolve o erro de "imagem vinculada quebrada"
      // que ocorria no formato HTML/MHTML antigo, pois agora o arquivo é um .xlsx binário real)
      // ExcelJS espera a string base64 "pura" (sem o prefixo data:image/...;base64,)
      const stripDataUrlPrefix = (dataUrl: string) => dataUrl.replace(/^data:image\/\w+;base64,/, '');

      try {
        if (logoBase64) {
          const logoId = wb.addImage({ base64: stripDataUrlPrefix(logoBase64), extension: 'png' });
          ws.addImage(logoId, {
            tl: { col: 0.1, row: 0.1 },
            ext: { width: 130, height: 52 }
          });
        }
        if (spmarLogoBase64Excel) {
          const spmarId = wb.addImage({ base64: stripDataUrlPrefix(spmarLogoBase64Excel), extension: 'png' });
          ws.addImage(spmarId, {
            tl: { col: colCount - 1.6, row: 0.1 },
            ext: { width: 120, height: 26 }
          });
        }
      } catch (imgError) {
        console.warn('Não foi possível inserir as logos na planilha. O relatório será exportado sem elas.', imgError);
      }

      await downloadCorporateWorkbook(wb, filename.replace(/\.xls$/, '.xlsx'));
    } catch (error) {
      console.error("Erro ao exportar Excel:", error);
      alert('Não foi possível gerar o arquivo Excel. Tente novamente ou contate o suporte.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6" id="relatorios-tab">
      
      {/* Tab Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-4 print:hidden">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
            Emissão de Relatórios Customizados
          </h1>
          <p className="text-xs text-slate-400 mt-1">Gere resumos, consumo operacional de combustível por frota, empresa e lubrificações.</p>
        </div>

         <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcelFormatted}
            disabled={results.length === 0 || isExporting}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {isExporting ? 'Processando...' : 'Exportar Excel'}
          </button>
          <button
            onClick={handleExportPDF}
            disabled={results.length === 0 || isExporting}
            className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            {isExporting ? 'Processando...' : 'Gerar PDF'}
          </button>
        </div>
      </div>

      {/* Grid of Report Types (Left selector in Desktop, full row in Mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:hidden" id="reports-workspace">
        
        {/* Left Column: Report categories list */}
        <div className="space-y-2 bg-slate-900/60 border border-slate-850/80 p-4 rounded-2xl h-fit">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono block mb-3 pl-1">Selecione o Modelo</span>
          
          {[
            { id: 'consumo_frota', label: 'Consumo por Frota', icon: Truck, desc: 'Ranking de consumo de litros por equipamento.' },
            { id: 'consumo_empresa', label: 'Consumo por Empresa', icon: Building2, desc: 'Divisão de litros abastecidos por empresa.' },
            { id: 'consumo_periodo', label: 'Consumo por Período', icon: Fuel, desc: 'Extrato analítico de todos os abastecimentos.' },
            { id: 'lubrificacao_frota', label: 'Lubrificações da Frota', icon: Droplets, desc: 'Relatório de trocas de óleos e graxas.' },
            { id: 'equipamentos_mobilizados', label: 'Equipamentos Ativos', icon: Truck, desc: 'Frota ativa operando nas frentes de obra.' },
            { id: 'equipamentos_manutencao', label: 'Frota em Manutenção', icon: AlertTriangle, desc: 'Inventário sob custódia da oficina.' },
            { id: 'resumo_obra', label: 'Resumo Geral por Obra', icon: MapPin, desc: 'Frota, combustível, presença e apontamentos.' },
            { id: 'presenca_lista', label: 'Lista de Presença', icon: CheckCircle, desc: 'Relação de funcionários presentes/ausentes por dia e obra.' },
            { id: 'apontamentos_ramos', label: 'Apontamentos por Ramo', icon: BarChart3, desc: 'Quantitativos diários de mão de obra e equipamentos por ramo.' }
          ].map(r => {
            const active = reportType === r.id;
            const Icon = r.icon;
            return (
              <button
                key={r.id}
                onClick={() => {
                  setReportType(r.id as ReportType);
                  if (r.id === 'apontamentos_ramos') {
                    setFiltroObraId('');
                    setFiltroEmpresaId('');
                  }
                }}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer block space-y-1 ${active ? 'bg-emerald-600/10 border-emerald-500 text-white' : 'bg-slate-905 border-transparent text-slate-400 hover:bg-slate-950/20 hover:text-slate-200'}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4.5 h-4.5 ${active ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span className="text-xs font-bold">{r.label}</span>
                </div>
                <p className="text-[10px] text-slate-500 pl-6 line-clamp-1">{r.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Right 3 Columns: Advanced Filters Panel & Data Table */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Automatic Dynamic Filter bar */}
          <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-4">
            <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 font-mono flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-emerald-400" />
              Painel de Filtros Inteligentes (Automáticos)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">Data Inicial</label>
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
              </div>

              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">Data Final</label>
                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
              </div>

              {/* Conditional Empresa filter */}
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">Empresa Proprietária / Executora</label>
                <select value={filtroEmpresaId} onChange={e => setFiltroEmpresaId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer">
                  <option value="">Todas</option>
                  {empresas.map(em => (
                    <option key={em.id} value={em.id} className="bg-slate-900 text-slate-200">{em.nome}</option>
                  ))}
                </select>
              </div>

              {/* Conditional site/obra filter */}
              {['consumo_frota', 'consumo_empresa', 'consumo_periodo', 'lubrificacao_frota', 'equipamentos_mobilizados', 'equipamentos_manutencao'].includes(reportType) && (
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">Frota / Equipamento</label>
                  <select value={filtroEquipamentoId} onChange={e => setFiltroEquipamentoId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer">
                    <option value="">Todos</option>
                    {equipamentos.map(eq => <option key={eq.id} value={eq.id} className="bg-slate-900 text-slate-200">{eq.prefixo} — {eq.nome}</option>)}
                  </select>
                </div>
              )}

              {/* Conditional site/obra filter */}
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">Canteiro de Obra</label>
                <select value={filtroObraId} onChange={e => setFiltroObraId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer">
                  <option value="">Todos</option>
                  {reportType === 'apontamentos_ramos'
                    ? apontamentoCanteiros.map(canteiro => (
                      <option key={canteiro} value={normalizeKey(canteiro)} className="bg-slate-900 text-slate-200">{canteiro}</option>
                    ))
                    : obras.map(ob => (
                      <option key={ob.id} value={ob.id} className="bg-slate-900 text-slate-200">{ob.nome}</option>
                    ))}
                </select>
              </div>

              {/* Conditional fuel filter */}
              {['consumo_frota', 'consumo_empresa', 'consumo_periodo'].includes(reportType) && (
                <>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">Insumo Combustível</label>
                    <select value={filtroCombustivelId} onChange={e => setFiltroCombustivelId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer">
                      <option value="">Todos</option>
                      {combustiveis.map(tc => (
                        <option key={tc.id} value={tc.id} className="bg-slate-900 text-slate-200">{tc.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">Ordenar abastecimento</label>
                    <select value={fuelSort} onChange={e => setFuelSort(e.target.value as 'data_desc' | 'litros_desc' | 'litros_asc')} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer">
                      <option value="litros_desc">Maior volume para menor</option>
                      <option value="litros_asc">Menor volume para maior</option>
                      <option value="data_desc">Mais recentes primeiro</option>
                    </select>
                  </div>
                </>
              )}

              {/* Conditional operator / technical filter */}
              {['consumo_frota', 'consumo_empresa', 'consumo_periodo', 'lubrificacao_frota', 'presenca_lista', 'apontamentos_ramos'].includes(reportType) && (
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-500">Responsável / Operador</label>
                  <input type="text" placeholder="Pesquise por nome..." value={filtroResponsavel} onChange={e => setFiltroResponsavel(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
                </div>
              )}

            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clearReportFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-950 border border-slate-800 text-slate-300 hover:border-emerald-500 hover:text-emerald-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                <FilterX className="w-3.5 h-3.5" />
                Limpar filtros
              </button>
            </div>
          </div>

          {/* Results Visual Viewport Card */}
          <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden p-6 space-y-4" id="report-view-canvas">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest block font-mono">RENEA INFRAESTRUTURA</span>
                <h2 className="text-base font-extrabold text-white">
                  {reportType === 'consumo_frota' && `Relatório de Consumo por Frota (${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')})`}
                  {reportType === 'consumo_empresa' && `Volume Segregado por Empresa Proprietária`}
                  {reportType === 'consumo_periodo' && `Extrato Cronológico Geral de Abastecimentos`}
                  {reportType === 'lubrificacao_frota' && `Intervenções de Lubrificação e Óleos aplicados`}
                  {reportType === 'equipamentos_mobilizados' && `Frota Ativa Mobilizada em Canteiros`}
                  {reportType === 'equipamentos_manutencao' && `Equipamentos Parados em Oficina`}
                  {reportType === 'resumo_obra' && `Consolidado Operacional por Canteiro`}
                  {reportType === 'presenca_lista' && `Lista de Presença (${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')})`}
                  {reportType === 'apontamentos_ramos' && `Apontamentos por Ramo (${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')})`}
                </h2>
              </div>
              
              <div className="text-right">
                <span className="text-xxs text-slate-500 font-mono block">EMITIDO EM: {new Date().toLocaleDateString('pt-BR')}</span>
                <span className="text-xs font-black text-white font-mono">{results.length} Registros</span>
              </div>
            </div>

            {/* Results Output Rendering */}
            {invalidDateRange ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-8 text-center text-sm font-bold text-rose-300">
                A data inicial não pode ser posterior à data final.
              </div>
            ) : results.length === 0 ? (
              <div className="py-16 text-center text-slate-500 italic">
                Nenhum resultado correspondente para os filtros selecionados. Altere o período de datas ou termos para buscar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                
                {reportType === 'consumo_frota' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                        <th className="pb-3 px-3">Frota</th>
                        <th className="pb-3 px-3">Descrição</th>
                        <th className="pb-3 px-3">Empresa</th>
                        {produtoColunas.map(nome => (
                          <th key={nome} className="pb-3 px-3 text-right">{nome}</th>
                        ))}
                        <th className="pb-3 px-3">Localização</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      <tr className="bg-slate-950/40 font-black">
                        <td className="py-2.5 px-3" colSpan={3}>TOTAIS</td>
                        {produtoColunas.map(nome => (
                          <td key={nome} className="py-2.5 px-3 text-right text-emerald-400 font-mono">{formatFuelReportNumber(produtoTotais[nome])}</td>
                        ))}
                        <td className="py-2.5 px-3" />
                      </tr>
                      {(results as any[]).map(r => (
                        <tr key={r.eq.id} className="hover:bg-slate-950/20">
                          <td className="py-3 px-3 font-mono font-black text-emerald-400">{r.eq.prefixo}</td>
                          <td className="py-3 px-3 text-slate-200 font-bold">{r.eq.nome}</td>
                          <td className="py-3 px-3 text-slate-400">{r.company}</td>
                          {produtoColunas.map(nome => (
                            <td key={nome} className="py-3 px-3 text-right text-white font-mono">
                              {r.produtos[nome] !== undefined ? formatFuelReportNumber(r.produtos[nome]) : '-'}
                            </td>
                          ))}
                          <td className="py-3 px-3 text-slate-300">{r.localizacao}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {reportType === 'consumo_empresa' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                        <th className="pb-3 px-3">Empresa Vinculada</th>
                        <th className="pb-3 px-3 text-center">Nº Lançamentos</th>
                        <th className="pb-3 px-3 text-right">Volume Abastecido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {(results as any[]).map(r => (
                        <tr key={r.companyName} className="hover:bg-slate-950/20">
                          <td className="py-3.5 px-3 font-bold text-slate-200">{r.companyName}</td>
                          <td className="py-3.5 px-3 text-center text-slate-400 font-mono">{r.countAbas}</td>
                          <td className="py-3.5 px-3 text-right text-emerald-400 font-mono font-black text-sm">{r.liters.toLocaleString('pt-BR')} L</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {reportType === 'consumo_periodo' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                        <th className="pb-3 px-3">Data/Hora</th>
                        <th className="pb-3 px-3">Frota</th>
                        <th className="pb-3 px-3">Combustível</th>
                        <th className="pb-3 px-3">Bomba Inicial/Final</th>
                        <th className="pb-3 px-3 text-center">Litros</th>
                        <th className="pb-3 px-3">Responsável</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {(results as any[]).map(ab => {
                        const eq = equipamentos.find(e => e.id === ab.equipamentoId);
                        const comb = combustiveis.find(t => t.id === ab.tipoCombustivelId)?.nome || 'Diesel';
                        return (
                          <tr key={ab.id} className="hover:bg-slate-950/20">
                            <td className="py-3 px-3 text-slate-300 font-mono">
                              <span className="font-bold text-slate-100">{ab.data.split('-').reverse().join('/')}</span>
                              <span className="text-[10px] text-slate-500 block">{ab.hora}</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-mono font-black text-emerald-400 mr-1.5">{eq ? eq.prefixo : ab.prefixoInformado || 'FROTA'}</span>
                              <span className="text-slate-400 truncate max-w-[120px] inline-block align-bottom">{eq ? eq.nome : 'Pendente de cadastro'}</span>
                            </td>
                            <td className="py-3 px-3 text-slate-300 font-semibold">{comb}</td>
                            <td className="py-3 px-3 text-slate-400 font-mono text-[10px]">
                              {ab.bombaInicial.toLocaleString('pt-BR')} → {ab.bombaFinal.toLocaleString('pt-BR')} L
                            </td>
                            <td className="py-3 px-3 text-center text-emerald-400 font-black font-mono">{ab.quantidadeLitros.toLocaleString('pt-BR')} L</td>
                            <td className="py-3 px-3 text-slate-400">{ab.responsavel}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {reportType === 'lubrificacao_frota' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                        <th className="pb-3 px-3">Data</th>
                        <th className="pb-3 px-3">Frota</th>
                        <th className="pb-3 px-3">Produto Lubrificante</th>
                        <th className="pb-3 px-3">Compartimento</th>
                        <th className="pb-3 px-3 text-center">Quantidade</th>
                        <th className="pb-3 px-3">Técnico</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {(results as any[]).map(lub => {
                        const eq = equipamentos.find(e => e.id === lub.equipamentoId);
                        const prod = lubrificantes.find(p => p.id === lub.produtoLubrificacaoId)?.nome || '—';
                        return (
                          <tr key={lub.id} className="hover:bg-slate-950/20">
                            <td className="py-3.5 px-3 font-mono text-slate-200">{lub.data.split('-').reverse().join('/')}</td>
                            <td className="py-3.5 px-3">
                              <span className="font-mono font-black text-emerald-400 mr-1.5">{eq ? eq.prefixo : 'FROTA'}</span>
                              <span className="text-slate-400 text-xxs">{eq ? eq.nome : '—'}</span>
                            </td>
                            <td className="py-3.5 px-3 font-bold text-slate-300">{prod}</td>
                            <td className="py-3.5 px-3 text-slate-300">{lub.compartimento}</td>
                            <td className="py-3.5 px-3 text-center text-emerald-400 font-mono font-bold">{lub.quantidade} L/kg</td>
                            <td className="py-3.5 px-3 text-slate-400">{lub.responsavel}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {(reportType === 'equipamentos_mobilizados' || reportType === 'equipamentos_manutencao') && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                        <th className="pb-3 px-3">Prefixo</th>
                        <th className="pb-3 px-3">Equipamento</th>
                        <th className="pb-3 px-3">Marca/Modelo</th>
                        <th className="pb-3 px-3">Placa/Série</th>
                        <th className="pb-3 px-3">Canteiro Atual</th>
                        <th className="pb-3 px-3">Proprietário</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {(results as any[]).map(eq => {
                        const emp = empresas.find(e => e.id === eq.empresaId)?.nome || 'Terceirizado';
                        const site = obras.find(o => o.id === eq.localAtualId)?.nome || '—';
                        return (
                          <tr key={eq.id} className="hover:bg-slate-950/20">
                            <td className="py-3.5 px-3 font-mono font-black text-emerald-400">{eq.prefixo}</td>
                            <td className="py-3.5 px-3 font-bold text-slate-200">{eq.nome}</td>
                            <td className="py-3.5 px-3 text-slate-300">{eq.marca} • {eq.modelo}</td>
                            <td className="py-3.5 px-3 text-slate-500 font-mono uppercase text-xxs">
                              {[eq.placa ? `Placa: ${eq.placa}` : '', eq.seriePlaca ? `Série: ${eq.seriePlaca}` : ''].filter(Boolean).join(' / ') || '—'}
                            </td>
                            <td className="py-3.5 px-3 text-slate-300">{site}</td>
                            <td className="py-3.5 px-3 text-slate-400 truncate max-w-[150px]">{emp}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {reportType === 'resumo_obra' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                        <th className="pb-3 px-3">Canteiro</th>
                        <th className="pb-3 px-3 text-center">Frota ativa</th>
                        <th className="pb-3 px-3 text-center">Parados</th>
                        <th className="pb-3 px-3 text-right">Combustível</th>
                        <th className="pb-3 px-3 text-right">Lubrificação</th>
                        <th className="pb-3 px-3 text-center">Presença</th>
                        <th className="pb-3 px-3 text-center">Apontamentos</th>
                        <th className="pb-3 px-3 text-center">M.O.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {(results as any[]).map(item => (
                        <tr key={item.site.id} className="hover:bg-slate-950/20">
                          <td className="py-4 px-3 font-bold text-slate-100 text-sm">{item.site.nome}</td>
                          <td className="py-4 px-3 text-center text-emerald-400 font-mono font-black">{item.activeEquipment}</td>
                          <td className="py-4 px-3 text-center text-amber-300 font-mono font-bold">{item.maintenanceEquipment}</td>
                          <td className="py-4 px-3 text-right text-slate-200 font-mono font-bold">{formatFuelReportNumber(item.fuelLiters)} L</td>
                          <td className="py-4 px-3 text-right text-slate-300 font-mono">{formatFuelReportNumber(item.lubricationQuantity)}</td>
                          <td className="py-4 px-3 text-center text-slate-300 font-mono">{item.presentPeople}/{item.presenceRecords}</td>
                          <td className="py-4 px-3 text-center text-slate-300 font-mono">{item.pointingRecords}</td>
                          <td className="py-4 px-3 text-center text-slate-300 font-mono">{item.pointedWorkers}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {reportType === 'presenca_lista' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                        <th className="pb-3 px-3">Data</th>
                        <th className="pb-3 px-3">Obra</th>
                        <th className="pb-3 px-3">Funcionário</th>
                        <th className="pb-3 px-3">Cargo</th>
                        <th className="pb-3 px-3 text-center">Situação</th>
                        <th className="pb-3 px-3">Observação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {(results as any[]).map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-950/20">
                          <td className="py-3.5 px-3 font-mono font-bold text-slate-100">{r.data.split('-').reverse().join('/')}</td>
                          <td className="py-3.5 px-3 text-slate-300">{r.obraNome}</td>
                          <td className="py-3.5 px-3 font-semibold text-slate-200">{r.funcionarioNome}</td>
                          <td className="py-3.5 px-3 text-slate-400">{r.cargo}</td>
                          <td className="py-3.5 px-3 text-center">
                            <span className={`text-xxs px-2 py-0.5 border rounded font-bold ${r.presente ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-rose-500/30 bg-rose-500/10 text-rose-400'}`}>
                              {r.presente ? 'PRESENTE' : 'AUSENTE'}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-slate-500 text-xxs">{r.observacao || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {reportType === 'apontamentos_ramos' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                        <th className="pb-3 px-3">Data/Hora</th>
                        <th className="pb-3 px-3">Canteiro/Ramo</th>
                        <th className="pb-3 px-3">Empresa</th>
                        <th className="pb-3 px-3">Apontador</th>
                        <th className="pb-3 px-3 text-center">Funções</th>
                        <th className="pb-3 px-3 text-center">Equip.</th>
                        <th className="pb-3 px-3">Tempo/Condição</th>
                        <th className="pb-3 px-3">Atividade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {(results as any[]).map(r => (
                        <tr key={r.id} className="hover:bg-slate-950/20">
                          <td className="py-3.5 px-3 font-mono">
                            <span className="font-bold text-slate-100 block">{r.data.split('-').reverse().join('/')}</span>
                            <span className="text-[10px] text-slate-500">{r.horaEnvio}</span>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="font-black text-emerald-300 block">{r.canteiroNome}</span>
                            <span className="text-slate-400">{r.ramoNome}</span>
                          </td>
                          <td className="py-3.5 px-3 text-slate-300">{r.empresa || '—'}</td>
                          <td className="py-3.5 px-3 text-slate-300">
                            <span className="font-bold text-slate-100 block">{r.responsavel || '—'}</span>
                            <span className="text-[10px] text-slate-500">{r.funcaoApontador || 'Apontador'}</span>
                          </td>
                          <td className="py-3.5 px-3 text-center text-white font-mono font-black">{totalQuantidade(r.funcoes)}</td>
                          <td className="py-3.5 px-3 text-center text-white font-mono font-black">{totalQuantidade(r.equipamentos)}</td>
                          <td className="py-3.5 px-3 text-slate-500 text-[10px]">{`M: ${r.clima.Manhã}/${r.condicao.Manhã} | T: ${r.clima.Tarde}/${r.condicao.Tarde} | N: ${r.clima.Noite}/${r.condicao.Noite}`}</td>
                          <td className="py-3.5 px-3 text-slate-300 max-w-sm">{r.descricaoAtividade || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
