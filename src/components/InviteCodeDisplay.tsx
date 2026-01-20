import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Copy, Check, QrCode, Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface InviteCodeDisplayProps {
  inviteCode: string;
  challengeName: string;
}

export const InviteCodeDisplay = ({ inviteCode, challengeName }: InviteCodeDisplayProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      toast.success('Code kopiert!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Kopieren fehlgeschlagen');
    }
  };

  const handleShare = async () => {
    const shareText = `Hey! Ich fordere dich zu einer ${challengeName} Challenge heraus! 💪\n\nCode: ${inviteCode}\n\nÖffne die BOOST App und gib den Code ein!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'BOOST Challenge',
          text: shareText,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20">
          <QrCode className="h-8 w-8 text-primary" />
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground mb-2">Einladungscode</p>
          <p className="text-3xl font-bold tracking-widest text-primary">{inviteCode}</p>
        </div>

        <p className="text-sm text-muted-foreground">
          Teile diesen Code mit deinem Freund, damit er die Challenge annehmen kann!
        </p>

        <div className="flex gap-2 justify-center">
          <Button onClick={handleCopy} variant="outline" size="sm">
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? 'Kopiert!' : 'Kopieren'}
          </Button>
          <Button onClick={handleShare} size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Teilen
          </Button>
        </div>
      </div>
    </Card>
  );
};
