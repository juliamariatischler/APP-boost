import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Search, UserPlus, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDisplayName } from '@/lib/formatName';

interface Profile {
  id: string;
  username: string;
  school: string;
  class: string;
}

interface FriendSearchProps {
  currentUserId: string;
  onFriendSelect: (friend: Profile) => void;
}

export const FriendSearch = ({ currentUserId, onFriendSelect }: FriendSearchProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, school, class')
        .ilike('username', `%${searchQuery}%`)
        .neq('id', currentUserId)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Fehler bei der Suche');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Username eingeben..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={isSearching} size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {searchResults.length > 0 && (
        <div className="space-y-2">
          {searchResults.map((user) => (
            <Card
              key={user.id}
              className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onFriendSelect(user)}
            >
              <div>
                <p className="font-medium">{formatDisplayName(user.username)}</p>
                <p className="text-sm text-muted-foreground">
                  {user.school} • Klasse {user.class}
                </p>
              </div>
              <Button size="sm" variant="ghost">
                <UserPlus className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      {searchResults.length === 0 && searchQuery && !isSearching && (
        <p className="text-center text-muted-foreground py-4">
          Keine Benutzer gefunden
        </p>
      )}
    </div>
  );
};
