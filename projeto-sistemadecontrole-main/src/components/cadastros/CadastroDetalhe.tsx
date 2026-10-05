import { Pencil, RotateCcw, Trash2, UserMinus } from 'lucide-react';
import type { HistoryLog } from '../../types';
import type { CadastroCategoriaId } from '../../utils/cadastrosCategorias';
import type { DadosCadastros, LinhaCadastro } from '../../utils/cadastrosLista';
import { temSituacao } from '../../utils/cadastrosLista';
import { CAMPOS, CLASSES_DA_TELA, type CampoCadastro } from './camposCadastro';
import CadastroPainel from './CadastroPainel';
import { BOTAO_PERIGO_LEVE, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, TOM_SITUACAO } from './estilos';

export interface UsoCadastro {
  collection: string;
  count: number;
}

interface Props {
  categoria: CadastroCategoriaId;
  linha: LinhaCadastro;
  dados: DadosCadastros;
  usos: UsoCadastro[];
  historico: HistoryLog[];
  podeEditar: boolean;
  podeExcluir: boolean;
  onEditar: () => void;
  onInativar: () => void;
  onReativar: () => void;
  onExcluir: () => void;
  onFechar: () => void;
}

const vazio = (valor: unknown) => valor === undefined || valor === null || valor === '' || (Array.isArray(valor) && valor.length === 0);

/**
 * Tudo sobre um cadastro sem sair da lista: os dados preenchidos, onde ele é
 * usado e quem mexeu por último. As ações ficam no rodapé, com Excluir por
 * último e em vermelho claro, para não ser tocado por engano.
 */
export default function CadastroDetalhe({ categoria, linha, dados, usos, historico, podeEditar, podeExcluir, onEditar, onInativar, onReativar, onExcluir, onFechar }: Props) {
  const registro = linha.registro as unknown as Record<string, unknown>;
  const nomes = new Map<string, string>([
    ...dados.empresas.map(item => [item.id, item.nome] as const),
    ...dados.obras.map(item => [item.id, item.nome] as const),
    ...dados.funcionarios.map(item => [item.id, item.nome] as const),
    ...dados.combustiveis.map(item => [item.id, item.nome] as const),
    ...dados.equipamentos.map(item => [item.id, `${item.prefixo} · ${item.nome}`] as const),
  ]);

  const exibir = (campo: CampoCadastro, valor: unknown): string => {
    const { tipo } = campo;
    if (tipo === 'classes') {
      return (valor as string[]).map(tipo => CLASSES_DA_TELA.find(classe => classe.tipo === tipo)?.label || tipo).join(', ');
    }
    if (tipo === 'marcar') return valor ? 'Sim' : 'Não';
    if (tipo === 'data' && typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
      const [ano, mes, dia] = valor.slice(0, 10).split('-');
      return `${dia}/${mes}/${ano}`;
    }
    if (tipo === 'selecao' && typeof valor === 'string') {
      return campo.opcoes?.(dados, null).find(opcao => opcao.valor === valor)?.label || nomes.get(valor) || valor;
    }
    return String(valor);
  };

  const linhas = CAMPOS[categoria]
    .filter(campo => campo.tipo !== 'foto')
    .map(campo => {
      const valor = campo.id === 'liderId' ? registro.liderNome : registro[campo.id];
      return { campo, valor };
    })
    .filter(({ valor }) => !vazio(valor));
  const foto = typeof registro.foto === 'string' ? registro.foto : '';
  const podeInativar = temSituacao(categoria);
  const usado = usos.length > 0;

  return (
    <CadastroPainel
      titulo={linha.titulo}
      subtitulo={linha.detalhe}
      topo={<span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${TOM_SITUACAO[linha.tom]}`}>{linha.situacao}</span>}
      onFechar={onFechar}
      testId="cadastro-detalhe"
      rodape={podeEditar ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={onEditar} className={`${BOTAO_PRIMARIO} sm:col-span-3`} data-testid="cadastro-editar">
            <Pencil className="size-5" aria-hidden="true" />
            Editar
          </button>
          {podeInativar && (linha.ativo ? (
            <button type="button" onClick={onInativar} className={`${BOTAO_SECUNDARIO} ${podeExcluir ? 'sm:col-span-2' : 'sm:col-span-3'}`} data-testid="cadastro-inativar">
              <UserMinus className="size-5" aria-hidden="true" />
              Inativar
            </button>
          ) : (
            <button type="button" onClick={onReativar} className={`${BOTAO_SECUNDARIO} ${podeExcluir ? 'sm:col-span-2' : 'sm:col-span-3'}`}>
              <RotateCcw className="size-5" aria-hidden="true" />
              Reativar
            </button>
          ))}
          {podeExcluir && (
            <button type="button" onClick={onExcluir} className={`${BOTAO_PERIGO_LEVE} ${podeInativar ? '' : 'sm:col-span-3'}`} data-testid="cadastro-excluir">
              <Trash2 className="size-5" aria-hidden="true" />
              Excluir
            </button>
          )}
        </div>
      ) : undefined}
    >
      <div className="space-y-6">
        {foto && <img src={foto} alt={`Foto de ${linha.titulo}`} className="aspect-video w-full rounded-2xl border border-slate-200 object-cover" />}

        <dl className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
          {linhas.map(({ campo, valor }) => (
            <div key={campo.id} className="contents">
              <dt className="text-slate-500">{campo.label}</dt>
              <dd className="break-words font-medium text-slate-900">{exibir(campo, valor)}</dd>
            </div>
          ))}
          <dt className="text-slate-500">Código</dt>
          <dd className="break-all font-mono text-xs text-slate-500 tabular-nums">{linha.id}</dd>
        </dl>

        <section aria-labelledby="cadastro-usos-titulo" className="space-y-2">
          <h3 id="cadastro-usos-titulo" className="text-xs font-bold uppercase tracking-wide text-[#718087]">Onde é usado</h3>
          {usado ? (
            <ul className="space-y-1.5">
              {usos.map(uso => (
                <li key={uso.collection} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
                  <span className="text-slate-700">{uso.collection}</span>
                  <strong className="tabular-nums text-slate-900">{uso.count.toLocaleString('pt-BR')}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">Não aparece em nenhum lançamento.</p>
          )}
        </section>

        <section aria-labelledby="cadastro-historico-titulo" className="space-y-2">
          <h3 id="cadastro-historico-titulo" className="text-xs font-bold uppercase tracking-wide text-[#718087]">Últimas alterações</h3>
          {historico.length > 0 ? (
            <ol className="space-y-2.5">
              {historico.map(log => (
                <li key={log.id} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 text-sm">
                  <span className="text-xs tabular-nums text-slate-500">{log.timestamp.slice(0, 16)}</span>
                  <span className="text-slate-700"><strong className="font-semibold text-slate-900">{log.usuario}</strong> {log.acao.toLowerCase()}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500">Nenhuma alteração registrada neste aparelho.</p>
          )}
        </section>
      </div>
    </CadastroPainel>
  );
}
