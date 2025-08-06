import { Link, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '../context/AuthContext';

const Navigation = () => {
  const location = useLocation();
  const { user, userProfile, logout } = useAuth();

  const getInitials = (email) => {
    return email ? email.substring(0, 2).toUpperCase() : 'U';
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { path: '/training-logs', label: 'Training Logs', icon: '📝' },
    { path: '/personal-records', label: 'Personal Records', icon: '🏆' },
    { path: '/goals', label: 'Goals', icon: '🎯' },
    { path: '/attendance', label: 'Attendance', icon: '📊' },
  ];

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo and Navigation */}
          <div className="flex items-center space-x-8">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <span className="text-2xl font-bold">🏔️ PeakLog</span>
            </Link>
            
            <nav className="hidden md:flex space-x-1">
              {navItems.map((item) => (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={location.pathname === item.path ? "default" : "ghost"}
                    className="flex items-center space-x-2"
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Button>
                </Link>
              ))}
            </nav>
          </div>

          {/* User Info and Actions */}
          <div className="flex items-center space-x-4">
            <Badge variant="secondary">
              {userProfile?.role || 'athlete'}
            </Badge>
            
            <div className="flex items-center space-x-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src="" />
                <AvatarFallback className="text-xs">
                  {getInitials(user?.email)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:block text-sm text-muted-foreground">
                {userProfile?.firstName || user?.email || 'Athlete'}
              </span>
            </div>
            
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navigation;