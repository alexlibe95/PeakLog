import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, getCountFromServer, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { clubService } from '../services/clubService';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Navigation from '../components/Navigation';
import { Crown, Shield, Users, Target, Info } from 'lucide-react';
import { useToast } from '@/components/ui/toast-context.jsx';

const Dashboard = () => {
  const {
    user,
    userProfile,
    isSuper,
    currentClubId,
    currentRole,
    getCurrentMembership,
    memberships,
    claims
  } = useAuth();

  const { toast } = useToast();

  const [statsLoading, setStatsLoading] = useState(false);
  const [totalClubs, setTotalClubs] = useState(0);
  const [totalAdmins, setTotalAdmins] = useState(0);
  const [totalAthletes, setTotalAthletes] = useState(0);
  const [nextTrainingSession, setNextTrainingSession] = useState(null);
  const [upcomingTrainingDays, setUpcomingTrainingDays] = useState([]);
  const [currentTrainingSession, setCurrentTrainingSession] = useState(null);
  const [sessionAttendance, setSessionAttendance] = useState([]);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [attendanceAthletes, setAttendanceAthletes] = useState([]);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Athlete attendance statistics
  const [athleteAttendanceStats, setAthleteAttendanceStats] = useState({
    attendanceRate: 0,
    sessionsCompleted: 0,
    totalSessions: 0,
    loading: true
  });

  // Program details modal state
  const [selectedProgramDay, setSelectedProgramDay] = useState(null);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);

  // Dashboard view selection
  const [selectedDashboardRole, setSelectedDashboardRole] = useState('');
  const [selectedDashboardClubId, setSelectedDashboardClubId] = useState('');

  // Get available roles and clubs for current user
  const getAvailableRoles = useCallback(() => {
    const roles = new Set();

    if (isSuper()) {
      roles.add('super');
    }

    (memberships || []).forEach(membership => {
      roles.add(membership.role);
    });

    return Array.from(roles);
  }, [isSuper, memberships]);

  const getAvailableClubsForRole = useCallback((role) => {
    if (role === 'super') {
      return []; // Super admin doesn't need club selection
    }

    return (memberships || [])
      .filter(membership => membership.role === role)
      .map(membership => ({
        id: membership.clubId,
        name: membership.clubName,
        role: membership.role
      }));
  }, [memberships]);

  // Use selected role/club for dashboard content, fallback to current
  const dashboardRole = selectedDashboardRole || currentRole;
  const dashboardClubId = selectedDashboardClubId || currentClubId;
  const dashboardMembership = (memberships || []).find(m =>
    m.clubId === dashboardClubId && m.role === dashboardRole
  ) || getCurrentMembership();

  // Get upcoming training days based on weekly schedule
  const loadUpcomingTrainingDays = useCallback(async (clubId) => {
    try {
      const upcomingDays = await clubService.getUpcomingTrainingDays(clubId, 7); // Get next 7 training days
      setUpcomingTrainingDays(upcomingDays);

      // Set the next training session from the first upcoming day
      if (upcomingDays.length > 0) {
        const nextDay = upcomingDays[0];
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const trainingDate = nextDay.date && nextDay.date instanceof Date
          ? new Date(nextDay.date.getFullYear(), nextDay.date.getMonth(), nextDay.date.getDate())
          : new Date(); // fallback to today if date is invalid

        const daysUntil = Math.ceil((trainingDate - today) / (1000 * 60 * 60 * 24));

        setNextTrainingSession({
          programName: nextDay.program?.name || 'Training Session',
          day: nextDay.dayName,
          startTime: nextDay.startTime,
          endTime: nextDay.endTime,
          daysUntil: daysUntil,
          program: nextDay.program,
          programId: nextDay.programId,
          date: nextDay.date,
          dateString: nextDay.dateString
        });
      } else {
        setNextTrainingSession(null);
      }
    } catch (error) {
      console.error('❌ Error loading upcoming training days:', error);
      setNextTrainingSession(null);
      setUpcomingTrainingDays([]);
    }
  }, []);

  // Handle dashboard view changes
  const handleRoleChange = (newRole) => {
    setSelectedDashboardRole(newRole);

    // Reset club selection when changing roles
    if (newRole === 'super') {
      setSelectedDashboardClubId('');
    } else {
      const clubsForRole = getAvailableClubsForRole(newRole);
      if (clubsForRole.length > 0) {
        setSelectedDashboardClubId(clubsForRole[0].id);
      }
    }
  };

  const handleClubChange = (newClubId) => {
    setSelectedDashboardClubId(newClubId);
  };

  // Synchronize dashboard view with AuthContext changes
  const isSuperUser = isSuper();
  useEffect(() => {
    const availableRoles = getAvailableRoles();
    if (availableRoles.length > 0) {
      // Always synchronize with current AuthContext role when it changes
      const targetRole = isSuperUser ? 'super' : currentRole || availableRoles[0];
      setSelectedDashboardRole(targetRole);

      if (targetRole !== 'super') {
        const clubsForRole = getAvailableClubsForRole(targetRole);
        if (clubsForRole.length > 0) {
          // Check if current club is available for this role, otherwise use first available
          const currentClubAvailable = clubsForRole.some(club => club.id === currentClubId);
          const targetClubId = currentClubAvailable ? currentClubId : clubsForRole[0].id;
          setSelectedDashboardClubId(targetClubId);
        } else {
          setSelectedDashboardClubId('');
        }
      } else {
        setSelectedDashboardClubId('');
      }
    }
  }, [currentRole, currentClubId, memberships, isSuperUser, selectedDashboardRole, selectedDashboardClubId, getAvailableRoles, getAvailableClubsForRole]);

  const loadSuperStats = useCallback(async () => {
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
      console.error('Error loading stats:', e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadClubStats = useCallback(async () => {
    if (!dashboardClubId) return;

    setStatsLoading(true);
    try {
      // Load club member counts
      const athletesQuery = query(collection(db, 'clubs', dashboardClubId, 'members'), where('role', '==', 'athlete'));
      const adminsQuery = query(collection(db, 'clubs', dashboardClubId, 'members'), where('role', '==', 'admin'));

      const [athletesSnap, adminsSnap] = await Promise.all([
        getDocs(athletesQuery),
        getDocs(adminsQuery)
      ]);

      // Note: These are loaded but not displayed in current UI
      console.log('Club stats loaded:', { athletes: athletesSnap.size, admins: adminsSnap.size });

    } catch (e) {
      console.error('Error loading club stats:', e);
    } finally {
      setStatsLoading(false);
    }
  }, [dashboardClubId]);

  // Load athlete attendance statistics
  const loadAthleteAttendanceStats = useCallback(async (clubId, athleteId) => {
    try {
      setAthleteAttendanceStats(prev => ({ ...prev, loading: true }));

      // Get all training sessions for this club
      const sessionsQuery = query(
        collection(db, 'trainingSessions'),
        where('clubId', '==', clubId),
        orderBy('date', 'desc'),
        limit(50) // Get last 50 sessions for stats
      );
      const sessionsSnap = await getDocs(sessionsQuery);

      let presentCount = 0, lateCount = 0, absentCount = 0;
      
      // Calculate current month sessions
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      let currentMonthSessions = 0;

      for (const sessionDoc of sessionsSnap.docs) {
        const sessionData = sessionDoc.data();
        const sessionDate = sessionData.date?.toDate ? sessionData.date.toDate() : new Date(sessionData.date);
        
        // Count sessions in current month
        if (sessionDate >= currentMonthStart) {
          currentMonthSessions++;
        }

        // Get attendance for this athlete in this session
        const attendanceQuery = query(
          collection(db, 'trainingSessions', sessionDoc.id, 'attendance'),
          where('athleteId', '==', athleteId)
        );
        const attendanceSnap = await getDocs(attendanceQuery);

        if (!attendanceSnap.empty) {
          const attendance = attendanceSnap.docs[0].data();

          // Count statistics
          switch (attendance.status) {
            case 'present':
              presentCount++;
              break;
            case 'late':
              lateCount++;
              break;
            case 'absent':
              absentCount++;
              break;
          }
        } else {
          // If no attendance record found, assume absent for past sessions
          if (sessionDate < now) {
            absentCount++;
          }
        }
      }

      const totalMarkedSessions = presentCount + lateCount + absentCount;
      const attendanceRate = totalMarkedSessions > 0 ? Math.round(((presentCount + lateCount) / totalMarkedSessions) * 100) : 0;

      setAthleteAttendanceStats({
        attendanceRate,
        sessionsCompleted: presentCount + lateCount, // Present + Late count as completed
        totalSessions: totalMarkedSessions,
        currentMonthSessions,
        loading: false
      });

    } catch (error) {
      console.error('❌ Error loading athlete attendance stats:', error);
      setAthleteAttendanceStats(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Main data loading effect - moved after function definitions to avoid hoisting issues
  useEffect(() => {
    if (dashboardRole === 'super' || isSuper()) {
      loadSuperStats();
    } else if (dashboardRole === 'admin' && dashboardClubId) {
      loadClubStats();
      loadUpcomingTrainingDays(dashboardClubId); // Load training days for attendance management
    } else if (dashboardRole === 'athlete' && dashboardClubId) {
      loadUpcomingTrainingDays(dashboardClubId);
      loadAthleteAttendanceStats(dashboardClubId, user.uid);
    }
  }, [currentClubId, currentRole, dashboardRole, dashboardClubId, userProfile?.role, claims?.super_admin, memberships, isSuper, loadClubStats, loadUpcomingTrainingDays, loadSuperStats, loadAthleteAttendanceStats, user.uid]);

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'super':
        return 'Super Admin';
      case 'admin':
        return 'Club Admin';
      case 'athlete':
        return 'Athlete';
      default:
        return 'Pending';
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getDashboardTitle = () => {
    if (dashboardRole === 'super') return 'Super Admin Dashboard';
    if (dashboardMembership) {
      return `${getRoleDisplayName(dashboardRole)} Dashboard`;
    }
    return `Welcome back, ${userProfile?.firstName || user?.email || 'User'}!`;
  };

  const getDashboardSubtitle = () => {
    if (dashboardRole === 'super') return 'Full system overview and management';
    if (dashboardMembership) {
      return dashboardMembership.clubName;
    }
    return 'Here\'s your training overview';
  };

  // Program details modal handlers
  const openProgramModal = (day) => {
    setSelectedProgramDay(day);
    setIsProgramModalOpen(true);
  };



  // Helper function to get effective club ID (same logic as AdminPage)
  const getEffectiveClubId = () => {
    // For regular admins, prioritize selected club, then current club, then first membership
    if (selectedDashboardClubId) {
      return selectedDashboardClubId;
    }

    if (currentClubId) {
      return currentClubId;
    }

    const adminMemberships = (memberships || []).filter(m => m.role === 'admin');
    if (adminMemberships.length > 0) {
      return adminMemberships[0].clubId;
    }

    return userProfile?.teamId || '';
  };

  // Attendance management functions
  const openAttendanceDialog = async (session) => {
    console.log('🎯 Opening attendance dialog for session:', session);
    console.log('🎯 Session date:', session.date);
    console.log('🎯 Session dateString:', session.dateString);
    console.log('🎯 Session programId:', session.programId);
    console.log('🎯 Session program:', session.program);

    setCurrentTrainingSession(session);
    setShowAttendanceDialog(true);
    setLoadingAthletes(true);

    try {
      let attendance = [];

      // Check if session has an ID (existing session) or needs to be created
      if (session.id && session.id !== session.dateString) {
        // Existing session - get attendance records
        console.log('Loading existing session attendance:', session.id);
        attendance = await clubService.getSessionAttendance(session.id);
      } else {
        // Check if a session already exists for this training day
        console.log('Checking for existing session for training day:', session.dateString);
        try {
          const clubIdToUse = getEffectiveClubId();
          const sessionsQuery = query(
            collection(db, 'trainingSessions'),
            where('clubId', '==', clubIdToUse),
            where('date', '==', new Date(session.dateString || session.date))
          );
          const sessionsSnap = await getDocs(sessionsQuery);

          if (!sessionsSnap.empty) {
            // Found existing session
            const existingSession = sessionsSnap.docs[0];
            const sessionId = existingSession.id;
            console.log('Found existing session:', sessionId);

            // Update current session with the real ID
            setCurrentTrainingSession(prev => ({ ...prev, id: sessionId }));

            // Load existing attendance records
            attendance = await clubService.getSessionAttendance(sessionId);
            console.log('Loaded existing attendance:', attendance);
          } else {
            console.log('No existing session found - will create new one when attendance is marked');
          }
        } catch (error) {
          console.log('Error checking for existing session:', error);
        }
      }

      setSessionAttendance(attendance);

      // Load club athletes for attendance management
      const dashboardClubId = selectedDashboardClubId || currentClubId;
      console.log('=== CLUB SELECTION DEBUG ===');
      console.log('Auth context values:', {
        currentClubId,
        currentRole,
        memberships: memberships?.map(m => ({ clubId: m.clubId, clubName: m.clubName, role: m.role }))
      });
      console.log('Dashboard selection:', {
        selectedDashboardClubId,
        selectedDashboardRole,
        dashboardClubId,
        dashboardRole
      });
      console.log('Session info:', {
        sessionClubId: session.clubId,
        sessionId: session.id,
        sessionName: session.programName
      });

      // Compare with AdminPage logic
      const adminMemberships = (memberships || []).filter(m => m.role === 'admin');
      console.log('Admin memberships:', adminMemberships.map(m => ({ clubId: m.clubId, clubName: m.clubName })));
      console.log('First admin club:', adminMemberships[0]?.clubId);

      const clubIdToUse = getEffectiveClubId();

      console.log('Final club ID to use:', clubIdToUse);
      console.log('Club comparison:', {
        dashboardClubId,
        sessionClubId: session.clubId,
        effectiveClubId: clubIdToUse
      });

      if (clubIdToUse) {
        console.log('Loading athletes for club:', clubIdToUse);
        try {
          const allMembers = await clubService.getClubMembersWithDetails(clubIdToUse);
          console.log('All members loaded:', allMembers);

          // Check member roles
          allMembers.forEach(member => {
            console.log(`Member ${member.id}: role=${member.role}, email=${member.email}`);
          });

          const athletesOnly = allMembers.filter(member => member.role === 'athlete');
          console.log('Filtered athletes:', athletesOnly);

          // Also log all roles found
          const allRoles = [...new Set(allMembers.map(m => m.role))];
          console.log('All roles found in club:', allRoles);

          // Try alternative filters
          const athletesAlt = allMembers.filter(member => member.role?.toLowerCase() === 'athlete');
          console.log('Athletes with case-insensitive filter:', athletesAlt);

          // Use case-insensitive filter if exact match fails
          const finalAthletes = athletesOnly.length > 0 ? athletesOnly : athletesAlt;
          setAttendanceAthletes(finalAthletes);
        } catch (clubError) {
          console.error('Error loading athletes for club:', clubIdToUse, clubError);
          setAttendanceAthletes([]);
        }
      } else {
        console.log('No club ID available for loading athletes');
        setAttendanceAthletes([]);
      }
    } catch (error) {
      console.error('Error loading attendance data:', error);
      setSessionAttendance([]);
      setAttendanceAthletes([]);
    } finally {
      setLoadingAthletes(false);
    }
  };

  const closeAttendanceDialog = () => {
    setShowAttendanceDialog(false);
    setCurrentTrainingSession(null);
    setSessionAttendance([]);
    setAttendanceAthletes([]);
  };



  const getAttendanceStatus = (athleteId) => {
    const attendance = sessionAttendance.find(a => a.athleteId === athleteId);
    return attendance ? attendance.status : '';
  };

  const saveAllAttendance = async () => {
    console.log('Attempting to save attendance...');
    console.log('Current training session:', currentTrainingSession);
    console.log('Session attendance records:', sessionAttendance);

    if (!currentTrainingSession || sessionAttendance.length === 0) {
      console.log('Cannot save: missing session or no attendance records');
      toast({
        title: "No attendance to save",
        description: "No attendance records have been marked.",
        variant: "destructive",
      });
      return;
    }

    setSavingAttendance(true);
    try {
      let sessionId = currentTrainingSession.id;

      // If session doesn't exist yet (future session), create it first
      if (!sessionId || sessionId === currentTrainingSession.dateString) {
        console.log('Creating session before bulk save:', currentTrainingSession);

        const clubIdToUse = getEffectiveClubId();

        // Create the training session
        const sessionData = {
          clubId: clubIdToUse,
          programId: currentTrainingSession.programId || 'general-training',
          title: currentTrainingSession.programName,
          description: `${currentTrainingSession.day} training session`,
          date: new Date(currentTrainingSession.dateString || currentTrainingSession.date),
          startTime: currentTrainingSession.startTime,
          endTime: currentTrainingSession.endTime,
          coachId: user.uid,
          maxParticipants: null,
          location: ''
        };

        const createdSession = await clubService.createTrainingSession(sessionData);
        sessionId = createdSession.id;

        // Update the current session with the new ID
        setCurrentTrainingSession(prev => ({ ...prev, id: sessionId }));

        console.log('Created new training session with ID:', sessionId);
        toast({
          title: "Training session created",
          description: "Session created for attendance marking",
        });
      }

      console.log('Calling bulkMarkAttendance with:', {
        sessionId: sessionId,
        attendanceData: sessionAttendance.map(attendance => ({
          athleteId: attendance.athleteId,
          status: attendance.status,
          notes: attendance.notes || ''
        })),
        coachId: user.uid
      });

      await clubService.bulkMarkAttendance(
        sessionId,
        sessionAttendance.map(attendance => ({
          athleteId: attendance.athleteId,
          status: attendance.status,
          notes: attendance.notes || ''
        })),
        user.uid
      );

      console.log('Attendance saved successfully');
      toast({
        title: "Attendance Saved",
        description: `Saved attendance for ${sessionAttendance.length} athlete(s)`,
      });

      // Close dialog after successful save
      closeAttendanceDialog();
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast({
        title: "Error",
        description: "Failed to save attendance. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingAttendance(false);
    }
  };





  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Page Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{getDashboardTitle()}</h1>
              <p className="text-muted-foreground">
                {getDashboardSubtitle()}
              </p>
            </div>

            {/* Dashboard View Selector - Only show if user has multiple roles or multiple clubs */}
            {(getAvailableRoles().length > 1 || (dashboardRole !== 'super' && getAvailableClubsForRole(dashboardRole).length > 1)) && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">View as:</span>

                {/* Role Selector - Only show if user has multiple roles */}
                {getAvailableRoles().length > 1 && (
                  <Select value={dashboardRole} onValueChange={handleRoleChange}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableRoles().map((role) => (
                        <SelectItem key={role} value={role}>
                          <div className="flex items-center gap-2">
                            {role === 'super' && <Crown className="h-3 w-3 text-yellow-600" />}
                            {role === 'admin' && <Shield className="h-3 w-3 text-blue-600" />}
                            {role === 'athlete' && <Users className="h-3 w-3 text-green-600" />}
                            {role === 'super' ? 'Super Admin' : role.charAt(0).toUpperCase() + role.slice(1)}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Club Selector (only show if role requires club selection and has multiple clubs) */}
                {dashboardRole !== 'super' && getAvailableClubsForRole(dashboardRole).length > 1 && (
                  <Select
                    value={selectedDashboardClubId || dashboardClubId}
                    onValueChange={handleClubChange}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableClubsForRole(dashboardRole).map((club) => (
                        <SelectItem key={club.id} value={club.id}>
                          <div className="flex items-center gap-2">
                            <Shield className="h-3 w-3" />
                            {club.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
        </div>


      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Super Admin Overview */}
        {dashboardRole === 'super' && (
          <>
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


          </>
        )}

        {/* Pending membership notice */}
        {(memberships || []).length === 0 && dashboardRole !== 'super' && (
          <div className="mb-6 p-6 border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-900">Welcome to PeakLog!</h3>
                <p className="text-blue-700">You're not part of any club yet</p>
              </div>
            </div>
            <div className="text-sm text-blue-800 mb-4">
              A club administrator needs to invite you to join their team. Once invited, you'll be able to access all training features and team management tools.
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>Check back later or contact your coach/administrator</span>
            </div>
          </div>
        )}



        {/* Athlete Stats Section */}
        {dashboardRole === 'athlete' && (
          <>
            {/* Athlete Performance Stats - Moved to Top */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
                  <div className="h-8 w-8 bg-green-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">✅</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {athleteAttendanceStats.loading ? '--' : `${athleteAttendanceStats.attendanceRate}%`}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {athleteAttendanceStats.loading ? 'Loading...' : `${athleteAttendanceStats.sessionsCompleted}/${athleteAttendanceStats.totalSessions} sessions`}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sessions Completed</CardTitle>
                  <div className="h-8 w-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">💪</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {athleteAttendanceStats.loading ? '--' : athleteAttendanceStats.currentMonthSessions}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {athleteAttendanceStats.loading ? 'Loading...' : 'This month'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Performance Rating</CardTitle>
                  <div className="h-8 w-8 bg-yellow-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">⭐</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {athleteAttendanceStats.loading ? '--' : 
                      athleteAttendanceStats.attendanceRate >= 90 ? '⭐⭐⭐⭐⭐' :
                      athleteAttendanceStats.attendanceRate >= 80 ? '⭐⭐⭐⭐' :
                      athleteAttendanceStats.attendanceRate >= 70 ? '⭐⭐⭐' :
                      athleteAttendanceStats.attendanceRate >= 60 ? '⭐⭐' :
                      athleteAttendanceStats.attendanceRate >= 50 ? '⭐' : '☆'
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {athleteAttendanceStats.loading ? 'Loading...' : 'Based on attendance'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Current/Next Training Day - Full Width Prominent Display */}
            <Card className="mb-6 border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="text-2xl">🏋️‍♂️</div>
                  {nextTrainingSession?.daysUntil === 0 ? 'Today\'s Training' : 'Next Training Session'}
                </CardTitle>
                <CardDescription className="text-base">
                  {dashboardMembership?.clubName || 'Your Club'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {nextTrainingSession ? (
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex-1 text-center md:text-left">
                      <h3 className="text-2xl font-bold mb-3 text-primary">
                        {nextTrainingSession.programName}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">Day</div>
                          <div className="font-semibold text-lg">
                            {nextTrainingSession.day.charAt(0).toUpperCase() + nextTrainingSession.day.slice(1)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">Time</div>
                          <div className="font-semibold text-lg">
                            {formatTime(nextTrainingSession.startTime)} - {formatTime(nextTrainingSession.endTime)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">When</div>
                          <div className="font-semibold text-lg">
                            {nextTrainingSession.daysUntil === 0
                              ? 'Today'
                              : nextTrainingSession.daysUntil === 1
                                ? 'Tomorrow'
                                : `In ${nextTrainingSession.daysUntil} days`
                            }
                          </div>
                        </div>
                      </div>
                      {nextTrainingSession.program?.description && (
                        <p className="text-muted-foreground mb-4">
                          {nextTrainingSession.program.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                        <Badge variant="outline" className="bg-primary/10">
                          📅 {nextTrainingSession.day.charAt(0).toUpperCase() + nextTrainingSession.day.slice(1)}
                        </Badge>
                        <Badge variant="outline" className="bg-primary/10">
                          🕐 {formatTime(nextTrainingSession.startTime)}
                        </Badge>
                        {nextTrainingSession.program?.difficulty && (
                          <Badge variant="outline" className="bg-primary/10">
                            🎯 {nextTrainingSession.program.difficulty.charAt(0).toUpperCase() + nextTrainingSession.program.difficulty.slice(1)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="text-center">
                        <div className="text-6xl mb-2">🏋️‍♂️</div>
                        <Button
                          variant="outline"
                          onClick={() => openProgramModal(upcomingTrainingDays[0])}
                          className="border-primary/20 hover:bg-primary/10"
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🏋️‍♂️</div>
                    <h3 className="text-2xl font-semibold mb-2">No Upcoming Sessions</h3>
                    <p className="text-muted-foreground text-lg">
                      Your coach will schedule training sessions soon
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

              {/* Upcoming Training Days */}
              {upcomingTrainingDays.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-lg">📅</span>
                      Upcoming Training Schedule
                    </CardTitle>
                    <CardDescription>
                      Your training schedule for the coming weeks at {dashboardMembership?.clubName || 'your club'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {upcomingTrainingDays.slice(0, 7).map((day, index) => (
                        <div
                          key={day.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${
                            index === 0
                              ? 'bg-primary/5 border-primary/20 hover:bg-primary/10'
                              : 'bg-muted/30 hover:bg-muted/50'
                          }`}
                          onClick={() => openProgramModal(day)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openProgramModal(day);
                            }
                          }}
                        >
                          <div className="text-center min-w-[60px]">
                            <div className="text-xs font-medium text-muted-foreground">
                              {day.dateString}
                            </div>
                            <div className="text-sm font-bold">
                              {day.dayName}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Target className="w-3 h-3 text-primary flex-shrink-0" />
                              <span className="font-medium text-sm truncate">
                                {day.program?.name || 'Training Session'}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatTime(day.startTime)} - {formatTime(day.endTime)}
                            </div>
                            {day.program?.description && (
                              <div className="text-xs text-muted-foreground truncate">
                                {day.program.description}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Info className="w-3 h-3 text-muted-foreground hover:text-primary transition-colors" />
                            <Badge variant={index === 0 ? "default" : "secondary"} className="text-xs">
                              {index === 0 ? 'Next' : `+${index + 1} days`}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}



          </>
        )}

        {/* Admin Attendance Management */}
        {dashboardRole === 'admin' && dashboardClubId && (
          <>
            <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                Attendance Management
              </CardTitle>
              <CardDescription>
                Mark attendance for training sessions at {dashboardMembership?.clubName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {nextTrainingSession ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <h4 className="font-semibold">{nextTrainingSession.programName}</h4>
                      <p className="text-sm text-muted-foreground">
                        {nextTrainingSession.day} - {formatTime(nextTrainingSession.startTime)} to {formatTime(nextTrainingSession.endTime)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {nextTrainingSession.daysUntil === 0 ? 'Today' : `In ${nextTrainingSession.daysUntil} days`}
                      </p>
                    </div>

                    <Button
                      onClick={() => openAttendanceDialog(nextTrainingSession)}
                      className="bg-primary hover:bg-primary/90"
                    >
                      Mark Attendance
                    </Button>
                  </div>

                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📊</div>
                  <h3 className="text-lg font-semibold mb-2">No Upcoming Sessions</h3>
                  <p className="text-muted-foreground">
                    Set up your weekly schedule to manage attendance
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          </>
        )}

        {/* Program Details Modal */}
        <Dialog open={isProgramModalOpen} onOpenChange={setIsProgramModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Training Program Details
              </DialogTitle>
              <DialogDescription>
                {selectedProgramDay && (
                  <>
                    {selectedProgramDay.dayName} - {selectedProgramDay.dateString}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            {selectedProgramDay && (
              <div className="space-y-4">
                {/* Program Header */}
                <div className="p-4 bg-primary/5 rounded-lg border">
                  <h3 className="text-lg font-semibold text-primary mb-2">
                    {selectedProgramDay.program?.name || 'Training Session'}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>🕒</span>
                      <span>{formatTime(selectedProgramDay.startTime)} - {formatTime(selectedProgramDay.endTime)}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {selectedProgramDay.dayName}
                    </Badge>
                  </div>
                </div>

                {/* Program Description */}
                {selectedProgramDay.program?.description && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Program Description</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {selectedProgramDay.program.description}
                    </p>
                  </div>
                )}

                {/* Training Objectives */}
                {selectedProgramDay.program?.objectives && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Training Objectives</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {selectedProgramDay.program.objectives}
                    </p>
                  </div>
                )}

                {/* Difficulty Level */}
                {selectedProgramDay.program?.difficulty && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Difficulty Level</h4>
                    <Badge variant="outline" className="text-xs">
                      {selectedProgramDay.program.difficulty.charAt(0).toUpperCase() + selectedProgramDay.program.difficulty.slice(1)}
                    </Badge>
                  </div>
                )}

                {/* Target Skills */}
                {selectedProgramDay.program?.targetSkills && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Target Skills</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedProgramDay.program.targetSkills}
                    </p>
                  </div>
                )}

                {/* Equipment Needed */}
                {selectedProgramDay.program?.equipment && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Equipment Needed</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedProgramDay.program.equipment}
                    </p>
                  </div>
                )}

                {/* Session Information */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Session Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Date:</span>
                      <div className="font-medium">{selectedProgramDay.dateString}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Typical Duration:</span>
                      <div className="font-medium">
                        {selectedProgramDay.program?.duration || (() => {
                          const start = new Date(`2000-01-01T${selectedProgramDay.startTime}`);
                          const end = new Date(`2000-01-01T${selectedProgramDay.endTime}`);
                          const duration = (end - start) / (1000 * 60); // minutes
                          return `${duration} minutes`;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preparation Tips */}
                {selectedProgramDay.program?.preparationTips && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Preparation Tips</h4>
                    <div className="text-sm text-muted-foreground leading-relaxed">
                      {selectedProgramDay.program.preparationTips}
                    </div>
                  </div>
                )}

                {/* Special Instructions */}
                {selectedProgramDay.program?.specialInstructions && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Special Instructions</h4>
                    <div className="text-sm text-muted-foreground leading-relaxed bg-amber-50 border border-amber-200 rounded p-3">
                      ⚠️ {selectedProgramDay.program.specialInstructions}
                    </div>
                  </div>
                )}

                {/* Default Training Tips (if no custom preparation tips) */}
                {(!selectedProgramDay.program?.preparationTips && !selectedProgramDay.program?.specialInstructions) && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">General Training Tips</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Arrive 10-15 minutes early to prepare</li>
                      <li>• Bring water and appropriate training gear</li>
                      <li>• Focus on proper technique and form</li>
                      <li>• Communicate with your coach about any concerns</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Attendance Management Dialog */}
        <Dialog open={showAttendanceDialog} onOpenChange={setShowAttendanceDialog}>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                Mark Attendance
              </DialogTitle>
              <DialogDescription>
                {currentTrainingSession && (
                  <span className="truncate">
                    {currentTrainingSession.programName} - {currentTrainingSession.day}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            {currentTrainingSession && (
              <div className="space-y-4">
                {/* Session Info */}
                <div className="p-3 sm:p-4 bg-primary/5 rounded-lg border">
                  <h4 className="font-semibold mb-2 truncate">{currentTrainingSession.programName}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Date:</span>
                      <div className="font-medium">
                        {currentTrainingSession.date
                          ? new Date(currentTrainingSession.date).toLocaleDateString()
                          : currentTrainingSession.dateString ||
                            (currentTrainingSession.id && currentTrainingSession.id.includes('-')
                              ? currentTrainingSession.id
                              : 'Today')
                        }
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Time:</span>
                      <div className="font-medium">
                        {formatTime(currentTrainingSession.startTime)} - {formatTime(currentTrainingSession.endTime)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Athlete Attendance List */}
                <div className="space-y-2">
                  <h4 className="font-medium">Club Athletes ({attendanceAthletes.length})</h4>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {loadingAthletes ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <div className="text-4xl mb-2">⏳</div>
                        <p>Loading athletes...</p>
                      </div>
                    ) : attendanceAthletes.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <div className="text-4xl mb-2">👥</div>
                        <p>No athletes found in this club</p>
                        <p className="text-sm">Athletes need to be added to the club first</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {attendanceAthletes.map((athlete) => (
                          <div key={athlete.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-3">
                            <div className="flex items-center space-x-3 min-w-0 flex-1">
                              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-medium">
                                  {(athlete.firstName || athlete.email || 'A')[0].toUpperCase()}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">
                                  {athlete.firstName && athlete.lastName
                                    ? `${athlete.firstName} ${athlete.lastName}`
                                    : athlete.email || 'Unknown Athlete'}
                                </p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {athlete.email}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Select
                                value={getAttendanceStatus(athlete.id)}
                                onValueChange={(status) => {
                                  console.log(`Updating attendance for ${athlete.email}: ${status}`);

                                  // Only update local state - no immediate Firebase calls
                                  setSessionAttendance(prev => {
                                    const newAttendance = [...prev];
                                    const existingIndex = newAttendance.findIndex(a => a.athleteId === athlete.id);

                                    if (existingIndex >= 0) {
                                      newAttendance[existingIndex] = {
                                        ...newAttendance[existingIndex],
                                        status,
                                        notes: '',
                                        markedAt: new Date()
                                      };
                                    } else {
                                      newAttendance.push({
                                        athleteId: athlete.id,
                                        status,
                                        notes: '',
                                        markedAt: new Date(),
                                        markedBy: user.uid
                                      });
                                    }

                                    console.log('Updated sessionAttendance:', newAttendance);
                                    return newAttendance;
                                  });
                                }}
                              >
                                <SelectTrigger className={`w-full sm:w-32 min-w-[120px] ${getAttendanceStatus(athlete.id) ? 'border-green-500 bg-green-50' : ''}`}>
                                  <SelectValue placeholder="Mark attendance" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="present">✅ Present</SelectItem>
                                  <SelectItem value="late">⏰ Late</SelectItem>
                                  <SelectItem value="absent">❌ Absent</SelectItem>
                                </SelectContent>
                              </Select>
                              {getAttendanceStatus(athlete.id) && (
                                <div className="text-xs text-green-600 font-medium whitespace-nowrap">
                                  ✓ Saved
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-3">
              <div className="flex items-center text-sm text-muted-foreground order-2 sm:order-1">
                {sessionAttendance.length > 0 && (
                  <span>{sessionAttendance.length} athlete(s) marked</span>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 order-1 sm:order-2">
                <Button variant="outline" onClick={closeAttendanceDialog} className="w-full sm:w-auto">
                  Close
                </Button>
                <Button
                  onClick={saveAllAttendance}
                  disabled={savingAttendance || sessionAttendance.length === 0}
                  className="w-full sm:w-auto"
                >
                  {savingAttendance ? 'Saving...' : 'Save All Attendance'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
};

export default Dashboard;