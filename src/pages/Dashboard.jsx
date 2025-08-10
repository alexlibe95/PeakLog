import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Navigation from '../components/Navigation';
import { collection, getCountFromServer, getDocs, query, where } from 'firebase/firestore';

const Dashboard = () => {
  const { user, userProfile, logout, isAdmin } = useAuth();
  const [teamName, setTeamName] = useState('');
  const [statsLoading, setStatsLoading] = useState(false);
  const [totalClubs, setTotalClubs] = useState(0);
  const [totalAdmins, setTotalAdmins] = useState(0);
  const [totalAthletes, setTotalAthletes] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        if (userProfile?.teamId) {
          const snap = await getDoc(doc(db, 'clubs', userProfile.teamId));
          if (snap.exists()) setTeamName(snap.data().name || userProfile.teamId);
          else setTeamName(userProfile.teamId);
        } else {
          setTeamName('');
        }
      } catch (e) {
        setTeamName(userProfile?.teamId || '');
      }
    })();
  }, [userProfile?.teamId]);

  const isSuper = userProfile?.role === 'super';

  useEffect(() => {
    if (!isSuper) return;
    (async () => {
      setStatsLoading(true);
      try {
        const clubsSnap = await getDocs(collection(db, 'clubs'));
        const clubIds = clubsSnap.docs.map((d) => d.id);
        setTotalClubs(clubIds.length);
        let admins = 0;
        let athletes = 0;
        await Promise.all(
          clubIds.map(async (id) => {
            const a = await getCountFromServer(query(collection(db, 'clubs', id, 'members'), where('role', '==', 'admin')));
            const at = await getCountFromServer(query(collection(db, 'clubs', id, 'members'), where('role', '==', 'athlete')));
            admins += a.data().count || 0;
            athletes += at.data().count || 0;
          })
        );
        setTotalAdmins(admins);
        setTotalAthletes(athletes);
      } catch (e) {
        // ignore
      } finally {
        setStatsLoading(false);
      }
    })();
  }, [isSuper]);

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

  // Super admin overview section

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Page Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            {isSuper ? 'Super Admin overview' : `Welcome back, ${userProfile?.firstName || user?.email || 'Athlete'}! Here's your training overview.`}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Super overview */}
        {isSuper && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Clubs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsLoading ? '—' : totalClubs}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Admins</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsLoading ? '—' : totalAdmins}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Athletes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsLoading ? '—' : totalAthletes}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pending role notice */}
        {userProfile?.role === 'pending' && (
          <div className="mb-6 p-4 border rounded bg-yellow-50 text-yellow-900">
            <div className="font-medium">Limited access</div>
            <div className="text-sm">Your account is pending assignment to a club. A super admin or club admin must invite you to a club to unlock full features.</div>
          </div>
        )}

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
                  <p className="text-sm">{teamName || '—'}</p>
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