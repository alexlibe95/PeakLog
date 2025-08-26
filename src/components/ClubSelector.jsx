import { useAuth } from '../context/AuthContext';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Crown, Shield, Users } from 'lucide-react';

const ClubSelector = ({ role, onClubChange, selectedClubId }) => {
  const { memberships, currentClubId, switchRole } = useAuth();

  // Filter memberships by role
  const roleMemberships = memberships.filter(m => m.role === role);

  // If no memberships for this role, don't show selector
  if (roleMemberships.length === 0) {
    return null;
  }

  // If only one membership, show it as a badge
  if (roleMemberships.length === 1) {
    const membership = roleMemberships[0];
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Club:</span>
        <Badge variant="outline" className="flex items-center gap-1">
          {role === 'admin' ? (
            <Shield className="h-3 w-3" />
          ) : (
            <Users className="h-3 w-3" />
          )}
          {membership.clubName}
        </Badge>
      </div>
    );
  }

  // Multiple memberships - show selector
  const handleClubChange = (clubId) => {
    const membership = roleMemberships.find(m => m.clubId === clubId);
    if (membership) {
      switchRole(clubId, role);
      if (onClubChange) {
        onClubChange(clubId);
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">
        {role === 'admin' ? 'Managing:' : 'Viewing as athlete:'}
      </span>
      <Select
        value={selectedClubId || currentClubId}
        onValueChange={handleClubChange}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select club" />
        </SelectTrigger>
        <SelectContent>
          {roleMemberships.map((membership) => (
            <SelectItem key={membership.clubId} value={membership.clubId}>
              <div className="flex items-center gap-2">
                {role === 'admin' ? (
                  <Shield className="h-4 w-4 text-blue-600" />
                ) : (
                  <Users className="h-4 w-4 text-green-600" />
                )}
                {membership.clubName}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ClubSelector;
