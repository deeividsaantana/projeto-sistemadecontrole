import { useRef, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { lerPlanilhaMateriais } from '../imports/lerPlanilhaMateriais';
import type { ImportDisposition, ImportPreview } from '../imports/types';
import type { Material, MovimentoMaterial } from '../types';
import { buildMaterialImportApplication } from '../imports/materialImportApplication';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CARTAO, FOCO } from './cadastros/estilos';

interface Props {
  movimentos: MovimentoMaterial[];
  materiais: Material[];
  responsavel: string;
  /** Ramos cadastrados: o local de aplicação com o mesmo nome já entra vinculado. */
  etapas?: ReadonlyArray<{ id: string; nome: string }>;
  onApply: (materials: Material[], movements: MovimentoMaterial[]) => void;
  onError: (message: string) => void;
}

// O que cada situação da leitura quer dizer, em palavras de quem usa. Só as
// linhas novas são gravadas; o resto aparece para a pessoa saber por quê.
const SITUACOES: ReadonlyArray<{ id: ImportDisposition; rotulo: string; tom: string }> = [
  { id: 'new', rotulo: 'Vão entrar', tom: 'text-[#176b4d]' },
  { id: 'unchanged', rotulo: 'Já estavam no app', tom: 'text-slate-700' },
  { id: 'potential-update', rotulo: 'Já estavam, com diferença', tom: 'text-amber-700' },
  { id: 'duplicate-in-file', rotulo: 'Repetidas na planilha', tom: 'text-slate-700' },
  { id: 'review', rotulo: 'Com dado faltando', tom: 'text-amber-700' },
  { id: 'invalid', rotulo: 'Não dá para ler', tom: 'text-rose-700' },
  { id: 'deferred', rotulo: 'Ficam para depois', tom: 'text-slate-700' },
];

const PROBLEMAS: ReadonlySet<ImportDisposition> = new Set(['review', 'invalid', 'potential-update']);

/**
 * Importar planilha de materiais em dois passos: escolher o arquivo e
 * confirmar. A leitura mostra quantas linhas vão entrar e por que as outras
 * ficam de fora; nada é gravado antes do botão Importar.
 */
export default function MateriaisImportacoesPanel({ movimentos, materiais, responsavel, etapas = [], onApply, onError }: Props) {
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [leitura, setLeitura] = useState<ImportPreview<unknown> | null>(null);
  const [aviso, setAviso] = useState('');
  const [abasFora, setAbasFora] = useState<Set<string>>(new Set());
  const [lendo, setLendo] = useState(false);
  const [resultado, setResultado] = useState('');

  const recomecar = () => {
    setLeitura(null);
    setAviso('');
    setAbasFora(new Set());
  };

  const ler = async (arquivo: File) => {
    setLendo(true);
    recomecar();
    setResultado('');
    try {
      const { preview, truncatedSheets } = await lerPlanilhaMateriais(arquivo, movimentos);
      setNomeArquivo(arquivo.name);
      setLeitura(preview);
      if (truncatedSheets?.length) {
        setAviso(`Parte da planilha ficou de fora porque a aba era grande demais: ${truncatedSheets
          .map(aba => `${aba.sheetName} (${aba.keptRows.toLocaleString('pt-BR')} de ${aba.originalRowsDeclared.toLocaleString('pt-BR')} linhas lidas)`)
          .join('; ')}. Confira se há viagem depois desse ponto.`);
      }
    } catch (erro) {
      onError(erro instanceof Error ? erro.message : 'Não foi possível ler a planilha. Confira se é um arquivo do Excel (.xlsx).');
    } finally {
      setLendo(false);
    }
  };

  const linhas = leitura ? leitura.rows.filter(item => !abasFora.has(item.row.lineage.sourceSheet)) : [];
  const contagem = linhas.reduce<Partial<Record<ImportDisposition, number>>>((acc, item) => {
    acc[item.disposition] = (acc[item.disposition] ?? 0) + 1;
    return acc;
  }, {});
  const novas = contagem.new ?? 0;
  const abasComLinhas = leitura ? [...new Set(leitura.rows.map(item => item.row.lineage.sourceSheet))] : [];
  const abasIgnoradas = leitura ? leitura.sheets.filter(aba => !aba.recognized && aba.rowCount > 0) : [];
  const comProblema = linhas.filter(item => PROBLEMAS.has(item.disposition));

  const alternarAba = (aba: string) => setAbasFora(atual => {
    const proxima = new Set(atual);
    if (proxima.has(aba)) proxima.delete(aba); else proxima.add(aba);
    return proxima;
  });

  const importar = () => {
    if (!leitura || novas === 0) return;
    const aplicado = buildMaterialImportApplication({ ...leitura, rows: linhas }, materiais, movimentos, responsavel, etapas);
    onApply(aplicado.materials, aplicado.movements);
    // Nenhuma linha some em silêncio: o resumo diz o que entrou e o que ficou de fora.
    setResultado(
      `Entraram ${aplicado.movements.length.toLocaleString('pt-BR')} movimento(s) e ${aplicado.materials.length.toLocaleString('pt-BR')} material(is) novo(s). `
      + `Ficaram de fora ${aplicado.skipped.duplicate.toLocaleString('pt-BR')} que já estavam no app ou repetidas e ${aplicado.skipped.review.toLocaleString('pt-BR')} com dado faltando`
      + `${aplicado.skipped.other ? `, mais ${aplicado.skipped.other.toLocaleString('pt-BR')} por outro motivo` : ''}.`,
    );
    recomecar();
  };

  return (
    <div className="space-y-4">
      {resultado && (
        <p role="status" data-materiais-reveal className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#176b4d]" aria-hidden="true" />
          {resultado}
        </p>
      )}

      {!leitura && (
        <section data-materiais-reveal className={`${CARTAO} p-5`} aria-labelledby="materiais-importar-titulo">
          <h2 id="materiais-importar-titulo" className="text-lg font-bold text-slate-900">Importar planilha de materiais</h2>
          <p className="mt-1 max-w-[65ch] text-sm text-slate-600">
            Serve para a planilha de agregados e a de recebimento. O app lê o arquivo inteiro, mostra quantas linhas vão entrar e só grava quando você apertar Importar. Viagem que já está no app não entra de novo.
          </p>
          <button
            type="button"
            disabled={lendo}
            onClick={() => arquivoRef.current?.click()}
            className={`mt-4 flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 text-center transition duration-200 hover:border-[#176b4d] hover:bg-emerald-50 disabled:cursor-wait ${FOCO}`}
          >
            {lendo ? (
              <>
                <Loader2 className="size-7 text-[#176b4d] motion-safe:animate-spin" aria-hidden="true" />
                <span className="text-base font-bold text-slate-800">Lendo a planilha...</span>
                <span className="text-sm text-slate-500">Planilha grande leva alguns segundos. A tela continua funcionando.</span>
              </>
            ) : (
              <>
                <Upload className="size-7 text-[#176b4d]" aria-hidden="true" />
                <span className="text-base font-bold text-slate-800">Escolher planilha do Excel</span>
                <span className="text-sm text-slate-500">Arquivo .xlsx</span>
              </>
            )}
          </button>
          <input
            ref={arquivoRef}
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            aria-label="Planilha de materiais"
            onChange={event => { const arquivo = event.target.files?.[0]; event.target.value = ''; if (arquivo) void ler(arquivo); }}
          />
        </section>
      )}

      {leitura && (
        <section data-materiais-reveal className={`${CARTAO} space-y-4 p-5`} aria-labelledby="materiais-conferir-titulo">
          <div>
            <h2 id="materiais-conferir-titulo" className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <FileSpreadsheet className="size-5 shrink-0 text-[#176b4d]" aria-hidden="true" />
              <span className="min-w-0 truncate">{nomeArquivo}</span>
            </h2>
            <p className="mt-1 text-sm text-slate-600">Confira os números. Nada foi gravado ainda.</p>
          </div>

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {SITUACOES.filter(situacao => situacao.id === 'new' || contagem[situacao.id]).map(situacao => (
              <div key={situacao.id} className={`rounded-xl border p-3 ${situacao.id === 'new' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                <dt className="text-sm font-semibold text-slate-600">{situacao.rotulo}</dt>
                <dd className={`text-2xl font-black tabular-nums ${situacao.tom}`}>{(contagem[situacao.id] ?? 0).toLocaleString('pt-BR')}</dd>
              </div>
            ))}
          </dl>

          {abasComLinhas.length > 1 && (
            <fieldset>
              <legend className="text-sm font-semibold text-slate-700">Abas que vão entrar (desmarque para deixar uma de fora)</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {abasComLinhas.map(aba => {
                  const dentro = !abasFora.has(aba);
                  return (
                    <label key={aba} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition duration-200 ${dentro ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-slate-50 text-slate-400 line-through'}`}>
                      <input type="checkbox" checked={dentro} onChange={() => alternarAba(aba)} className="size-4 accent-[#176b4d]" />
                      {aba}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {abasIgnoradas.length > 0 && (
            <p className="text-sm text-slate-600">
              O app não reconhece e deixa de fora: {abasIgnoradas.map(aba => aba.sheetName).join(', ')}.
            </p>
          )}

          {aviso && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{aviso}</p>}

          {comProblema.length > 0 && (
            <details className="rounded-xl border border-slate-200">
              <summary className={`min-h-11 cursor-pointer rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 ${FOCO}`}>
                Ver as {comProblema.length.toLocaleString('pt-BR')} linha(s) que não vão entrar por problema
              </summary>
              <ul className="max-h-72 divide-y divide-slate-100 overflow-auto border-t border-slate-200">
                {comProblema.slice(0, 200).map(item => (
                  <li key={`${item.row.lineage.sourceSheet}-${item.row.lineage.sourceRow}`} className="px-3 py-2 text-sm">
                    <strong className="text-slate-800">{item.row.lineage.sourceSheet}, linha {item.row.lineage.sourceRow}</strong>
                    {item.row.lineage.validationMessages.length > 0 && <span className="block text-slate-600">{item.row.lineage.validationMessages.join(' ')}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={recomecar} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button type="button" onClick={importar} disabled={novas === 0} data-testid="materiais-importar-confirmar" className={`${BOTAO_PRIMARIO} px-5`}>
              {novas === 0 ? 'Nada novo para importar' : `Importar ${novas.toLocaleString('pt-BR')} linha(s)`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
