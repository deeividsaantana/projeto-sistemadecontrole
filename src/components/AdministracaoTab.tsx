/**
 * Administração: saúde do armazenamento e do registro das coleções. A checagem
 * de registro é a mesma que roda nos testes — uma coleção nova que ficar fora do
 * backup ou da sincronização aparece aqui em vez de sumir silenciosamente.
 */
import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Database } from 'lucide-react';
import { INTERMEDIATE_TABLE_IDS } from '../firebaseCloudSync';
import {
  divergenciasDeRegistro,
  formatarBytes,
  resumoArmazenamento,
  volumePorColecao,
} from '../utils/diagnostico';
import { APP_VERSION_LABEL } from '../app/version';
import { PageHeader, TableBody, TableHead, TableShell } from '../shared/ui';

interface AdministracaoTabProps {
  ultimaSincronizacao: string;
  nuvemConectada: boolean;
  totalUsuarios?: number;
  onNavigate: (tab: string) => void;
}

export default function AdministracaoTab({
  ultimaSincronizacao,
  nuvemConectada,
  totalUsuarios,
  onNavigate,
}: AdministracaoTabProps) {
  const volumes = useMemo(
    () => typeof localStorage === 'undefined' ? [] : volumePorColecao(localStorage),
    [],
  );
  const resumo = resumoArmazenamento(volumes);
  const divergencias = useMemo(() => divergenciasDeRegistro(INTERMEDIATE_TABLE_IDS), []);

  return (
    <div id="administracao-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Administração"
        description="Saúde do armazenamento, registro das coleções e estado da sincronização."
      />

      <div className={`mt-4 rounded-lg border px-4 py-3 ${divergencias.length === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
        {divergencias.length === 0 ? (
          <p className="flex items-center gap-2 text-xs font-bold text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            Todas as coleções de dados estão no backup e na sincronização com a nuvem.
          </p>
        ) : (
          <>
            <p className="flex items-center gap-2 text-xs font-bold text-rose-900">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              {divergencias.length} coleção(ões) mal registrada(s) — dado gravado aqui pode não chegar à nuvem
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px] text-rose-800">
              {divergencias.map(item => (
                <li key={`${item.colecao}-${item.problema}`}>{item.colecao}: {item.problema}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Coleções', valor: String(resumo.colecoes) },
          { label: 'Registros', valor: resumo.registros.toLocaleString('pt-BR') },
          { label: 'Uso local', valor: formatarBytes(resumo.bytes) },
          { label: 'Coleções vazias', valor: String(resumo.vazias) },
        ].map(item => (
          <div key={item.label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">{item.label}</p>
            <strong className="mt-1.5 block truncate text-xl font-black tabular-nums text-slate-900">{item.valor}</strong>
          </div>
        ))}
      </section>

      <section className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {[
          { label: 'Versão', valor: APP_VERSION_LABEL },
          { label: 'Nuvem', valor: nuvemConectada ? 'Conectada' : 'Sem conexão' },
          { label: 'Última sincronização', valor: ultimaSincronizacao || 'Ainda não sincronizou nesta sessão' },
        ].map(item => (
          <div key={item.label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
            <strong className="mt-1 block truncate text-sm font-bold text-slate-800">{item.valor}</strong>
          </div>
        ))}
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          ['configuracoes', 'Backup, importação e usuários'],
          ['auditoria', 'Histórico de ações'],
          ['permissoes', 'Matriz de permissões'],
          ['cadastros', 'Cadastros auxiliares'],
        ].map(([tab, rotulo]) => (
          <button
            key={tab}
            type="button"
            onClick={() => onNavigate(tab)}
            className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700"
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <TableShell minWidth={620}>
          <TableHead>
            <tr>
              <th className="p-3">Coleção</th>
              <th className="p-3">Chave</th>
              <th className="p-3">Registros</th>
              <th className="p-3">Tamanho</th>
            </tr>
          </TableHead>
          <TableBody>
            {volumes.map(item => (
              <tr key={item.chave} className="transition-colors hover:bg-slate-50">
                <td className="p-3 font-bold text-slate-800">{item.colecao}</td>
                <td className="p-3 font-mono text-[11px] text-slate-500">{item.chave}</td>
                <td className="p-3 font-mono text-slate-700">{item.registros.toLocaleString('pt-BR')}</td>
                <td className="p-3 font-mono text-slate-700">{formatarBytes(item.bytes)}</td>
              </tr>
            ))}
          </TableBody>
        </TableShell>
      </div>

      {totalUsuarios !== undefined && (
        <p className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
          <Database className="h-3.5 w-3.5" /> {totalUsuarios} usuário(s) cadastrado(s) no acesso corporativo.
        </p>
      )}
    </div>
  );
}
