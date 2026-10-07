-- Hardening: o Supabase concede EXECUTE a `anon` por padrão em toda função
-- nova no schema public (ALTER DEFAULT PRIVILEGES do projeto), independente
-- do `revoke all ... from public` já presente nas migrations anteriores.
-- As funções abaixo já se protegem sozinhas quando chamadas sem sessão
-- (auth.uid() nulo => exceção ou nenhuma linha), mas expor a chamada RPC a
-- usuários anônimos é superfície desnecessária — revoga explicitamente.

revoke execute on function public.publish_erp_snapshot(text, timestamptz, jsonb) from anon;
revoke execute on function public.is_organization_member(text) from anon;
revoke execute on function public.has_organization_role(text, text[]) from anon;
