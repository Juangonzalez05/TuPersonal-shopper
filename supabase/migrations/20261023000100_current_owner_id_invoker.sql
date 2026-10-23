-- current_owner_id() no necesita privilegios de dueño: cada usuario puede leer su propia
-- fila de account_members (política member_reads_own). Con security invoker ya no queda
-- expuesta como función privilegiada por /rest/v1/rpc (aviso de los advisors de Supabase).
alter function public.current_owner_id() security invoker;
