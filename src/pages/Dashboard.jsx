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
import TrainingCalendar from '../components/TrainingCalendar';
import VacationManager from '../components/VacationManager';
import AdminMessageManager from '../components/AdminMessageManager';
import { Crown, Shield, Users, Target, Info, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/toast-context';

const Dashboard = () => {
  const {
    user,
    userProfile,
    isSuper,
    currentClubId,
    currentRole,
    getCurrentMembership,
    memberships,
    loading: authLoading
  } = useAuth();

  const { toast } = useToast();

  const [statsLoading, setStatsLoading] = useState(false);
  const [totalClubs, setTotalClubs] = useState(0);
  const [totalAdmins, setTotalAdmins] = useState(0);
  const [totalAthletes, setTotalAthletes] = useState(0);
  const [nextTrainingSession, setNextTrainingSession] = useState(null);
  const [upcomingTrainingDays, setUpcomingTrainingDays] = useState([]);
  const [currentTrainingSession, setCurrentTrainingSession] = useState(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [sessionAttendance, setSessionAttendance] = useState([]);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [clubMessage, setClubMessage] = useState(null);
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

  // Weekly schedule existence tracking (null = not loaded, false = no schedule, true = has schedule)
  const [hasWeeklySchedule, setHasWeeklySchedule] = useState(null);

  // Program details modal state
  const [selectedProgramDay, setSelectedProgramDay] = useState(null);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);

  // Dashboard view selection
  const [selectedDashboardRole, setSelectedDashboardRole] = useState('');
  const [selectedDashboardClubId, setSelectedDashboardClubId] = useState('');
  const [availableRoles, setAvailableRoles] = useState([]);
  const [availableClubs, setAvailableClubs] = useState([]);

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

  // Helper function to determine training status
  const getTrainingStatus = (day, currentTime) => {
    if (!day || !day.startTime || !day.endTime) {
      return 'upcoming';
    }

    const today = new Date();
    const dayDate = day.date instanceof Date ? day.date : new Date(day.date);
    
    // Check if it's today
    if (dayDate.toDateString() !== today.toDateString()) {
      return dayDate < today ? 'completed' : 'upcoming';
    }

    // Parse training times for today
    const [startHour, startMinute] = day.startTime.split(':').map(Number);
    const [endHour, endMinute] = day.endTime.split(':').map(Number);
    
    const startTime = new Date(today);
    startTime.setHours(startHour, startMinute, 0, 0);
    
    const endTime = new Date(today);
    endTime.setHours(endHour, endMinute, 0, 0);

    if (currentTime < startTime) {
      return 'upcoming'; // Training hasn't started yet today
    } else if (currentTime >= startTime && currentTime <= endTime) {
      return 'in-progress'; // Training is happening now
    } else {
      return 'completed'; // Training has ended today
    }
  };

  // Load club message for athletes
  const loadClubMessage = useCallback(async (clubId) => {
    try {
      const message = await clubService.getClubMessage(clubId);
      setClubMessage(message);
    } catch (error) {
      console.error('❌ Error loading club message:', error);
      setClubMessage(null);
    }
  }, []);

  // Get upcoming training days based on weekly schedule
  const loadUpcomingTrainingDays = useCallback(async (clubId) => {
    try {
      // Set a timeout to prevent indefinite loading state
      const timeoutId = setTimeout(() => {
        setHasWeeklySchedule(false);
      }, 10000); // 10 second timeout

      // Load data with individual error handling to prevent hanging
      let upcomingDays = [];
      let cancellations = { cancellations: [] };
      let weeklySchedule = null;

      try {
        upcomingDays = await clubService.getUpcomingTrainingDays(clubId, 14);
      } catch (error) {
        console.error('Error loading upcoming days:', error);
      }

      try {
        cancellations = await clubService.getTrainingCancellations(clubId);
      } catch (error) {
        console.error('Error loading cancellations:', error);
      }

      try {
        weeklySchedule = await clubService.getWeeklySchedule(clubId);
      } catch (error) {
        console.error('Error loading weekly schedule:', error);
        weeklySchedule = null; // Ensure it's null on error
      }

      // Check if weekly schedule exists
      const scheduleExists = !!weeklySchedule && !!weeklySchedule.schedule && Object.keys(weeklySchedule.schedule).length > 0;

      // Always set the schedule state to prevent loading hang
      setHasWeeklySchedule(scheduleExists);
      clearTimeout(timeoutId); // Clear timeout on success

      // Enhance upcoming days with cancellation and status information
      const currentTime = new Date();
      const enhancedDays = upcomingDays.map(day => {
        const dayDate = day.date instanceof Date ? day.date : new Date(day.date);
        
        // Find if this day is cancelled
        const cancellation = cancellations.cancellations?.find(c => {
          let cancellationDate;
          
          // Handle Firestore Timestamp
          if (c.date && c.date.toDate && typeof c.date.toDate === 'function') {
            cancellationDate = c.date.toDate();
          } 
          // Handle regular Date object
          else if (c.date instanceof Date) {
            cancellationDate = c.date;
          } 
          // Handle date strings/numbers
          else {
            cancellationDate = new Date(c.date);
          }
          
          return cancellationDate && !isNaN(cancellationDate.getTime()) && 
                 cancellationDate.toDateString() === dayDate.toDateString();
        });

        // Determine training status
        const status = getTrainingStatus(day, currentTime);

        return {
          ...day,
          isCancelled: !!cancellation,
          cancellationInfo: cancellation || null,
          status: cancellation ? 'cancelled' : status
        };
      });

      setUpcomingTrainingDays(enhancedDays);

      // Set the next training session from the first NON-CANCELLED upcoming day
      const nextActiveDay = enhancedDays.find(day => !day.isCancelled);
      if (nextActiveDay) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const trainingDate = nextActiveDay.date && nextActiveDay.date instanceof Date
          ? new Date(nextActiveDay.date.getFullYear(), nextActiveDay.date.getMonth(), nextActiveDay.date.getDate())
          : new Date(); // fallback to today if date is invalid

        const daysUntil = Math.ceil((trainingDate - today) / (1000 * 60 * 60 * 24));

        setNextTrainingSession({
          programName: nextActiveDay.program?.name || 'Training Session',
          day: nextActiveDay.dayName,
          startTime: nextActiveDay.startTime,
          endTime: nextActiveDay.endTime,
          daysUntil: daysUntil,
          program: nextActiveDay.program,
          programId: nextActiveDay.programId,
          date: nextActiveDay.date,
          dateString: nextActiveDay.dateString,
          isCancelled: false,
          status: nextActiveDay.status
        });
      } else {
        setNextTrainingSession(null);
      }
    } catch (error) {
      console.error('❌ Error loading upcoming training days:', error);
      setNextTrainingSession(null);
      setUpcomingTrainingDays([]);
      setHasWeeklySchedule(false); // Set to false on error to prevent loading state
    }
  }, []);

  // Handle dashboard view changes
  const handleRoleChange = (newRole) => {
    setSelectedDashboardRole(newRole);
    setHasWeeklySchedule(null); // Reset weekly schedule state to not loaded

    // Reset club selection when changing roles
    if (newRole === 'super') {
      setSelectedDashboardClubId('');
    } else {
      const clubsForRole = getAvailableClubsForRole(newRole);
      if (clubsForRole.length > 0) {
        // Prefer current club if available for this role, otherwise use first
        const currentClubAvailable = clubsForRole.some(club => club.id === currentClubId);
        const targetClubId = currentClubAvailable ? currentClubId : clubsForRole[0].id;
        setSelectedDashboardClubId(targetClubId);
      } else {
        setSelectedDashboardClubId('');
      }
    }
  };

  const handleClubChange = (newClubId) => {
    setSelectedDashboardClubId(newClubId);
    setHasWeeklySchedule(null); // Reset weekly schedule state to not loaded when changing clubs
  };

  // Update available roles and clubs when memberships change
  useEffect(() => {
    const roles = getAvailableRoles();
    setAvailableRoles(roles);
  }, [isSuper, memberships]); // Depend on the actual values, not the functions

  useEffect(() => {
    if (selectedDashboardRole) {
      const clubs = getAvailableClubsForRole(selectedDashboardRole);
      setAvailableClubs(clubs);
    } else {
      setAvailableClubs([]);
    }
  }, [selectedDashboardRole, memberships]); // Depend on the actual values, not the functions

  // Synchronize dashboard view with AuthContext changes (only on initial load)
  const isSuperUser = isSuper();
  useEffect(() => {
    if (availableRoles.length > 0) {
      // Only set initial values if not already set
      if (!selectedDashboardRole) {
        const targetRole = isSuperUser ? 'super' : currentRole || availableRoles[0];
        setSelectedDashboardRole(targetRole);
      }

      if (!selectedDashboardClubId) {
        const targetRole = selectedDashboardRole || (isSuperUser ? 'super' : currentRole || availableRoles[0]);

        if (targetRole !== 'super' && availableClubs.length > 0) {
          // Check if current club is available for this role, otherwise use first available
          const currentClubAvailable = availableClubs.some(club => club.id === currentClubId);
          const targetClubId = currentClubAvailable ? currentClubId : availableClubs[0].id;
          setSelectedDashboardClubId(targetClubId);
        } else {
          setSelectedDashboardClubId('');
        }
      }
    }
  }, [currentRole, currentClubId, memberships, isSuperUser, selectedDashboardRole, selectedDashboardClubId, availableRoles, availableClubs]);

  // Set initial load as complete after 5 seconds to allow time for pending assignment processing
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoadComplete(true);
    }, 5000); // 5 seconds should be enough for assignment processing

    return () => clearTimeout(timer);
  }, []);

  // Refresh training status periodically
  useEffect(() => {
    let interval;
    
    if (dashboardClubId && dashboardRole === 'athlete') {
      // Refresh every 2 minutes to update training status
      interval = setInterval(() => {
        loadUpcomingTrainingDays(dashboardClubId);
      }, 2 * 60 * 1000); // 2 minutes
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [dashboardClubId, dashboardRole, loadUpcomingTrainingDays]);

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
      // Load member counts for potential future use
      const athletesQuery = query(collection(db, 'clubs', dashboardClubId, 'members'), where('role', '==', 'athlete'));
      const adminsQuery = query(collection(db, 'clubs', dashboardClubId, 'members'), where('role', '==', 'admin'));

      await Promise.all([
        getDocs(athletesQuery),
        getDocs(adminsQuery)
      ]);

      // Note: These are loaded but not displayed in current UI

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

      // Get past training sessions for this club (only sessions that have occurred)
      // Only count sessions that are either from schedule or have attendance records
      const now = new Date();
      const sessionsQuery = query(
        collection(db, 'trainingSessions'),
        where('clubId', '==', clubId),
        where('date', '<', now), // Only past sessions
        orderBy('date', 'desc'),
        limit(100)
      );
      const sessionsSnap = await getDocs(sessionsQuery);

      let presentCount = 0, lateCount = 0, absentCount = 0;
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      let currentMonthSessions = 0;

      for (const sessionDoc of sessionsSnap.docs) {
        const sessionData = sessionDoc.data();
        const sessionDate = sessionData.date?.toDate ? sessionData.date.toDate() : new Date(sessionData.date);

        // Only count sessions that have attendance records for this athlete
        // This ensures we only count sessions where the athlete was actually expected to attend
        const attendanceQuery = query(
          collection(db, 'trainingSessions', sessionDoc.id, 'attendance'),
          where('athleteId', '==', athleteId)
        );
        const attendanceSnap = await getDocs(attendanceQuery);

        if (!attendanceSnap.empty) {
          // Count sessions in current month
          if (sessionDate >= currentMonthStart) {
            currentMonthSessions++;
          }

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
      loadClubMessage(dashboardClubId);
    }
  }, [dashboardRole, dashboardClubId]); // Simplified dependencies to avoid unnecessary re-runs

  // Fallback effect to ensure data loading happens even if main useEffect fails
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      // Only load if we haven't loaded yet and we have the required data
      if (hasWeeklySchedule === null && dashboardClubId && dashboardRole) {
        if (dashboardRole === 'admin' || dashboardRole === 'athlete') {
          loadUpcomingTrainingDays(dashboardClubId);
        }
      }
    }, 2000); // Wait 2 seconds for main useEffect to run

    return () => clearTimeout(fallbackTimer);
  }, [dashboardRole, dashboardClubId, hasWeeklySchedule]);

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
    setCurrentTrainingSession(session);
    setShowAttendanceDialog(true);
    setLoadingAthletes(true);

    try {
      let attendance = [];

      // Check if session has an ID (existing session) or needs to be created
      if (session.id && session.id !== session.dateString) {
        // Existing session - get attendance records
        attendance = await clubService.getSessionAttendance(session.id);
      } else {
        // Check if a session already exists for this training day
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

            // Update current session with the real ID
            setCurrentTrainingSession(prev => ({ ...prev, id: sessionId }));

            // Load existing attendance records
            attendance = await clubService.getSessionAttendance(sessionId);
          } else {
            // No existing session found - will create new one when attendance is marked
          }
        } catch (error) {
          console.error('Error checking for existing session:', error);
        }
      }

      setSessionAttendance(attendance);

      // Load club athletes for attendance management
      const clubIdToUse = getEffectiveClubId();

      if (clubIdToUse) {
        try {
          const allMembers = await clubService.getClubMembersWithDetails(clubIdToUse);

          const athletesOnly = allMembers.filter(member => member.role === 'athlete');

          // Use the athletes list
          setAttendanceAthletes(athletesOnly);
        } catch (clubError) {
          console.error('Error loading athletes for club:', clubIdToUse, clubError);
          setAttendanceAthletes([]);
        }
      } else {
        // No club ID available for loading athletes
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
    if (!currentTrainingSession || sessionAttendance.length === 0) {
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

        toast({
          title: "Training session created",
          description: "Session created for attendance marking",
        });
      }

      // Mark attendance for all athletes

      await clubService.bulkMarkAttendance(
        sessionId,
        sessionAttendance.map(attendance => ({
          athleteId: attendance.athleteId,
          status: attendance.status,
          notes: attendance.notes || ''
        })),
        user.uid
      );


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





  // Show loading screen while auth is loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading...</p>
          <p className="text-sm text-muted-foreground mt-2">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return null; // AuthContext will handle the redirect
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Page Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold">{getDashboardTitle()}</h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                {getDashboardSubtitle()}
              </p>
            </div>

            {/* Dashboard View Selector - Only show if user has multiple roles or multiple clubs */}
            {(availableRoles.length > 1 || (dashboardRole !== 'super' && availableClubs.length > 1)) && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <span className="text-sm text-muted-foreground self-start sm:self-center">View as:</span>

                <div className="flex flex-col sm:flex-row gap-2">
                  {/* Role Selector - Only show if user has multiple roles */}
                  {availableRoles.length > 1 && (
                    <Select value={dashboardRole} onValueChange={handleRoleChange}>
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoles.map((role) => (
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
                  {dashboardRole !== 'super' && availableClubs.length > 1 && (
                    <Select
                      value={selectedDashboardClubId || dashboardClubId}
                      onValueChange={handleClubChange}
                    >
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableClubs.map((club) => (
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
        {/* Show loading state during initial load */}
        {(memberships || []).length === 0 && dashboardRole !== 'super' && !initialLoadComplete && (
          <div className="mb-6 p-6 border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                <div className="animate-spin w-6 h-6 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full"></div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Setting up your account...</h3>
                <p className="text-blue-700 dark:text-blue-300">Checking for club invitations</p>
              </div>
            </div>
            <div className="text-sm text-blue-800 dark:text-blue-200">
              We're processing your club invitations. This should only take a moment.
            </div>
          </div>
        )}

        {/* Show "not in any club" message only after initial load is complete */}
        {(memberships || []).length === 0 && dashboardRole !== 'super' && initialLoadComplete && (
          <div className="mb-6 p-6 border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Welcome to PeakLog!</h3>
                <p className="text-blue-700 dark:text-blue-300">You're not part of any club yet</p>
              </div>
            </div>
            <div className="text-sm text-blue-800 dark:text-blue-200 mb-4">
              A club administrator needs to invite you to join their team. Once invited, you'll be able to access all training features and team management tools.
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
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

            {/* Club Message Display */}
            {clubMessage && (
              <Card className={`mb-6 border-2 ${
                clubMessage.type === 'important' || clubMessage.priority === 'urgent'
                  ? 'border-red-300 dark:border-red-700 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 shadow-lg'
                  : clubMessage.priority === 'high'
                  ? 'border-orange-300 dark:border-orange-700 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900'
                  : clubMessage.type === 'reminder'
                  ? 'border-yellow-300 dark:border-yellow-700 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900'
                  : 'border-blue-300 dark:border-blue-700 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900'
              }`}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-base sm:text-lg">
                    <div className="flex items-center gap-2">
                      <div className="text-lg sm:text-xl">
                        {clubMessage.type === 'general' ? '📢' :
                         clubMessage.type === 'reminder' ? '⏰' :
                         clubMessage.type === 'equipment' ? '🎒' :
                         clubMessage.type === 'schedule' ? '📅' :
                         clubMessage.type === 'important' ? '❗' :
                         clubMessage.type === 'motivation' ? '💪' : '📢'}
                      </div>
                      <span>Coach Message</span>
                    </div>
                    <Badge className={`text-xs ${
                      clubMessage.priority === 'urgent' ? 'bg-red-500 dark:bg-red-600 text-white' :
                      clubMessage.priority === 'high' ? 'bg-orange-500 dark:bg-orange-600 text-white' :
                      clubMessage.priority === 'normal' ? 'bg-blue-500 dark:bg-blue-600 text-white' :
                      'bg-gray-500 dark:bg-gray-600 text-white'
                    }`}>
                      {clubMessage.priority === 'urgent' ? 'URGENT' :
                       clubMessage.priority === 'high' ? 'HIGH' :
                       clubMessage.priority === 'normal' ? 'NORMAL' : 'LOW'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <h3 className="font-semibold text-base sm:text-lg mb-3 text-primary">
                    {clubMessage.title}
                  </h3>
                  <p className="leading-relaxed mb-3">
                    {clubMessage.content}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>
                      Posted: {(() => {
                        let date = clubMessage.updatedAt || clubMessage.createdAt;
                        if (date?.toDate) date = date.toDate();
                        else if (!(date instanceof Date)) date = new Date(date);
                        return isNaN(date?.getTime()) ? 'Recently' : date.toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                      })()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Current/Next Training Day - Full Width Prominent Display */}
            <Card className={`mb-6 border-2 ${
              nextTrainingSession?.status === 'in-progress' 
                ? 'border-green-400 bg-gradient-to-r from-green-50 to-green-100' 
                : nextTrainingSession?.status === 'completed'
                ? 'border-gray-400 bg-gradient-to-r from-gray-50 to-gray-100'
                : 'border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10'
            }`}>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="text-2xl">
                    {nextTrainingSession?.status === 'in-progress' ? '🔥' :
                     nextTrainingSession?.status === 'completed' ? '✅' : '🏋️‍♂️'}
                  </div>
                  {nextTrainingSession?.daysUntil === 0 ? (
                    nextTrainingSession?.status === 'in-progress' ? 'Training In Progress' :
                    nextTrainingSession?.status === 'completed' ? 'Today\'s Training Completed' :
                    'Today\'s Training'
                  ) : 'Next Training Session'}
                </CardTitle>
                <CardDescription className="text-base">
                  {dashboardMembership?.clubName || 'Your Club'}
                  {nextTrainingSession?.status === 'in-progress' && (
                    <span className="ml-2 text-green-600 font-medium">• LIVE NOW</span>
                  )}
                  {nextTrainingSession?.status === 'completed' && (
                    <span className="ml-2 text-gray-600 font-medium">• COMPLETED</span>
                  )}
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
                          <div className="text-sm text-muted-foreground">Status</div>
                          <div className={`font-semibold text-lg ${
                            nextTrainingSession.status === 'in-progress' ? 'text-green-600' :
                            nextTrainingSession.status === 'completed' ? 'text-gray-600' :
                            'text-primary'
                          }`}>
                            {nextTrainingSession.daysUntil === 0 ? (
                              nextTrainingSession.status === 'in-progress' ? '🔥 In Progress' :
                              nextTrainingSession.status === 'completed' ? '✅ Completed' :
                              '⏰ Today'
                            ) : (
                              nextTrainingSession.daysUntil === 1 ? 'Tomorrow' : `In ${nextTrainingSession.daysUntil} days`
                            )}
                          </div>
                        </div>
                      </div>
                      {nextTrainingSession.program?.description && (
                        <p className="text-muted-foreground mb-4">
                          {nextTrainingSession.program.description}
                        </p>
                      )}

                      {/* Additional Program Details */}
                      <div className="space-y-3 mb-4">
                        {nextTrainingSession.program?.duration && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">⏱️ Duration:</span>
                            <span className="font-medium">{nextTrainingSession.program.duration}</span>
                          </div>
                        )}
                        {nextTrainingSession.program?.equipment && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">🏋️ Equipment:</span>
                            <span className="font-medium">{nextTrainingSession.program.equipment}</span>
                          </div>
                        )}
                        {nextTrainingSession.program?.objectives && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">🎯 Objectives:</span>
                            <span className="font-medium">{nextTrainingSession.program.objectives}</span>
                          </div>
                        )}
                      </div>

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
                      {upcomingTrainingDays.slice(0, 10).map((day, index) => (
                        <div
                          key={day.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 ${
                            day.isCancelled
                              ? 'bg-red-50 border-red-200 opacity-75'
                              : day.status === 'in-progress'
                              ? 'bg-green-50 border-green-200 ring-2 ring-green-400'
                              : day.status === 'completed'
                              ? 'bg-gray-50 border-gray-200 opacity-90'
                              : index === 0 && !day.isCancelled
                              ? 'bg-primary/5 dark:bg-primary/10 border-primary/20 dark:border-primary/30 hover:bg-primary/10 dark:hover:bg-primary/20 cursor-pointer hover:shadow-md'
                              : 'bg-muted/30 hover:bg-muted/50 cursor-pointer hover:shadow-md'
                          }`}
                          onClick={!day.isCancelled ? () => openProgramModal(day) : undefined}
                          role={!day.isCancelled ? "button" : undefined}
                          tabIndex={!day.isCancelled ? 0 : undefined}
                          onKeyDown={!day.isCancelled ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openProgramModal(day);
                            }
                          } : undefined}
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
                              {day.isCancelled ? (
                                <span className="text-red-500 text-sm">❌</span>
                              ) : (
                                <Target className="w-3 h-3 text-primary flex-shrink-0" />
                              )}
                              <span className={`font-medium text-sm truncate ${
                                day.isCancelled ? 'text-red-600 line-through' : ''
                              }`}>
                                {day.program?.name || 'Training Session'}
                              </span>
                            </div>
                            <div className={`text-xs mt-1 ${
                              day.isCancelled ? 'text-red-500' : 'text-muted-foreground'
                            }`}>
                              {day.isCancelled ? (
                                <div>
                                  <div className="font-medium">🚫 CANCELLED</div>
                                  {day.cancellationInfo && (
                                    <div className="mt-1">
                                      <div className="font-medium">
                                        {day.cancellationInfo.type === 'vacation' && '🏖️ Vacation'}
                                        {day.cancellationInfo.type === 'maintenance' && '🔧 Maintenance'}
                                        {day.cancellationInfo.type === 'weather' && '🌦️ Weather'}
                                        {day.cancellationInfo.type === 'other' && '📅 Other'}
                                      </div>
                                      <div className="text-xs italic">
                                        {day.cancellationInfo.reason}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <>
                                  {formatTime(day.startTime)} - {formatTime(day.endTime)}
                                  {day.program?.description && (
                                    <div className="text-xs text-muted-foreground truncate mt-1">
                                      {day.program.description}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!day.isCancelled && (
                              <Info className="w-3 h-3 text-muted-foreground hover:text-primary transition-colors" />
                            )}
                            <Badge 
                              variant={
                                day.isCancelled ? "destructive" : 
                                day.status === 'in-progress' ? "default" :
                                day.status === 'completed' ? "secondary" :
                                index === 0 && !day.isCancelled ? "default" : "secondary"
                              } 
                              className={`text-xs ${
                                day.status === 'in-progress' ? 'bg-green-600 text-white animate-pulse' :
                                day.status === 'completed' ? 'bg-gray-500 text-white' : ''
                              }`}
                            >
                              {day.isCancelled ? 'Cancelled' :
                               day.status === 'in-progress' ? '🔥 Live' :
                               day.status === 'completed' ? '✅ Done' :
                               (() => {
                                 const today = new Date();
                                 const trainingDate = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate());
                                 const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                                 const daysDiff = Math.ceil((trainingDate - todayDate) / (1000 * 60 * 60 * 24));
                                 return daysDiff === 0 ? 'Today' : daysDiff === 1 ? 'Tomorrow' : `+${daysDiff} days`;
                               })()}
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
                Quick Attendance
              </CardTitle>
              <CardDescription>
                Mark attendance for today's training session at {dashboardMembership?.clubName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {nextTrainingSession ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{nextTrainingSession.programName}</h4>
                        <p className="text-sm text-muted-foreground">
                          {nextTrainingSession.day} - {formatTime(nextTrainingSession.startTime)} to {formatTime(nextTrainingSession.endTime)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {nextTrainingSession.daysUntil === 0 ? 'Today' : `In ${nextTrainingSession.daysUntil} days`}
                        </p>

                        {/* Additional Program Details in Attendance Dialog */}
                        <div className="mt-3 space-y-2">
                          {nextTrainingSession.program?.duration && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">⏱️ Duration:</span>
                              <span className="font-medium">{nextTrainingSession.program.duration}</span>
                            </div>
                          )}
                          {nextTrainingSession.program?.equipment && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">🏋️ Equipment:</span>
                              <span className="font-medium">{nextTrainingSession.program.equipment}</span>
                            </div>
                          )}
                          {nextTrainingSession.program?.objectives && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">🎯 Objectives:</span>
                              <span className="font-medium">{nextTrainingSession.program.objectives}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => openAttendanceDialog(nextTrainingSession)}
                    className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
                    disabled={nextTrainingSession.daysUntil !== 0}
                  >
                    {nextTrainingSession.daysUntil === 0 ? 'Mark Attendance' : 'Not Today'}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📊</div>
                  {hasWeeklySchedule === null ? (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Loading Schedule...</h3>
                      <p className="text-muted-foreground">Checking your training schedule</p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-lg font-semibold mb-2">
                        {hasWeeklySchedule
                          ? (upcomingTrainingDays.length > 0 ? "No Training Today" : "Rest Day")
                          : "No Upcoming Sessions"
                        }
                      </h3>
                      <p className="text-muted-foreground">
                        {hasWeeklySchedule
                          ? (upcomingTrainingDays.length > 0
                              ? "Your weekly schedule is set up, but today has no training sessions. Check upcoming days below."
                              : "Your weekly schedule is set up, but there are no upcoming training sessions scheduled."
                            )
                          : "Set up your weekly schedule to manage attendance"
                        }
                      </p>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Training Calendar - for managing schedule and past attendance */}
          <TrainingCalendar 
            clubId={dashboardClubId}
            clubName={dashboardMembership?.clubName}
          />

          {/* Vacation Manager - for scheduling cancellations */}
          <VacationManager 
            clubId={dashboardClubId}
            clubName={dashboardMembership?.clubName}
          />

          {/* Admin Message Manager - for posting messages to athletes */}
          <AdminMessageManager 
            clubId={dashboardClubId}
          />
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
                <div className="p-4 bg-primary/5 dark:bg-primary/10 rounded-lg border">
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
                    <div className="text-sm text-muted-foreground leading-relaxed bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded p-3">
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
          <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
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
                <div className="p-3 sm:p-4 bg-primary/5 dark:bg-primary/10 rounded-lg border">
                  <h4 className="font-semibold mb-2 truncate">{currentTrainingSession.programName}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-sm">
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