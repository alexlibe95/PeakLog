import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";

import { useAuth } from '../context/AuthContext';
import PeakLogLogo from './icons/PeakLogLogo';
import { useState, useEffect, useRef } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [visibleItems, setVisibleItems] = useState([]);
  const [overflowItems, setOverflowItems] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const navRef = useRef(null);
  const containerRef = useRef(null);
  const prevNavItemsRef = useRef(null);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mobileMenuOpen && !event.target.closest('header')) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [mobileMenuOpen]);


  const {
    user,
    userProfile,
    logout,
    isSuper,
    currentRole,
    memberships,
    switchRole,
    claims
  } = useAuth();



  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleAdminClick = async (e) => {
    e.preventDefault();
    setIsNavigating(true);

    try {
      // Check if user is super admin (has super admin access)
      if (isSuper()) {
        // For super admins, navigate to superadmin page
        navigate('/superadmin');
        return;
      }

      // For regular admins, find the first club where the user is an admin
      const adminMembership = memberships.find(m => m.role === 'admin');

      if (adminMembership) {
        // Navigate first to prevent refresh effect
        navigate('/admin');
        // Then switch role after navigation (slight delay to ensure smooth transition)
        setTimeout(() => {
          switchRole(adminMembership.clubId, 'admin');
        }, 100);
      } else {
        // If user is not admin in any club, navigate to dashboard
        navigate('/dashboard');
      }
    } finally {
      // Clear navigation state after a brief delay
      setTimeout(() => setIsNavigating(false), 300);
    }
  };

  const handleTrainingManagementClick = async (e) => {
    e.preventDefault();
    setIsNavigating(true);

    try {
      // Find the first club where the user is an admin
      const adminMembership = memberships.find(m => m.role === 'admin');

      if (adminMembership) {
        // Navigate first to prevent refresh effect
        navigate('/training-management');
        // Then switch role after navigation (slight delay to ensure smooth transition)
        setTimeout(() => {
          switchRole(adminMembership.clubId, 'admin');
        }, 100);
      } else {
        // If user is not admin in any club, navigate to dashboard
        navigate('/dashboard');
      }
    } finally {
      // Clear navigation state after a brief delay
      setTimeout(() => setIsNavigating(false), 300);
    }
  };



  // Get the highest priority role for display
  const getHighestRole = () => {
    // Check if user is super admin (highest priority)
    if (userProfile?.role === 'super' || claims?.super_admin === true) {
      return 'super';
    }

    // Check if user has any admin memberships (second priority)
    const adminMemberships = memberships.filter(m => m.role === 'admin');
    if (adminMemberships.length > 0) {
      return 'admin';
    }

    // Check if user has any athlete memberships (lowest priority)
    const athleteMemberships = memberships.filter(m => m.role === 'athlete');
    if (athleteMemberships.length > 0) {
      return 'athlete';
    }

    // Default to pending if no roles found
    return 'pending';
  };

  // Get all navigation items based on all user roles
  const getNavItems = () => {
    const items = [
      { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
    ];

    // Check if user is super admin (from database, current role, or claims)
    const isActualSuperAdmin = userProfile?.role === 'super' || claims?.super_admin === true;
    const isCurrentlySuper = currentRole === 'super';

    // Super admins get super admin interface
    if (isActualSuperAdmin || isCurrentlySuper) {
      items.push({ path: '/superadmin', label: 'Super Admin', icon: '👑' });
    }

    // Add club admin options if user has admin memberships (including super admins)
    const adminMemberships = memberships.filter(m => m.role === 'admin');
    if (adminMemberships.length > 0) {
      // If super admin (actual or currently switched), add training management as additional option
      if (isActualSuperAdmin || isCurrentlySuper) {
        items.push({ path: '/training-management', label: 'Trainings', icon: '🏋️' });
        items.push({ path: '/athlete-management', label: 'Athletes', icon: '🏆' });
        items.push({ path: '/category-management', label: 'Categories', icon: '📊' });
        items.push({ path: '/testing', label: 'Test Limits', icon: '⚡' });
      } else {
        // Regular admin users get both club admin and training management
        items.push({ path: '/admin', label: 'Club Admin', icon: '🛠️' });
        items.push({ path: '/training-management', label: 'Trainings', icon: '🏋️' });
        items.push({ path: '/athlete-management', label: 'Athletes', icon: '🏆' });
        items.push({ path: '/category-management', label: 'Categories', icon: '📊' });
        items.push({ path: '/testing', label: 'Test Limits', icon: '⚡' });
      }
    }

    // Add athlete sections
    const athleteMemberships = memberships.filter(m => m.role === 'athlete');
    if (athleteMemberships.length > 0) {
      items.push({ path: '/training', label: 'Training', icon: '🏋️' });
      items.push({ path: '/my-progress', label: 'My Progress', icon: '📈' });
    }

    return items;
  };

  const navItems = getNavItems();

  // Handle navigation overflow - run once on mount and when navItems actually change
  useEffect(() => {
    // Check if navItems actually changed
    const navItemsChanged = !prevNavItemsRef.current ||
      JSON.stringify(navItems) !== JSON.stringify(prevNavItemsRef.current);

    if (!navItemsChanged) return;

    // Update the ref
    prevNavItemsRef.current = navItems;

    const updateOverflow = () => {
      if (!containerRef.current || !navRef.current) return;

      const container = containerRef.current;
      const nav = navRef.current;
      const containerWidth = container.offsetWidth;
      const navWidth = nav.scrollWidth;

      // If navigation overflows, split items
      if (navWidth > containerWidth && navItems.length > 2) {
        const visibleCount = Math.max(2, Math.floor(navItems.length * (containerWidth / navWidth)));
        setVisibleItems(navItems.slice(0, visibleCount));
        setOverflowItems(navItems.slice(visibleCount));
      } else {
        setVisibleItems(navItems);
        setOverflowItems([]);
      }
    };

    // Run immediately
    updateOverflow();

    // Also run after a short delay to ensure DOM is ready
    const timeoutId = setTimeout(updateOverflow, 50);

    return () => clearTimeout(timeoutId);
  }, [navItems]); // Depend on navItems to detect changes

  // Handle window resize separately
  useEffect(() => {
    let resizeTimeoutId;
    let isMounted = true;

    const handleResize = () => {
      if (!isMounted) return;

      // Clear existing timeout
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }

      // Debounce resize handler
      resizeTimeoutId = setTimeout(() => {
        if (!isMounted) return;

        const updateOverflow = () => {
          if (!containerRef.current || !navRef.current) return;

          const container = containerRef.current;
          const nav = navRef.current;
          const containerWidth = container.offsetWidth;
          const navWidth = nav.scrollWidth;

          if (navWidth > containerWidth && navItems.length > 2) {
            const visibleCount = Math.max(2, Math.floor(navItems.length * (containerWidth / navWidth)));
            setVisibleItems(navItems.slice(0, visibleCount));
            setOverflowItems(navItems.slice(visibleCount));
          } else {
            setVisibleItems(navItems);
            setOverflowItems([]);
          }
        };

        updateOverflow();
      }, 150); // Longer debounce for resize
    };

    window.addEventListener('resize', handleResize);
    return () => {
      isMounted = false;
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []); // No dependencies for resize handler

  return (
    <header className={`border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 nav-transition ${isNavigating ? 'nav-loading' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo and Navigation */}
          <div className="flex items-center space-x-2 sm:space-x-4 lg:space-x-6 xl:space-x-8">
            <Link to="/dashboard" className="flex items-center space-x-2 flex-shrink-0">
              <PeakLogLogo size="default" />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1" ref={containerRef}>
              <div className="flex items-center space-x-1" ref={navRef}>
                {visibleItems.map((item) => (
                  item.path === '/admin' || item.path === '/superadmin' ? (
                    <Button
                      key={item.path}
                      variant={location.pathname === item.path ? "default" : "ghost"}
                      className="flex items-center space-x-2 whitespace-nowrap"
                      onClick={handleAdminClick}
                    >
                      <span>{item.icon}</span>
                      <span className="hidden xl:inline">{item.label}</span>
                      <span className="xl:hidden text-xs">{item.label.slice(0, 4)}...</span>
                    </Button>
                  ) : item.path === '/training-management' ? (
                    <Button
                      key={item.path}
                      variant={location.pathname === item.path ? "default" : "ghost"}
                      className="flex items-center space-x-2 whitespace-nowrap"
                      onClick={handleTrainingManagementClick}
                    >
                      <span>{item.icon}</span>
                      <span className="hidden xl:inline">{item.label}</span>
                      <span className="xl:hidden text-xs">{item.label.slice(0, 4)}...</span>
                    </Button>
                  ) : (
                    <Link key={item.path} to={item.path}>
                      <Button
                        variant={location.pathname === item.path ? "default" : "ghost"}
                        className="flex items-center space-x-2 whitespace-nowrap"
                      >
                        <span>{item.icon}</span>
                        <span className="hidden xl:inline">{item.label}</span>
                        <span className="xl:hidden text-xs">{item.label.slice(0, 4)}...</span>
                      </Button>
                    </Link>
                  )
                ))}

                {/* More dropdown for overflow items */}
                {overflowItems.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="flex items-center space-x-2 whitespace-nowrap">
                        <span>⋯</span>
                        <span className="hidden xl:inline">More</span>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {overflowItems.map((item) => (
                        item.path === '/admin' || item.path === '/superadmin' ? (
                          <DropdownMenuItem
                            key={item.path}
                            onClick={handleAdminClick}
                            className="flex items-center space-x-2"
                          >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                          </DropdownMenuItem>
                        ) : item.path === '/training-management' ? (
                          <DropdownMenuItem
                            key={item.path}
                            onClick={handleTrainingManagementClick}
                            className="flex items-center space-x-2"
                          >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            key={item.path}
                            asChild
                            className="flex items-center space-x-2"
                          >
                            <Link to={item.path}>
                              <span>{item.icon}</span>
                              <span>{item.label}</span>
                            </Link>
                          </DropdownMenuItem>
                        )
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </nav>
          </div>

          {/* User Info and Actions */}
          <div className="flex items-center space-x-4">
            {/* Navigation Loading Indicator */}
            {isNavigating && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
            )}

            {/* User Menu Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto p-1 text-sm text-muted-foreground hover:text-foreground">
                  {userProfile?.firstName || user?.email || 'User'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Role:</span>
                    <Badge variant="secondary" className="text-xs">
                      {getHighestRole()}
                    </Badge>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                  </svg>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <nav className="flex flex-col space-y-2">
              {navItems.map((item) => (
                item.path === '/admin' || item.path === '/superadmin' ? (
                  <Button
                    key={item.path}
                    variant={location.pathname === item.path ? "default" : "ghost"}
                    className="justify-start"
                    onClick={(e) => {
                      handleAdminClick(e);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <span className="mr-3">{item.icon}</span>
                    <span>{item.label}</span>
                  </Button>
                ) : item.path === '/training-management' ? (
                  <Button
                    key={item.path}
                    variant={location.pathname === item.path ? "default" : "ghost"}
                    className="justify-start"
                    onClick={(e) => {
                      handleTrainingManagementClick(e);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <span className="mr-3">{item.icon}</span>
                    <span>{item.label}</span>
                  </Button>
                ) : (
                  <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)}>
                    <Button
                      variant={location.pathname === item.path ? "default" : "ghost"}
                      className="w-full justify-start"
                    >
                      <span className="mr-3">{item.icon}</span>
                      <span>{item.label}</span>
                    </Button>
                  </Link>
                )
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navigation;