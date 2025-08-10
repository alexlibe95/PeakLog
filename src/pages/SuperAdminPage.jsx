import { useEffect, useMemo, useState } from 'react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { clubService } from '@/services/clubService';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, collectionGroup, query, where, getCountFromServer } from 'firebase/firestore';
import { useToast } from '@/components/ui/toast-context.jsx';

export default function SuperAdminPage() {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createName, setCreateName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [selectedClubId, setSelectedClubId] = useState('');
  const [admins, setAdmins] = useState([]);
  const [adminUsers, setAdminUsers] = useState({}); // uid -> { email }
  const [adminInvites, setAdminInvites] = useState([]);
  const [adminEmail, setAdminEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [statsLoading, setStatsLoading] = useState(false);
  const [totalClubs, setTotalClubs] = useState(0);
  const [totalAdmins, setTotalAdmins] = useState(0);
  const [totalAthletes, setTotalAthletes] = useState(0);

  const selectedClub = useMemo(() => clubs.find(c => c.id === selectedClubId) || null, [clubs, selectedClubId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await clubService.listClubs();
        setClubs(data);
        if (data.length > 0) setSelectedClubId(data[0].id);
      } catch (e) {
        console.error('Failed to load clubs', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setStatsLoading(true);
      try {
        const clubsCountSnap = await getCountFromServer(collection(db, 'clubs'));
        // Fallback: count admins/athletes by scanning clubs and summing members
        const clubSnaps = await Promise.all(clubs.map(async (c) => {
          const adminsSnap = await getCountFromServer(query(collection(db, 'clubs', c.id, 'members'), where('role', '==', 'admin')));
          const athletesSnap = await getCountFromServer(query(collection(db, 'clubs', c.id, 'members'), where('role', '==', 'athlete')));
          return {
            admins: adminsSnap.data().count || 0,
            athletes: athletesSnap.data().count || 0,
          };
        }));
        const sums = clubSnaps.reduce((acc, cur) => ({ admins: acc.admins + cur.admins, athletes: acc.athletes + cur.athletes }), { admins: 0, athletes: 0 });
        setTotalClubs(clubsCountSnap.data().count || 0);
        setTotalAdmins(sums.admins);
        setTotalAthletes(sums.athletes);
      } catch (e) {
        console.error('Failed to load stats', e);
      } finally {
        setStatsLoading(false);
      }
    })();
  }, [clubs]);

  useEffect(() => {
    if (!selectedClubId) return;
    (async () => {
      try {
        const list = await clubService.listAdmins(selectedClubId);
        setAdmins(list);
        // Load emails for admins
        const entries = await Promise.all(
          list.map(async (a) => {
            try {
              const snap = await getDoc(doc(db, 'users', a.id));
              return [a.id, { email: snap.exists() ? snap.data().email : '' }];
            } catch {
              return [a.id, { email: '' }];
            }
          })
        );
        setAdminUsers(Object.fromEntries(entries));
        const invites = await clubService.listInvites(selectedClubId);
        setAdminInvites(invites.filter((i) => i.role === 'admin'));
      } catch (e) {
        console.error('Failed to load admins', e);
      }
    })();
  }, [selectedClubId]);

  const handleCreateClub = async () => {
    if (!createName.trim()) return;
    setSaving(true);
    try {
      const exists = await clubService.clubNameExists(createName.trim());
      if (exists) return toast({ title: 'Name already exists', variant: 'destructive' });
      const id = await clubService.createClub(createName.trim());
      const refreshed = await clubService.listClubs();
      setClubs(refreshed);
      setSelectedClubId(id);
      setCreateName('');
      toast({ title: 'Club created' });
    } catch (e) {
      console.error('Create club failed', e);
      toast({ title: 'Failed to create club', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRenameClub = async () => {
    if (!selectedClubId || !selectedClub) return;
    if (!renameName.trim()) return;
    setSaving(true);
    try {
      const exists = await clubService.clubNameExists(renameName.trim(), selectedClubId);
      if (exists) return toast({ title: 'Name already exists', variant: 'destructive' });
      await clubService.renameClub(selectedClubId, renameName.trim());
      const refreshed = await clubService.listClubs();
      setClubs(refreshed);
      setRenameName('');
      toast({ title: 'Club renamed' });
    } catch (e) {
      console.error('Rename club failed', e);
      toast({ title: 'Failed to rename club', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateClub = async () => {
    if (!selectedClubId) return;
    setSaving(true);
    try {
      await clubService.deactivateClub(selectedClubId);
      const refreshed = await clubService.listClubs();
      setClubs(refreshed);
      toast({ title: 'Club deactivated' });
    } catch (e) {
      console.error('Deactivate club failed', e);
      toast({ title: 'Failed to deactivate club', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleActivateClub = async () => {
    if (!selectedClubId) return;
    setSaving(true);
    try {
      await clubService.activateClub(selectedClubId);
      const refreshed = await clubService.listClubs();
      setClubs(refreshed);
      toast({ title: 'Club activated' });
    } catch (e) {
      console.error('Activate club failed', e);
      toast({ title: 'Failed to activate club', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAssignAdmin = async () => {
    if (!selectedClubId || !adminEmail.trim()) return;
    setSaving(true);
    try {
      const token = await clubService.assignAdminByEmail(selectedClubId, adminEmail.trim());
      const list = await clubService.listAdmins(selectedClubId);
      setAdmins(list);
      const entries = await Promise.all(
        list.map(async (a) => {
          try {
            const snap = await getDoc(doc(db, 'users', a.id));
            return [a.id, { email: snap.exists() ? snap.data().email : '' }];
          } catch {
            return [a.id, { email: '' }];
          }
        })
      );
      setAdminUsers(Object.fromEntries(entries));
      const invites = await clubService.listInvites(selectedClubId);
      setAdminInvites(invites.filter((i) => i.role === 'admin'));
      setAdminEmail('');
      toast({ title: 'Admin invite created', description: 'Link copied to clipboard' });
      navigator.clipboard.writeText(`${window.location.origin}/auth-callback?invite=${token}&club=${selectedClubId}`);
    } catch (e) {
      const message = e?.message || 'Internal error';
      toast({ title: message, variant: 'destructive' });
      console.error('Assign admin failed', e);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyInvite = async (inviteId) => {
    if (!selectedClubId) return;
    await navigator.clipboard.writeText(`${window.location.origin}/auth-callback?invite=${inviteId}&club=${selectedClubId}`);
    toast({ title: 'Link copied' });
  };

  const handleRevokeAdminInvite = async (inviteId) => {
    if (!selectedClubId) return;
    setSaving(true);
    try {
      await clubService.revokeInvite(selectedClubId, inviteId);
      const invites = await clubService.listInvites(selectedClubId);
      setAdminInvites(invites.filter((i) => i.role === 'admin'));
      toast({ title: 'Invite revoked' });
    } catch (e) {
      console.error('Revoke admin invite failed', e);
      toast({ title: 'Failed to revoke invite', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAdmin = async (uid) => {
    if (!selectedClubId || !uid) return;
    setSaving(true);
    try {
      await clubService.removeAdmin(selectedClubId, uid);
      const list = await clubService.listAdmins(selectedClubId);
      setAdmins(list);
    } catch (e) {
      console.error('Remove admin failed', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-6xl mx-auto p-4 space-y-6">
        <h1 className="text-2xl font-semibold">Super Admin</h1>

        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded p-4">
                <div className="text-sm text-muted-foreground">Clubs</div>
                <div className="text-2xl font-bold">{statsLoading ? '—' : totalClubs}</div>
              </div>
              <div className="border rounded p-4">
                <div className="text-sm text-muted-foreground">Admins</div>
                <div className="text-2xl font-bold">{statsLoading ? '—' : totalAdmins}</div>
              </div>
              <div className="border rounded p-4">
                <div className="text-sm text-muted-foreground">Athletes</div>
                <div className="text-2xl font-bold">{statsLoading ? '—' : totalAthletes}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create Club</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                placeholder="Club name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="max-w-xs"
              />
              <Button onClick={handleCreateClub} disabled={saving || loading || !createName.trim()}>Create</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manage Clubs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
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
              <Input
                placeholder="Rename selected club"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                className="max-w-xs"
              />
              <Button variant="outline" onClick={handleRenameClub} disabled={!selectedClub || saving || !renameName.trim()}>Rename</Button>
              {selectedClub?.status === 'inactive' ? (
                <Button onClick={handleActivateClub} disabled={!selectedClub || saving}>Activate</Button>
              ) : (
                <Button variant="destructive" onClick={handleDeactivateClub} disabled={!selectedClub || saving}>Deactivate</Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Admins for Selected Club</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedClubId && (
              <p className="text-sm text-muted-foreground">Create or select a club to manage admins.</p>
            )}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Admin email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="max-w-sm"
              />
              <Button onClick={handleAssignAdmin} disabled={!selectedClubId || saving}>Add Admin</Button>
            </div>
            <Separator />
            <div className="space-y-2">
              {admins.length === 0 && (
                <p className="text-sm text-muted-foreground">No admins yet.</p>
              )}
              {admins.map((a) => (
                <div key={a.id} className="flex items-center justify-between border rounded px-3 py-2">
                  <div className="text-sm">
                    <div className="font-medium">{adminUsers[a.id]?.email || a.id}</div>
                    <div className="text-muted-foreground">role: {a.role}</div>
                  </div>
                  <Button variant="outline" onClick={() => handleRemoveAdmin(a.id)} disabled={saving}>Remove</Button>
                </div>
              ))}
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">Pending Admin Invites</p>
              {adminInvites.length === 0 && (
                <p className="text-sm text-muted-foreground">No pending invites.</p>
              )}
              {adminInvites.map((i) => (
                <div key={i.id} className="flex items-center justify-between border rounded px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{i.email}</div>
                    <div className="text-muted-foreground">status: {i.status} • expires: {i.expiresAt}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => handleCopyInvite(i.id)}>Copy Link</Button>
                    <Button variant="destructive" onClick={() => handleRevokeAdminInvite(i.id)} disabled={saving}>Revoke</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}


