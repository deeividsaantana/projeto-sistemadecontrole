import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
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

  return (
    <section className="space-y-5">
      <header className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-emerald-400" />
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-400">Administração</p><h1 className="text-2xl font-black text-white">Usuários e permissões</h1></div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form onSubmit={createUser} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-2"><Plus className="h-5 w-5 text-emerald-400" /><h2 className="font-bold text-white">Novo usuário</h2></div>
          <label className="block text-xs font-bold text-slate-300">Nome<input required value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
          <label className="block text-xs font-bold text-slate-300">E-mail<input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
          <label className="block text-xs font-bold text-slate-300">Senha temporária<input required minLength={8} type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
          <label className="block text-xs font-bold text-slate-300">Perfil<select value={form.role} onChange={event => setForm({ ...form, role: event.target.value as ManagedUserRole })} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">{roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
          <button disabled={saving} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-60"><UserRound className="h-4 w-4" />Criar usuário</button>
          {message ? <p className="text-xs text-emerald-300">{message}</p> : null}
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        </form>

        <article className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <header className="flex items-center justify-between border-b border-slate-800 p-4"><div><h2 className="font-bold text-white">Acessos cadastrados</h2><p className="text-xs text-slate-500">Perfis aplicados no controle de acesso do sistema</p></div><button type="button" onClick={() => void refresh()} disabled={loading || saving} className="rounded-md border border-slate-700 p-2 text-slate-300 hover:border-emerald-500"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></header>
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-950 text-[10px] uppercase text-slate-500"><tr><th className="p-3">Usuário</th><th className="p-3">Perfil</th><th className="p-3">Status</th><th className="p-3">Ações</th></tr></thead><tbody>{users.map(user => <tr key={user.firebaseUid} className="border-t border-slate-800"><td className="p-3"><strong className="block text-white">{user.fullName}</strong><span className="text-xs text-slate-500">{user.email}</span></td><td className="p-3"><select value={user.role} disabled={saving} onChange={event => void updateUser(user, { role: event.target.value as ManagedUserRole })} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white">{roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}</select></td><td className="p-3"><span className={user.active ? 'text-emerald-400' : 'text-slate-500'}>{user.active ? 'Ativo' : 'Inativo'}</span></td><td className="p-3"><button type="button" disabled={saving} onClick={() => void updateUser(user, { active: !user.active })} className="rounded border border-slate-700 px-2 py-1 text-xs font-bold text-slate-200 hover:border-amber-500">{user.active ? 'Inativar' : 'Reativar'}</button></td></tr>)}</tbody></table></div>
          {!loading && users.length === 0 ? <p className="p-5 text-sm text-slate-500">Nenhum usuário de equipe registrado nesta organização.</p> : null}
        </article>
      </div>
    </section>
  );
}
