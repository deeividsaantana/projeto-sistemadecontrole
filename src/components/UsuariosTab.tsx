import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { Button, EmptyState, IconButton, TextInput } from '../shared/ui';
import {
  createManagedUser,
  loadManagedUsers,
  updateManagedUser,
  type ManagedUser,
  type ManagedUserRole,
} from '../services/masterDataApi';

const roles: Array<{ value: ManagedUserRole; label: string }> = [
  { value: 'admin', label: 'Administrador' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'operador', label: 'Operador' },
  { value: 'leitura', label: 'Visualização' },
];

export default function UsuariosTab() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'operador' as ManagedUserRole });

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      setUsers(await loadManagedUsers());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await createManagedUser(form);
      setForm({ fullName: '', email: '', password: '', role: 'operador' });
      setMessage('Usuário criado. Oriente-o a trocar a senha temporária no primeiro acesso.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível criar usuário.');
    } finally {
      setSaving(false);
    }
  };

  const updateUser = async (user: ManagedUser, changes: Partial<Pick<ManagedUser, 'role' | 'active'>>) => {
    setSaving(true);
    setError('');
    try {
      await updateManagedUser({
        uid: user.firebaseUid,
        role: changes.role || user.role,
        active: changes.active ?? user.active,
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível atualizar usuário.');
    } finally {
      setSaving(false);
    }
  };

  const selectClass = 'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/15 disabled:bg-slate-100';
  const labelClass = 'block text-[11px] font-bold uppercase tracking-wider text-slate-500';

  return (
    <section className="space-y-5">
      <header className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-emerald-700" />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Administração</p>
          <h1 className="text-2xl font-black text-slate-900">Usuários e permissões</h1>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form onSubmit={createUser} className="space-y-4 rounded-xl border border-[#e2e8e4] bg-white p-5">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-emerald-700" />
            <h2 className="font-bold text-slate-900">Novo usuário</h2>
          </div>
          <label className="space-y-1.5">
            <span className={labelClass}>Nome</span>
            <TextInput required value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} />
          </label>
          <label className="space-y-1.5">
            <span className={labelClass}>E-mail</span>
            <TextInput required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
          </label>
          <label className="space-y-1.5">
            <span className={labelClass}>Senha temporária</span>
            <TextInput required minLength={8} type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} />
          </label>
          <label className="space-y-1.5">
            <span className={labelClass}>Perfil</span>
            <select
              value={form.role}
              onChange={event => setForm({ ...form, role: event.target.value as ManagedUserRole })}
              className={selectClass}
            >
              {roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </label>
          <Button type="submit" variant="primary" icon={UserRound} disabled={saving} className="w-full">
            {saving ? 'Salvando...' : 'Criar usuário'}
          </Button>
          {message ? <p role="status" className="text-xs font-semibold text-emerald-700">{message}</p> : null}
          {error ? <p role="alert" className="text-xs font-semibold text-rose-700">{error}</p> : null}
        </form>

        <article className="overflow-hidden rounded-xl border border-[#e2e8e4] bg-white">
          <header className="flex items-center justify-between gap-3 border-b border-[#e2e8e4] p-4">
            <div>
              <h2 className="font-bold text-slate-900">Acessos cadastrados</h2>
              <p className="text-xs text-slate-500">Perfis aplicados no controle de acesso do sistema</p>
            </div>
            <IconButton
              icon={RefreshCw}
              label="Atualizar lista de usuários"
              onClick={() => void refresh()}
              disabled={loading || saving}
              className={loading ? '[&>svg]:animate-spin' : undefined}
            />
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-[#fafcfb] text-[10px] uppercase tracking-wider text-slate-500">
                <tr><th className="p-3">Usuário</th><th className="p-3">Perfil</th><th className="p-3">Status</th><th className="p-3">Ações</th></tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.firebaseUid} className="border-t border-[#e8eeea]">
                    <td className="p-3">
                      <strong className="block text-slate-900">{user.fullName}</strong>
                      <span className="text-xs text-slate-500">{user.email}</span>
                    </td>
                    <td className="p-3">
                      <select
                        value={user.role}
                        disabled={saving}
                        onChange={event => void updateUser(user, { role: event.target.value as ManagedUserRole })}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/15 disabled:bg-slate-100"
                        aria-label={`Perfil de ${user.fullName}`}
                      >
                        {roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
                      </select>
                    </td>
                    <td className="p-3">
                      <span className={user.active ? 'font-semibold text-emerald-700' : 'text-slate-500'}>
                        {user.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="p-3">
                      <Button
                        size="sm"
                        variant={user.active ? 'subtle' : 'secondary'}
                        disabled={saving}
                        onClick={() => void updateUser(user, { active: !user.active })}
                      >
                        {user.active ? 'Inativar' : 'Reativar'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && users.length === 0
            ? <EmptyState icon={UserRound} title="Nenhum usuário de equipe registrado nesta organização." />
            : null}
        </article>
      </div>
    </section>
  );
}
