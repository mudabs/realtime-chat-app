-- Drop the problematic RLS policies
drop policy if exists "members_select_for_user" on public.conversation_members;
drop policy if exists "members_insert" on public.conversation_members;

-- Create corrected policies
-- Allow users to select their own memberships
create policy "members_select_for_user" on public.conversation_members
  for select using (user_id = auth.uid());

-- Allow conversation creator to add members, or users to add themselves
create policy "members_insert" on public.conversation_members
  for insert with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_members.conversation_id
        and c.created_by = auth.uid()
    )
    or user_id = auth.uid()
  );