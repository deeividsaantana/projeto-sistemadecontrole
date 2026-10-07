import { useRef, useState, type ReactNode } from 'react';
import type { ControleEquipamentoDiario, Empresa, Equipamento, Funcionario } from '../../types';
import {
  preverCadastroSge,
  preverImportacaoSge,
  registrosParaAplicar,
  rotuloImportacaoSge,
  type LinhaBrutaSge,
  type PreviaCadastroSge,
  type PreviaImportacaoSge,
} from '../../fleet/sgeApontamentos';
import { loadValidatedWorkbook } from '../../utils/excelCorporate';
import { FOCO, TOM_SITUACAO } from '../cadastros/estilos';
import FleetImportPreviewModal, { type FleetImportPreviewRow } from './FleetImportPreviewModal';
import CadastroSgePrevia from './CadastroSgePrevia';

export type TomMensagemSge = 'success' | 'error' | 'info';

interface Props {
  equipamentos: readonly Equipamento[];
  registros: readonly ControleEquipamentoDiario[];
  /** Motoristas operacionais da Frota: é com eles que os lançamentos do dia casam o operador. */
  motoristas: readonly Funcionario[];
  /** Cadastro completo de colaboradores: é com ele que o motorista do equipamento é vinculado. */
  funcionarios: readonly Funcionario[];
  /** Para cadastrar máquina nova do SGE com a empresa certa. */
  empresas?: readonly Empresa[];
  onImport: (registros: ControleEquipamentoDiario[]) => void;
  onApplyCadastroSge?: (previa: PreviaCadastroSge) => void;
  /** No Quadro da Frota a planilha serve para atualizar o cadastro; os lançamentos vêm desmarcados. */
  importarLancamentosPorPadrao?: boolean;
  onMensagem: (tom: TomMensagemSge, texto: string) => void;
  /** O botão de abrir fica a cargo de cada tela, para caber no menu dela. */
  gatilho: (abrir: () => void) => ReactNode;
}

const textoDe = (valor: unknown): string => String(valor ?? '').trim();
const celula = (row: { getCell: (indice: number) => { value: unknown } }, indice: number): unknown => row.getCell(indice).value;

// Colunas identificadas pelo texto do cabeçalho, não pela posição: a planilha do
// SGE muda de layout entre exportações, mas os nomes das colunas se mantêm.
const ALVOS: Record<string, RegExp> = {
  data: /^data$/i,
  uaEquipamento: /ua\s*equipamento/i,
  descricaoEquipamento: /descri[cç][aã]o.*equipamento/i,
  empresa: /^empresa$/i,
  horimetroInicial: /hor[ií]metro\s*inicial/i,
  horimetroFinal: /hor[ií]metro\s*final/i,
  horasHorimetro: /horas\s*hor[ií]metro/i,
  matriculaOperador: /matr[ií]cula.*operador/i,
  nomeOperador: /nome.*operador/i,
  observacoes: /observa/i,
};

const lerLinhasSge = async (arquivo: File): Promise<LinhaBrutaSge[]> => {
  const workbook = await loadValidatedWorkbook(arquivo);
  const sheet = workbook.worksheets.find(item => /apontad/i.test(item.name)) || workbook.worksheets[0];
  if (!sheet) throw new Error('Nenhuma aba com dados foi encontrada.');
  let colunas: Record<string, number> = {};
  let headerRow = 0;
  for (let numero = 1; numero <= 20 && !headerRow; numero += 1) {
    const linhaCabecalho = sheet.getRow(numero);
    const achadas: Record<string, number> = {};
    for (let indice = 1; indice <= 15; indice += 1) {
      const texto = textoDe(linhaCabecalho.getCell(indice).value);
      if (!texto) continue;
      Object.entries(ALVOS).forEach(([chave, regex]) => {
        if (!achadas[chave] && regex.test(texto)) achadas[chave] = indice;
      });
    }
    if (achadas.data && achadas.uaEquipamento) {
      headerRow = numero;
      colunas = achadas;
    }
  }
  if (!headerRow) throw new Error('Não encontrei as colunas "Data" e "UA Equipamento" nesta planilha.');
  const linhas: LinhaBrutaSge[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const valores = Object.values(colunas).map(indice => textoDe(celula(row, indice)));
    if (!valores.some(Boolean) || valores.join(' ').toLocaleLowerCase('pt-BR').includes('total geral')) return;
    linhas.push({
      linha: rowNumber,
      data: celula(row, colunas.data),
      uaEquipamento: celula(row, colunas.uaEquipamento),
      descricaoEquipamento: colunas.descricaoEquipamento ? celula(row, colunas.descricaoEquipamento) : '',
      empresa: colunas.empresa ? celula(row, colunas.empresa) : '',
      horimetroInicial: colunas.horimetroInicial ? celula(row, colunas.horimetroInicial) : '',
      horimetroFinal: colunas.horimetroFinal ? celula(row, colunas.horimetroFinal) : '',
      horasHorimetro: colunas.horasHorimetro ? celula(row, colunas.horasHorimetro) : '',
      matriculaOperador: colunas.matriculaOperador ? celula(row, colunas.matriculaOperador) : '',
      nomeOperador: colunas.nomeOperador ? celula(row, colunas.nomeOperador) : '',
      observacoes: colunas.observacoes ? celula(row, colunas.observacoes) : '',
    });
  });
  if (!linhas.length) throw new Error('Nenhuma linha de apontamento encontrada nesta planilha.');
  return linhas;
};

/**
 * Importação do "Equipamentos Apontados" do SGE, igual no Controle de Frotas e
 * no Quadro da Frota: lê a planilha, mostra a prévia (lançamentos do dia e
 * cadastro dos equipamentos) e só grava o que ficar marcado.
 */
export default function ImportacaoSge({
  equipamentos,
  registros,
  motoristas,
  funcionarios,
  empresas = [],
  onImport,
  onApplyCadastroSge,
  importarLancamentosPorPadrao = true,
  onMensagem,
  gatilho,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<PreviaImportacaoSge>();
  const [cadastro, setCadastro] = useState<PreviaCadastroSge>();
  const [arquivo, setArquivo] = useState('');
  const [atualizarCadastro, setAtualizarCadastro] = useState(true);
  const [importarLancamentos, setImportarLancamentos] = useState(importarLancamentosPorPadrao);

  const ler = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    onMensagem('info', 'Lendo o apontamento do SGE...');
    try {
      const linhas = await lerLinhasSge(file);
      setArquivo(file.name);
      setPrevia(preverImportacaoSge({ linhas, equipamentos, registros, motoristas }));
      setCadastro(onApplyCadastroSge ? preverCadastroSge({ linhas, equipamentos, funcionarios, empresas }) : undefined);
      setAtualizarCadastro(true);
      setImportarLancamentos(importarLancamentosPorPadrao);
      onMensagem('info', '');
    } catch (error) {
      onMensagem('error', error instanceof Error ? error.message : 'Falha ao validar o apontamento do SGE.');
    }
  };

  const fechar = () => {
    setPrevia(undefined);
    setCadastro(undefined);
    setArquivo('');
  };
  const cadastroParaAplicar = atualizarCadastro && cadastro?.alteracoes.length ? cadastro : undefined;
  const lancamentos = importarLancamentos && previa?.podeAplicar ? previa.novos + previa.atualizados : 0;
  const aplicar = () => {
    if (!previa || (!lancamentos && !cadastroParaAplicar)) return;
    if (lancamentos) onImport(registrosParaAplicar(previa));
    if (cadastroParaAplicar) onApplyCadastroSge?.(cadastroParaAplicar);
    onMensagem('success', [
      lancamentos ? `Apontamento do SGE importado · ${previa.novos} novo(s) · ${previa.atualizados} atualizado(s) · ${previa.protegidos} protegido(s) por lançamento manual · ${previa.duplicados} duplicado(s) no arquivo · ${previa.comErro} com erro.` : '',
      cadastroParaAplicar ? `Cadastro: ${cadastroParaAplicar.equipamentosNovos} equipamento(s) novo(s), ${cadastroParaAplicar.equipamentosReativados} de volta ao quadro, ${cadastroParaAplicar.motoristasVinculados} motorista(s) vinculado(s) e ${cadastroParaAplicar.horimetrosAtualizados} horímetro(s) atualizado(s).` : '',
    ].filter(Boolean).join(' '));
    fechar();
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={ler} data-testid="sge-arquivo" />
      {gatilho(() => inputRef.current?.click())}
      <FleetImportPreviewModal
        open={Boolean(previa)}
        title={`Conferir o apontamento do SGE${arquivo ? `: ${arquivo}` : ''}`}
        description="Nada entra no sistema antes de você confirmar. Lançamentos manuais e máquinas em manutenção nunca são sobrescritos."
        stats={previa ? [
          { label: 'Novos', value: previa.novos, tone: TOM_SITUACAO.ok },
          { label: 'Atualizações', value: previa.atualizados, tone: 'bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200' },
          { label: 'Protegidos', value: previa.protegidos, tone: TOM_SITUACAO.inativo },
          { label: 'Duplicados no dia', value: previa.duplicados, tone: TOM_SITUACAO.alerta },
          { label: 'Com erro', value: previa.comErro, tone: 'bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-200' },
        ] : []}
        rows={(previa?.linhas || []).map((item): FleetImportPreviewRow => ({
          key: `${item.linha}-${item.chave}`,
          rowNumber: item.linha,
          dispositionLabel: ({ NOVO: 'Novo', ATUALIZA: 'Atualiza', PROTEGIDO: 'Protegido', DUPLICADO: 'Duplicado', ERRO: 'Erro' } as Record<string, string>)[item.disposicao] || item.disposicao,
          prefixo: item.registro?.prefixo || '',
          pessoa: item.registro?.nomeMotorista || '',
          data: item.registro?.data || '',
          messages: item.mensagens.join(' '),
        }))}
        applyCount={(previa?.novos || 0) + (previa?.atualizados || 0)}
        applyLabel={cadastro ? rotuloImportacaoSge(lancamentos, cadastroParaAplicar?.alteracoes.length || 0) : undefined}
        canApply={Boolean(lancamentos || cadastroParaAplicar)}
        onClose={fechar}
        onApply={aplicar}
      >
        {cadastro && previa && (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
            <input
              type="checkbox"
              checked={importarLancamentos && previa.podeAplicar}
              disabled={!previa.podeAplicar}
              onChange={event => setImportarLancamentos(event.target.checked)}
              className={`mt-0.5 size-5 shrink-0 rounded accent-emerald-700 ${FOCO}`}
            />
            <span>
              <span className="block text-sm font-bold text-slate-800">Importar os lançamentos do dia</span>
              <span className="block text-xs text-slate-600">
                {previa.podeAplicar
                  ? `Cria ${previa.novos + previa.atualizados} lançamento(s) da lista acima no Controle de Frotas. Desmarque para mexer só no cadastro.`
                  : 'Nenhum lançamento novo para importar desta planilha.'}
              </span>
            </span>
          </label>
        )}
        {cadastro && <CadastroSgePrevia previa={cadastro} marcado={atualizarCadastro} onMarcar={setAtualizarCadastro} />}
      </FleetImportPreviewModal>
    </>
  );
}
