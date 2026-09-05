-- 0001_progress_snapshots_updated_at_trigger.sql
--
-- FOR REVIEW ONLY — not applied by any automation. Apply manually after review.
--
-- Why: the iOS app reconciles its local progress against the single
-- `ios_progress_snapshots` row per user. Device clocks (the snapshot's
-- `client_updated_at` / `clientUpdatedAt`) are only a fallback tiebreak; the
-- primary "which side is newer" signal is the server-side `updated_at`, which
-- must therefore be set by the database on EVERY insert and update — never by
-- the client, and never left stale after an upsert.
--
-- See ios/FluentFrenchIOS/Services/SnapshotReconciler.swift for the rule and
-- backend/types.ts (ios_progress_snapshots) for the summary.

begin;

-- 1. Backfill rows written before updated_at was maintained.
update public.ios_progress_snapshots
set updated_at = coalesce(updated_at, now())
where updated_at is null;

-- 2. Default for inserts that omit the column.
alter table public.ios_progress_snapshots
  alter column updated_at set default now(),
  alter column updated_at set not null;

-- 3. Trigger: stamp updated_at server-side on insert and on every update,
--    overriding any value the client may have sent.
create or replace function public.ios_progress_snapshots_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ios_progress_snapshots_set_updated_at on public.ios_progress_snapshots;

create trigger ios_progress_snapshots_set_updated_at
before insert or update on public.ios_progress_snapshots
for each row
execute function public.ios_progress_snapshots_set_updated_at();

commit;

-- Verification (run manually):
--   insert into public.ios_progress_snapshots (user_id, snapshot, client_updated_at)
--     values ('<uuid>', '{}'::jsonb, now()::text)
--     on conflict (user_id) do update set snapshot = excluded.snapshot
--     returning updated_at;
--   -- updated_at must equal the transaction time, not any client-supplied value.
