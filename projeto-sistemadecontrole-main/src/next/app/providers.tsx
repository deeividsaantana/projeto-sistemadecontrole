import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { OrganizationProvider } from './organizations/OrganizationContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: false, staleTime: 60_000 },
  },
});

export const NextAppProviders = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>
    <OrganizationProvider>{children}</OrganizationProvider>
  </QueryClientProvider>
);
