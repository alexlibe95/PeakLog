import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { clubService } from '../services/clubService';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useToast } from './ui/toast-context.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
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
} from './ui/alert-dialog';
import { Users, Trash2, Shield } from 'lucide-react';

const ClubMemberManagement = ({ clubId }) => {
  const { user, currentClubId } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Use provided clubId or current club
  const effectiveClubId = clubId || currentClubId;

  useEffect(() => {
    if (effectiveClubId) {
      loadMembers();
    }
  }, [effectiveClubId]);

  const loadMembers = async () => {
    if (!effectiveClubId) return;

    setLoading(true);
    try {
      const membersData = await clubService.getClubMembersWithDetails(effectiveClubId);
      // Sort members: admins first, then athletes
      const sortedMembers = membersData.sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return 0; // Keep same role members in original order
      });
      setMembers(sortedMembers);
    } catch (error) {
      console.error('Error loading members:', error);
      toast({
        title: 'Error loading data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };



  const handleChangeRole = async (userId, newRole) => {
    if (!effectiveClubId) return;

    setSaving(true);
    try {
      await clubService.changeUserRole(effectiveClubId, userId, newRole);
      await loadMembers();

      toast({
        title: 'Role updated successfully'
      });
    } catch (error) {
      console.error('Error changing role:', error);
      toast({
        title: 'Failed to update role',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!effectiveClubId) return;

    setSaving(true);
    try {
      // Determine if it's an admin or athlete removal
      const member = members.find(m => m.id === userId);
      if (member?.role === 'admin') {
        await clubService.removeAdmin(effectiveClubId, userId);
      } else {
        await clubService.removeAthlete(effectiveClubId, userId);
      }

      await loadMembers();

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

  if (!effectiveClubId) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No club selected
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Club Members ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading members...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No members found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
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
                      {member.joinedAt
                        ? new Date(member.joinedAt).toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={member.role}
                          onValueChange={(newRole) => handleChangeRole(member.id, newRole)}
                          disabled={saving || member.id === user?.uid}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="athlete">Athlete</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>

                        {member.id !== user?.uid && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Member</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove {member.email || member.id} from this club?
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default ClubMemberManagement;
