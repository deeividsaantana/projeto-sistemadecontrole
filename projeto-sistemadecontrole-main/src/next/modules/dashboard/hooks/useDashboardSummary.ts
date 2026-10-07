import { useQuery } from '@tanstack/react-query';
import { fetchDashboardSummary } from '../services/dashboardService';

export const useDashboardSummary = () =>
  useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchDashboardSummary,
  });
