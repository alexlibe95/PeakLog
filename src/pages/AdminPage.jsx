import Navigation from '@/components/Navigation';
import MemberManagement from '@/components/MemberManagement';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';

function AdminPage() {
  const { userProfile, currentClubId, memberships } = useAuth();

  // Regular admin specific state
  const [selectedAdminClubId, setSelectedAdminClubId] = useState('');

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

        {/* Member Management Section - Shared component */}
        <MemberManagement 
          clubId={effectiveClubId}
          clubName={adminMemberships.find(m => m.clubId === effectiveClubId)?.clubName}
          isSuper={false}
          onMemberChange={() => {
            // Handle any necessary updates after member changes
          }}
        />
      </main>
    </div>
  );
}

export default AdminPage;