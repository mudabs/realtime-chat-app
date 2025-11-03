-- Ensure creator is set from JWT and creator can read the conversation immediately

-- 1) Function to set created_by from auth.uid()
create or replace function public.set_conversation_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by := auth.uid();
  return new;
end;
$$;

-- 2) Trigger to apply it on insert
drop trigger if exists set_conversation_creator on public.conversations;
create trigger set_conversation_creator
before insert on public.conversations
for each row
execute function public.set_conversation_creator();

-- 3) Allow conversation creator to select their conversation right after insert (for returning *)
drop policy if exists "conversations_select_creator" on public.conversations;
create policy "conversations_select_creator" on public.conversations
  for select using (created_by = auth.uid());