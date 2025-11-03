import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { NewChatDialog } from '@/components/chat/NewChatDialog';
import { Button } from '@/components/ui/button';
import { LogOut, MessageSquarePlus, Settings } from 'lucide-react';
import { toast } from 'sonner';

const Chat = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Logged out successfully');
      navigate('/auth');
    } catch (error: any) {
      toast.error('Failed to logout');
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-primary to-accent p-2 rounded-xl shadow-md">
            <MessageSquarePlus className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gradient">Chat App</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate('/settings')} variant="ghost" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button onClick={handleLogout} variant="ghost" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 border-r border-border flex flex-col bg-card">
          <div className="p-4 border-b border-border">
            <Button
              onClick={() => setShowNewChat(true)}
              className="w-full"
              size="sm"
            >
              <MessageSquarePlus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          </div>
          <ConversationList
            selectedId={selectedConversation}
            onSelect={setSelectedConversation}
          />
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <ChatRoom conversationId={selectedConversation} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <div className="bg-gradient-to-br from-primary/10 to-accent/10 p-8 rounded-2xl mb-4 inline-block">
                  <MessageSquarePlus className="w-16 h-16 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Welcome to Chat</h2>
                <p className="text-muted-foreground mb-6">
                  Select a conversation or start a new one
                </p>
                <Button onClick={() => setShowNewChat(true)}>
                  <MessageSquarePlus className="w-4 h-4 mr-2" />
                  Start New Chat
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <NewChatDialog
        open={showNewChat}
        onOpenChange={setShowNewChat}
        onConversationCreated={(id) => {
          setSelectedConversation(id);
          setShowNewChat(false);
        }}
      />
    </div>
  );
};

export default Chat;
