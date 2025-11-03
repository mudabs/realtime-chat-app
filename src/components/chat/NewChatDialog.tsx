import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Search } from 'lucide-react';

interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (id: string) => void;
}

export const NewChatDialog = ({ open, onOpenChange, onConversationCreated }: NewChatDialogProps) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchUsers();
    }
  }, [open, user]);

  const fetchUsers = async () => {
    try {
      // Get all existing conversation partners
      const { data: myConversations } = await supabase
        .from('conversation_members')
        .select('conversation_id, conversations:conversation_id(is_group)')
        .eq('user_id', user?.id);

      const existingPartnerIds = new Set<string>();
      
      if (myConversations) {
        for (const conv of myConversations) {
          if (conv.conversations && !conv.conversations.is_group) {
            const { data: otherMember } = await supabase
              .from('conversation_members')
              .select('user_id')
              .eq('conversation_id', conv.conversation_id)
              .neq('user_id', user?.id)
              .maybeSingle();
            
            if (otherMember) {
              existingPartnerIds.add(otherMember.user_id);
            }
          }
        }
      }

      // Fetch all users except current user
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user?.id);

      if (error) throw error;

      // Filter out users who already have conversations with current user
      const availableUsers = (data || []).filter(
        (profile) => !existingPartnerIds.has(profile.id)
      );

      setUsers(availableUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const createConversation = async (otherUserId: string) => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: existingConv } = await supabase
        .from('conversation_members')
        .select('conversation_id, conversations:conversation_id(is_group)')
        .eq('user_id', user.id);

      if (existingConv) {
        for (const conv of existingConv) {
          if (conv.conversations && !conv.conversations.is_group) {
            const { data: otherMember } = await supabase
              .from('conversation_members')
              .select('user_id')
              .eq('conversation_id', conv.conversation_id)
              .neq('user_id', user.id)
              .maybeSingle();

            if (otherMember?.user_id === otherUserId) {
              onConversationCreated(conv.conversation_id);
              onOpenChange(false);
              return;
            }
          }
        }
      }

      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert([
          {
            is_group: false,
            created_by: user.id,
          },
        ])
        .select()
        .single();

      if (convError) throw convError;

      const { error: membersError } = await supabase
        .from('conversation_members')
        .insert([
          { conversation_id: newConv.id, user_id: user.id },
          { conversation_id: newConv.id, user_id: otherUserId },
        ]);

      if (membersError) throw membersError;

      toast.success('Conversation created!');
      onConversationCreated(newConv.id);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to create conversation');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a new chat</DialogTitle>
          <DialogDescription>
            Select a user to start a conversation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {filteredUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No users found</p>
              ) : (
                filteredUsers.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => createConversation(profile.id)}
                    disabled={loading}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                        {profile.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-sm">{profile.display_name}</p>
                      <p className="text-xs text-muted-foreground">@{profile.username}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
