select 'Migraciones registradas' as comprobacion, count(*)::text as resultado
from supabase_migrations.schema_migrations
where version in ('202611120001', '202611130001', '202611130002')
union all
select 'Tablas con RLS', count(*)::text from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relrowsecurity
  and c.relname in ('profiles','albums','recommendations','recommendation_votes','saved_albums','recommendation_reports')
union all
select 'Politicas RLS', count(*)::text from pg_policies where schemaname='public'
  and tablename in ('profiles','albums','recommendations','recommendation_votes','saved_albums','recommendation_reports')
union all
select 'Vistas con security_invoker', count(*)::text from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='v' and c.reloptions @> array['security_invoker=true']
  and c.relname in ('recommendation_stats','curator_stats','recommendation_details','album_mood_stats')
union all
select 'Publicacion solo servidor', case when
  has_function_privilege('service_role', 'public.publish_recommendation(uuid,text,text,jsonb,public.listening_context[],smallint,public.mood[],public.album_language,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.publish_recommendation(uuid,text,text,jsonb,public.listening_context[],smallint,public.mood[],public.album_language,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.publish_recommendation(uuid,text,text,jsonb,public.listening_context[],smallint,public.mood[],public.album_language,text)', 'EXECUTE')
  then 'OK' else 'ERROR' end
union all
select 'Votos solo autenticados', case when
  has_function_privilege('authenticated','public.set_recommendation_vote(uuid,boolean)','EXECUTE')
  and not has_function_privilege('anon','public.set_recommendation_vote(uuid,boolean)','EXECUTE')
  then 'OK' else 'ERROR' end
union all
select 'Pendientes sin acceso anonimo', case when not has_table_privilege('anon','public.saved_albums','SELECT') then 'OK' else 'ERROR' end
union all
select 'Reportes sin acceso anonimo', case when not has_table_privilege('anon','public.recommendation_reports','SELECT') then 'OK' else 'ERROR' end;
