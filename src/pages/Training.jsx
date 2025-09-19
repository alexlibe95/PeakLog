import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatTimeValue, isTimeUnit } from '../utils/valueParser';
import { 
  Calendar, 
  Award, 
  Target, 
  TrendingUp, 
  CheckCircle, 
  Clock,
  Trophy,
  Activity,
  BookOpen
} from 'lucide-react';

const Training = () => {
  const { user, currentClubId, getCurrentMembership } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trainingHistory, setTrainingHistory] = useState([]);
  const [personalRecords, setPersonalRecords] = useState([]);
  const [goals, setGoals] = useState([]);
  const [categories, setCategories] = useState([]);

  // Get current club information
  const currentMembership = getCurrentMembership();
  const currentClubName = currentMembership?.clubName || 'Your Club';


  // Load all data
  useEffect(() => {
    const loadData = async () => {
      if (!currentClubId || !user) return;

      setLoading(true);

      try {
        // Load categories first
        const categoriesQuery = query(
          collection(db, 'performanceCategories'),
          where('clubId', '==', currentClubId),
          where('isActive', '==', true)
        );
        const categoriesSnap = await getDocs(categoriesQuery);
        const categoriesData = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const sortedCategories = categoriesData.sort((a, b) => a.name.localeCompare(b.name));
        setCategories(sortedCategories);

        // Load training history
        const sessionsQuery = query(
          collection(db, 'trainingSessions'),
          where('clubId', '==', currentClubId),
          orderBy('date', 'desc'),
          limit(20)
        );
        const sessionsSnap = await getDocs(sessionsQuery);

        const attendedSessions = [];

        for (const sessionDoc of sessionsSnap.docs) {
          const sessionData = sessionDoc.data();

          // Check if athlete attended this session
          const attendanceQuery = query(
            collection(db, 'trainingSessions', sessionDoc.id, 'attendance'),
            where('athleteId', '==', user.uid)
          );
          const attendanceSnap = await getDocs(attendanceQuery);

          if (!attendanceSnap.empty) {
            const attendance = attendanceSnap.docs[0].data();
            if (attendance.status === 'present' || attendance.status === 'late') {
              attendedSessions.push({
                id: sessionDoc.id,
                title: sessionData.title || sessionData.programName || 'Training Session',
                date: sessionData.date,
                startTime: sessionData.startTime,
                endTime: sessionData.endTime,
                status: attendance.status,
                notes: attendance.notes || ''
              });
            }
          }
        }

        setTrainingHistory(attendedSessions);

        // Load personal records
        const recordsQuery = query(
          collection(db, 'personalRecords'),
          where('athleteId', '==', user.uid)
        );
        const recordsSnap = await getDocs(recordsQuery);
        const records = recordsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Enrich records with category information
        const enrichedRecords = records.map(record => {
          const category = sortedCategories.find(c => c.id === record.categoryId);
          return {
            ...record,
            unit: category?.unit || '',
            categoryName: category?.name || 'Unknown Category'
          };
        });

        setPersonalRecords(enrichedRecords.sort((a, b) => new Date(b.date) - new Date(a.date)));

        // Load goals
        const goalsQuery = query(
          collection(db, 'athleteGoals'),
          where('athleteId', '==', user.uid),
          where('clubId', '==', currentClubId),
          where('isActive', '==', true)
        );
        const goalsSnap = await getDocs(goalsQuery);
        const goalsData = goalsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Enrich goals with category information
        const enrichedGoals = goalsData.map(goal => {
          const category = sortedCategories.find(c => c.id === goal.categoryId);
          return {
            ...goal,
            unit: category?.unit || '',
            categoryName: category?.name || 'Unknown Category'
          };
        });

        setGoals(enrichedGoals.sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate)));

      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentClubId, user]);

  // Helper functions
  const formatDate = (date) => {
    const dateObj = date?.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getCategoryName = (record) => {
    return record.categoryName || 'Unknown Category';
  };

  const getGoalStatus = (goal) => {
    const today = new Date();
    const targetDate = new Date(goal.targetDate);
    
    if (goal.status === 'completed') return 'completed';
    if (targetDate < today) return 'overdue';
    
    const daysUntil = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 7) return 'urgent';
    if (daysUntil <= 30) return 'upcoming';
    return 'future';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'overdue': return 'bg-red-500';
      case 'urgent': return 'bg-orange-500';
      case 'upcoming': return 'bg-yellow-500';
      case 'future': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'overdue': return 'Overdue';
      case 'urgent': return 'Due Soon';
      case 'upcoming': return 'Upcoming';
      case 'future': return 'Future Goal';
      default: return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <Activity className="mx-auto h-12 w-12 text-muted-foreground animate-pulse mb-4" />
              <h3 className="text-lg font-semibold mb-2">Loading Your Training Data</h3>
              <p className="text-muted-foreground">Please wait while we fetch your information...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="text-center">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-4">
              <div className="p-2 sm:p-3 bg-primary/10 rounded-full">
                <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary">My Training Journey</h1>
            </div>
            <p className="text-lg sm:text-xl text-muted-foreground px-2">
              Track your progress, celebrate achievements, and pursue your goals
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
            
            {/* Personal Records */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Award className="h-6 w-6 text-amber-500" />
                  <div>
                    <CardTitle className="text-lg">Personal Bests</CardTitle>
                    <CardDescription>Your record achievements</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {personalRecords.length === 0 ? (
                  <div className="text-center py-8">
                    <Trophy className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">No personal records yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {personalRecords.slice(0, 5).map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm text-amber-900 dark:text-amber-100">{getCategoryName(record)}</h4>
                          <p className="text-xs text-muted-foreground">{formatDate(record.date)}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-amber-700 dark:text-amber-300">
                            {isTimeUnit(record.unit)
                              ? formatTimeValue(record.value)
                              : record.value} {record.unit}
                          </div>
                        </div>
                      </div>
                    ))}
                    {personalRecords.length > 5 && (
                      <p className="text-xs text-center text-muted-foreground pt-2">
                        +{personalRecords.length - 5} more records
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Goals */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Target className="h-6 w-6 text-blue-500" />
                  <div>
                    <CardTitle className="text-lg">Goals</CardTitle>
                    <CardDescription>Your training objectives</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {goals.length === 0 ? (
                  <div className="text-center py-8">
                    <Target className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">No goals set yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {goals.slice(0, 5).map((goal) => {
                      const status = getGoalStatus(goal);
                      return (
                        <div key={goal.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm">{getCategoryName(goal)}</h4>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${status === 'upcoming' ? 'text-gray-900' : 'text-white'} ${getStatusColor(status)}`}
                            >
                              {getStatusText(status)}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                              Target: {isTimeUnit(goal.unit)
                                ? formatTimeValue(goal.targetValue)
                                : goal.targetValue} {goal.unit}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(goal.targetDate)}
                            </div>
                          </div>
                          {goal.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">"{goal.notes}"</p>
                          )}
                        </div>
                      );
                    })}
                    {goals.length > 5 && (
                      <p className="text-xs text-center text-muted-foreground pt-2">
                        +{goals.length - 5} more goals
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-6 w-6 text-green-500" />
                  <div>
                    <CardTitle className="text-lg">Quick Stats</CardTitle>
                    <CardDescription>Your progress overview</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Training Sessions</span>
                    <span className="font-semibold">{trainingHistory.length}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Personal Records</span>
                    <span className="font-semibold">{personalRecords.length}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Active Goals</span>
                    <span className="font-semibold">{goals.filter(g => g.status !== 'completed').length}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Completed Goals</span>
                    <span className="font-semibold text-green-600">{goals.filter(g => g.status === 'completed').length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Training Sessions - Moved to bottom */}
          <Card className="h-fit">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Calendar className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle className="text-xl">Training Sessions</CardTitle>
                  <CardDescription>Your recent training attendance history</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {trainingHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Training Sessions Yet</h3>
                  <p className="text-muted-foreground">
                    Your attended training sessions will appear here once you start participating
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {trainingHistory.map((session) => (
                    <div key={session.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <Activity className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{session.title}</h3>
                          <Badge variant={session.status === 'present' ? 'default' : 'secondary'} className="text-xs">
                            {session.status === 'present' ? 'Present' : 'Late'}
                          </Badge>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(session.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(session.startTime)} - {formatTime(session.endTime)}
                          </span>
                        </div>
                        {session.notes && (
                          <p className="text-sm text-muted-foreground mt-1">"{session.notes}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Training;