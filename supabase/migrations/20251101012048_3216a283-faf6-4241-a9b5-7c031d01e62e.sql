-- Create storage buckets for avatars and message attachments

-- 1) Create avatars bucket (public)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 2) Create attachments bucket (private)
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- 3) Storage policies for avatars
create policy "Anyone can view avatars"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
on storage.objects for insert
with check (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can update their own avatar"
on storage.objects for update
using (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their own avatar"
on storage.objects for delete
using (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4) Storage policies for attachments
create policy "Users can view attachments in their conversations"
on storage.objects for select
using (
  bucket_id = 'attachments'
  AND EXISTS (
    SELECT 1 FROM messages m
    JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
    WHERE m.attachments::jsonb @> jsonb_build_array(jsonb_build_object('path', name))
    AND cm.user_id = auth.uid()
  )
);

create policy "Users can upload attachments"
on storage.objects for insert
with check (
  bucket_id = 'attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5) Add RLS policy to allow users to delete their own conversations
create policy "conversations_delete_creator" on public.conversations
  for delete using (created_by = auth.uid());

create policy "conversation_members_delete" on public.conversation_members
  for delete using (user_id = auth.uid());

create policy "messages_delete_sender" on public.messages
  for delete using (sender_id = auth.uid());