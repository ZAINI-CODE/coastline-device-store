-- Use Vault at runtime; never put the credential in cron commands or SQL files.
-- Synchronous HTTP avoids pg_net's shared request-header queue.
-- Leave paused until real sender/queue delivery acceptance tests pass.
begin;
create extension if not exists http with schema extensions;
do $setup$
declare worker_job bigint;
begin
  if not exists(select 1 from pg_extension where extname='pg_cron') then
    raise exception 'Cron must be installed before scheduler setup';
  end if;
  if not exists(select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='http' and n.nspname='extensions') then
    raise exception 'HTTP extension must be in the extensions schema';
  end if;
  if (select count(*) from vault.secrets where name='EMAIL_WORKER_SECRET') <> 1 then
    raise exception 'Exactly one EMAIL_WORKER_SECRET entry is required in Vault';
  end if;
  select cron.schedule('coastline-order-email','* * * * *',$command$
    do $worker$
    declare worker_status integer;
    begin
      perform set_config('http.curlopt_connecttimeout_ms','5000',true);
      perform set_config('http.curlopt_timeout_ms','55000',true);
      select status into worker_status from extensions.http((
        'POST','https://roamotmagssiipntchgh.supabase.co/functions/v1/order-email',
        array[row('Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='EMAIL_WORKER_SECRET'))::extensions.http_header],
        'application/json','{"action":"deliver"}'
      )::extensions.http_request);
      if worker_status <> 200 then raise exception 'Email worker HTTP %',worker_status; end if;
    end;
    $worker$;
  $command$) into worker_job;
  perform cron.alter_job(worker_job,active := false);
end;
$setup$;
commit;
select jobname,schedule,active from cron.job where jobname='coastline-order-email';
