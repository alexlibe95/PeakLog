import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  const { user } = useAuth();
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

  useEffect(() => {
    console.log('TrainingCalendar useEffect triggered:', {
      clubId,
      currentDate: currentDate.toString(),
      month: currentDate.getMonth(),
      year: currentDate.getFullYear()
    });
    
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
      const attendance = await clubService.getSessionAttendance(sessionId);
      const attendanceMap = {};
      attendance.forEach(record => {
        attendanceMap[record.athleteId] = record;
      });

      // Initialize attendance for all club members
      const sessionAttendanceData = clubMembers.map(member => ({
        athleteId: member.id,
        athleteName: `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email,
        status: attendanceMap[member.id]?.status || 'absent',
        notes: attendanceMap[member.id]?.notes || ''
      }));

      setSessionAttendance(sessionAttendanceData);
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
    if (!selectedSession) return;

    try {
      const attendanceUpdates = sessionAttendance.map(({ athleteId, status, notes }) => ({
        athleteId,
        status,
        notes
      }));

      await clubService.updateSessionAttendance(selectedSession.id, attendanceUpdates, user.uid);
      
      toast({
        title: 'Attendance updated',
        description: 'Session attendance has been updated successfully'
      });

      setShowAttendanceDialog(false);
      setSelectedSession(null);
      loadCalendarData();
    } catch (error) {
      console.error('Error updating attendance:', error);
      toast({
        title: 'Error',
        description: 'Failed to update attendance',
        variant: 'destructive'
      });
    }
  };

  const updateAttendanceStatus = (athleteId, status) => {
    setSessionAttendance(prev => 
      prev.map(record => 
        record.athleteId === athleteId 
          ? { ...record, status }
          : record
      )
    );
  };

  const updateAttendanceNotes = (athleteId, notes) => {
    setSessionAttendance(prev => 
      prev.map(record => 
        record.athleteId === athleteId 
          ? { ...record, notes }
          : record
      )
    );
  };

  const navigateMonth = (direction) => {
    console.log('navigateMonth called with direction:', direction);
    setCurrentDate(prev => {
      console.log('Previous date:', prev);
      // Create a completely new date object to avoid any mutation issues
      const newDate = new Date(prev.getFullYear(), prev.getMonth() + direction, 1);
      console.log('New date:', newDate, 'Month:', newDate.getMonth(), 'Year:', newDate.getFullYear());
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Training Calendar
            </CardTitle>
            <CardDescription>
              Manage training schedule, cancellations, and attendance for {clubName}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigateMonth(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[120px] text-center">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigateMonth(1)}
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
            <div className="grid grid-cols-7 gap-1">
              {/* Header */}
              {weekDays.map(day => (
                <div key={day} className="p-2 text-center font-medium text-sm text-gray-500">
                  {day}
                </div>
              ))}
              
              {/* Calendar Days */}
              {calendarGrid.map((week, weekIdx) => 
                week.map((day, dayIdx) => (
                  <div 
                    key={`${weekIdx}-${dayIdx}`}
                    className={`
                      relative p-2 min-h-[80px] border rounded cursor-pointer hover:bg-gray-50
                      ${day.isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'}
                      ${day.isToday ? 'ring-2 ring-blue-500' : ''}
                    `}
                  >
                    <div className="text-sm font-medium">{day.date.getDate()}</div>
                    
                    {day.dayData && (
                      <div className="space-y-1 mt-1">
                        {day.dayData.isScheduled && (
                          <div className="text-xs">
                            {day.dayData.isCancelled ? (
                              <div className="space-y-1">
                                <Badge 
                                  variant="destructive" 
                                  className="text-xs px-1 py-0 block w-full"
                                >
                                  <Ban className="h-3 w-3 mr-1" />
                                  Cancelled
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-full text-xs p-1"
                                  onClick={() => handleRemoveCancellation(day.dayData.cancellationInfo?.id)}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Remove
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <Badge 
                                  variant="default" 
                                  className="text-xs px-1 py-0 block w-full"
                                >
                                  <Clock className="h-3 w-3 mr-1" />
                                  {day.dayData.scheduleInfo?.startTime}
                                </Badge>
                                {day.date <= new Date() && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-full text-xs p-1"
                                    onClick={() => {
                                      setSelectedDate(day.date);
                                      setSelectedSession(day.dayData.session);
                                      if (day.dayData.session) {
                                        loadSessionAttendance(day.dayData.session.id);
                                        setShowAttendanceDialog(true);
                                      }
                                    }}
                                  >
                                    <Users className="h-3 w-3 mr-1" />
                                    Attendance
                                  </Button>
                                )}
                                {day.date > new Date() && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-full text-xs p-1"
                                    onClick={() => {
                                      setSelectedDate(day.date);
                                      setShowCancellationDialog(true);
                                    }}
                                  >
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Cancel
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
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Attendance</DialogTitle>
            <DialogDescription>
              Update attendance for {selectedDate && formatDate(selectedDate)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {sessionAttendance.map((record) => (
              <div key={record.athleteId} className="flex items-center gap-4 p-3 border rounded">
                <div className="flex-1">
                  <p className="font-medium">{record.athleteName}</p>
                </div>
                
                <div className="flex gap-2">
                  {['present', 'absent', 'late', 'excused'].map((status) => (
                    <Button
                      key={status}
                      variant={record.status === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateAttendanceStatus(record.athleteId, status)}
                    >
                      {getStatusBadge(status)}
                    </Button>
                  ))}
                </div>
                
                <Input
                  placeholder="Notes..."
                  value={record.notes}
                  onChange={(e) => updateAttendanceNotes(record.athleteId, e.target.value)}
                  className="w-48"
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowAttendanceDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAttendanceUpdate}>
              Update Attendance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TrainingCalendar;
