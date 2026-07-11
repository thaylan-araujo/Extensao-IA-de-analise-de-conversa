-- Correção do gate de papéis (bug encontrado na verificação humana do 01-08):
-- o custom_access_token_hook roda como supabase_auth_admin, que tinha GRANT de
-- SELECT em profiles desde o schema inicial, mas NENHUMA policy de RLS o
-- autorizava — o SELECT do hook voltava vazio (falha silenciosa) e o token era
-- emitido sem app_metadata.user_role, derrubando todo login no /login.
-- Pegadinha documentada do Supabase: o papel interno de auth precisa de policy
-- explícita além do GRANT quando a tabela tem RLS.
create policy "auth admin reads profiles for token hook"
on public.profiles
for select
to supabase_auth_admin
using (true);
