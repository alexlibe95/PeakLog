import Navigation from '@/components/Navigation';
import MemberManagement from '@/components/MemberManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { useEffect, useState } from 'react';
import { clubService } from '@/services/clubService';
import { Shield, Trash2 } from 'lucide-react';

function SuperAdminPage() {
  const { userProfile, isSuper, currentClubId, memberships, claims } = useAuth();
  const { toast } = useToast();

  // Check if user is super admin
  const isUserSuperAdmin = isSuper() && userProfile?.role === 'super';

  const [saving, setSaving] = useState(false);
  const [clubs, setClubs] = useState([]);
  const [selectedClubId, setSelectedClubId] = useState('');

  // Regular admin specific state
  const [selectedAdminClubId, setSelectedAdminClubId] = useState('');

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



  // Selected club for super admin
  const selectedClub = (clubs || []).find(c => c.id === selectedClubId) || null;

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-semibold truncate">{isSuper() ? 'Super Admin' : 'Club Admin'}</h1>
          {(isSuper() || adminMemberships.length > 0) && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              <span className="text-sm text-muted-foreground hidden sm:inline">Managing:</span>
              {isSuper() ? (
                // Super admin - show club dropdown with management buttons
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                  <Select
                    value={selectedClubId}
                    onValueChange={setSelectedClubId}
                  >
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Select a club..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(clubs || []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex items-center gap-2">
                            <Shield className="h-3 w-3" />
                            <span className="truncate">{c.name} {c.status === 'inactive' ? '(inactive)' : ''}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none"
                      onClick={() => {
                        const newName = prompt('Enter new club name:', selectedClub?.name || '');
                        if (newName && newName.trim() && newName.trim() !== selectedClub?.name) {
                          handleRenameClub(newName.trim());
                        }
                      }}
                      disabled={!selectedClubId}
                    >
                      <span className="sm:hidden">Rename</span>
                      <span className="hidden sm:inline">✏️</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none"
                      onClick={() => {
                        const clubName = prompt('Enter new club name:');
                        if (clubName && clubName.trim()) {
                          handleCreateClub(clubName.trim());
                        }
                      }}
                    >
                      <span className="sm:hidden">Create</span>
                      <span className="hidden sm:inline">➕</span>
                    </Button>
                  </div>
                </div>
              ) : adminMemberships.length === 1 ? (
                // Single club - show badge
                <Badge variant="outline" className="flex items-center gap-1 max-w-full">
                  <Shield className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{adminMemberships[0].clubName}</span>
                </Badge>
              ) : (
                // Multiple clubs - show dropdown
                <Select
                  value={selectedAdminClubId}
                  onValueChange={setSelectedAdminClubId}
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {adminMemberships.map((membership) => (
                      <SelectItem key={membership.clubId} value={membership.clubId}>
                        <div className="flex items-center gap-2">
                          <Shield className="h-3 w-3" />
                          <span className="truncate">{membership.clubName}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>



        {/* Member Management Section - Shared component for both admin types */}
        <MemberManagement 
          clubId={isSuper() ? selectedClubId : effectiveClubId}
          clubName={isSuper() ? selectedClub?.name : adminMemberships.find(m => m.clubId === effectiveClubId)?.clubName}
          isSuper={isSuper()}
          onMemberChange={() => {
            // Handle any necessary updates after member changes
            // This could trigger other data refreshes if needed
          }}
        />



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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium truncate">{selectedClub.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Status: <Badge variant={selectedClub.status === 'active' ? 'default' : 'secondary'}>
                      {selectedClub.status === 'active' ? '✅ Active' : '🚫 Inactive'}
                    </Badge>
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                  {selectedClub.status === 'inactive' ? (
                    <>
                      <Button
                        onClick={handleActivateClub}
                        disabled={saving}
                        className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                        size="sm"
                      >
                        <span className="sm:hidden">Activate Club</span>
                        <span className="hidden sm:inline">✅ Activate Club</span>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" disabled={saving} className="w-full sm:w-auto" size="sm">
                            <Trash2 className="h-4 w-4 mr-2" />
                            <span className="sm:hidden">Delete Club</span>
                            <span className="hidden sm:inline">🗑️ Delete Club</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[95vw] max-w-md sm:max-w-lg">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Club Permanently</AlertDialogTitle>
                            <AlertDialogDescription className="max-h-[60vh] overflow-y-auto">
                              Are you absolutely sure you want to delete "{selectedClub?.name}"?
                              <br /><br />
                              This action will permanently delete:
                              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                                <li>All club members and their memberships</li>
                                <li>All training programs and schedules</li>
                                <li>All attendance records and sessions</li>
                                <li>All club settings and data</li>
                              </ul>
                              <br />
                              This action cannot be undone and will affect all users.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDeleteClub}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
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
                      className="w-full sm:w-auto"
                      size="sm"
                    >
                      <span className="sm:hidden">Deactivate Club</span>
                      <span className="hidden sm:inline">🚫 Deactivate Club</span>
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

export default SuperAdminPage;