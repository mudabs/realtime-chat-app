import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Users, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

interface Conversation {
  id: string;
  is_group: boolean;
  name: string | null;
  avatar_url: string | null;
  other_user?: {
    display_name: string;
    avatar_url: string | null;
    username: string;
  };
}

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const ConversationList = ({ selectedId, onSelect }: ConversationListProps) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConvs, setSelectedConvs] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      try {
        const { data: memberData, error: memberError } = await supabase
          .from('conversation_members')
          .select(`
            conversation_id,
            conversations:conversation_id (
              id,
              is_group,
              name,
              avatar_url
            )
          `)
          .eq('user_id', user.id);

        if (memberError) throw memberError;

        const conversationIds = memberData
          .map((m: any) => m.conversations.id)
          .filter(Boolean);

        const conversationsWithDetails = await Promise.all(
          memberData.map(async (m: any) => {
            const conv = m.conversations;
            
            if (!conv.is_group) {
              const { data: otherMembers } = await supabase
                .from('conversation_members')
                .select('user_id, profiles:user_id(display_name, avatar_url, username)')
                .eq('conversation_id', conv.id)
                .neq('user_id', user.id)
                .single();

              if (otherMembers?.profiles) {
                return {
                  ...conv,
                  other_user: otherMembers.profiles,
                };
              }
            }

            return conv;
          })
        );

        setConversations(conversationsWithDetails);
      } catch (error) {
        console.error('Error fetching conversations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();

    const channel = supabase
      .channel('conversation_members_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_members',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const getConversationName = (conv: Conversation) => {
    if (conv.is_group) {
      return conv.name || 'Group Chat';
    }
    return conv.other_user?.display_name || conv.other_user?.username || 'Unknown User';
  };

  const getConversationAvatar = (conv: Conversation) => {
    if (conv.is_group) {
      return conv.avatar_url;
    }
    return conv.other_user?.avatar_url;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-muted-foreground">Loading conversations...</div>
      </div>
    );
  }

  const handleDeleteSelected = async () => {
    setIsDeleting(true);
    try {
      for (const convId of selectedConvs) {
        // Delete messages first
        await supabase.from('messages').delete().eq('conversation_id', convId);
        // Delete conversation members
        await supabase.from('conversation_members').delete().eq('conversation_id', convId);
        // Delete conversation
        await supabase.from('conversations').delete().eq('id', convId);
      }
      
      toast.success(`Deleted ${selectedConvs.size} conversation(s)`);
      setSelectedConvs(new Set());
      setShowDeleteDialog(false);
      
      // Refresh conversations
      const { data: memberData } = await supabase
        .from('conversation_members')
        .select(`
          conversation_id,
          conversations:conversation_id (
            id,
            is_group,
            name,
            avatar_url
          )
        `)
        .eq('user_id', user!.id);

      if (memberData) {
        const conversationsWithDetails = await Promise.all(
          memberData.map(async (m: any) => {
            const conv = m.conversations;
            
            if (!conv.is_group) {
              const { data: otherMembers } = await supabase
                .from('conversation_members')
                .select('user_id, profiles:user_id(display_name, avatar_url, username)')
                .eq('conversation_id', conv.id)
                .neq('user_id', user!.id)
                .maybeSingle();

              if (otherMembers?.profiles) {
                return {
                  ...conv,
                  other_user: otherMembers.profiles,
                };
              }
            }

            return conv;
          })
        );

        setConversations(conversationsWithDetails);
      }
    } catch (error) {
      console.error('Error deleting conversations:', error);
      toast.error('Failed to delete conversations');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectConv = (convId: string) => {
    const newSelected = new Set(selectedConvs);
    if (newSelected.has(convId)) {
      newSelected.delete(convId);
    } else {
      newSelected.add(convId);
    }
    setSelectedConvs(newSelected);
  };

  const filteredConversations = conversations.filter((conv) => {
    const name = getConversationName(conv).toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query);
  });

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div>
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No conversations yet</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-3 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {selectedConvs.size > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="flex-1"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete ({selectedConvs.size})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedConvs(new Set())}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredConversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer',
                selectedId === conv.id && 'bg-muted'
              )}
            >
              <input
                type="checkbox"
                checked={selectedConvs.has(conv.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleSelectConv(conv.id);
                }}
                className="w-4 h-4"
              />
              <div
                className="flex items-center gap-3 flex-1"
                onClick={() => {
                  if (selectedConvs.size === 0) {
                    onSelect(conv.id);
                  }
                }}
              >
                <Avatar className="w-10 h-10">
                  <AvatarImage src={getConversationAvatar(conv) || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                    {getInitials(getConversationName(conv))}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm">{getConversationName(conv)}</p>
                  <p className="text-xs text-muted-foreground">
                    {conv.is_group ? 'Group' : 'Direct Message'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversations?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedConvs.size} conversation(s)? This action cannot be undone and will delete all messages in these conversations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
