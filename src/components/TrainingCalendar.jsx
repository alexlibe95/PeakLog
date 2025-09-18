import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { clubService } from '@/services/clubService';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/toast-context';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Users, 
  Clock,
  AlertTriangle,
  Ban
} from 'lucide-react';

const TrainingCalendar = ({ clubId, clubName }) => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCancellationDialog, setShowCancellationDialog] = useState(false);
  const [showRemovalDialog, setShowRemovalDialog] = useState(false);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedDayForActions, setSelectedDayForActions] = useState(null);
  const [currentTrainingSession, setCurrentTrainingSession] = useState(null);
  const [cancellationForm, setCancellationForm] = useState({
    reason: '',
    type: 'vacation'
  });
  const [clubMembers, setClubMembers] = useState([]);
  const [sessionAttendance, setSessionAttendance] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState({ present: 0, total: 0 });
  const [loadingAthletes, setLoadingAthletes] = useState(false);

  useEffect(() => {
    if (clubId) {
      loadCalendarData();
      loadClubMembers();
    }
  }, [clubId, currentDate]);

  const loadCalendarData = async () => {
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const data = await clubService.getMonthlyTrainingCalendar(clubId, year, month);
      setCalendarData(data);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      toast({
        title: 'Error loading calendar',
        description: 'Failed to load training calendar data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadClubMembers = async () => {
    try {
      const members = await clubService.getClubMembersWithDetails(clubId);
      setClubMembers(members.filter(member => member.role === 'athlete'));
    } catch (error) {
      console.error('Error loading club members:', error);
    }
  };

  const loadSessionAttendance = async (sessionId) => {
    try {
      let attendance = [];

      // If sessionId exists, get existing attendance records
      if (sessionId) {
        attendance = await clubService.getSessionAttendance(sessionId);
      }

      // Load club members to ensure we have all athletes for attendance marking
      if (clubMembers.length === 0) {
        await loadClubMembers();
      }

      // Create attendance records for all club members, merging with existing attendance
      const attendanceMap = {};
      attendance.forEach(record => {
        attendanceMap[record.athleteId] = record;
      });

      const sessionAttendanceData = clubMembers.map(member => ({
        athleteId: member.id,
        athleteName: `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email,
        status: attendanceMap[member.id]?.status || '',
        email: member.email
      }));

      setSessionAttendance(sessionAttendanceData);

      // Calculate attendance summary
      const presentCount = sessionAttendanceData.filter(record => record.status === 'present').length;
      setAttendanceSummary({
        present: presentCount,
        total: sessionAttendanceData.length
      });
    } catch (error) {
      console.error('Error loading session attendance:', error);
      toast({
        title: 'Error loading attendance',
        description: 'Failed to load attendance data',
        variant: 'destructive'
      });
    }
  };

  const handleAddCancellation = async () => {
    if (!selectedDate || !cancellationForm.reason.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please provide a reason for the cancellation',
        variant: 'destructive'
      });
      return;
    }

    try {
      await clubService.addTrainingCancellation(
        clubId,
        {
          date: selectedDate,
          reason: cancellationForm.reason.trim(),
          type: cancellationForm.type
        },
        user.uid
      );

      toast({
        title: 'Training cancelled',
        description: 'Training session has been cancelled successfully'
      });

      setCancellationForm({ reason: '', type: 'vacation' });
      setShowCancellationDialog(false);
      setSelectedDate(null);
      loadCalendarData();
    } catch (error) {
      console.error('Error adding cancellation:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel training session',
        variant: 'destructive'
      });
    }
  };

  const handleRemoveCancellation = async (cancellationId) => {
    try {
      await clubService.removeTrainingCancellation(clubId, cancellationId, user.uid);
      toast({
        title: 'Cancellation removed',
        description: 'Training session is now active again'
      });
      loadCalendarData();
    } catch (error) {
      console.error('Error removing cancellation:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove cancellation',
        variant: 'destructive'
      });
    }
  };

  const handleAttendanceUpdate = async () => {
    if (!currentTrainingSession || sessionAttendance.length === 0) {
      toast({
        title: "No attendance to update",
        description: "No attendance records have been marked.",
        variant: "destructive",
      });
      return;
    }

    try {
      let sessionId = currentTrainingSession.id;

      // If session doesn't exist yet (past session with no attendance marked), create it first
      if (!sessionId) {
        const sessionData = {
          clubId: clubId,
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
      
      toast({
          title: "Training session created",
          description: "Session created for attendance marking",
        });
      }

      // Filter out orphaned records and only update attendance for current club members
      const validAttendance = sessionAttendance.filter(record => !record.isRemoved);

      if (validAttendance.length === 0) {
        toast({
          title: "No valid attendance to update",
          description: "All athletes have been removed from the club.",
          variant: "destructive",
        });
        return;
      }

      // Mark attendance for valid athletes only
      await clubService.bulkMarkAttendance(
        sessionId,
        validAttendance.map(attendance => ({
          athleteId: attendance.athleteId,
          status: attendance.status,
          notes: ''
        })),
        user.uid
      );

      const removedCount = sessionAttendance.length - validAttendance.length;
      const message = removedCount > 0
        ? `Updated attendance for ${validAttendance.length} athlete(s). ${removedCount} orphaned record(s) were removed.`
        : `Updated attendance for ${validAttendance.length} athlete(s)`;
      
      toast({
        title: "Attendance Updated",
        description: message,
      });

      // If we have valid attendance records, mark this day as completed in calendar
      if (validAttendance.length > 0) {
        // Update the calendar data to reflect this session now has valid attendance
        setCalendarData(prevData =>
          prevData.map(day => {
            const dayDate = day.date.toDate ? day.date.toDate() : day.date;
            const sessionDate = currentTrainingSession.date instanceof Date ? currentTrainingSession.date : new Date(currentTrainingSession.date);

            if (dayDate.toDateString() === sessionDate.toDateString()) {
              return {
                ...day,
                session: {
                  ...day.session,
                  hasValidAttendance: true,
                  attendanceCount: validAttendance.length
                }
              };
            }
            return day;
          })
        );
      }

      setShowAttendanceDialog(false);
      setCurrentTrainingSession(null);
      setSessionAttendance([]);
    } catch (error) {
      console.error('Error updating attendance:', error);
      toast({
        title: "Error",
        description: "Failed to update attendance. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateAttendanceStatus = (athleteId, status) => {
    setSessionAttendance(prev => {
      const newAttendance = [...prev];
      const existingIndex = newAttendance.findIndex(a => a.athleteId === athleteId);

      if (existingIndex >= 0) {
        newAttendance[existingIndex] = {
          ...newAttendance[existingIndex],
          status,
          markedAt: new Date()
        };
      } else {
        newAttendance.push({
          athleteId: athleteId,
          status,
          markedAt: new Date(),
          markedBy: user.uid
        });
      }
      return newAttendance;
    });
  };

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      // Create a completely new date object to avoid any mutation issues
      const newDate = new Date(prev.getFullYear(), prev.getMonth() + direction, 1);
      return newDate;
    });
  };

  const cleanupOrphanedRecords = async () => {
    try {
      // Get all past sessions
      const sessionsQuery = query(
        collection(db, 'trainingSessions'),
        where('clubId', '==', clubId),
        where('date', '<', new Date())
      );
      const sessionsSnap = await getDocs(sessionsQuery);

      let totalCleaned = 0;
      const sessionsToDelete = [];

      for (const sessionDoc of sessionsSnap.docs) {
        const sessionData = sessionDoc.data();
        const sessionId = sessionDoc.id;

        // Get attendance records for this session
        const attendanceSnap = await getDocs(collection(db, 'trainingSessions', sessionId, 'attendance'));

        if (attendanceSnap.empty) {
          // Session has no attendance records - can be deleted
          sessionsToDelete.push(sessionId);
        } else {
          // Check if all attendance records are orphaned
          const attendanceRecords = attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // Load current club members to check against
          if (clubMembers.length === 0) {
            await loadClubMembers();
          }

          const currentMemberIds = new Set(clubMembers.map(member => member.id));
          const validRecords = attendanceRecords.filter(record => currentMemberIds.has(record.athleteId));
          const orphanedRecords = attendanceRecords.filter(record => !currentMemberIds.has(record.athleteId));

          if (validRecords.length === 0 && orphanedRecords.length > 0) {
            // Session only has orphaned records - delete the session and all its records
            sessionsToDelete.push(sessionId);
            totalCleaned += orphanedRecords.length;
          }
        }
      }

      // Delete the sessions
      const deletePromises = sessionsToDelete.map(sessionId =>
        deleteDoc(doc(db, 'trainingSessions', sessionId))
      );

      await Promise.all(deletePromises);

      toast({
        title: "Cleanup Complete",
        description: `Removed ${sessionsToDelete.length} past sessions with only orphaned records`,
      });

      // Refresh calendar data
      loadCalendarData();

    } catch (error) {
      console.error('Error cleaning up orphaned records:', error);
      toast({
        title: "Error",
        description: "Failed to cleanup orphaned records",
        variant: "destructive",
      });
    }
  };

  const handleAttendanceDialog = async (day) => {
    setCurrentTrainingSession(day.dayData.session || {
      id: null,
      programName: day.dayData.scheduleInfo?.programName || 'Training Session',
      programId: day.dayData.scheduleInfo?.programId || 'general-training',
      day: day.dayData.dayOfWeek,
      startTime: day.dayData.scheduleInfo?.startTime,
      endTime: day.dayData.scheduleInfo?.endTime,
      date: day.date,
      dateString: day.date.toISOString().split('T')[0]
    });
    setShowAttendanceDialog(true);
    setLoadingAthletes(true);

    try {
      // Load session attendance
      if (day.dayData.session) {
        const attendance = await clubService.getSessionAttendance(day.dayData.session.id);

        // Load current club members to cross-reference
        if (clubMembers.length === 0) {
          await loadClubMembers();
        }

        // Create a map of current members for quick lookup
        const currentMembersMap = new Map();
        clubMembers.forEach(member => {
          currentMembersMap.set(member.id, member);
        });

        // Process attendance records
        const processedAttendance = attendance.map(record => {
          const member = currentMembersMap.get(record.athleteId);

          if (member) {
            // Athlete is still in the club - use current member data
            return {
              ...record,
              athleteName: `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email,
              email: member.email,
              isRemoved: false
            };
          } else {
            // Athlete is no longer in the club - mark as removed
            return {
              ...record,
              athleteName: 'Unknown Athlete (Removed)',
              email: 'N/A',
              isRemoved: true
            };
          }
        });

        // Add any current club members who don't have attendance records yet
        clubMembers.forEach(member => {
          const existingRecord = processedAttendance.find(record => record.athleteId === member.id);
          if (!existingRecord) {
            processedAttendance.push({
              athleteId: member.id,
              athleteName: `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email,
              status: '',
              email: member.email,
              isRemoved: false
            });
          }
        });

        // Update calendar data to reflect whether this session has valid attendance
        const validRecordsCount = processedAttendance.filter(record => !record.isRemoved).length;
        const hasValidAttendance = validRecordsCount > 0;

        setCalendarData(prevData =>
          prevData.map(day => {
            const dayDate = day.date.toDate ? day.date.toDate() : day.date;
            const sessionDate = day.dayData?.session ? (day.dayData.session.date.toDate ? day.dayData.session.date.toDate() : new Date(day.dayData.session.date)) : null;

            if (sessionDate && dayDate.toDateString() === sessionDate.toDateString()) {
              return {
                ...day,
                session: {
                  ...day.session,
                  hasValidAttendance,
                  attendanceCount: validRecordsCount,
                  totalRecords: processedAttendance.length
                }
              };
            }
            return day;
          })
        );

        setSessionAttendance(processedAttendance);
      } else {
        // Load all club members for new session
        if (clubMembers.length === 0) {
          await loadClubMembers();
        }
        const sessionAttendanceData = clubMembers.map(member => ({
          athleteId: member.id,
          athleteName: `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email,
          status: '',
          email: member.email,
          isRemoved: false
        }));

        // For new sessions, mark as having no valid attendance yet
        setCalendarData(prevData =>
          prevData.map(day => {
            const dayDate = day.date.toDate ? day.date.toDate() : day.date;
            const sessionDate = day.dayData?.session ? (day.dayData.session.date.toDate ? day.dayData.session.date.toDate() : new Date(day.dayData.session.date)) : null;

            if (sessionDate && dayDate.toDateString() === sessionDate.toDateString()) {
              return {
                ...day,
                session: {
                  ...day.session,
                  hasValidAttendance: false,
                  attendanceCount: 0,
                  totalRecords: sessionAttendanceData.length
                }
              };
            }
            return day;
          })
        );

        setSessionAttendance(sessionAttendanceData);
      }
    } catch (error) {
      console.error('Error loading attendance data:', error);
      setSessionAttendance([]);
    } finally {
      setLoadingAthletes(false);
    }
  };

  const formatDate = (date) => {
    let d;
    
    if (!date) {
      return 'Invalid Date';
    }
    
    // Handle Firestore Timestamp
    if (date.toDate && typeof date.toDate === 'function') {
      d = date.toDate();
    } 
    // Handle regular Date object
    else if (date instanceof Date) {
      d = date;
    } 
    // Handle date strings/numbers
    else {
      d = new Date(date);
    }
    
    // Check if the date is valid
    if (isNaN(d.getTime())) {
      console.warn('Invalid date provided to formatDate:', date);
      return 'Invalid Date';
    }
    
    return d.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';

    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${minutes}${ampm}`;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      present: { variant: 'default', icon: '✅', label: 'Present' },
      absent: { variant: 'destructive', icon: '❌', label: 'Absent' },
      late: { variant: 'secondary', icon: '⏰', label: 'Late' },
      excused: { variant: 'outline', icon: '⚠️', label: 'Excused' }
    };
    
    const config = statusConfig[status] || statusConfig.absent;
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.icon} {config.label}
      </Badge>
    );
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Build calendar grid
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());
  
  const calendarGrid = [];
  const currentCalendarDate = new Date(startDate);
  
  for (let week = 0; week < 6; week++) {
    const weekDays = [];
    for (let day = 0; day < 7; day++) {
      const dayData = calendarData.find(d => 
        d.date.toDateString() === currentCalendarDate.toDateString()
      );
      
      weekDays.push({
        date: new Date(currentCalendarDate),
        dayData,
        isCurrentMonth: currentCalendarDate.getMonth() === currentDate.getMonth(),
        isToday: currentCalendarDate.toDateString() === new Date().toDateString()
      });
      
      currentCalendarDate.setDate(currentCalendarDate.getDate() + 1);
    }
    calendarGrid.push(weekDays);
    
    if (currentCalendarDate > lastDayOfMonth && week >= 4) break;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-lg">
              <Calendar className="h-5 w-5" />
              <span>Training Calendar</span>
            </CardTitle>
            <CardDescription className="text-sm">
              Manage training schedule, cancellations, and attendance for {clubName}
            </CardDescription>
          </div>
          <div className="flex items-center justify-center gap-2 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth(-1)}
              className="flex-shrink-0 h-9 w-9 sm:h-8 sm:w-auto px-2 sm:px-3 touch-manipulation"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium text-sm sm:text-base min-w-0 text-center px-2 truncate flex-1">
              <span className="hidden sm:inline">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
              <span className="sm:hidden">{monthNames[currentDate.getMonth()].substring(0, 3)} {currentDate.getFullYear()}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth(1)}
              className="flex-shrink-0 h-9 w-9 sm:h-8 sm:w-auto px-2 sm:px-3 touch-manipulation"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Loading calendar...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1 overflow-x-auto">
              {/* Header */}
              {weekDays.map(day => (
                <div key={day} className="p-1 sm:p-2 text-center font-medium text-xs sm:text-sm text-gray-500">
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day.substring(0, 1)}</span>
                </div>
              ))}

              {/* Calendar Days */}
              {calendarGrid.map((week, weekIdx) =>
                week.map((day, dayIdx) => {
                  // Determine color coding based on training status
                  let dayColorClass = 'bg-white';
                  let textColorClass = 'text-gray-900';

                  if (day.dayData?.isScheduled) {
                    if (day.dayData.isCancelled) {
                      dayColorClass = 'bg-red-100';
                      textColorClass = 'text-red-800';
                    } else if (day.date <= new Date()) {
                      // Past training day
                      dayColorClass = 'bg-blue-100';
                      textColorClass = 'text-blue-800';
                    } else {
                      // Future training day
                      dayColorClass = 'bg-blue-50';
                      textColorClass = 'text-blue-700';
                    }
                  } else if (!day.isCurrentMonth) {
                    dayColorClass = 'bg-gray-50';
                    textColorClass = 'text-gray-400';
                  }

                  return (
                  <div
                    key={`${weekIdx}-${dayIdx}`}
                      className={`relative p-1 sm:p-2 min-h-[60px] sm:min-h-[80px] border rounded cursor-pointer hover:opacity-80 transition-opacity ${dayColorClass} ${textColorClass} ${day.isToday ? 'ring-2 ring-blue-500' : ''}`}
                                    onClick={() => {
                        if (day.dayData?.isScheduled) {
                          if (day.dayData.isCancelled) {
                            // Show removal dialog for cancelled sessions
                            setSelectedDayForActions(day);
                            setShowRemovalDialog(true);
                          } else if (day.date <= new Date() && isAdmin) {
                            // Show attendance dialog for past sessions (admins only)
                            handleAttendanceDialog(day);
                          } else if (day.date > new Date()) {
                            // Show cancellation dialog for future sessions
                                      setSelectedDate(day.date);
                                      setShowCancellationDialog(true);
                          }
                        }
                      }}
                    >
                      <div className="text-center space-y-1">
                        <div className="text-sm font-medium">{day.date.getDate()}</div>

                        {day.dayData?.isScheduled && !day.dayData.isCancelled && (
                          <>
                            <div className="text-xs text-gray-600">
                              {formatTime(day.dayData.scheduleInfo?.startTime)}
                              </div>
                            <div className="text-xs text-gray-600">
                              {formatTime(day.dayData.scheduleInfo?.endTime)}
                          </div>
                          </>
                        )}

                        {day.dayData?.isCancelled && (
                          <div className="text-xs text-red-500">Cancelled</div>
                        )}
                      </div>

                      {/* Click overlay for actions */}
                      {day.dayData?.isScheduled && (
                        <div className="absolute inset-0 bg-transparent rounded cursor-pointer" />
                    )}
                  </div>
                  );
                })
              )}
            </div>

            {/* Click outside to close modal and Legend */}
            <>
              {selectedDayForActions && (
                <div
                  className="fixed inset-0 z-0"
                  onClick={() => setSelectedDayForActions(null)}
                />
              )}

            </>
          </div>
        )}
      </CardContent>

      {/* Cancellation Dialog */}
      <Dialog open={showCancellationDialog} onOpenChange={setShowCancellationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Training Session</DialogTitle>
            <DialogDescription>
              Cancel training for {selectedDate && formatDate(selectedDate)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="cancellation-type">Cancellation Type</Label>
              <Select 
                value={cancellationForm.type} 
                onValueChange={(value) => setCancellationForm(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">Vacation</SelectItem>
                  <SelectItem value="maintenance">Facility Maintenance</SelectItem>
                  <SelectItem value="weather">Weather</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="cancellation-reason">Reason</Label>
              <Textarea
                id="cancellation-reason"
                placeholder="Enter the reason for cancelling this training session..."
                value={cancellationForm.reason}
                onChange={(e) => setCancellationForm(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowCancellationDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleAddCancellation}
            >
              Cancel Training
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance Dialog */}
      <Dialog open={showAttendanceDialog} onOpenChange={setShowAttendanceDialog}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              Edit Attendance
            </DialogTitle>
            <DialogDescription>
              {currentTrainingSession && (
                <span className="truncate">
                  {currentTrainingSession.programName || 'Training Session'} - {currentTrainingSession.date && formatDate(currentTrainingSession.date)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {currentTrainingSession && (
            <div className="space-y-4">
              {/* Session Info */}
              <div className="p-3 sm:p-4 bg-primary/5 rounded-lg border">
                <h4 className="font-semibold mb-2 truncate">{currentTrainingSession.programName || 'Training Session'}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Date:</span>
                    <div className="font-medium">
                      {currentTrainingSession.date ? formatDate(currentTrainingSession.date) : 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Time:</span>
                    <div className="font-medium">
                      {currentTrainingSession.startTime || 'Not specified'}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div className="font-medium text-green-600">
                      Past Session
                    </div>
                  </div>
                </div>
              </div>

              {/* Athlete Attendance List */}
              <div className="space-y-2">
                <h4 className="font-medium">Club Athletes ({sessionAttendance.length})</h4>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {loadingAthletes ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="text-4xl mb-2">⏳</div>
                      <p>Loading athletes...</p>
                    </div>
                  ) : sessionAttendance.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="text-4xl mb-2">👥</div>
                      <p>No athletes found for this session</p>
                      <p className="text-sm">Club members may not have been loaded</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sessionAttendance.map((record) => (
                        <div
                          key={record.athleteId}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-3 ${
                            record.isRemoved ? 'border-red-200 bg-red-50' : 'border-gray-200'
                          }`}
                        >
                          <div className="flex items-center space-x-3 min-w-0 flex-1">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              record.isRemoved ? 'bg-red-100 text-red-700' : 'bg-primary/10 text-primary'
                            }`}>
                              <span className="text-sm font-medium">
                                {(record.athleteName || 'A')[0].toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`font-medium truncate ${record.isRemoved ? 'text-red-700' : ''}`}>
                                {record.athleteName || 'Unknown Athlete'}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                {record.email || ''}
                              </p>
                              {record.isRemoved && (
                                <p className="text-xs text-red-600 mt-1">
                                  ⚠️ Athlete no longer in club
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {record.isRemoved ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-8 bg-red-50 hover:bg-red-100 border-red-300 text-red-700"
                                onClick={async () => {
                                  try {
                                    // Remove this orphaned attendance record from database
                                    if (currentTrainingSession?.id) {
                                      await clubService.removeAttendanceRecord(currentTrainingSession.id, record.athleteId);

                                      // Also remove from local state
                                      setSessionAttendance(prev =>
                                        prev.filter(r => r.athleteId !== record.athleteId)
                                      );

                                      toast({
                                        title: "Record removed",
                                        description: "Orphaned attendance record has been permanently deleted",
                                      });

                                      // Refresh calendar data to update day colors
                                      loadCalendarData();
                                    }
                                  } catch (error) {
                                    console.error('Error removing attendance record:', error);
                                    toast({
                                      title: "Error",
                                      description: "Failed to remove attendance record",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                🗑️ Remove
                              </Button>
                            ) : (
                              <>
                            <Select
                              value={record.status}
                              onValueChange={(status) => updateAttendanceStatus(record.athleteId, status)}
                            >
                                  <SelectTrigger className={`w-full sm:w-32 min-w-[120px] ${record.status ? 'border-green-500 bg-green-50' : ''}`}>
                                    <SelectValue placeholder="Mark attendance" />
                              </SelectTrigger>
                              <SelectContent>
                                    <SelectItem value="present">✅ Present</SelectItem>
                                    <SelectItem value="late">⏰ Late</SelectItem>
                                    <SelectItem value="absent">❌ Absent</SelectItem>
                              </SelectContent>
                            </Select>
                                {record.status && (
                                  <div className="text-xs text-green-600 font-medium whitespace-nowrap">
                                    ✓ Saved
                                  </div>
                                )}
                              </>
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
                <span>{sessionAttendance.filter(record => record.status && record.status !== '').length} athlete(s) marked</span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 order-1 sm:order-2">
              <Button variant="outline" onClick={() => {
                setShowAttendanceDialog(false);
                setCurrentTrainingSession(null);
                setSessionAttendance([]);
              }} className="w-full sm:w-auto">
                Close
              </Button>
            <Button
                onClick={handleAttendanceUpdate}
                disabled={sessionAttendance.length === 0}
                className="w-full sm:w-auto"
            >
                Update All Attendance
            </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close attendance dialog when clicking outside */}
      {showAttendanceDialog && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowAttendanceDialog(false);
            setCurrentTrainingSession(null);
            setSessionAttendance([]);
          }}
        />
      )}

      {/* Removal Dialog */}
      <Dialog open={showRemovalDialog} onOpenChange={setShowRemovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Training Cancellation</DialogTitle>
            <DialogDescription>
              Remove the cancellation for {selectedDayForActions && formatDate(selectedDayForActions.date)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <h4 className="font-medium text-red-800">Remove Cancellation</h4>
                  <p className="text-sm text-red-700">
                    This will restore the training session and make it active again.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRemovalDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedDayForActions?.dayData?.cancellationInfo?.id) {
                  handleRemoveCancellation(selectedDayForActions.dayData.cancellationInfo.id);
                  setShowRemovalDialog(false);
                  setSelectedDayForActions(null);
                }
              }}
            >
              Remove Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TrainingCalendar;
