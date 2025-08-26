import Navigation from '@/components/Navigation';
import ClubSelector from '@/components/ClubSelector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/toast-context.jsx';
import { useEffect, useState, useCallback } from 'react';
import { clubService } from '@/services/clubService';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Shield, Trash2, Users, UserPlus } from 'lucide-react';

function AdminPage() {
  const { userProfile, isSuper, currentClubId, memberships, claims } = useAuth();
  const { toast } = useToast();

  // Check if user is super admin
  const isUserSuperAdmin = isSuper() && userProfile?.role === 'super';

  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [clubs, setClubs] = useState([]);
  const [selectedClubId, setSelectedClubId] = useState('');
  const [inviteRole, setInviteRole] = useState('athlete');

  // Regular admin specific state
  const [selectedAdminClubId, setSelectedAdminClubId] = useState('');
  const [regularMembers, setRegularMembers] = useState([]);
  const [regularMembersLoading, setRegularMembersLoading] = useState(false);

  // Super admin specific state
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [adminUsers, setAdminUsers] = useState({});
  const [athletes, setAthletes] = useState([]);
  const [athleteUsers, setAthleteUsers] = useState({});

  // Get admin memberships
  const adminMemberships = (memberships || []).filter(m => m.role === 'admin');

  // Calculate effective club ID more robustly
  const getEffectiveClubId = () => {
    if (isSuper()) {
      return selectedClubId;
    }

    // For regular admins, prioritize selected club, then current club, then first membership
    if (selectedAdminClubId) {
      return selectedAdminClubId;
    }

    if (currentClubId) {
      return currentClubId;
    }

    if (adminMemberships.length > 0) {
      return adminMemberships[0].clubId;
    }

    return userProfile?.teamId || '';
  };

  const effectiveClubId = getEffectiveClubId();

  // Initialize selected club for regular admins
  useEffect(() => {
    if (!isSuper() && adminMemberships.length > 0 && !selectedAdminClubId) {
      setSelectedAdminClubId(currentClubId || adminMemberships[0].clubId);
    }
  }, [isSuper, adminMemberships, currentClubId, selectedAdminClubId]);

  // Handle club switching for regular admins
  useEffect(() => {
    if (!isSuper() && selectedAdminClubId && selectedAdminClubId !== currentClubId) {
      // Update the current club context when admin switches clubs
      const membership = adminMemberships.find(m => m.clubId === selectedAdminClubId);
      if (membership) {
        // You might want to update the global context here
        // For now, we'll just ensure the effectiveClubId is updated
      }
    }
  }, [selectedAdminClubId, currentClubId, isSuper, adminMemberships]);

  // Load regular admin members
  const loadRegularMembers = useCallback(async () => {
    if (!effectiveClubId || isSuper()) return;

    setRegularMembersLoading(true);
    try {
      const membersData = await clubService.getClubMembersWithDetails(effectiveClubId) || [];
      // Sort members: admins first, then athletes
      const sortedMembers = membersData.sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return 0; // Keep same role members in original order
      });
      setRegularMembers(sortedMembers);
    } catch (error) {
      console.error('Error loading members:', error);
      toast({
        title: 'Error loading data',
        variant: 'destructive'
      });
    } finally {
      setRegularMembersLoading(false);
    }
  }, [effectiveClubId, isSuper, toast]);

  // Load members when club changes
  useEffect(() => {
    if (!isSuper() && effectiveClubId) {
      loadRegularMembers();
    }
  }, [effectiveClubId, isSuper, loadRegularMembers]);

  // Selected club for super admin
  const selectedClub = (clubs || []).find(c => c.id === selectedClubId) || null;

  // Helper functions for role display
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
    if (isSuper()) {
      // Super admins can see all clubs
      (async () => {
        try {
          const c = await clubService.listClubs();
          setClubs(c);
          if (!selectedClubId && c.length > 0) setSelectedClubId(c[0].id);
        } catch (e) {
          console.error('Failed to load clubs', e);
        }
      })();
    } else if (adminMemberships.length > 0) {
      // Regular admins can only see clubs they are assigned to
      const adminClubs = adminMemberships.map(membership => ({
        id: membership.clubId,
        name: membership.clubName,
        status: 'active' // Assume active since they are assigned
      }));
      setClubs(adminClubs);
      if (!effectiveClubId && adminClubs.length > 0) {
        // Set the first admin club as selected
        setSelectedClubId(adminClubs[0].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.role, claims?.super_admin, memberships, selectedClubId, currentClubId]);

  // Super admin specific useEffect hooks
  useEffect(() => {
    if (isSuper()) {
      // Load clubs for super admin
      (async () => {
        try {
          const data = await clubService.listClubs();
          setClubs(data);
          if (data.length > 0) setSelectedClubId(data[0].id);
        } catch (e) {
          console.error('Failed to load clubs', e);
        }
      })();
    }
  }, [isSuper]);

  // Load super admin data for selected club
  const loadSuperAdminData = useCallback(async () => {
    if (!selectedClubId) return;

    setLoading(true);
    try {
      // Load all members (both admins and athletes)
      const allMembers = await clubService.listMembers(selectedClubId) || [];

      // Separate admins and athletes for backward compatibility
      const adminList = allMembers.filter(member => member.role === 'admin');
      const athleteList = allMembers.filter(member => member.role === 'athlete');

      setAdmins(adminList);
      setAthletes(athleteList);

      // Load emails for all members
      const memberEntries = await Promise.all(
        allMembers.map(async (member) => {
          try {
            const snap = await getDoc(doc(db, 'users', member.id));
            return [member.id, { email: snap.exists() ? snap.data().email : '' }];
          } catch {
            return [member.id, { email: '' }];
          }
        })
      );
      setAdminUsers(Object.fromEntries(memberEntries));
      setAthleteUsers(Object.fromEntries(memberEntries));
    } catch (e) {
      console.error('Failed to load club members', e);
    } finally {
      setLoading(false);
    }
  }, [selectedClubId]);

  useEffect(() => {
    if (isSuper() && selectedClubId) {
      loadSuperAdminData();
    }
  }, [selectedClubId, isSuper, loadSuperAdminData]);

  // Club management handlers
  const handleCreateClub = async (clubName) => {
    if (!clubName || !clubName.trim()) return;
    setSaving(true);
    try {
      const exists = await clubService.clubNameExists(clubName.trim());
      if (exists) return toast({ title: 'Name already exists', variant: 'destructive' });
      const id = await clubService.createClub(clubName.trim());
      const refreshed = await clubService.listClubs();
      setClubs(refreshed);
      setSelectedClubId(id);
      toast({ title: 'Club created successfully' });
    } catch (e) {
      console.error('Create club failed', e);
      toast({ title: 'Failed to create club', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRenameClub = async (newName) => {
    if (!selectedClubId || !selectedClub || !newName || !newName.trim()) return;
    setSaving(true);
    try {
      const exists = await clubService.clubNameExists(newName.trim(), selectedClubId);
      if (exists) return toast({ title: 'Name already exists', variant: 'destructive' });
      await clubService.renameClub(selectedClubId, newName.trim());
      const refreshed = await clubService.listClubs();
      setClubs(refreshed);
      toast({ title: 'Club renamed successfully' });
    } catch (e) {
      console.error('Rename club failed', e);
      toast({ title: 'Failed to rename club', variant: 'destructive' });
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

  // Super admin member management handlers
  const handleAssignAdmin = async () => {
    if (!selectedClubId || !email.trim()) return;
    setSaving(true);
    try {
      await clubService.assignAdminByEmail(selectedClubId, email.trim());
      setEmail('');
      setInviteRole('athlete'); // Reset to default
      await loadSuperAdminData();
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
      await loadSuperAdminData();
      toast({ title: 'Admin removed successfully' });
    } catch (e) {
      console.error('Remove admin failed', e);
    } finally {
      setSaving(false);
    }
  };

  const handleAddAthleteSuper = async () => {
    if (!selectedClubId || !email.trim()) return;
    setSaving(true);
    try {
      await clubService.assignAthleteByEmail(selectedClubId, email.trim());
      setEmail('');
      setInviteRole('athlete'); // Reset to default
      await loadSuperAdminData();
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
      await loadSuperAdminData();
      toast({ title: 'Athlete removed successfully' });
    } catch (e) {
      console.error('Remove athlete failed', e);
    } finally {
      setSaving(false);
    }
  };

  // Handle removing members for regular admins
  const handleRemoveRegularMember = async (userId) => {
    if (!effectiveClubId) return;

    setSaving(true);
    try {
      // Determine if it's an admin or athlete removal
      const member = regularMembers.find(m => m.id === userId);
      if (member?.role === 'admin') {
        await clubService.removeAdmin(effectiveClubId, userId);
      } else {
        await clubService.removeAthlete(effectiveClubId, userId);
      }

      await loadRegularMembers();

      toast({
        title: 'Member removed successfully'
      });
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: 'Failed to remove member',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddAthlete = async () => {
    if (!effectiveClubId || !email.trim()) {
      return;
    }

    setSaving(true);
    try {
      if (inviteRole === 'admin') {
        await clubService.assignAdminByEmail(effectiveClubId, email.trim());
      } else {
        await clubService.assignAthleteByEmail(effectiveClubId, email.trim());
      }
      setEmail('');
      setInviteRole('athlete'); // Reset to default

      // Refresh the member list after successful addition
      if (!isSuper()) {
        await loadRegularMembers();
      }

      toast({
        title: `${inviteRole === 'admin' ? 'Admin' : 'Athlete'} added successfully`,
        description: 'User will be able to access the club when they register'
      });
    } catch (e) {
      console.error('Add member failed', e);
      toast({
        title: `Failed to add ${inviteRole}`,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };



  const handleDeleteClub = async () => {
    if (!selectedClubId || !selectedClub) return;
    setSaving(true);
    try {
      await clubService.deleteClub(selectedClubId);

      // Refresh clubs list
      if (isUserSuperAdmin) {
        const refreshed = await clubService.listClubs();
        setClubs(refreshed);
        // Select first club if available, otherwise clear selection
        if (refreshed.length > 0) {
          setSelectedClubId(refreshed[0].id);
        } else {
          setSelectedClubId('');
        }
      }

      toast({
        title: 'Club Deleted Successfully',
        description: `"${selectedClub.name}" and all its data have been permanently removed.`
      });
    } catch (e) {
      console.error('Delete club failed', e);
      toast({
        title: 'Failed to Delete Club',
        description: e.message || 'An error occurred while deleting the club',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Unified Admin Interface
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-6xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{isSuper() ? 'Super Admin' : 'Club Admin'}</h1>
          {(isSuper() || adminMemberships.length > 0) && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Managing:</span>
              {isSuper() ? (
                // Super admin - show club dropdown with management buttons
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedClubId}
                    onValueChange={setSelectedClubId}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select a club..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(clubs || []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex items-center gap-2">
                            <Shield className="h-3 w-3" />
                            {c.name} {c.status === 'inactive' ? '(inactive)' : ''}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newName = prompt('Enter new club name:', selectedClub?.name || '');
                      if (newName && newName.trim() && newName.trim() !== selectedClub?.name) {
                        handleRenameClub(newName.trim());
                      }
                    }}
                    disabled={!selectedClubId}
                  >
                    ✏️
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const clubName = prompt('Enter new club name:');
                      if (clubName && clubName.trim()) {
                        handleCreateClub(clubName.trim());
                      }
                    }}
                  >
                    ➕
                  </Button>
                </div>
              ) : adminMemberships.length === 1 ? (
                // Single club - show badge
                <Badge variant="outline" className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {adminMemberships[0].clubName}
                </Badge>
              ) : (
                // Multiple clubs - show dropdown
                <Select
                  value={selectedAdminClubId}
                  onValueChange={setSelectedAdminClubId}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {adminMemberships.map((membership) => (
                      <SelectItem key={membership.clubId} value={membership.clubId}>
                        <div className="flex items-center gap-2">
                          <Shield className="h-3 w-3" />
                          {membership.clubName}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>



        {/* Member Management Section - Unified interface for both admin types */}
        {(!isSuper() || selectedClubId) && (
          <Card>
            <CardHeader>
              <CardTitle>Club Members</CardTitle>
              <CardDescription>
                {isSuper()
                  ? `Manage members for ${selectedClub?.name || 'selected club'}`
                  : 'Manage existing members, change roles, and remove athletes'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Club Member Section */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Add New Member</h4>
                  {(isSuper() || (!isSuper() && adminMemberships.length > 0)) && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm text-muted-foreground">Adding to:</span>
                      <Badge variant="outline">
                        {isSuper()
                          ? (selectedClub?.name || 'No club selected')
                          : (adminMemberships.find(m => m.clubId === effectiveClubId)?.clubName || 'Club')
                        }
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="member@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="athlete">Athlete</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={isSuper() ? (inviteRole === 'admin' ? handleAssignAdmin : handleAddAthleteSuper) : handleAddAthlete} disabled={saving || !effectiveClubId}>
                      Add Member
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    💡 <strong>Tip:</strong> You can add people who haven't registered yet.
                    They'll automatically get access when they create their account!
                  </div>
                </div>

                <Separator />
              </div>

              {/* Unified member list for both admin types */}
              <div>
                <h4 className="text-sm font-medium mb-3">
                  Club Members ({isSuper() ? (admins.length + athletes.length) : regularMembers.length})
                </h4>
                {isSuper() ? (
                  // Super admin member loading state
                  loading ? (
                    <div className="text-center py-4">Loading members...</div>
                  ) : (admins.length + athletes.length) === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      No members yet.
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
                        {/* Combine and sort admins first, then athletes */}
                        {[...admins, ...athletes]
                          .sort((a, b) => {
                            if (a.role === 'admin' && b.role !== 'admin') return -1;
                            if (a.role !== 'admin' && b.role === 'admin') return 1;
                            return 0; // Keep same role members in original order
                          })
                          .map((member) => (
                            <TableRow key={member.id}>
                              <TableCell>{adminUsers[member.id]?.email || athleteUsers[member.id]?.email || 'N/A'}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getRoleIcon(member.role)}
                                  <Badge className={getRoleBadgeColor(member.role)}>
                                    {member.role}
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
                                      <AlertDialogTitle>Remove {member.role === 'admin' ? 'Admin' : 'Athlete'}</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to remove {adminUsers[member.id]?.email || athleteUsers[member.id]?.email || member.id} from this club?
                                        This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => member.role === 'admin' ? handleRemoveAdmin(member.id) : handleRemoveAthlete(member.id)}
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
                  )
                ) : (
                  // Regular admin member loading state
                  regularMembersLoading ? (
                    <div className="text-center py-4">Loading members...</div>
                  ) : regularMembers.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      No members yet.
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
                        {regularMembers.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell>{member.email || 'N/A'}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getRoleIcon(member.role)}
                                <Badge className={getRoleBadgeColor(member.role)}>
                                  {member.role}
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
                                    <AlertDialogTitle>Remove {member.role === 'admin' ? 'Admin' : 'Athlete'}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove {member.email || member.id} from this club?
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleRemoveRegularMember(member.id, member.email)}
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
                  )
                )}
              </div>
            </CardContent>
          </Card>
                )}

        {/* Club Management Section - Bottom of Page */}
        {isUserSuperAdmin && selectedClub && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Club Management
              </CardTitle>
              <CardDescription>
                Manage the selected club's status and lifecycle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{selectedClub.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Status: <Badge variant={selectedClub.status === 'active' ? 'default' : 'secondary'}>
                      {selectedClub.status === 'active' ? '✅ Active' : '🚫 Inactive'}
                    </Badge>
                  </p>
                </div>
                <div className="flex gap-3">
                  {selectedClub.status === 'inactive' ? (
                    <>
                      <Button
                        onClick={handleActivateClub}
                        disabled={saving}
                        className="bg-green-600 hover:bg-green-700"
                      >
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
                              This action cannot be undone and will affect all users.
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
                    <Button
                      variant="destructive"
                      onClick={handleDeactivateClub}
                      disabled={saving}
                      size="lg"
                    >
                      🚫 Deactivate Club
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
export default AdminPage;
