import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';

interface Message {
  id: number;
  conversation_id: string;
  sender_id: string | null;
  content: string | null;
  attachments: any;
  created_at: string;
  sender?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

interface ChatRoomProps {
  conversationId: string;
}

export const ChatRoom = ({ conversationId }: ChatRoomProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversationName, setConversationName] = useState('');
  const [otherUserUsername, setOtherUserUsername] = useState('');
  const [otherUserAvatar, setOtherUserAvatar] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId || !user) return;

      const fetchMessages = async () => {
      setLoading(true);
      try {
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;

        const messagesWithSenders = await Promise.all(
          (messagesData || []).map(async (msg) => {
            if (msg.sender_id) {
              const { data: senderData } = await supabase
                .from('profiles')
                .select('display_name, username, avatar_url')
                .eq('id', msg.sender_id)
                .single();

              return {
                ...msg,
                sender: senderData || undefined,
              };
            }
            return msg;
          })
        );

        setMessages(messagesWithSenders as Message[]);

        const { data: convData } = await supabase
          .from('conversations')
          .select('is_group, name')
          .eq('id', conversationId)
          .single();

        if (convData) {
          if (convData.is_group) {
            setConversationName(convData.name || 'Group Chat');
          } else {
            const { data: otherMemberData } = await supabase
              .from('conversation_members')
              .select('user_id')
              .eq('conversation_id', conversationId)
              .neq('user_id', user.id)
              .single();

            if (otherMemberData) {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('display_name, username, avatar_url')
                .eq('id', otherMemberData.user_id)
                .single();

              if (profileData) {
                setConversationName(profileData.display_name || profileData.username);
                setOtherUserUsername(profileData.username);
                setOtherUserAvatar(profileData.avatar_url);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const { data: senderData } = await supabase
            .from('profiles')
            .select('display_name, username, avatar_url')
            .eq('id', payload.new.sender_id)
            .single();

          const newMessage = {
            ...payload.new,
            sender: senderData,
          } as Message;

          setMessages((prev) => [...prev, newMessage]);
          setTimeout(() => scrollToBottom(), 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSendMessage = async (content: string, attachments?: any[]) => {
    if (!user || (!content.trim() && !attachments)) return;

    try {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: content.trim() || null,
        attachments: attachments || null,
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={otherUserAvatar || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
              {conversationName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold">{conversationName}</h2>
            <p className="text-xs text-muted-foreground">
              {otherUserUsername ? `@${otherUserUsername}` : 'Active now'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-6" ref={scrollRef}>
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.sender_id === user?.id}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Composer */}
      <MessageComposer onSend={handleSendMessage} />
    </div>
  );
};
