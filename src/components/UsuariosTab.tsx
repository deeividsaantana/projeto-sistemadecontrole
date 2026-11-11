import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { Pencil, Plus, RefreshCw, UserRound } from 'lucide-react';
import { Button, ConfirmDialog, EmptyState, IconButton, Modal, PageHeader, TabelaPadrao, TextInput, type ColunaTabela } from '../shared/ui';
import {
  createManagedUser,
  deleteManagedUser,
  loadManagedUsers,
  updateManagedUser,
  type ManagedUser,
  type ManagedUserPermission,
  type ManagedUserRole,
} from '../services/masterDataApi';
import { TelaCheia } from '../shared/ui/TelaCheia';
import { CAMPO, CAMPO_SELECT } from './cadastros/estilos';

const roles: Array<{ value: ManagedUserRole; label: string; faz: string }> = [
  { value: 'admin', label: 'Administrador', faz: 'Pode tudo, inclusive excluir e cuidar dos usuários.' },
  { value: 'gestor', label: 'Gestor', faz: 'Lança, aprova e zera o dia de presença, mas não exclui.' },
  { value: 'operador', label: 'Operador', faz: 'Lança em campo, mas não aprova nem exclui.' },
  { value: 'leitura', label: 'Visualização', faz: 'Só consulta, não lança nada.' },
];

type Mudanca = { user: ManagedUser; changes: Partial<Pick<ManagedUser, 'role' | 'active'>> };
type UserForm = {
  fullName: string;
  email: string;
  password: string;
  role: ManagedUserRole;
  profileName: string;
  avatarColor: string;
  jobTitle: string;
  phone: string;
  area: string;
  registration: string;
  permissions: ManagedUserPermission[];
};

const permissionOptions: Array<{ value: ManagedUserPermission; label: string }> = [
  { value: 'dashboard', label: 'Painel' },
  { value: 'lancamentos', label: 'Lançamentos' },
  { value: 'compras', label: 'Compras' },
  { value: 'cadastros', label: 'Cadastros' },
  { value: 'frota', label: 'Frota' },
  { value: 'presenca', label: 'Presença' },
  { value: 'diario', label: 'Diário de obra' },
  { value: 'usuarios', label: 'Usuários' },
];

const vazioFormulario: UserForm = {
  fullName: '', email: '', password: '', role: 'operador', profileName: '',
  avatarColor: '#176b4d', jobTitle: '', phone: '', area: '', registration: '',
  permissions: ['dashboard', 'lancamentos'],
};

const formularioDoUsuario = (user: ManagedUser): UserForm => ({
  ...vazioFormulario,
  fullName: user.fullName,
  email: user.email || '',
  role: user.role,
  profileName: user.profileName || '',
  avatarColor: user.avatarColor || '#176b4d',
  jobTitle: user.jobTitle || '',
  phone: user.phone || '',
  area: user.area || '',
  registration: user.registration || '',
  permissions: user.permissions || [],
});

/** Texto da confirmação: o que muda para a pessoa, em palavras de obra (M12). */
const textoDaMudanca = ({ user, changes }: Mudanca) => {
  if (changes.active === false) {
    return {
      titulo: `Inativar ${user.fullName}?`,
      descricao: 'A pessoa não consegue mais entrar no sistema. O que ela lançou continua. Para devolver o acesso, toque em Reativar.',
      botao: 'Inativar',
    };
  }
  const novo = roles.find(role => role.value === changes.role);
  const deixaDeSerAdmin = user.role === 'admin' && changes.role !== 'admin' ? ' Perde o perfil de administrador.' : '';
  return {
    titulo: `Mudar ${user.fullName} para ${novo?.label || changes.role}?`,
    descricao: `${novo?.faz || ''}${deixaDeSerAdmin}`,
    botao: 'Mudar perfil',
  };
};

interface UsuariosTabProps {
  /** Dentro da Administração o cabeçalho próprio sai: quem manda no título da
   *  página é a aba que hospeda, e duas <h1> na mesma tela confundem tanto o
   *  leitor de tela quanto quem olha. */
  embutido?: boolean;
}

export default function UsuariosTab({ embutido = false }: UsuariosTabProps = {}) {
  const escopo = useRef<HTMLElement>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [erroLista, setErroLista] = useState('');
  const [pendente, setPendente] = useState<Mudanca | null>(null);
  const [form, setForm] = useState<UserForm>(vazioFormulario);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<ManagedUser | null>(null);

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
      setForm(vazioFormulario);
      setMessage('Usuário criado. Oriente-o a trocar a senha temporária no primeiro acesso.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível criar usuário.');
    } finally {
      setSaving(false);
    }
  };

  const updateUser = async (user: ManagedUser, changes: Partial<Pick<ManagedUser, 'role' | 'active'>> & Partial<Omit<UserForm, 'email' | 'password'>>) => {
    setSaving(true);
    setErroLista('');
    try {
      await updateManagedUser({
        uid: user.userId,
        role: changes.role || user.role,
        active: changes.active ?? user.active,
        fullName: changes.fullName,
        profileName: changes.profileName,
        avatarColor: changes.avatarColor,
        jobTitle: changes.jobTitle,
        phone: changes.phone,
        area: changes.area,
        registration: changes.registration,
        permissions: changes.permissions,
      });
      await refresh();
    } catch (caught) {
      setErroLista(caught instanceof Error ? caught.message : 'Não foi possível atualizar usuário.');
    } finally {
      setSaving(false);
      setPendente(null);
    }
  };
  const saveProfile = async () => {
    if (!editingUser) return;
    await updateUser(editingUser, {
      role: form.role,
      fullName: form.fullName,
      profileName: form.profileName,
      avatarColor: form.avatarColor,
      jobTitle: form.jobTitle,
      phone: form.phone,
      area: form.area,
      registration: form.registration,
      permissions: form.permissions,
    });
    setEditingUser(null);
  };
  const removeUser = async () => {
    if (!deletingUser) return;
    setSaving(true);
    setErroLista('');
    try {
      await deleteManagedUser(deletingUser.userId);
      setMessage(`${deletingUser.fullName} foi excluído.`);
      await refresh();
    } catch (caught) {
      setErroLista(caught instanceof Error ? caught.message : 'Não foi possível excluir usuário.');
    } finally {
      setSaving(false);
      setDeletingUser(null);
    }
  };
  const confirmacao = pendente ? textoDaMudanca(pendente) : null;

  const selectClass = `${CAMPO_SELECT} text-sm font-medium`;
  const labelClass = 'block text-xs font-bold text-slate-500';

  const colunas: ColunaTabela<ManagedUser>[] = [
    {
      chave: 'usuario',
      titulo: 'Usuário',
      larguraMinima: 220,
      valorOrdenacao: user => user.fullName,
      dica: user => `${user.fullName} · ${user.email}`,
      render: user => (
        <span className="block min-w-0">
          <span className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black text-white" style={{ backgroundColor: user.avatarColor || '#176b4d' }}>
              {(user.profileName || user.fullName).slice(0, 1).toUpperCase()}
            </span>
            <strong className="block text-slate-900">{user.profileName || user.fullName}</strong>
          </span>
          <span className="block text-xs text-slate-600 break-words">{user.email}</span>
          {user.jobTitle || user.area ? <span className="block text-xs text-slate-500">{[user.jobTitle, user.area].filter(Boolean).join(' · ')}</span> : null}
        </span>
      ),
    },
    {
      chave: 'perfil',
      titulo: 'Perfil',
      valorOrdenacao: user => roles.find(role => role.value === user.role)?.label ?? user.role,
      render: user => (
        <select
          value={user.role}
          disabled={saving}
          onChange={event => setPendente({ user, changes: { role: event.target.value as ManagedUserRole } })}
          className={`${CAMPO}`}
          aria-label={`Perfil de ${user.fullName}`}
        >
          {roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
        </select>
      ),
    },
    {
      chave: 'status',
      titulo: 'Status',
      valorOrdenacao: user => (user.active ? 'Ativo' : 'Inativo'),
      render: user => <span className={user.active ? 'font-semibold text-emerald-700' : 'text-slate-600'}>{user.active ? 'Ativo' : 'Inativo'}</span>,
    },
  ];

  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(raiz.querySelectorAll('[data-usuarios-reveal]'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, { scope: escopo });

  const conteudo = (
    <>
      <div data-usuarios-reveal className="grid items-start gap-5 xl:grid-cols-[420px_1fr]">
        <form onSubmit={createUser} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-emerald-700" aria-hidden="true" />
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
        <article className="min-w-0 space-y-3">
          <header className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">Acessos cadastrados</h2>
              <p className="text-xs text-slate-600">Perfis aplicados no controle de acesso do sistema</p>
            </div>
            <IconButton
              icon={RefreshCw}
              label="Atualizar lista de usuários"
              onClick={() => void refresh()}
              disabled={loading || saving}
              className={loading ? '[&>svg]:animate-spin' : undefined}
            />
          </header>
          {erroLista ? <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700" data-testid="usuarios-erro">{erroLista}</p> : null}
          <TabelaPadrao
            titulo="Acessos cadastrados"
            linhas={users}
            colunas={colunas}
            idDaLinha={user => user.userId}
            nomeDoItem={{ um: 'usuário', varios: 'usuários' }}
            carregando={loading && users.length === 0}
            classeLinha={user => (user.active ? undefined : 'text-slate-500')}
            acoes={user => (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant={user.active ? 'subtle' : 'secondary'}
                  disabled={saving}
                  onClick={() => (user.active ? setPendente({ user, changes: { active: false } }) : void updateUser(user, { active: true }))}
                >
                  {user.active ? 'Inativar' : 'Reativar'}
                </Button>
                    <Button
                  size="sm"
                  variant="subtle"
                  disabled={saving}
                  icon={Pencil}
                  onClick={() => { setEditingUser(user); setForm(formularioDoUsuario(user)); }}
                >
                  Editar
                </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={saving || user.role === 'admin'}
                      onClick={() => setDeletingUser(user)}
                      title={user.role === 'admin' ? 'Administradores não podem ser excluídos' : 'Excluir usuário'}
                    >
                      Excluir
                    </Button>
              </div>
            )}
            vazio={<EmptyState icon={UserRound} title="Nenhum usuário de equipe registrado nesta organização." />}
          />
        </article>
      </div>
      <Modal
        open={Boolean(editingUser)}
        title={editingUser ? `Editar ${editingUser.fullName}` : 'Editar usuário'}
        description="Atualize o perfil, os dados de equipe e os módulos liberados."
        size="lg"
        busy={saving}
        onClose={() => setEditingUser(null)}
        onSubmit={() => void saveProfile()}
        footer={<div className="flex justify-end gap-2"><Button variant="subtle" onClick={() => setEditingUser(null)} disabled={saving}>Cancelar</Button><Button variant="primary" onClick={() => void saveProfile()} disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</Button></div>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 sm:col-span-2"><span className={labelClass}>Nome completo</span><TextInput value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} /></label>
          <label className="space-y-1.5"><span className={labelClass}>Nome de perfil</span><TextInput value={form.profileName} onChange={event => setForm({ ...form, profileName: event.target.value })} placeholder="Como aparece no sistema" /></label>
          <label className="space-y-1.5"><span className={labelClass}>Cor do avatar</span><div className="flex items-center gap-2"><input type="color" value={form.avatarColor} onChange={event => setForm({ ...form, avatarColor: event.target.value })} className="h-11 w-full rounded-xl border border-slate-300 bg-white p-1 accent-[#176b4d]" /><Button type="button" size="sm" variant="subtle" onClick={() => setForm({ ...form, avatarColor: '#176b4d' })} disabled={saving}>Restaurar</Button></div></label>
          <label className="space-y-1.5"><span className={labelClass}>Cargo</span><TextInput value={form.jobTitle} onChange={event => setForm({ ...form, jobTitle: event.target.value })} /></label>
          <label className="space-y-1.5"><span className={labelClass}>Área</span><TextInput value={form.area} onChange={event => setForm({ ...form, area: event.target.value })} /></label>
          <label className="space-y-1.5"><span className={labelClass}>Matrícula</span><TextInput value={form.registration} onChange={event => setForm({ ...form, registration: event.target.value })} /></label>
          <label className="space-y-1.5"><span className={labelClass}>Telefone</span><TextInput value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></label>
          <label className="space-y-1.5 sm:col-span-2"><span className={labelClass}>Perfil de acesso</span><select value={form.role} onChange={event => setForm({ ...form, role: event.target.value as ManagedUserRole })} className={selectClass}>{roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
          <fieldset className="sm:col-span-2"><legend className={labelClass}>Módulos liberados</legend><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{permissionOptions.map(permission => <label key={permission.value} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={form.permissions.includes(permission.value)} onChange={event => setForm({ ...form, permissions: event.target.checked ? [...form.permissions, permission.value] : form.permissions.filter(item => item !== permission.value) })} />{permission.label}</label>)}</div></fieldset>
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(deletingUser)}
        tone="danger"
        busy={saving}
        title={deletingUser ? `Excluir ${deletingUser.fullName}?` : ''}
        description="A conta será removida do acesso e não poderá ser recuperada por esta tela. Os lançamentos históricos permanecem registrados."
        confirmLabel="Excluir usuário"
        onConfirm={() => { void removeUser(); }}
        onCancel={() => setDeletingUser(null)}
      />
      <ConfirmDialog
        open={Boolean(confirmacao)}
        tone="warning"
        busy={saving}
        title={confirmacao?.titulo || ''}
        description={confirmacao?.descricao || ''}
        confirmLabel={confirmacao?.botao}
        onConfirm={() => { if (pendente) void updateUser(pendente.user, pendente.changes); }}
        onCancel={() => setPendente(null)}
      />
    </>
  );

  // Dentro da Administração a aba que hospeda é a página; sozinha, a tela usa
  // o mesmo molde das outras abas.
  if (embutido) return <section ref={escopo} className="space-y-5">{conteudo}</section>;
  return (
    <TelaCheia ref={escopo} id="usuarios-tab" rotulo="Usuários e permissões" longa
      cabecalho={<div data-usuarios-reveal><PageHeader eyebrow="Administração" title="Usuários e permissões" /></div>}>
      {conteudo}
    </TelaCheia>
  );
}
