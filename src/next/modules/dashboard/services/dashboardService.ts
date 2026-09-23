import { getDashboardSummary } from '../../../services/repositories/dashboardRepository';

// Hoje é síncrono (lê o cache local); a assinatura async já deixa pronta a
// troca por uma chamada real ao Supabase sem mexer em quem consome.
export const fetchDashboardSummary = async () => getDashboardSummary();
