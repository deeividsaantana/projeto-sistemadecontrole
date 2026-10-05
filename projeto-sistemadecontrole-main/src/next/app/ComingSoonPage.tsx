import { Construction } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/States';

export const ComingSoonPage = ({ moduleLabel }: { moduleLabel: string }) => (
  <div className="flex flex-col gap-6">
    <PageHeader title={moduleLabel} description="Este módulo ainda está no frontend antigo." />
    <EmptyState
      icon={Construction}
      title="Migração em andamento"
      description="Este módulo ainda roda na versão anterior do sistema. Ele entra no novo frontend em uma próxima etapa, um módulo por vez."
    />
  </div>
);
