import { MODULES } from '../constants/navigation';
import { ComingSoonPage } from './ComingSoonPage';
import { DashboardPage } from '../modules/dashboard/pages/DashboardPage';

export const resolveRoute = (path: string) => {
  const module = MODULES.find(item => item.path === path) ?? MODULES[0];
  if (module.id === 'dashboard') return <DashboardPage />;
  return <ComingSoonPage moduleLabel={module.label} />;
};
