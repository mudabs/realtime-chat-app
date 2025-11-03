-- Create profiles table for user information
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  status text default 'online',
  created_at timestamptz default now()
);

-- Create conversations table (DMs & groups)
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  name text,
  avatar_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Create conversation_members table
create table public.conversation_members (
  id bigserial primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  role text default 'member',
  unique (conversation_id, user_id)
);

create index on public.conversation_members (user_id);
create index on public.conversation_members (conversation_id);

-- Create messages table
create table public.messages (
  id bigserial primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  content text,
  attachments jsonb,
  created_at timestamptz default now(),
  edited_at timestamptz
);

create index on public.messages (conversation_id, created_at desc);
create index on public.messages (sender_id);

-- Create message_reads table for read receipts
create table public.message_reads (
  id bigserial primary key,
  message_id bigint references public.messages(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  read_at timestamptz default now(),
  unique (message_id, user_id)
);

create index on public.message_reads (message_id);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;

-- Profiles policies
create policy "profiles_read_authenticated" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Conversations policies
create policy "conversations_select_member" on public.conversations
  for select using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = public.conversations.id
        and cm.user_id = auth.uid()
    )
  );

create policy "conversations_insert_authenticated" on public.conversations
  for insert with check (auth.role() = 'authenticated' and created_by = auth.uid());

-- Conversation members policies
create policy "members_select_for_user" on public.conversation_members
  for select using (
    user_id = auth.uid() or
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = public.conversation_members.conversation_id
        and cm.user_id = auth.uid()
    )
  );

create policy "members_insert" on public.conversation_members
  for insert with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.created_by = auth.uid()
    )
  );

-- Messages policies
create policy "messages_select_if_member" on public.messages
  for select using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = public.messages.conversation_id
        and cm.user_id = auth.uid()
    )
  );

create policy "messages_insert_member_only" on public.messages
  for insert with check (
    auth.role() = 'authenticated'
    and sender_id = auth.uid()
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = public.messages.conversation_id
        and cm.user_id = auth.uid()
    )
  );

-- Message reads policies
create policy "message_reads_select" on public.message_reads
  for select using (
    exists (
      select 1 from public.messages m
      join public.conversation_members cm on m.conversation_id = cm.conversation_id
      where m.id = message_id and cm.user_id = auth.uid()
    )
  );

create policy "message_reads_insert" on public.message_reads
  for insert with check (user_id = auth.uid());

-- Create trigger function for auto-creating profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

-- Trigger to create profile on user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable realtime for messages
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversation_members;