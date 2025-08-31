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
import { useState, useEffect } from 'react';
import { clubService } from '@/services/clubService';
import { Shield, Trash2, Users, Mail, Clock } from 'lucide-react';

function MemberManagement({ 
  clubId, 
  clubName, 
  isSuper = false,
  onMemberChange = () => {}
}) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [inviteRole, setInviteRole] = useState('athlete');
  const [members, setMembers] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loading, setLoading] = useState(false);

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
      if (inviteRole === 'admin') {
        await clubService.assignAdminByEmail(clubId, email.trim());
      } else {
        await clubService.assignAthleteByEmail(clubId, email.trim());
      }
      setEmail('');
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

  // Resend invitation
  const handleResendInvitation = async (email, role) => {
    setSaving(true);
    try {
      if (role === 'admin') {
        await clubService.assignAdminByEmail(clubId, email);
      } else {
        await clubService.assignAthleteByEmail(clubId, email);
      }
      
      toast({
        title: 'Invitation resent successfully'
      });
    } catch (error) {
      console.error('Error resending invitation:', error);
      toast({
        title: 'Failed to resend invitation',
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
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-muted-foreground">Adding to:</span>
              <Badge variant="outline">
                {clubName || 'Selected Club'}
              </Badge>
            </div>
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
              <Button onClick={handleAddMember} disabled={saving || !clubId}>
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

        {/* Pending Invitations Section */}
        {pendingInvitations.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              Pending Invitations ({pendingInvitations.length})
            </h4>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-2">
              {pendingInvitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-orange-600" />
                    <div>
                      <span className="font-medium">{invitation.email}</span>
                      <div className="flex items-center gap-2 mt-1">
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
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResendInvitation(invitation.email, invitation.role)}
                      disabled={saving}
                    >
                      Resend
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to cancel the invitation for {invitation.email}?
                            They will no longer be able to join the club with this invitation.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleCancelInvitation(invitation.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Cancel Invitation
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
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
                              onClick={() => handleRemoveMember(member.id, member.role)}
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
  );
}

export default MemberManagement;
