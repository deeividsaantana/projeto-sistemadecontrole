import { AppShell } from '../layouts/AppShell';
import { useRoute } from './useRoute';
import { resolveRoute } from './routes';

export const NextApp = () => {
  const { path, navigate } = useRoute();
  return (
    <AppShell currentPath={path} onNavigate={navigate}>
      {resolveRoute(path)}
    </AppShell>
  );
};
