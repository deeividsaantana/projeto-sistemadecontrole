/**
 * Permissões, dentro da Administração: a matriz efetiva de cada perfil, pela
 * mesma função que as telas usam para decidir o que exibir. É documentação viva
 * da regra, não um cadastro paralelo.
 *
 * Deixa explícito que esconder botão não é segurança: quem recusa a gravação é
 * o servidor, pelo perfil gravado na conta.
 */
import { useMemo, useState } from 'react';
import { Check, KeyRound, Minus, ShieldAlert } from 'lucide-react';
import { ALL_NAVIGATION_ITEMS, ROLE_ACCESS, type UserRole } from '../../app/navigation/navigation';
import { CAPACIDADES_CONHECIDAS, pode } from '../../utils/permissoes';
import { TableBody, TableHead, TableShell } from '../../shared/ui';

const PAPEIS: UserRole[] = ['admin', 'gestor', 'operador', 'leitura'];

const ROTULO_PAPEL: Record<UserRole, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  operador: 'Operação',
  leitura: 'Leitura',
};

const ROTULO_CAPACIDADE: Record<string, string> = {
  ver: 'Ver',
  editar: 'Editar',
  aprovar: 'Aprovar',
  excluir: 'Excluir',
};

export default function MatrizPermissoes() {
  const [papel, setPapel] = useState<UserRole>('gestor');

  const modulos = useMemo(
    () => ALL_NAVIGATION_ITEMS.filter(item => ROLE_ACCESS[papel].includes(item.id)),
    [papel],
  );
  const semAcesso = ALL_NAVIGATION_ITEMS.length - modulos.length;

  return (
    <div id="administracao-permissoes" className="space-y-4">
      <p data-admin-reveal className="text-xs text-slate-500">O que cada perfil enxerga e pode fazer, pela mesma regra que as telas usam.</p>

      <div data-admin-reveal className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="flex items-start gap-2 text-xs font-bold text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          Esconder um botão só evita erro de operação. Quem recusa a gravação é o servidor, pelo perfil gravado na
          conta. Para mudar o que alguém pode fazer, troque o perfil da pessoa em Acessos.
        </p>
      </div>

      <div data-admin-reveal className="flex flex-wrap gap-1.5">
        {PAPEIS.map(item => (
          <button
            key={item}
            type="button"
            onClick={() => setPapel(item)}
            aria-pressed={papel === item}
            className={`min-h-10 rounded-lg border px-3 text-xs font-bold transition-colors ${papel === item
              ? 'border-emerald-600 bg-emerald-700 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-400'}`}
          >
            {ROTULO_PAPEL[item]}
          </button>
        ))}
      </div>

      <section data-admin-reveal className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Telas visíveis', valor: String(modulos.length) },
          { label: 'Telas ocultas', valor: String(semAcesso) },
          { label: 'Pode editar', valor: String(modulos.filter(item => pode(papel, item.id, 'editar')).length) },
          { label: 'Pode aprovar', valor: String(modulos.filter(item => pode(papel, item.id, 'aprovar')).length) },
        ].map(item => (
          <div key={item.label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase leading-tight tracking-wide text-slate-500">{item.label}</p>
            <strong className="mt-1.5 block text-2xl font-black tabular-nums text-slate-900">{item.valor}</strong>
          </div>
        ))}
      </section>

      <div data-admin-reveal className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <TableShell minWidth={720}>
          <TableHead>
            <tr>
              <th className="p-3">Tela</th>
              {CAPACIDADES_CONHECIDAS.map(capacidade => (
                <th key={capacidade} className="p-3">{ROTULO_CAPACIDADE[capacidade]}</th>
              ))}
            </tr>
          </TableHead>
          <TableBody>
            {modulos.map(modulo => (
              <tr key={modulo.id} className="transition-colors hover:bg-slate-50">
                <td className="p-3 font-bold text-slate-800">{modulo.label}</td>
                {CAPACIDADES_CONHECIDAS.map(capacidade => {
                  const permitido = pode(papel, modulo.id, capacidade);
                  return (
                    <td key={capacidade} className="p-3">
                      {permitido
                        ? <Check className="h-4 w-4 text-emerald-600" aria-label="permitido" />
                        : <Minus className="h-4 w-4 text-slate-700" aria-label="não permitido" />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </TableBody>
        </TableShell>
      </div>

      <p className="flex items-center gap-2 text-xs text-slate-500">
        <KeyRound className="h-3.5 w-3.5" />
        Medição e orçamento só são aprovados pelo administrador; a operação registra o que acontece em campo, mas não
        decide medição, orçamento, contrato ou tratativa de não conformidade.
      </p>
    </div>
  );
}
