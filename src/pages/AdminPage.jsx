import Navigation from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/toast-context.jsx';
import { useEffect, useState } from 'react';
import { clubService } from '@/services/clubService';

function AdminPage() {
  const { userProfile, isSuper } = useAuth();
  const { toast } = useToast();
  const [invites, setInvites] = useState([]);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [clubs, setClubs] = useState([]);
  const [selectedClubId, setSelectedClubId] = useState('');

  const effectiveClubId = isSuper() ? selectedClubId : (userProfile?.teamId || '');

  useEffect(() => {
    if (isSuper()) {
      (async () => {
        try {
          const c = await clubService.listClubs();
          setClubs(c);
          if (!selectedClubId && c.length > 0) setSelectedClubId(c[0].id);
        } catch (e) {
          console.error('Failed to load clubs', e);
        }
      })();
    } else {
      setSelectedClubId(userProfile?.teamId || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper, userProfile?.teamId]);

  useEffect(() => {
    if (!effectiveClubId) return;
    (async () => {
      try {
        const list = await clubService.listInvites(effectiveClubId);
        setInvites(list);
      } catch (e) {
        console.error('Failed to load invites', e);
      }
    })();
  }, [effectiveClubId]);

  const handleInvite = async () => {
    if (!effectiveClubId || !email.trim()) return;
    setSaving(true);
    try {
      const token = await clubService.createInvite(effectiveClubId, email.trim(), 'athlete');
      const list = await clubService.listInvites(effectiveClubId);
      setInvites(list);
      setEmail('');
      toast({ title: 'Invite created', description: 'Link copied to clipboard' });
      navigator.clipboard.writeText(`${window.location.origin}/auth-callback?invite=${token}&club=${effectiveClubId}`);
    } catch (e) {
      console.error('Invite failed', e);
      toast({ title: 'Invite failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (inviteId) => {
    if (!effectiveClubId) return;
    setSaving(true);
    try {
      await clubService.revokeInvite(effectiveClubId, inviteId);
      const list = await clubService.listInvites(effectiveClubId);
      setInvites(list);
      toast({ title: 'Invite revoked' });
    } catch (e) {
      console.error('Revoke failed', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-6xl mx-auto p-4 space-y-6">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <Card>
          <CardHeader>
            <CardTitle>Invite Athletes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSuper() && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Club</span>
                <select
                  className="border rounded px-2 py-1"
                  value={selectedClubId}
                  onChange={(e) => setSelectedClubId(e.target.value)}
                >
                  {clubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.status === 'inactive' ? '(inactive)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input placeholder="athlete@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button onClick={handleInvite} disabled={saving || !effectiveClubId}>Generate Invite</Button>
            </div>
            {/* Pending invites listing is moved to Super Admin tab */}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
export default AdminPage;
