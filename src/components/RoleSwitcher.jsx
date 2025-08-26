import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ChevronDown, Users, Shield, Crown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const RoleSwitcher = () => {
  const {
    memberships,
    currentRole,
    switchRole,
    isSuper,
    hasMultipleRoles,
    getCurrentMembership,
    userProfile,
    claims
  } = useAuth();

  const [isOpen, setIsOpen] = useState(false);

  // Don't show switcher if user doesn't have multiple roles and isn't a super admin
  const isActualSuperAdmin = userProfile?.role === 'super' || claims?.super_admin === true;
  if (!hasMultipleRoles() && !isActualSuperAdmin) {
    return null;
  }

  // Always show switcher for super admins with club memberships
  if (isActualSuperAdmin && memberships.length > 0) {
    // Show switcher for super admins
  } else if (!hasMultipleRoles()) {
    return null;
  }

  const getRoleIcon = (role) => {
    switch (role) {
      case 'super':
        return <Crown className="h-4 w-4" />;
      case 'admin':
        return <Shield className="h-4 w-4" />;
      case 'athlete':
        return <Users className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'super':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'admin':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'athlete':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const currentMembership = getCurrentMembership();

  const handleRoleSwitch = (clubId, role) => {
    console.log('🔄 RoleSwitcher handleRoleSwitch called:', { clubId, role });
    const success = switchRole(clubId, role);
    console.log('🔄 RoleSwitcher switchRole result:', success);
    if (success) {
      console.log('✅ Role switch successful, closing dropdown');
      setIsOpen(false);
    } else {
      console.log('❌ Role switch failed, keeping dropdown open');
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Current Role</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current Role Display */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            {getRoleIcon(currentRole)}
            <div>
              <div className="font-medium text-sm">
                {currentMembership?.clubName || 'No Club'}
              </div>
              <div className="text-xs text-muted-foreground">
                {currentRole || 'No Role'}
              </div>
            </div>
          </div>
          <Badge className={`${getRoleColor(currentRole)} border`}>
            {currentRole}
          </Badge>
        </div>

        {/* Role Switcher Dropdown */}
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              Switch Role
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Available Roles</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Always show Super Admin option for actual super admins */}
            {(userProfile?.role === 'super' || claims?.super_admin === true) && (
              <DropdownMenuItem
                onClick={() => handleRoleSwitch(null, 'super')}
                className="flex items-center gap-2"
              >
                <Crown className="h-4 w-4 text-purple-600" />
                <div>
                  <div className="font-medium">Super Admin</div>
                  <div className="text-xs text-muted-foreground">Full system access</div>
                </div>
              </DropdownMenuItem>
            )}

            {memberships.map((membership) => (
              <DropdownMenuItem
                key={`${membership.clubId}-${membership.role}`}
                onClick={() => handleRoleSwitch(membership.clubId, membership.role)}
                className="flex items-center gap-2"
              >
                {getRoleIcon(membership.role)}
                <div>
                  <div className="font-medium">{membership.clubName}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {membership.role}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}

            {memberships.length === 0 && !isSuper() && (
              <DropdownMenuItem disabled>
                <div className="text-sm text-muted-foreground">
                  No club memberships found
                </div>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Role Summary */}
        <div className="text-xs text-muted-foreground space-y-1">
          {isSuper() && (
            <div>• Super Admin: Full system access</div>
          )}
          {memberships.filter(m => m.role === 'admin').length > 0 && (
            <div>• Club Admin: Manage {memberships.filter(m => m.role === 'admin').length} club(s)</div>
          )}
          {memberships.filter(m => m.role === 'athlete').length > 0 && (
            <div>• Athlete: Member of {memberships.filter(m => m.role === 'athlete').length} club(s)</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RoleSwitcher;
