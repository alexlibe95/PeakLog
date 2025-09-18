import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
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
  Plus, 
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
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
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
    if (!selectedSession || sessionAttendance.length === 0) {
      toast({
        title: "No attendance to update",
        description: "No attendance records have been marked.",
        variant: "destructive",
      });
      return;
    }

    try {
      let sessionId = selectedSession.id;

      // If session doesn't exist yet (past session with no attendance marked), create it first
      if (!sessionId) {
        const sessionData = {
          clubId: clubId,
          programId: selectedSession.programId || 'general-training',
          title: selectedSession.programName,
          description: `${selectedSession.day} training session`,
          date: new Date(selectedSession.dateString || selectedSession.date),
          startTime: selectedSession.startTime,
          endTime: selectedSession.endTime,
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

      // Mark attendance for all athletes
      await clubService.bulkMarkAttendance(
        sessionId,
        sessionAttendance.map(attendance => ({
          athleteId: attendance.athleteId,
          status: attendance.status,
          notes: ''
        })),
        user.uid
      );

      toast({
        title: "Attendance Updated",
        description: `Updated attendance for ${sessionAttendance.length} athlete(s)`,
      });

      setShowAttendanceDialog(false);
      setSelectedSession(null);
      setSelectedDate(null);
      setSessionAttendance([]);
      loadCalendarData();
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <span className="text-base sm:text-lg">Training Calendar</span>
            </CardTitle>
            <CardDescription className="text-sm">
              Manage training schedule, cancellations, and attendance for {clubName}
            </CardDescription>
          </div>
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth(-1)}
              className="flex-shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium text-sm sm:text-base min-w-0 sm:min-w-[120px] text-center px-2 truncate">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth(1)}
              className="flex-shrink-0"
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
                week.map((day, dayIdx) => (
                  <div
                    key={`${weekIdx}-${dayIdx}`}
                    className={`
                      relative p-1 sm:p-2 min-h-[60px] sm:min-h-[80px] border rounded cursor-pointer hover:bg-gray-50
                      ${day.isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'}
                      ${day.isToday ? 'ring-1 sm:ring-2 ring-blue-500' : ''}
                      text-xs sm:text-sm
                    `}
                  >
                    <div className="text-xs sm:text-sm font-medium mb-1">{day.date.getDate()}</div>
                    
                    {day.dayData && (
                      <div className="space-y-1 mt-1">
                        {day.dayData.isScheduled && (
                          <div className="text-xs">
                            {day.dayData.isCancelled ? (
                              <div className="space-y-1">
                                <Badge
                                  variant="destructive"
                                  className="text-xs px-1 py-0.5 block w-full text-xs"
                                >
                                  <Ban className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />
                                  <span className="hidden sm:inline">Cancelled</span>
                                  <span className="sm:hidden">X</span>
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 sm:h-6 w-full text-xs p-0.5 sm:p-1"
                                  onClick={() => handleRemoveCancellation(day.dayData.cancellationInfo?.id)}
                                >
                                  <X className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />
                                  <span className="hidden sm:inline">Remove</span>
                                  <span className="sm:hidden">-</span>
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <Badge
                                  variant={day.date <= new Date() ? "secondary" : "default"}
                                  className={`text-xs px-1 py-0.5 block w-full text-xs ${
                                    day.date <= new Date() ? "bg-green-100 text-green-800 border-green-200" : ""
                                  }`}
                                >
                                  <Clock className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />
                                  <span className="hidden sm:inline">{day.dayData.scheduleInfo?.startTime}</span>
                                  <span className="sm:hidden">{day.dayData.scheduleInfo?.startTime?.split(':')[0]}h</span>
                                  {day.date <= new Date() && (
                                    <span className="ml-1 text-xs opacity-75">(Past)</span>
                                  )}
                                </Badge>
                                {day.date <= new Date() && isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 sm:h-6 w-full text-xs p-0.5 sm:p-1 bg-blue-50 hover:bg-blue-100"
                                    title={`Edit attendance for ${formatDate(day.date)} (Past Session)`}
                                    onClick={async () => {
                                      setSelectedDate(day.date);
                                      setLoadingAthletes(true);

                                      try {
                                        let sessionToUse = day.dayData.session;

                                        // If no session exists for this date, check if one exists in Firestore
                                        if (!sessionToUse) {
                                          const sessionsQuery = query(
                                            collection(db, 'trainingSessions'),
                                            where('clubId', '==', clubId),
                                            where('date', '==', day.date)
                                          );
                                          const sessionsSnap = await getDocs(sessionsQuery);

                                          if (!sessionsSnap.empty) {
                                            // Found existing session
                                            sessionToUse = {
                                              ...sessionsSnap.docs[0].data(),
                                              id: sessionsSnap.docs[0].id
                                            };
                                          } else {
                                            // No existing session - create a temporary session object
                                            sessionToUse = {
                                              id: null, // Will be created when attendance is saved
                                              programName: day.dayData.scheduleInfo?.programName || 'Training Session',
                                              programId: day.dayData.scheduleInfo?.programId || 'general-training',
                                              day: day.dayData.dayOfWeek,
                                              startTime: day.dayData.scheduleInfo?.startTime,
                                              endTime: day.dayData.scheduleInfo?.endTime,
                                              date: day.date,
                                              dateString: day.date.toISOString().split('T')[0]
                                            };
                                          }
                                        }

                                        setSelectedSession(sessionToUse);
                                        await loadSessionAttendance(sessionToUse.id);
                                        setShowAttendanceDialog(true);
                                      } catch (error) {
                                        console.error('Error setting up attendance dialog:', error);
                                        toast({
                                          title: 'Error',
                                          description: 'Failed to load attendance data',
                                          variant: 'destructive'
                                        });
                                      } finally {
                                        setLoadingAthletes(false);
                                      }
                                    }}
                                  >
                                    <Users className="h-2 w-2 sm:h-3 sm:w-3 mr-1 text-blue-600" />
                                    <span className="hidden sm:inline">Edit Attendance</span>
                                    <span className="sm:hidden">Edit Att.</span>
                                  </Button>
                                )}
                                {day.date > new Date() && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 sm:h-6 w-full text-xs p-0.5 sm:p-1"
                                    onClick={() => {
                                      setSelectedDate(day.date);
                                      setShowCancellationDialog(true);
                                    }}
                                  >
                                    <AlertTriangle className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />
                                    <span className="hidden sm:inline">Cancel</span>
                                    <span className="sm:hidden">X</span>
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 pt-4 border-t">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>Scheduled Training</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>Cancelled</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-blue-500 rounded"></div>
                <span>Today</span>
              </div>
            </div>
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
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              Edit Attendance
            </DialogTitle>
            <DialogDescription>
              {selectedSession && (
                <span className="truncate">
                  {selectedSession.programName || 'Training Session'} - {selectedDate && formatDate(selectedDate)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedSession && (
            <div className="space-y-4">
              {/* Session Info */}
              <div className="p-3 sm:p-4 bg-primary/5 rounded-lg border">
                <h4 className="font-semibold mb-2 truncate">{selectedSession.programName || 'Training Session'}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Date:</span>
                    <div className="font-medium">
                      {selectedDate ? formatDate(selectedDate) : 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Time:</span>
                    <div className="font-medium">
                      {selectedSession.startTime || 'Not specified'}
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
                        <div key={record.athleteId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-3">
                          <div className="flex items-center space-x-3 min-w-0 flex-1">
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-medium">
                                {(record.athleteName || 'A')[0].toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">
                                {record.athleteName || 'Unknown Athlete'}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                {record.email || ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
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
              <Button variant="outline" onClick={() => setShowAttendanceDialog(false)} className="w-full sm:w-auto">
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
    </Card>
  );
};

export default TrainingCalendar;
