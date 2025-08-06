import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Navigation from '../components/Navigation';

const Dashboard = () => {
  const { user, userProfile, logout, isAdmin } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const getInitials = (email) => {
    return email ? email.substring(0, 2).toUpperCase() : 'U';
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Page Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {userProfile?.firstName || user?.email || 'Athlete'}! Here's your training overview.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Welcome Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Personal Records</CardTitle>
              <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-medium">🏆</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">
                +2 from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Training Sessions</CardTitle>
              <div className="h-8 w-8 bg-secondary rounded-md flex items-center justify-center">
                <span className="text-secondary-foreground text-sm font-medium">📝</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">24</div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
              <div className="h-8 w-8 bg-accent rounded-md flex items-center justify-center">
                <span className="text-accent-foreground text-sm font-medium">📊</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">92%</div>
              <p className="text-xs text-muted-foreground">
                +5% from last month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Get started with these common tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link to="/training-logs">
                <Button variant="outline" className="h-16 flex flex-col w-full">
                  <span className="text-lg mb-1">📋</span>
                  Log Training
                </Button>
              </Link>
              <Button variant="outline" className="h-16 flex flex-col">
                <span className="text-lg mb-1">🏆</span>
                Add PR
              </Button>
              <Button variant="outline" className="h-16 flex flex-col">
                <span className="text-lg mb-1">🎯</span>
                Set Goal
              </Button>
              {isAdmin() && (
                <Button variant="outline" className="h-16 flex flex-col">
                  <span className="text-lg mb-1">👥</span>
                  Manage Team
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* User Profile Info */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              Your account details and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Email</h4>
                  <p className="text-sm">{user?.email || 'test@example.com'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Role</h4>
                  <Badge variant="outline">{userProfile?.role || 'athlete'}</Badge>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Sport</h4>
                  <p className="text-sm">{userProfile?.sport || 'Canoe/Kayak'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Team</h4>
                  <p className="text-sm">{userProfile?.teamId || 'PeakLog Team'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;