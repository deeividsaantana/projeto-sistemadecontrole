import { useState, type ReactNode } from 'react';
import { Sidebar } from '../components/navigation/Sidebar';
import { MobileNavDrawer } from '../components/navigation/MobileNavDrawer';
import { Topbar } from '../components/navigation/Topbar';
import { MOCK_TENANT } from '../app/tenant';

export const AppShell = ({
  currentPath,
  onNavigate,
  children,
}: {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: ReactNode;
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // O mesmo botão do Topbar faz dois papéis: no desktop recolhe a sidebar
  // (ela nunca some), no mobile abre a gaveta (a sidebar fixa nem existe
  // abaixo do breakpoint md) — cada estado só afeta a tela onde faz sentido.
  const handleToggleNav = () => {
    setCollapsed(value => !value);
    setMobileNavOpen(value => !value);
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--color-surface-canvas)]">
      <Sidebar currentPath={currentPath} onNavigate={onNavigate} collapsed={collapsed} />
      <MobileNavDrawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        currentPath={currentPath}
        onNavigate={path => {
          onNavigate(path);
          setMobileNavOpen(false);
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar tenant={MOCK_TENANT} onToggleSidebar={handleToggleNav} />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
};
