begin;
set local lock_timeout='5s';
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists avatar_mode text not null default 'google';
alter table public.profiles add column if not exists google_avatar_url text;
do $$begin
 if not exists(select 1 from pg_constraint where conrelid='public.profiles'::regclass and conname='profile_contact_format') then
 alter table public.profiles add constraint profile_contact_format check(phone is null or phone ~ '^\+[1-9][0-9]{6,14}$');end if;
 if not exists(select 1 from pg_constraint where conrelid='public.profiles'::regclass and conname='profile_avatar_scope') then
 alter table public.profiles add constraint profile_avatar_scope check(avatar_path is null or avatar_path ~ ('^'||id::text||'/[0-9a-f-]{36}\.webp$'));end if;
 if not exists(select 1 from pg_constraint where conrelid='public.profiles'::regclass and conname='profile_avatar_mode') then
 alter table public.profiles add constraint profile_avatar_mode check(avatar_mode in ('google','upload','none'));end if;
 if not exists(select 1 from pg_constraint where conrelid='public.profiles'::regclass and conname='profile_google_avatar_host') then
 alter table public.profiles add constraint profile_google_avatar_host check(google_avatar_url is null or (length(google_avatar_url)<=2048 and google_avatar_url ~ '^https://[a-zA-Z0-9-]+\.googleusercontent\.com/'));end if;
end$$;
create or replace function public.sync_my_profile() returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare who uuid:=auth.uid();meta jsonb:=auth.jwt()->'user_metadata';photo text;person text;contact text;
begin
 if who is null then raise exception 'Sign in required';end if;
 person:=left(coalesce(nullif(trim(meta->>'display_name'),''),nullif(trim(meta->>'full_name'),''),nullif(trim(meta->>'name'),'')),80);
 contact:=meta->>'phone';if contact !~ '^\+[1-9][0-9]{6,14}$' then contact:=null;end if;
 if auth.jwt()->'app_metadata'->>'provider'='google' or (auth.jwt()->'app_metadata'->'providers') ? 'google' then
 photo:=coalesce(meta->>'avatar_url',meta->>'picture');
 if photo !~ '^https://[a-zA-Z0-9-]+\.googleusercontent\.com/' or length(photo)>2048 then photo:=null;end if;
 end if;
 insert into public.profiles(id,display_name,phone,google_avatar_url) values(who,person,contact,photo)
 on conflict(id) do update set
 display_name=coalesce(nullif(trim(profiles.display_name),''),excluded.display_name),
 phone=coalesce(profiles.phone,excluded.phone),
 google_avatar_url=coalesce(excluded.google_avatar_url,profiles.google_avatar_url);
end$$;
revoke all on function public.sync_my_profile() from public,anon;
grant execute on function public.sync_my_profile() to authenticated;
-- Existing profile RLS continues to restrict all rows to auth.uid().
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-avatars','profile-avatars',false,2097152,array['image/webp']) on conflict(id) do nothing;
do $$begin
 if exists(select 1 from storage.buckets where id='profile-avatars' and (public or file_size_limit is distinct from 2097152 or allowed_mime_types is distinct from array['image/webp'])) then
 raise exception 'Existing avatar bucket differs from reviewed private configuration';end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='own_avatar_read') then
 create policy own_avatar_read on storage.objects for select to authenticated using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='own_avatar_insert') then
 create policy own_avatar_insert on storage.objects for insert to authenticated with check(bucket_id='profile-avatars' and name ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.webp$'));end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='own_avatar_delete') then
 create policy own_avatar_delete on storage.objects for delete to authenticated using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);end if;
end$$;
commit;
