import { useEffect, useMemo, useState } from 'react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { clubService } from '@/services/clubService';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, collectionGroup, query, where, getCountFromServer } from 'firebase/firestore';
import { useToast } from '@/components/ui/toast-context.jsx';
import { Users, Trash2, Shield } from 'lucide-react';

export default function SuperAdminPage() {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createName, setCreateName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [selectedClubId, setSelectedClubId] = useState('');
  const [admins, setAdmins] = useState([]);
  const [adminUsers, setAdminUsers] = useState({}); // uid -> { email }

  const [adminEmail, setAdminEmail] = useState('');
  const [athletes, setAthletes] = useState([]);
  const [athleteUsers, setAthleteUsers] = useState({});

  // Super admin management state
  const [promoteEmail, setPromoteEmail] = useState('');
  const [promoteUserId, setPromoteUserId] = useState('');
  const [athleteEmail, setAthleteEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Check if current user is super admin
  const { isSuper, userProfile } = useAuth();
  const isUserSuperAdmin = isSuper() && userProfile?.role === 'super';

  const selectedClub = useMemo(() => {
    const club = clubs.find(c => c.id === selectedClubId) || null;
    return club;
  }, [clubs, selectedClubId]);

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-600" />;
      case 'athlete':
        return <Users className="h-4 w-4 text-green-600" />;
      default:
        return <Users className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'athlete':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let data;
        if (isUserSuperAdmin) {
          // Super admins see ALL clubs
          data = await clubService.listClubs();
        } else {
          // Regular admins see only their assigned clubs
          const { memberships } = useAuth();
          const adminMemberships = (memberships || []).filter(m => m.role === 'admin');
          data = adminMemberships.map(membership => ({
            id: membership.clubId,
            name: membership.clubName,
            status: 'active' // Assume active since they're assigned
          }));
        }

        setClubs(data);
        if (data.length > 0) {
          setSelectedClubId(data[0].id);
        }
      } catch (e) {
        console.error('Failed to load clubs', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [isUserSuperAdmin]);



  useEffect(() => {
    if (!selectedClubId) return;
    (async () => {
      try {
        // Load admins
        const adminList = await clubService.listAdmins(selectedClubId);
        setAdmins(adminList);
        // Load emails for admins
        const adminEntries = await Promise.all(
          adminList.map(async (a) => {
            try {
              const snap = await getDoc(doc(db, 'users', a.id));
              return [a.id, { email: snap.exists() ? snap.data().email : '' }];
            } catch {
              return [a.id, { email: '' }];
            }
          })
        );
        setAdminUsers(Object.fromEntries(adminEntries));

        // Load athletes
        const athleteList = await clubService.listMembers(selectedClubId);
        const athletesOnly = athleteList.filter(member => member.role === 'athlete');
        setAthletes(athletesOnly);
        // Load emails for athletes
        const athleteEntries = await Promise.all(
          athletesOnly.map(async (a) => {
            try {
              const snap = await getDoc(doc(db, 'users', a.id));
              return [a.id, { email: snap.exists() ? snap.data().email : '' }];
            } catch {
              return [a.id, { email: '' }];
            }
          })
        );
        setAthleteUsers(Object.fromEntries(athleteEntries));
      } catch (e) {
        console.error('Failed to load club members', e);
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

  const handleDeleteClub = async () => {
    if (!selectedClubId || !selectedClub) return;

    // Additional confirmation check
    const confirmText = `DELETE-${selectedClub.name}`;
    const userConfirm = prompt(
      `This will permanently delete the club "${selectedClub.name}".\n\nType "${confirmText}" to confirm:`
    );

    if (userConfirm !== confirmText) {
      toast({ title: 'Deletion cancelled', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      await clubService.deleteClub(selectedClubId);
      const refreshed = await clubService.listClubs();
      setClubs(refreshed);

      // Clear selection if deleted club was selected
      if (refreshed.length > 0) {
        setSelectedClubId(refreshed[0].id);
      } else {
        setSelectedClubId('');
      }

      toast({
        title: 'Club deleted successfully',
        description: `"${selectedClub.name}" and all its data have been permanently removed.`
      });
    } catch (e) {
      console.error('Delete club failed', e);
      toast({
        title: 'Failed to delete club',
        description: 'An error occurred while deleting the club.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAssignAdmin = async () => {
    if (!selectedClubId || !adminEmail.trim()) return;
    setSaving(true);
    try {
      await clubService.assignAdminByEmail(selectedClubId, adminEmail.trim());
      // Refresh the admin list
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
      setAdminEmail('');
      toast({ title: 'Admin added successfully', description: 'User will get admin access when they register' });
    } catch (e) {
      const message = e?.message || 'Internal error';
      toast({ title: message, variant: 'destructive' });
      console.error('Assign admin failed', e);
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

  const handleAddAthlete = async () => {
    if (!selectedClubId || !athleteEmail.trim()) return;
    setSaving(true);
    try {
      await clubService.assignAthleteByEmail(selectedClubId, athleteEmail.trim());
      // Refresh the athlete list
      const athleteList = await clubService.listMembers(selectedClubId);
      const athletesOnly = athleteList.filter(member => member.role === 'athlete');
      setAthletes(athletesOnly);
      const athleteEntries = await Promise.all(
        athletesOnly.map(async (a) => {
          try {
            const snap = await getDoc(doc(db, 'users', a.id));
            return [a.id, { email: snap.exists() ? snap.data().email : '' }];
          } catch {
            return [a.id, { email: '' }];
          }
        })
      );
      setAthleteUsers(Object.fromEntries(athleteEntries));
      setAthleteEmail('');
      toast({ title: 'Athlete added successfully', description: 'User will get athlete access when they register' });
    } catch (e) {
      const message = e?.message || 'Internal error';
      toast({ title: message, variant: 'destructive' });
      console.error('Add athlete failed', e);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAthlete = async (uid) => {
    if (!selectedClubId || !uid) return;
    setSaving(true);
    try {
      await clubService.removeAthlete(selectedClubId, uid);
      // Refresh the athlete list
      const athleteList = await clubService.listMembers(selectedClubId);
      const athletesOnly = athleteList.filter(member => member.role === 'athlete');
      setAthletes(athletesOnly);
    } catch (e) {
      console.error('Remove athlete failed', e);
    } finally {
      setSaving(false);
    }
  };

  // Super Admin Management Functions
  const handlePromoteToSuperAdmin = async () => {
    if (!promoteEmail.trim()) return;
    setSaving(true);
    try {
      const result = await clubService.promoteUserByEmail(promoteEmail.trim());
      setPromoteEmail('');
      setPromoteUserId('');
      toast({
        title: 'User Promoted Successfully',
        description: `${promoteEmail.trim()} is now a super admin!`
      });
    } catch (e) {
      const message = e?.message || 'Failed to promote user';
      toast({
        title: 'Promotion Failed',
        description: message,
        variant: 'destructive'
      });
      console.error('Promote failed', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDemoteFromSuperAdmin = async () => {
    if (!promoteUserId) return;
    setSaving(true);
    try {
      const result = await clubService.demoteFromSuperAdmin(promoteUserId);
      setPromoteEmail('');
      setPromoteUserId('');
      toast({
        title: 'User Demoted Successfully',
        description: 'Super admin privileges removed'
      });
    } catch (e) {
      const message = e?.message || 'Failed to demote user';
      toast({
        title: 'Demotion Failed',
        description: message,
        variant: 'destructive'
      });
      console.error('Demote failed', e);
    } finally {
      setSaving(false);
    }
  };

  const handleFindUser = async () => {
    if (!promoteEmail.trim()) return;
    setSaving(true);
    try {
      const user = await clubService.getUserByEmail(promoteEmail.trim());
      setPromoteUserId(user.id);
      toast({
        title: 'User Found',
        description: `Found user: ${user.email} (${user.role || 'no role'})`
      });
    } catch (e) {
      const message = e?.message || 'Failed to find user';
      toast({
        title: 'User Not Found',
        description: message,
        variant: 'destructive'
      });
      console.error('Find user failed', e);
      setPromoteUserId('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-6xl mx-auto p-4 space-y-6">
        <h1 className="text-2xl font-semibold">
          {isUserSuperAdmin ? 'Super Admin' : 'Club Admin'}
        </h1>



        {isUserSuperAdmin && (
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
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              Manage Clubs {isUserSuperAdmin && '(All Clubs)'}
            </CardTitle>
            <CardDescription>
              {isUserSuperAdmin
                ? 'Manage all clubs in the system - deactivate, activate, or delete any club'
                : 'Manage your assigned clubs'
              }
            </CardDescription>
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

              {/* Club Status Controls - Always Visible */}
              {selectedClub && (
                <div className="flex gap-2 ml-4 pl-4 border-l border-border">
                  {selectedClub.status === 'inactive' ? (
                    <>
                      <Button onClick={handleActivateClub} disabled={saving} className="bg-green-600 hover:bg-green-700">
                        ✅ Activate Club
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" disabled={saving}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            🗑️ Delete Club
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Club Permanently</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you absolutely sure you want to delete "{selectedClub?.name}"?
                              <br /><br />
                              This action will permanently delete:
                              <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>All club members and their memberships</li>
                                <li>All training programs and schedules</li>
                                <li>All attendance records and sessions</li>
                                <li>All club settings and data</li>
                              </ul>
                              <br />
                              This action cannot be undone and will affect {admins.length + athletes.length} users.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDeleteClub}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete Club Forever
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  ) : (
                    <Button variant="destructive" onClick={handleDeactivateClub} disabled={saving}>
                      🚫 Deactivate Club
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {isUserSuperAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Super Admin Management</CardTitle>
              <CardDescription>
                Promote users to super admin or demote them from super admin role
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Find and Manage User</h4>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="user@example.com"
                      value={promoteEmail}
                      onChange={(e) => setPromoteEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={handleFindUser} disabled={saving || !promoteEmail.trim()}>
                      Find User
                    </Button>
                  </div>
                </div>

                {promoteUserId && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">User Actions</h4>
                    <div className="flex gap-2">
                      <Button
                        onClick={handlePromoteToSuperAdmin}
                        disabled={saving}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        Promote to Super Admin
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleDemoteFromSuperAdmin}
                        disabled={saving}
                      >
                        Demote from Super Admin
                      </Button>
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground space-y-1">
                  <div>💡 <strong>How to use:</strong></div>
                  <div>1. Enter a user's email address</div>
                  <div>2. Click "Find User" to locate them</div>
                  <div>3. Use "Promote to Super Admin" or "Demote from Super Admin"</div>
                  <div>⚠️ <strong>Warning:</strong> Super admin has full system access</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
            {loading ? (
              <div className="text-center py-4">Loading admins...</div>
            ) : admins.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No admins yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{adminUsers[a.id]?.email || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getRoleIcon(a.role)}
                          <Badge className={getRoleBadgeColor(a.role)}>
                            {a.role}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Admin</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove {adminUsers[a.id]?.email || a.id} from this club?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemoveAdmin(a.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Athletes for Selected Club</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedClubId && (
              <p className="text-sm text-muted-foreground">Create or select a club to manage athletes.</p>
            )}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Athlete email"
                value={athleteEmail}
                onChange={(e) => setAthleteEmail(e.target.value)}
                className="max-w-sm"
              />
              <Button onClick={handleAddAthlete} disabled={!selectedClubId || saving}>Add Athlete</Button>
            </div>
            <Separator />
            {loading ? (
              <div className="text-center py-4">Loading athletes...</div>
            ) : athletes.length === 0 && selectedClubId ? (
              <div className="text-center py-4 text-muted-foreground">
                No athletes yet.
              </div>
            ) : athletes.length === 0 ? null : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {athletes.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{athleteUsers[a.id]?.email || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getRoleIcon(a.role)}
                          <Badge className={getRoleBadgeColor(a.role)}>
                            {a.role}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Athlete</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove {athleteUsers[a.id]?.email || a.id} from this club?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemoveAthlete(a.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}


