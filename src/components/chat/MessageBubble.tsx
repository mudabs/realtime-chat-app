import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface MessageBubbleProps {
  message: {
    content: string | null;
    created_at: string;
    attachments?: any;
    sender?: {
      display_name: string;
      username: string;
      avatar_url: string | null;
    };
  };
  isOwn: boolean;
}

export const MessageBubble = ({ message, isOwn }: MessageBubbleProps) => {
  const timestamp = format(new Date(message.created_at), 'HH:mm');

  return (
    <div
      className={cn(
        'flex gap-3 max-w-[70%]',
        isOwn ? 'ml-auto flex-row-reverse' : 'mr-auto'
      )}
    >
      {!isOwn && (
        <Avatar className="w-8 h-8 mt-1">
          <AvatarImage src={message.sender?.avatar_url || undefined} />
          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
            {message.sender?.display_name?.slice(0, 2).toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
        {!isOwn && (
          <span className="text-xs font-medium text-foreground mb-1 px-1">
            {message.sender?.display_name || message.sender?.username || 'Unknown'}
          </span>
        )}
        
        <div
          className={cn(
            'px-4 py-2 rounded-2xl transition-smooth',
            isOwn
              ? 'bg-[hsl(var(--chat-bubble-user))] text-[hsl(var(--chat-bubble-user-text))] rounded-br-md shadow-md'
              : 'bg-[hsl(var(--chat-bubble-other))] text-[hsl(var(--chat-bubble-other-text))] rounded-bl-md border border-border'
          )}
        >
          {message.attachments && Array.isArray(message.attachments) && message.attachments.length > 0 && (
            <div className="mb-2 space-y-2">
              {message.attachments.map((att: any, idx: number) => (
                <div key={idx}>
                  {att.type?.startsWith('image/') ? (
                    <img
                      src={att.url}
                      alt={att.name || 'attachment'}
                      className="rounded-lg max-w-xs max-h-64 object-cover"
                    />
                  ) : att.type?.startsWith('video/') ? (
                    <video
                      src={att.url}
                      controls
                      className="rounded-lg max-w-xs max-h-64"
                    />
                  ) : att.type?.startsWith('audio/') ? (
                    <audio src={att.url} controls className="w-full" />
                  ) : (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline"
                    >
                      📎 {att.name}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>
        
        <span
          className={cn(
            'text-xs text-muted-foreground mt-1 px-1',
            isOwn ? 'text-right' : 'text-left'
          )}
        >
          {isOwn ? 'You' : message.sender?.display_name || 'Unknown'} • {timestamp}
        </span>
      </div>
    </div>
  );
};
