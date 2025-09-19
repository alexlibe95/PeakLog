import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import ClubSelector from '../components/ClubSelector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast-context";
import { clubService } from '../services/clubService';
import { collection, query, where, getDocs, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Plus,
  Calendar,
  Target,
  XCircle,
  Settings,
  Clock,
  Edit2,
  Trash2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TrainingManagement = () => {
  const { user, userProfile, currentClubId, getCurrentMembership } = useAuth();
  const { toast } = useToast();

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const [showWeeklySchedule, setShowWeeklySchedule] = useState(false);
  const [weeklySchedule, setWeeklySchedule] = useState({
    monday: { enabled: false, startTime: '09:00', endTime: '10:30', programId: 'none' },
    tuesday: { enabled: false, startTime: '09:00', endTime: '10:30', programId: 'none' },
    wednesday: { enabled: false, startTime: '09:00', endTime: '10:30', programId: 'none' },
    thursday: { enabled: false, startTime: '09:00', endTime: '10:30', programId: 'none' },
    friday: { enabled: false, startTime: '09:00', endTime: '10:30', programId: 'none' },
    saturday: { enabled: false, startTime: '09:00', endTime: '10:30', programId: 'none' },
    sunday: { enabled: false, startTime: '09:00', endTime: '10:30', programId: 'none' }
  });
  const [upcomingDays, setUpcomingDays] = useState([]);

  // Form states
  const [programForm, setProgramForm] = useState({
    name: '',
    description: '',
    objectives: '',
    difficulty: 'beginner',
    duration: '',
    equipment: '',
    preparationTips: '',
    targetSkills: '',
    specialInstructions: '',
    schedule: []
  });

  // Edit state
  const [editingProgram, setEditingProgram] = useState(null);
  const [showEditProgram, setShowEditProgram] = useState(false);

  const currentMembership = getCurrentMembership();
  const currentClubName = currentMembership?.clubName || 'your club';

  const daysOfWeek = [
    { key: 'monday', label: 'Monday', short: 'Mon' },
    { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
    { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
    { key: 'thursday', label: 'Thursday', short: 'Thu' },
    { key: 'friday', label: 'Friday', short: 'Fri' },
    { key: 'saturday', label: 'Saturday', short: 'Sat' },
    { key: 'sunday', label: 'Sunday', short: 'Sun' }
  ];

  const generateUpcomingDays = useCallback(async () => {
    // Don't generate if no club is selected
    if (!currentClubId) {
      return;
    }

    const days = [];
    const today = new Date();

    // Get enabled days from weekly schedule
    const enabledDays = Object.entries(weeklySchedule || {})
      .filter(([, dayData]) => dayData && dayData.enabled)
      .map(([dayKey, dayData]) => ({
        dayKey,
        ...dayData,
        dayIndex: getDayIndex(dayKey)
      }));

    // If no days are enabled, show next 4 days as default
    if (enabledDays.length === 0) {
      for (let i = 0; i < 4; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);

        const defaultDay = {
          id: date.toISOString().split('T')[0],
          date: date,
          dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
          dateString: `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`,
          programs: [],
          isDefault: true // Mark as default when no schedule is set
        };
        days.push(defaultDay);
      }
    } else {
      // Generate next occurrences of enabled days
      let daysFound = 0;
      let currentDate = new Date(today);

      while (daysFound < 4) {
        const currentDayIndex = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

        // Check if current day matches any enabled day
        const matchingDay = enabledDays.find(day => day.dayIndex === currentDayIndex);

        if (matchingDay) {
          const defaultProgramId = matchingDay.programId !== 'none' ? matchingDay.programId : null;
          const defaultPrograms = [];

          // Auto-assign default program if set
          if (defaultProgramId) {
            const defaultProgram = programs.find(p => p.id === defaultProgramId);
            if (defaultProgram) {
              defaultPrograms.push({
                ...defaultProgram,
                assignedAt: new Date(),
                isDefault: true
              });
            }
          }

          const newDay = {
            id: currentDate.toISOString().split('T')[0],
            date: new Date(currentDate),
            dayName: currentDate.toLocaleDateString('en-US', { weekday: 'long' }),
            dateString: `${currentDate.getDate().toString().padStart(2, '0')}/${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`,
            programs: defaultPrograms,
            defaultProgramId: defaultProgramId
          };
          days.push(newDay);
          daysFound++;
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // Now load existing training sessions for these days
    try {
      const sessionsQuery = query(
        collection(db, 'trainingSessions'),
        where('clubId', '==', currentClubId)
      );

      const sessionsSnap = await getDocs(sessionsQuery);
      const existingSessions = sessionsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.() || doc.data().date
      }));

      // Update days with existing sessions
      const updatedDays = days.map(day => {
        const daySessions = existingSessions.filter(session => {
          const sessionDate = session.date;
          const dayDate = new Date(day.date);
          return sessionDate && dayDate &&
                 sessionDate.toDateString() === dayDate.toDateString();
        });

        // Convert sessions to program format
        const sessionPrograms = daySessions.map(session => {
          const program = programs.find(p => p.id === session.programId);
          if (program) {
            return {
              ...program,
              assignedAt: session.createdAt?.toDate?.() || session.createdAt || new Date(),
              sessionId: session.id
            };
          }
          return null;
        }).filter(Boolean);

        return {
          ...day,
          programs: [...day.programs, ...sessionPrograms]
        };
      });

      setUpcomingDays(updatedDays);
    } catch (error) {
      console.error('Error loading existing training sessions:', error);
      setUpcomingDays(days); // Fallback to days without sessions
    }
  }, [programs, weeklySchedule, currentClubId]);

  const getDayIndex = (dayKey) => {
    const dayMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6
    };
    return dayMap[dayKey];
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // Load both programs and weekly schedule in parallel
      const [programsData, savedSchedule] = await Promise.all([
        clubService.getTrainingPrograms(currentClubId),
        clubService.getWeeklySchedule(currentClubId)
      ]);

      // Set programs first
      setPrograms(programsData);

      // Set weekly schedule
      if (savedSchedule && savedSchedule.schedule) {
        setWeeklySchedule(savedSchedule.schedule);
      }

      // Note: upcoming days will be generated by the useEffect that watches for data changes
    } catch (error) {
      console.error('❌ TrainingManagement: Error loading training data:', error);
      toast({
        title: "Error",
        description: "Failed to load training data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentClubId, toast]);

  useEffect(() => {
    if (currentClubId && userProfile) {
      loadData();
    }
  }, [currentClubId, userProfile]);

  // Generate upcoming days when data is loaded
  useEffect(() => {
    if (currentClubId && !loading && (programs.length > 0 || Object.keys(weeklySchedule).length > 0)) {
      generateUpcomingDays();
    }
  }, [currentClubId, weeklySchedule, programs.length, loading]);

  const handleCreateProgram = async (e) => {
    e.preventDefault();
    if (!programForm.name.trim()) return;

    try {
      await clubService.createTrainingProgram(currentClubId, {
        ...programForm,
        createdBy: user.uid
      });

      toast({
        title: "Program Created",
        description: "Training program has been created successfully.",
      });

      setProgramForm({
        name: '',
        description: '',
        objectives: '',
        difficulty: 'beginner',
        duration: '',
        equipment: '',
        preparationTips: '',
        targetSkills: '',
        specialInstructions: '',
        schedule: []
      });
      setShowCreateProgram(false);
      loadData();
    } catch (error) {
      console.error('Error creating program:', error);
      toast({
        title: "Error",
        description: "Failed to create training program.",
        variant: "destructive",
      });
    }
  };



  const handleScheduleChange = (day, field, value) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const handleScheduleSubmit = async () => {
    try {
      // Save the schedule to the database
      await clubService.saveWeeklySchedule(currentClubId, weeklySchedule, user.uid);

      // Reload the schedule from database to ensure we have the latest data
      const savedSchedule = await clubService.getWeeklySchedule(currentClubId);
      if (savedSchedule && savedSchedule.schedule) {
        setWeeklySchedule(savedSchedule.schedule);
      }

      setShowWeeklySchedule(false);

      // Note: upcoming days will be regenerated by the useEffect that watches weeklySchedule changes

      toast({
        title: "Schedule Saved",
        description: `Training schedule updated successfully`,
      });
    } catch (error) {
      console.error('❌ Error saving schedule:', error);
      toast({
        title: "Error",
        description: "Failed to save training schedule.",
        variant: "destructive",
      });
    }
  };

  // Edit program functions
  const openEditProgram = (program) => {
    setEditingProgram(program);
    setProgramForm({
      name: program.name || '',
      description: program.description || '',
      objectives: program.objectives || '',
      difficulty: program.difficulty || 'beginner',
      duration: program.duration || '',
      equipment: program.equipment || '',
      preparationTips: program.preparationTips || '',
      targetSkills: program.targetSkills || '',
      specialInstructions: program.specialInstructions || '',
      schedule: program.schedule || []
    });
    setShowEditProgram(true);
  };

  const closeEditProgram = () => {
    setShowEditProgram(false);
    setEditingProgram(null);
    setProgramForm({
      name: '',
      description: '',
      objectives: '',
      difficulty: 'beginner',
      duration: '',
      equipment: '',
      preparationTips: '',
      targetSkills: '',
      specialInstructions: '',
      schedule: []
    });
  };

  const handleEditProgram = async (e) => {
    e.preventDefault();
    if (!programForm.name.trim()) return;

    try {
      await clubService.updateTrainingProgram(editingProgram.id, programForm);

      toast({
        title: "Program Updated",
        description: "Training program has been updated successfully.",
      });

      closeEditProgram();
      loadData();
    } catch (error) {
      console.error('Error updating program:', error);
      toast({
        title: "Error",
        description: "Failed to update training program.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProgram = async (programId) => {
    if (!confirm('Are you sure you want to delete this training program? This action cannot be undone.')) {
      return;
    }

    try {
      await clubService.deleteTrainingProgram(programId);

      toast({
        title: "Program Deleted",
        description: "Training program has been deleted successfully.",
      });

      loadData();
    } catch (error) {
      console.error('Error deleting program:', error);
      toast({
        title: "Error",
        description: "Failed to delete training program.",
        variant: "destructive",
      });
    }
  };

  const assignProgramToDay = async (dayId, programId) => {
    try {
      const day = upcomingDays.find(d => d.id === dayId);
      if (!day) return;

      // Check if program is already assigned
      if (day.programs.some(p => p.id === programId)) {
        return; // Don't add duplicate
      }

      const program = programs.find(p => p.id === programId);
      if (!program) return;

      // Create training session in database
      const dayData = {
        date: day.date,
        dayName: day.dayName,
        startTime: '09:00', // Default time, could be made configurable
        endTime: '10:30'
      };

      const session = await clubService.createTrainingSessionFromSchedule(currentClubId, dayData, program);

      // Update local state to reflect the change
      setUpcomingDays(prev => prev.map(day => {
        if (day.id === dayId) {
          return {
            ...day,
            programs: [...day.programs, {
              ...program,
              assignedAt: new Date(),
              sessionId: session.id // Store the session ID for future reference
            }]
          };
        }
        return day;
      }));

      toast({
        title: "Program Assigned",
        description: `${program.name} has been assigned to ${day.dayName}`,
      });

    } catch (error) {
      console.error('Error assigning program to day:', error);
      toast({
        title: "Error",
        description: "Failed to assign program to training day.",
        variant: "destructive",
      });
    }
  };

  const removeProgramFromDay = async (dayId, programId) => {
    try {
      const day = upcomingDays.find(d => d.id === dayId);
      if (!day) return;

      const programToRemove = day.programs.find(p => p.id === programId);
      if (!programToRemove) return;

      // If there's a session ID, we need to delete the training session from database
      if (programToRemove.sessionId) {
        // Find and delete the training session
        const sessionsQuery = query(
          collection(db, 'trainingSessions'),
          where('clubId', '==', currentClubId),
          where('programId', '==', programId),
          where('date', '==', Timestamp.fromDate(new Date(day.date)))
        );

        const sessionsSnap = await getDocs(sessionsQuery);
        if (!sessionsSnap.empty) {
          // Delete the first matching session
          await deleteDoc(sessionsSnap.docs[0].ref);
        }
      }

      // Update local state to reflect the change
      setUpcomingDays(prev => prev.map(day => {
        if (day.id === dayId) {
          return {
            ...day,
            programs: day.programs.filter(p => p.id !== programId)
          };
        }
        return day;
      }));

      toast({
        title: "Program Removed",
        description: `${programToRemove.name} has been removed from ${day.dayName}`,
      });

    } catch (error) {
      console.error('Error removing program from day:', error);
      toast({
        title: "Error",
        description: "Failed to remove program from training day.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background">
      <Navigation />

      {/* Page Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold truncate">Training Management</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                Manage training programs and sessions for {currentClubName}
              </p>
            </div>
            <div className="flex-shrink-0">
              <ClubSelector role="admin" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6 sm:space-y-8">
          {/* Header with Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-bold">Training Management</h2>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">Set your weekly schedule and assign training programs</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <>
              <Dialog open={showCreateProgram} onOpenChange={setShowCreateProgram}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <Plus className="w-4 h-4 mr-2" />
                    <span className="sm:inline">Create Program</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader className="pb-6">
                    <DialogTitle>Create Training Program</DialogTitle>
                    <DialogDescription>
                      Create a comprehensive training program for {currentClubName}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateProgram}>
                    <div className="space-y-6 pt-2 pb-4">
                      {/* Basic Information */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-primary">Basic Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                            <Label htmlFor="programName">Program Name *</Label>
                        <Input
                          id="programName"
                          value={programForm.name}
                          onChange={(e) => setProgramForm(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="e.g., Advanced Kayak Training"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                            <Label htmlFor="difficulty">Difficulty Level</Label>
                            <Select
                              value={programForm.difficulty}
                              onValueChange={(value) => setProgramForm(prev => ({ ...prev, difficulty: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="beginner">Beginner</SelectItem>
                                <SelectItem value="intermediate">Intermediate</SelectItem>
                                <SelectItem value="advanced">Advanced</SelectItem>
                                <SelectItem value="expert">Expert</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="programDescription">Program Description</Label>
                        <Textarea
                          id="programDescription"
                          value={programForm.description}
                          onChange={(e) => setProgramForm(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Describe what athletes will learn and achieve in this program"
                          rows={3}
                        />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="objectives">Training Objectives</Label>
                          <Textarea
                            id="objectives"
                            value={programForm.objectives}
                            onChange={(e) => setProgramForm(prev => ({ ...prev, objectives: e.target.value }))}
                            placeholder="What are the specific goals and outcomes for this training program?"
                            rows={2}
                          />
                        </div>
                      </div>

                      {/* Training Details */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-primary">Training Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="duration">Typical Duration</Label>
                            <Input
                              id="duration"
                              value={programForm.duration}
                              onChange={(e) => setProgramForm(prev => ({ ...prev, duration: e.target.value }))}
                              placeholder="e.g., 90 minutes, 2 hours"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="targetSkills">Target Skills</Label>
                            <Input
                              id="targetSkills"
                              value={programForm.targetSkills}
                              onChange={(e) => setProgramForm(prev => ({ ...prev, targetSkills: e.target.value }))}
                              placeholder="e.g., Paddling technique, Endurance, Balance"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="equipment">Equipment Needed</Label>
                          <Textarea
                            id="equipment"
                            value={programForm.equipment}
                            onChange={(e) => setProgramForm(prev => ({ ...prev, equipment: e.target.value }))}
                            placeholder="List any special equipment, clothing, or gear athletes should bring"
                            rows={2}
                          />
                        </div>
                      </div>

                      {/* Preparation & Instructions */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-primary">Preparation & Instructions</h4>
                        <div className="space-y-2">
                          <Label htmlFor="preparationTips">Preparation Tips</Label>
                          <Textarea
                            id="preparationTips"
                            value={programForm.preparationTips}
                            onChange={(e) => setProgramForm(prev => ({ ...prev, preparationTips: e.target.value }))}
                            placeholder="What should athletes do to prepare for this training session?"
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="specialInstructions">Special Instructions</Label>
                          <Textarea
                            id="specialInstructions"
                            value={programForm.specialInstructions}
                            onChange={(e) => setProgramForm(prev => ({ ...prev, specialInstructions: e.target.value }))}
                            placeholder="Any important safety notes, prerequisites, or special instructions"
                            rows={2}
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:gap-3 pt-6">
                      <Button type="button" variant="outline" onClick={() => setShowCreateProgram(false)} className="w-full sm:w-auto">
                        Cancel
                      </Button>
                      <Button type="submit" className="w-full sm:w-auto">Create Program</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Edit Program Dialog */}
              <Dialog open={showEditProgram} onOpenChange={setShowEditProgram}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader className="pb-6">
                    <DialogTitle>Edit Training Program</DialogTitle>
                    <DialogDescription>
                      Update the details for {editingProgram?.name}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleEditProgram}>
                    <div className="space-y-6 pt-2 pb-4">
                      {/* Basic Information */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-primary">Basic Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-programName">Program Name *</Label>
                            <Input
                              id="edit-programName"
                              value={programForm.name}
                              onChange={(e) => setProgramForm(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="e.g., Advanced Kayak Training"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-difficulty">Difficulty Level</Label>
                            <Select
                              value={programForm.difficulty}
                              onValueChange={(value) => setProgramForm(prev => ({ ...prev, difficulty: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="beginner">Beginner</SelectItem>
                                <SelectItem value="intermediate">Intermediate</SelectItem>
                                <SelectItem value="advanced">Advanced</SelectItem>
                                <SelectItem value="expert">Expert</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-programDescription">Program Description</Label>
                          <Textarea
                            id="edit-programDescription"
                            value={programForm.description}
                            onChange={(e) => setProgramForm(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Describe what athletes will learn and achieve in this program"
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-objectives">Training Objectives</Label>
                          <Textarea
                            id="edit-objectives"
                            value={programForm.objectives}
                            onChange={(e) => setProgramForm(prev => ({ ...prev, objectives: e.target.value }))}
                            placeholder="What are the specific goals and outcomes for this training program?"
                            rows={2}
                          />
                        </div>
                      </div>

                      {/* Training Details */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-primary">Training Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-duration">Typical Duration</Label>
                            <Input
                              id="edit-duration"
                              value={programForm.duration}
                              onChange={(e) => setProgramForm(prev => ({ ...prev, duration: e.target.value }))}
                              placeholder="e.g., 90 minutes, 2 hours"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-targetSkills">Target Skills</Label>
                            <Input
                              id="edit-targetSkills"
                              value={programForm.targetSkills}
                              onChange={(e) => setProgramForm(prev => ({ ...prev, targetSkills: e.target.value }))}
                              placeholder="e.g., Paddling technique, Endurance, Balance"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-equipment">Equipment Needed</Label>
                          <Textarea
                            id="edit-equipment"
                            value={programForm.equipment}
                            onChange={(e) => setProgramForm(prev => ({ ...prev, equipment: e.target.value }))}
                            placeholder="List any special equipment, clothing, or gear athletes should bring"
                            rows={2}
                          />
                        </div>
                      </div>

                      {/* Preparation & Instructions */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-primary">Preparation & Instructions</h4>
                        <div className="space-y-2">
                          <Label htmlFor="edit-preparationTips">Preparation Tips</Label>
                          <Textarea
                            id="edit-preparationTips"
                            value={programForm.preparationTips}
                            onChange={(e) => setProgramForm(prev => ({ ...prev, preparationTips: e.target.value }))}
                            placeholder="What should athletes do to prepare for this training session?"
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-specialInstructions">Special Instructions</Label>
                          <Textarea
                            id="edit-specialInstructions"
                            value={programForm.specialInstructions}
                            onChange={(e) => setProgramForm(prev => ({ ...prev, specialInstructions: e.target.value }))}
                            placeholder="Any important safety notes, prerequisites, or special instructions"
                            rows={2}
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:gap-3 pt-6">
                      <Button type="button" variant="outline" onClick={closeEditProgram} className="w-full sm:w-auto">
                        Cancel
                      </Button>
                      <Button type="submit" className="w-full sm:w-auto">Update Program</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={showWeeklySchedule} onOpenChange={setShowWeeklySchedule}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto">
                    <Settings className="w-4 h-4 mr-2" />
                    <span className="sm:inline">Set Weekly Schedule</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-[600px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-lg sm:text-xl">Weekly Training Schedule</DialogTitle>
                    <DialogDescription className="text-sm">
                      Select which days you want to train and set default programs for {currentClubName}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    {daysOfWeek.map(({ key, label, short }) => (
                      <div key={key} className="flex flex-col gap-3 p-3 border rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={key}
                            checked={weeklySchedule[key].enabled}
                            onCheckedChange={(checked) => handleScheduleChange(key, 'enabled', checked)}
                          />
                          <Label htmlFor={key} className="font-medium cursor-pointer text-sm flex-1">
                            <span className="sm:hidden">{short}</span>
                            <span className="hidden sm:inline">{label}</span>
                          </Label>
                        </div>

                        {weeklySchedule[key].enabled && (
                          <div className="flex flex-col gap-3 ml-6">
                            {/* Time Inputs */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <label className="text-xs text-muted-foreground min-w-0">Time:</label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="time"
                                  value={weeklySchedule[key].startTime}
                                  onChange={(e) => handleScheduleChange(key, 'startTime', e.target.value)}
                                  className="w-[100px] text-xs"
                                />
                                <span className="text-xs text-muted-foreground">to</span>
                                <Input
                                  type="time"
                                  value={weeklySchedule[key].endTime}
                                  onChange={(e) => handleScheduleChange(key, 'endTime', e.target.value)}
                                  className="w-[100px] text-xs"
                                />
                              </div>
                            </div>

                            {/* Program Selection */}
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-muted-foreground">Default Program:</label>
                              <Select
                                value={weeklySchedule[key].programId || 'none'}
                                onValueChange={(programId) => handleScheduleChange(key, 'programId', programId === 'none' ? '' : programId)}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select program" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No default program</SelectItem>
                                  {programs.map((program) => (
                                    <SelectItem key={program.id} value={program.id}>
                                      {program.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:gap-3 pt-6">
                    <Button type="button" variant="outline" onClick={() => setShowWeeklySchedule(false)} className="w-full sm:w-auto">
                      Cancel
                    </Button>
                    <Button onClick={handleScheduleSubmit} className="w-full sm:w-auto">
                      Save Schedule
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              </>
            </div>
          </div>

          {/* Upcoming Training Days */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Upcoming Training Days
                  </CardTitle>
                                <CardDescription>
                {upcomingDays.some(day => day.isDefault)
                  ? "Set your weekly schedule to see specific training days"
                  : `Next ${upcomingDays.length} training days based on your weekly schedule`
                }
              </CardDescription>
                </div>

              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {upcomingDays.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">📅</div>
                    <h3 className="text-lg font-semibold mb-2">No Upcoming Training Days</h3>
                    <p className="text-muted-foreground mb-4">
                      Set up your weekly schedule to see upcoming training days
                    </p>

                    {/* Debug info and guidance */}
                    <div className="text-left bg-gray-50 p-3 rounded text-xs space-y-2">
                      <div><strong>Debug Info:</strong></div>
                      <div>Programs loaded: {programs.length}</div>
                      <div>Weekly schedule keys: {Object.keys(weeklySchedule || {}).join(', ')}</div>
                      <div>Enabled days: {Object.entries(weeklySchedule || {}).filter(([,day]) => day?.enabled).length}</div>
                      <div>Current club: {currentClubId || 'None'}</div>

                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {

                          }}
                        >
                          📊 Debug Log
                        </Button>

                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {upcomingDays.map((day) => (
                      <div key={day.id} className="border rounded-lg p-3 sm:p-4 bg-card hover:shadow-md transition-shadow">
                        <div className="text-center mb-3">
                          <h3 className="text-base sm:text-lg font-semibold">{day.dayName}</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                            {day.dateString}
                          </p>
                        </div>
                        <div className="flex justify-center mb-3 gap-2 flex-wrap">
                          <Badge variant={day.isDefault ? "secondary" : "default"} className="text-xs">
                            {day.programs.length} programs
                          </Badge>
                          {day.isDefault && (
                            <Badge variant="outline" className="text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-2">
                          {day.programs.length > 0 ? (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">Programs:</p>
                              <div className="flex flex-wrap gap-1">
                                {day.programs.map((program) => (
                                  <div key={program.id} className="relative group">
                                    <Badge variant="outline" className="text-xs px-2 py-1 max-w-full truncate" title={program.name}>
                                      {program.name.length > 12 ? `${program.name.substring(0, 12)}...` : program.name}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              No programs
                            </p>
                          )}

                          {/* Add Program Button */}
                          <div className="flex justify-center pt-2 border-t">
                            <AddProgramsDialog
                              dayId={day.id}
                              allPrograms={programs}
                              currentlyAssignedPrograms={day.programs}
                              onAssignPrograms={assignProgramToDay}
                              onRemovePrograms={removeProgramFromDay}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Training Programs List */}
          {programs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Available Programs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {programs.map((program) => (
                    <div key={program.id} className="p-3 sm:p-4 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold flex-1 text-sm sm:text-base pr-2 line-clamp-2">{program.name}</h4>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditProgram(program)}
                            className="h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-600"
                          >
                            <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProgram(program.id)}
                            className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                          >
                            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-3 line-clamp-3">{program.description}</p>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {program.difficulty ? program.difficulty.charAt(0).toUpperCase() + program.difficulty.slice(1) : 'Beginner'}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={program.duration || 'Flexible'}>
                          {program.duration || 'Flexible'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div> 
    </>
  );
};

// AddProgramsDialog component for selecting multiple programs
const AddProgramsDialog = ({ dayId, allPrograms, currentlyAssignedPrograms, onAssignPrograms, onRemovePrograms }) => {
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  // Initialize selected programs with currently assigned ones
  useEffect(() => {
    if (isOpen) {
      setSelectedPrograms(currentlyAssignedPrograms.map(p => p.id));
    }
  }, [isOpen, currentlyAssignedPrograms]);

  const handleProgramToggle = (programId) => {
    setSelectedPrograms(prev =>
      prev.includes(programId)
        ? prev.filter(id => id !== programId)
        : [...prev, programId]
    );
  };

  const handleUpdatePrograms = () => {
    const currentlyAssignedIds = currentlyAssignedPrograms.map(p => p.id);

    // Programs to add (in selected but not in currently assigned)
    const programsToAdd = selectedPrograms.filter(id => !currentlyAssignedIds.includes(id));

    // Programs to remove (in currently assigned but not in selected)
    const programsToRemove = currentlyAssignedIds.filter(id => !selectedPrograms.includes(id));

    // Apply changes
    programsToAdd.forEach(programId => {
      onAssignPrograms(dayId, programId);
    });

    programsToRemove.forEach(programId => {
      onRemovePrograms(dayId, programId);
    });

    setIsOpen(false);
  };

  const handleOpenChange = (open) => {
    setIsOpen(open);
    if (!open) {
      setSelectedPrograms([]);
    }
  };

  const selectedCount = selectedPrograms.length;
  const assignedCount = currentlyAssignedPrograms.length;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm">
          <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          <span className="hidden xs:inline">Manage </span>Programs
          <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
            {assignedCount}
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-md max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-lg">Manage Training Programs</DialogTitle>
          <DialogDescription className="text-sm">
            Select the training programs you want to assign to this day. Currently assigned programs are pre-selected.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2 max-h-[50vh] overflow-y-auto">
          {allPrograms.map((program) => (
            <div key={program.id} className={`flex items-start space-x-2 sm:space-x-3 p-3 rounded-lg border transition-all duration-200 ${
              selectedPrograms.includes(program.id)
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border hover:bg-muted/50 hover:border-primary/20'
            }`}>
              <Checkbox
                id={`program-${program.id}`}
                checked={selectedPrograms.includes(program.id)}
                onCheckedChange={() => handleProgramToggle(program.id)}
                className="mt-0.5 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <label
                  htmlFor={`program-${program.id}`}
                  className="text-sm font-medium cursor-pointer flex items-start flex-col gap-1 sm:flex-row sm:items-center sm:gap-2 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Target className={`w-3 h-3 sm:w-4 sm:h-4 transition-colors flex-shrink-0 ${
                      selectedPrograms.includes(program.id) ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                    <span className={`truncate ${selectedPrograms.includes(program.id) ? 'text-primary' : ''}`}>
                      {program.name}
                    </span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {program.difficulty && (
                      <Badge variant="outline" className="text-xs">
                        {program.difficulty.charAt(0).toUpperCase() + program.difficulty.slice(1)}
                      </Badge>
                    )}
                    {currentlyAssignedPrograms.some(p => p.id === program.id) && (
                      <Badge variant="secondary" className="text-xs">
                        Assigned
                      </Badge>
                    )}
                  </div>
                </label>
                {program.description && (
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                    {program.description}
                  </p>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-2 text-xs text-muted-foreground">
                  {program.duration && (
                    <span className="truncate">Duration: {program.duration}</span>
                  )}
                  {program.targetSkills && (
                    <span className="truncate">Skills: {program.targetSkills}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:gap-3 pt-6">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdatePrograms}
            disabled={selectedCount === assignedCount}
            className="w-full sm:w-auto"
          >
            <span className="hidden sm:inline">
              {selectedCount > assignedCount ? 'Add' : selectedCount < assignedCount ? 'Remove' : 'Update'} {Math.abs(selectedCount - assignedCount)} Program{Math.abs(selectedCount - assignedCount) !== 1 ? 's' : ''}
            </span>
            <span className="sm:hidden">
              {selectedCount > assignedCount ? 'Add' : selectedCount < assignedCount ? 'Remove' : 'Update'} ({Math.abs(selectedCount - assignedCount)})
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TrainingManagement;
