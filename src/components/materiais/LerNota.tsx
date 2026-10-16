import { useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Camera, FileText, Loader2, Trash2 } from 'lucide-react';
import type { Empresa, Material, MovimentoMaterial } from '../../types';
import { entradasDaNota, fornecedorDaNota, lerTextoNota, materialParecido, numeroBr, type NotaLida } from '../../utils/leituraNota';
import { textoDaNota } from '../../services/textoDaNota';
import { numero } from '../../utils/formato';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO, reduzMovimento } from '../cadastros/estilos';
import CampoEscolha from './CampoEscolha';

interface Linha {
  chave: number;
  descricaoNota: string;
  unidadeNota: string;
  materialId: string;
  quantidade: string;
  valorUnitario: string;
}

interface Props {
  hoje: string;
  materiais: readonly Material[];
  empresas: readonly Empresa[];
  responsavel: string;
  onSalvar: (movimentos: MovimentoMaterial[], descricao: string) => void;
}

const texto = (valor: number) => (valor ? String(valor).replace('.', ',') : '');

/**
 * Ler nota: a pessoa manda a foto ou o PDF, o aparelho lê o texto e monta as
 * entradas. Nada entra no estoque sem a pessoa conferir material e quantidade
 * linha a linha e apertar "Lançar".
 */
export default function LerNota({ hoje, materiais, empresas, responsavel, onSalvar }: Props) {
  const [lendo, setLendo] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [nota, setNota] = useState<Pick<NotaLida, 'numero' | 'dataEmissao' | 'fornecedorNome'> | null>(null);
  const [fornecedorId, setFornecedorId] = useState('');
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const foto = useRef<HTMLInputElement>(null);
  const pdf = useRef<HTMLInputElement>(null);
  const raiz = useRef<HTMLDivElement>(null);

  const opcoesMaterial = useMemo(() => materiais.map(item => ({ id: item.id, nome: item.descricao, apelido: item.codigo })), [materiais]);
  const opcoesFornecedor = useMemo(() => empresas.map(item => ({ id: item.id, nome: item.nome, apelido: item.cnpj })), [empresas]);

  useGSAP(() => {
    if (!nota || reduzMovimento()) return;
    gsap.fromTo('[data-nota-linha]', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25, stagger: 0.04, ease: 'power2.out', clearProps: 'transform,opacity' });
  }, { scope: raiz, dependencies: [nota] });

  const abrir = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setErro('');
    setAviso('');
    setLendo('Abrindo a nota…');
    try {
      const lida = lerTextoNota(await textoDaNota(arquivo, setLendo));
      setNota({ numero: lida.numero, dataEmissao: lida.dataEmissao, fornecedorNome: lida.fornecedorNome });
      setFornecedorId(fornecedorDaNota(lida, empresas)?.id ?? '');
      setLinhas(lida.itens.map((item, chave) => ({
        chave,
        descricaoNota: item.descricao,
        unidadeNota: item.unidade,
        materialId: materialParecido(item.descricao, materiais)?.id ?? '',
        quantidade: texto(item.quantidade),
        valorUnitario: texto(item.valorUnitario),
      })));
      if (!lida.itens.length) setAviso('Não achei os itens da nota. Confira o número e a data e adicione os itens à mão.');
    } catch {
      setErro('Não consegui ler esse arquivo. Tente outra foto, mais reta e com boa luz, ou o PDF da nota.');
    } finally {
      setLendo('');
      if (foto.current) foto.current.value = '';
      if (pdf.current) pdf.current.value = '';
    }
  };

  const mudar = (chave: number, campo: keyof Linha, valor: string) => {
    setLinhas(atuais => atuais.map(linha => (linha.chave === chave ? { ...linha, [campo]: valor } : linha)));
  };

  const prontas = linhas.filter(linha => linha.materialId && numeroBr(linha.quantidade) > 0);

  const lancar = () => {
    if (!nota) return;
    if (!prontas.length) { setErro('Escolha o material e a quantidade de pelo menos uma linha.'); return; }
    const fornecedor = empresas.find(item => item.id === fornecedorId);
    const movimentos = entradasDaNota(
      nota,
      prontas.map(linha => ({ materialId: linha.materialId, quantidade: numeroBr(linha.quantidade), valorUnitario: numeroBr(linha.valorUnitario) })),
      materiais,
      fornecedor,
      { hoje, responsavel },
    );
    onSalvar(movimentos, `Nota ${nota.numero || 'sem número'}: ${movimentos.length} entrada(s)`);
    setAviso(`${movimentos.length} entrada(s) da nota ${nota.numero || ''} lançadas no estoque.`);
    setNota(null);
    setLinhas([]);
    setFornecedorId('');
  };

  return (
    <div ref={raiz} className="space-y-4">
      <section className={`${CARTAO} p-4`} aria-labelledby="ler-nota-titulo">
        <h2 id="ler-nota-titulo" className="text-base font-bold text-slate-900">Ler nota fiscal</h2>
        <p className="text-sm text-slate-500">Tire a foto da nota ou escolha o PDF. Você confere tudo antes de lançar.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" disabled={Boolean(lendo)} onClick={() => foto.current?.click()} className={`${BOTAO_PRIMARIO} min-h-14 text-base`} data-testid="ler-nota-foto">
            <Camera className="size-5 shrink-0" aria-hidden="true" /> Foto da nota
          </button>
          <button type="button" disabled={Boolean(lendo)} onClick={() => pdf.current?.click()} className={`${BOTAO_SECUNDARIO} min-h-14 text-base`} data-testid="ler-nota-pdf">
            <FileText className="size-5 shrink-0" aria-hidden="true" /> PDF da nota
          </button>
        </div>
        <input ref={foto} type="file" accept="image/*" capture="environment" className="hidden" onChange={event => abrir(event.target.files?.[0])} />
        <input ref={pdf} type="file" accept="application/pdf,.pdf" className="hidden" onChange={event => abrir(event.target.files?.[0])} />
        {lendo && <p role="status" className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#176b4d]"><Loader2 className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />{lendo}</p>}
        {erro && <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{erro}</p>}
        {aviso && <p role="status" className="mt-3 text-sm font-semibold text-slate-700">{aviso}</p>}
      </section>

      {nota && (
        <section className={`${CARTAO} overflow-hidden`} aria-labelledby="conferir-nota">
          <header className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-3">
            <h2 id="conferir-nota" className="text-base font-bold text-slate-900 sm:col-span-3">Confira antes de lançar</h2>
            <label className="grid gap-1"><span className={ROTULO}>Número da nota</span>
              <input className={CAMPO} value={nota.numero} onChange={event => setNota({ ...nota, numero: event.target.value })} inputMode="numeric" />
            </label>
            <label className="grid gap-1"><span className={ROTULO}>Data</span>
              <input className={CAMPO} type="date" value={nota.dataEmissao || hoje} onChange={event => setNota({ ...nota, dataEmissao: event.target.value })} />
            </label>
            <div className="grid gap-1"><span className={ROTULO}>Fornecedor{nota.fornecedorNome && !fornecedorId ? ` (na nota: ${nota.fornecedorNome})` : ''}</span>
              <CampoEscolha opcoes={opcoesFornecedor} valor={fornecedorId} onEscolher={setFornecedorId} vazio="Sem fornecedor" rotuloAcessivel="Fornecedor da nota" placeholder="Fornecedor" />
            </div>
          </header>

          <ol className="divide-y divide-slate-100">
            {linhas.map((linha, posicao) => (
              <li key={linha.chave} data-nota-linha className="grid gap-2 p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_7rem_7rem_auto] md:items-end">
                <p className="text-sm text-slate-600 md:self-center"><span className="font-bold text-slate-900">{posicao + 1}.</span> {linha.descricaoNota || 'Item novo'}{linha.unidadeNota ? ` (${linha.unidadeNota})` : ''}</p>
                <div className="grid gap-1"><span className={`${ROTULO} md:sr-only`}>Material</span>
                  <CampoEscolha compacto opcoes={opcoesMaterial} valor={linha.materialId} onEscolher={id => mudar(linha.chave, 'materialId', id)} rotuloAcessivel={`Material da linha ${posicao + 1}`} placeholder="Escolha o material" />
                </div>
                <label className="grid gap-1"><span className={`${ROTULO} md:sr-only`}>Quantidade</span>
                  <input className={`${CAMPO} tabular-nums`} inputMode="decimal" aria-label={`Quantidade da linha ${posicao + 1}`} value={linha.quantidade} onChange={event => mudar(linha.chave, 'quantidade', event.target.value)} />
                </label>
                <label className="grid gap-1"><span className={`${ROTULO} md:sr-only`}>Valor unitário</span>
                  <input className={`${CAMPO} tabular-nums`} inputMode="decimal" aria-label={`Valor unitário da linha ${posicao + 1}`} value={linha.valorUnitario} onChange={event => mudar(linha.chave, 'valorUnitario', event.target.value)} />
                </label>
                <button type="button" onClick={() => setLinhas(atuais => atuais.filter(item => item.chave !== linha.chave))} className={`grid min-h-11 min-w-11 place-items-center rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-700 ${FOCO}`} aria-label={`Tirar a linha ${posicao + 1}`}>
                  <Trash2 className="size-5 shrink-0" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>

          <footer className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-4">
            <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setLinhas(atuais => [...atuais, { chave: Date.now(), descricaoNota: '', unidadeNota: '', materialId: '', quantidade: '', valorUnitario: '' }])}>
              Adicionar item
            </button>
            <span className="text-sm text-slate-500">{prontas.length} de {linhas.length} prontas{prontas.length ? ` · ${numero(prontas.reduce((soma, linha) => soma + numeroBr(linha.quantidade) * numeroBr(linha.valorUnitario), 0))} em valor` : ''}</span>
            <span className="flex-1" />
            <button type="button" className={BOTAO_SECUNDARIO} onClick={() => { setNota(null); setLinhas([]); }}>Descartar</button>
            <button type="button" className={BOTAO_PRIMARIO} onClick={lancar} data-testid="ler-nota-lancar">Lançar {prontas.length} entrada(s)</button>
          </footer>
        </section>
      )}
    </div>
  );
}
