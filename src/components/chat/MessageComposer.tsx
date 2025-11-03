import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Image, Paperclip } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface MessageComposerProps {
  onSend: (content: string, attachments?: any[]) => void;
}

export const MessageComposer = ({ onSend }: MessageComposerProps) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setUploading(true);
    try {
      const uploadedFiles = [];

      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from('attachments')
          .upload(fileName, file);

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from('attachments')
          .getPublicUrl(fileName);

        uploadedFiles.push({
          path: fileName,
          url: urlData.publicUrl,
          type: file.type,
          name: file.name,
        });
      }

      setAttachments([...attachments, ...uploadedFiles]);
      toast.success('Files uploaded successfully');
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Failed to upload files');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSend = () => {
    if (message.trim() || attachments.length > 0) {
      onSend(message, attachments.length > 0 ? attachments : undefined);
      setMessage('');
      setAttachments([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border bg-card px-6 py-4">
      <div className="max-w-4xl mx-auto space-y-2">
        {attachments.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {attachments.map((att, idx) => (
              <div key={idx} className="relative bg-muted p-2 rounded text-xs">
                {att.name}
                <button
                  onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                  className="ml-2 text-destructive"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 h-11 w-11"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
            disabled={uploading}
          />
          <Button
            onClick={handleSend}
            disabled={(!message.trim() && attachments.length === 0) || uploading}
            size="icon"
            className="shrink-0 h-11 w-11"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
