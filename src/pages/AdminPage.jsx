import Navigation from '@/components/Navigation';
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
import { Shield, Trash2, Users } from 'lucide-react';

function AdminPage() {
  const { userProfile, currentClubId, memberships } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [inviteRole, setInviteRole] = useState('athlete');

  // Regular admin specific state
  const [selectedAdminClubId, setSelectedAdminClubId] = useState('');
  const [regularMembers, setRegularMembers] = useState([]);
  const [regularMembersLoading, setRegularMembersLoading] = useState(false);

  // Get admin memberships
  const adminMemberships = (memberships || []).filter(m => m.role === 'admin');

  // Calculate effective club ID
  const getEffectiveClubId = () => {
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
    if (adminMemberships.length > 0 && !selectedAdminClubId) {
      setSelectedAdminClubId(currentClubId || adminMemberships[0].clubId);
    }
  }, [adminMemberships, currentClubId, selectedAdminClubId]);

  // Load regular admin members
  const loadRegularMembers = useCallback(async () => {
    if (!effectiveClubId) return;

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
  }, [effectiveClubId, toast]);

  // Load members when club changes
  useEffect(() => {
    if (effectiveClubId) {
      loadRegularMembers();
    }
  }, [effectiveClubId, loadRegularMembers]);

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

  const handleAddMember = async () => {
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
      await loadRegularMembers();

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

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-6xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Club Admin</h1>
          {adminMemberships.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Managing:</span>
              {adminMemberships.length === 1 ? (
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

        {/* Member Management Section */}
        {effectiveClubId && (
          <Card>
            <CardHeader>
              <CardTitle>Club Members</CardTitle>
              <CardDescription>
                Manage existing members, change roles, and remove athletes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Club Member Section */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Add New Member</h4>
                  {adminMemberships.length > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm text-muted-foreground">Adding to:</span>
                      <Badge variant="outline">
                        {adminMemberships.find(m => m.clubId === effectiveClubId)?.clubName || 'Club'}
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
                    <Button onClick={handleAddMember} disabled={saving || !effectiveClubId}>
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

              {/* Member list */}
              <div>
                <h4 className="text-sm font-medium mb-3">
                  Club Members ({regularMembers.length})
                </h4>
                {regularMembersLoading ? (
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
                                    onClick={() => handleRemoveRegularMember(member.id)}
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
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

export default AdminPage;