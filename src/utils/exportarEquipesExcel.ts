import type { Empresa, Funcionario, GrupoEquipe } from '../types';
import { addCorporateSummarySheet, configureCorporateWorkbook, createCorporateWorkbook, downloadCorporateWorkbook, styleCorporateWorksheet } from './excelCorporate';
import { linhasDasEquipes, SEM_EQUIPE } from './exportarEquipes';

/** Baixa o Excel com cada pessoa e a sua equipe (aba Equipes e Presença > Equipes). */
export const baixarPlanilhaEquipes = async (
  grupos: GrupoEquipe[],
  funcionarios: Funcionario[],
  empresas: Empresa[],
  dia: string,
) => {
  const titulo = 'Equipes e colaboradores';
  const linhas = linhasDasEquipes(grupos, funcionarios, empresas);
  const workbook = await createCorporateWorkbook();
  configureCorporateWorkbook(workbook, titulo);
  const sheet = workbook.addWorksheet('Equipes');
  sheet.columns = [
    { header: 'Equipe', key: 'equipe', width: 28 },
    { header: 'Situação da equipe', key: 'situacaoEquipe', width: 16 },
    { header: 'Frente', key: 'frente', width: 28 },
    { header: 'Encarregado', key: 'encarregado', width: 28 },
    { header: 'Matrícula', key: 'matricula', width: 12 },
    { header: 'Colaborador', key: 'colaborador', width: 34 },
    { header: 'Função', key: 'funcao', width: 28 },
    { header: 'Empresa', key: 'empresa', width: 26 },
    { header: 'Situação', key: 'situacao', width: 16 },
  ];
  linhas.forEach(linha => sheet.addRow(linha));
  styleCorporateWorksheet(sheet, { title: titulo, headerRow: 1, lastColumn: 9, recordCount: linhas.length });
  addCorporateSummarySheet(workbook, titulo, [
    ['Equipes', grupos.length],
    ['Colaboradores em equipe', linhas.filter(linha => linha.equipe !== SEM_EQUIPE).length],
    ['Ativos sem equipe', linhas.filter(linha => linha.equipe === SEM_EQUIPE).length],
    ['Data de referência', dia.split('-').reverse().join('/')],
  ]);
  await downloadCorporateWorkbook(workbook, `RENEA_equipes_${dia}.xlsx`);
};
