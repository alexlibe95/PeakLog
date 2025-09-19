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
import { useToast } from '@/components/ui/toast-context.jsx';
import { useState, useEffect } from 'react';
import { clubService } from '@/services/clubService';
import { Shield, Trash2, Users, Mail, Clock } from 'lucide-react';

function MemberManagement({ 
  clubId, 
  clubName, 
  isSuper = false,
  onMemberChange = () => {}
}) {

  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [inviteRole, setInviteRole] = useState('athlete');
  const [members, setMembers] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loading, setLoading] = useState(false);

  // Helper functions for role display
  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case 'athlete':
        return <Users className="h-4 w-4 text-green-600 dark:text-green-400" />;
      default:
        return <Users className="h-4 w-4 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800';
      case 'athlete':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-950 dark:text-gray-200 dark:border-gray-800';
    }
  };

  // Load members and pending invitations
  const loadMembersData = async () => {
    if (!clubId) return;

    setLoading(true);
    try {
      // Load existing members
      const membersData = await clubService.getClubMembersWithDetails(clubId) || [];
      // Sort members: admins first, then athletes
      const sortedMembers = membersData.sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return 0;
      });
      setMembers(sortedMembers);

      // Load pending invitations
      const invitations = await clubService.getPendingInvitations(clubId) || [];
      setPendingInvitations(invitations);
    } catch (error) {
      console.error('Error loading members data:', error);
      toast({
        title: 'Error loading data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clubId) {
      loadMembersData();
    }
  }, [clubId]);

  // Add new member
  const handleAddMember = async () => {
    if (!clubId || !email.trim()) {
      return;
    }

    setSaving(true);
    try {
      const memberData = {
        email: email.trim(),
        ...(firstName.trim() && { firstName: firstName.trim() }),
        ...(lastName.trim() && { lastName: lastName.trim() })
      };

      if (inviteRole === 'admin') {
        await clubService.assignAdminByEmail(clubId, memberData);
      } else {
        await clubService.assignAthleteByEmail(clubId, memberData);
      }
      setEmail('');
      setFirstName('');
      setLastName('');
      setInviteRole('athlete');

      // Reload data
      await loadMembersData();
      onMemberChange();

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

  // Remove member
  const handleRemoveMember = async (userId, userRole) => {
    if (!clubId) return;

    setSaving(true);
    try {
      if (userRole === 'admin') {
        await clubService.removeAdmin(clubId, userId);
      } else {
        await clubService.removeAthlete(clubId, userId);
      }

      await loadMembersData();
      onMemberChange();

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

  // Cancel pending invitation
  const handleCancelInvitation = async (invitationId) => {
    setSaving(true);
    try {
      await clubService.cancelInvitationById(invitationId, clubId);
      await loadMembersData();
      
      toast({
        title: 'Invitation cancelled successfully'
      });
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast({
        title: 'Failed to cancel invitation',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };



  if (!clubId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Club Members</CardTitle>
          <CardDescription>
            {isSuper ? 'Select a club to manage members' : 'No club selected'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Please select a club to manage members</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Club Members</CardTitle>
        <CardDescription>
          {isSuper
            ? `Manage members for ${clubName || 'selected club'}`
            : 'Manage existing members, change roles, and remove athletes'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Club Member Section */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Add New Member</h4>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
              <span className="text-sm text-muted-foreground">Adding to:</span>
              <Badge variant="outline" className="max-w-full">
                <span className="truncate">{clubName || 'Selected Club'}</span>
              </Badge>
            </div>
            <div className="space-y-3">
              {/* Optional Name Fields - Now on top */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="First Name (optional)"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="text-sm"
                />
                <Input
                  placeholder="Last Name (optional)"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="text-sm"
                />
              </div>

              {/* Email, Role, and Button Row - Now below */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="member@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                  required
                />
                <div className="flex gap-2">
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="w-full sm:w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="athlete">Athlete</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddMember} disabled={saving || !clubId} className="whitespace-nowrap">
                    <span className="sm:hidden">Add</span>
                    <span className="hidden sm:inline">Add Member</span>
                  </Button>
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              💡 <strong>Tip:</strong> You can add people who haven't registered yet.
            </div>
          </div>

          <Separator />
        </div>

        {/* Pending Invitations Section */}
        {pendingInvitations.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              Pending Invitations ({pendingInvitations.length})
            </h4>
            <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-3 sm:p-4 space-y-2">
              {pendingInvitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Mail className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{invitation.email}</div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {getRoleIcon(invitation.role)}
                        <Badge className={getRoleBadgeColor(invitation.role)} variant="outline">
                          {invitation.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Invited {new Date(invitation.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="p-2 flex-shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="w-[95vw] max-w-md">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to cancel the invitation for {invitation.email}?
                          They will no longer be able to join the club with this invitation.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                        <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleCancelInvitation(invitation.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
                        >
                          Cancel Invitation
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
            <Separator className="mt-4" />
          </div>
        )}

        {/* Active Members List */}
        <div>
          <h4 className="text-sm font-medium mb-3">
            Active Members ({members.length})
          </h4>
          {loading ? (
            <div className="text-center py-4">Loading members...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No active members yet.
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="truncate max-w-xs">{member.email || 'N/A'}</TableCell>
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
                            <AlertDialogContent className="w-[95vw] max-w-md">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove {member.role === 'admin' ? 'Admin' : 'Athlete'}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove {member.email || member.id} from this club?
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveMember(member.id, member.role)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
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
              </div>

              {/* Mobile Card View */}
              <div className="sm:hidden space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{member.email || 'N/A'}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {getRoleIcon(member.role)}
                          <Badge className={getRoleBadgeColor(member.role)}>
                            {member.role}
                          </Badge>
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="ml-2">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[95vw] max-w-md">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {member.role === 'admin' ? 'Admin' : 'Athlete'}</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove {member.email || member.id} from this club?
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col gap-2">
                            <AlertDialogCancel className="w-full">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveMember(member.id, member.role)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default MemberManagement;
