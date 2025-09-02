import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/toast-context.jsx';
import { clubService } from '@/services/clubService';
import { performanceCategoryService } from '@/services/performanceCategoryService';
import { athletePerformanceService } from '@/services/athletePerformanceService';
import { testService } from '@/services/testService';
import { Shield, Users, Plus, Edit, Trash2, Target, Trophy, Calendar } from 'lucide-react';

// Static mapping of category types to value comparison logic
const CATEGORY_TYPE_RULES = {
  // Time-based: lower is better (faster)
  time: ['seconds', 'minutes', 'hours', 'sec', 'min', 'hr', 'ms', 'milliseconds'],
  // Weight/distance: higher is better (stronger/farther)
  weight: ['kg', 'lbs', 'pounds', 'kilograms', 'tonnes', 'tons', 'g', 'grams'],
  distance: ['meters', 'm', 'km', 'kilometers', 'miles', 'mi', 'feet', 'ft', 'yards', 'yd'],
  // Count-based: higher is better
  count: ['reps', 'repetitions', 'count', 'times', 'sets'],
  // Points/score: higher is better
  points: ['points', 'pts', 'score', 'marks']
};

function AthleteManagement() {
  const { userProfile, currentClubId, memberships, user, isAdmin } = useAuth();
  const { toast } = useToast();

  // Debug log the auth state
  useEffect(() => {
    console.log('🔐 AthleteManagement Auth State:', {
      user: user?.uid,
      userProfile,
      currentClubId,
      memberships,
      isAdmin: isAdmin?.()
    });
  }, [user, userProfile, currentClubId, memberships, isAdmin]);

  // State management
  const [selectedAdminClubId, setSelectedAdminClubId] = useState('');
  const [athletes, setAthletes] = useState([]);

  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [selectedAthleteRecords, setSelectedAthleteRecords] = useState([]);
  const [selectedAthleteGoals, setSelectedAthleteGoals] = useState([]);
  const [selectedAthletePBs, setSelectedAthletePBs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);

  // Dialog states

  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);

  const [editingRecord, setEditingRecord] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);

  // Form states
  const [recordForm, setRecordForm] = useState({ categoryId: '', value: '', notes: '', date: '' });
  const [goalForm, setGoalForm] = useState({ categoryId: '', targetValue: '', targetDate: '', notes: '' });

  // Get admin memberships
  const adminMemberships = (memberships || []).filter(m => m.role === 'admin');

  // Calculate effective club ID
  const getEffectiveClubId = () => {
    if (selectedAdminClubId) return selectedAdminClubId;
    if (currentClubId) return currentClubId;
    if (adminMemberships.length > 0) return adminMemberships[0].clubId;
    return userProfile?.teamId || '';
  };

  const effectiveClubId = getEffectiveClubId();

  // Load categories
  const loadCategories = async () => {
    if (!effectiveClubId) return;

    try {
      const clubCategories = await performanceCategoryService.getClubCategories(effectiveClubId);
      setCategories(clubCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  // Initialize selected club for regular admins
  useEffect(() => {
    if (adminMemberships.length > 0 && !selectedAdminClubId) {
      setSelectedAdminClubId(currentClubId || adminMemberships[0].clubId);
    }
  }, [adminMemberships, currentClubId, selectedAdminClubId]);

  // Load data when club changes
  useEffect(() => {
    if (effectiveClubId) {
      console.log('🏠 AthleteManagement: effectiveClubId changed to:', effectiveClubId);
      loadAthletes();
      loadCategories();
    } else {
      console.log('⚠️ AthleteManagement: No effective club ID');
    }
  }, [effectiveClubId]);

  // Load athlete records when athlete is selected
  useEffect(() => {
    if (selectedAthlete && effectiveClubId) {
      loadAthleteData();
    }
  }, [selectedAthlete, effectiveClubId]);

  const loadAthletes = async () => {
    if (!effectiveClubId) return;
    
    setLoading(true);
    try {
      const members = await clubService.getClubMembersWithDetails(effectiveClubId);
      const athleteMembers = members.filter(member => member.role === 'athlete');
      setAthletes(athleteMembers);
    } catch (error) {
      console.error('Error loading athletes:', error);
      toast({
        title: 'Error loading athletes',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };




  // Load athlete personal bests from personalRecords collection
  const loadAthletePBs = async () => {
    if (!selectedAthlete || !effectiveClubId) return;

    try {
      // Query personalRecords collection for this athlete
      const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');

      const pbQuery = query(
        collection(db, 'personalRecords'),
        where('athleteId', '==', selectedAthlete.id),
        orderBy('updatedAt', 'desc')
      );

      const pbSnapshot = await getDocs(pbQuery);
      const pbs = pbSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.() || doc.data().date,
        updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
      }));

      setSelectedAthletePBs(pbs);
      console.log('🏆 Loaded athlete PBs:', pbs);
    } catch (error) {
      console.error('Error loading athlete PBs:', error);
      setSelectedAthletePBs([]);
    }
  };

  const loadAthleteData = async () => {
    if (!selectedAthlete || !effectiveClubId) return;

    try {
      const [records, goals] = await Promise.all([
        athletePerformanceService.getAthleteRecords(selectedAthlete.id, effectiveClubId),
        athletePerformanceService.getAthleteGoals(selectedAthlete.id, effectiveClubId)
      ]);
      setSelectedAthleteRecords(records);
      setSelectedAthleteGoals(goals);

      // Also load personal bests
      await loadAthletePBs();
    } catch (error) {
      console.error('Error loading athlete data:', error);
      toast({
        title: 'Error loading athlete performance data',
        variant: 'destructive'
      });
    }
  };







  // Personal record management
  const handleCreateRecord = async () => {
    if (!selectedAthlete || !recordForm.categoryId || !recordForm.value) return;
    
    setSaving(true);
    try {
      await athletePerformanceService.createRecord(selectedAthlete.id, effectiveClubId, {
        ...recordForm,
        value: parseFloat(recordForm.value),
        date: recordForm.date || new Date().toISOString().split('T')[0]
      });
      await loadAthleteData();
      setRecordForm({ categoryId: '', value: '', notes: '', date: '' });
      setRecordDialogOpen(false);
      toast({
        title: 'Personal record added successfully'
      });
    } catch (error) {
      console.error('Error creating record:', error);
      toast({
        title: 'Error adding personal record',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRecord = async () => {
    if (!editingRecord || !recordForm.value) return;
    
    setSaving(true);
    try {
      await athletePerformanceService.updateRecord(editingRecord.id, {
        ...recordForm,
        value: parseFloat(recordForm.value)
      });
      await loadAthleteData();
      setEditingRecord(null);
      setRecordForm({ categoryId: '', value: '', notes: '', date: '' });
      setRecordDialogOpen(false);
      toast({
        title: 'Personal record updated successfully'
      });
    } catch (error) {
      console.error('Error updating record:', error);
      toast({
        title: 'Error updating personal record',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = async (recordId) => {
    setSaving(true);
    try {
      await athletePerformanceService.deleteRecord(recordId);
      await loadAthleteData();
      toast({
        title: 'Personal record deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting record:', error);
      toast({
        title: 'Error deleting personal record',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Goal management
  const handleCreateGoal = async () => {
    if (!selectedAthlete || !goalForm.categoryId || !goalForm.targetValue || !goalForm.targetDate) return;
    
    setSaving(true);
    try {
      await athletePerformanceService.createGoal(selectedAthlete.id, effectiveClubId, {
        ...goalForm,
        targetValue: parseFloat(goalForm.targetValue)
      });
      await loadAthleteData();
      setGoalForm({ categoryId: '', targetValue: '', targetDate: '', notes: '' });
      setGoalDialogOpen(false);
      toast({
        title: 'Goal created successfully'
      });
    } catch (error) {
      console.error('Error creating goal:', error);
      toast({
        title: 'Error creating goal',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateGoal = async () => {
    if (!editingGoal || !goalForm.targetValue || !goalForm.targetDate) return;
    
    setSaving(true);
    try {
      await athletePerformanceService.updateGoal(editingGoal.id, {
        ...goalForm,
        targetValue: parseFloat(goalForm.targetValue)
      });
      await loadAthleteData();
      setEditingGoal(null);
      setGoalForm({ categoryId: '', targetValue: '', targetDate: '', notes: '' });
      setGoalDialogOpen(false);
      toast({
        title: 'Goal updated successfully'
      });
    } catch (error) {
      console.error('Error updating goal:', error);
      toast({
        title: 'Error updating goal',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    setSaving(true);
    try {
      await athletePerformanceService.deleteGoal(goalId);
      await loadAthleteData();
      toast({
        title: 'Goal deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting goal:', error);
      toast({
        title: 'Error deleting goal',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Helper functions


  const openRecordDialog = (record = null) => {
    if (record) {
      setEditingRecord(record);
      setRecordForm({
        categoryId: record.categoryId,
        value: record.value.toString(),
        notes: record.notes || '',
        date: record.date
      });
    } else {
      setEditingRecord(null);
      setRecordForm({ categoryId: '', value: '', notes: '', date: new Date().toISOString().split('T')[0] });
    }
    setRecordDialogOpen(true);
  };

  const openGoalDialog = (goal = null) => {
    if (goal) {
      setEditingGoal(goal);
      setGoalForm({
        categoryId: goal.categoryId,
        targetValue: goal.targetValue.toString(),
        targetDate: goal.targetDate,
        notes: goal.notes || ''
      });
    } else {
      setEditingGoal(null);
      setGoalForm({ categoryId: '', targetValue: '', targetDate: '', notes: '' });
    }
    setGoalDialogOpen(true);
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown Category';
  };

  const getCategoryUnit = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.unit : '';
  };

  // Determine if higher values are better for a category
  const isHigherBetter = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category || !category.unit) return true; // Default to higher is better

    const unit = category.unit.toLowerCase().trim();

    // Check if unit indicates time (lower is better)
    if (CATEGORY_TYPE_RULES.time.some(timeUnit => unit.includes(timeUnit))) {
      return false;
    }

    // For weight, distance, count, points: higher is better
    return true;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto p-4 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-semibold truncate">Athlete Performance Management</h1>
          {adminMemberships.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:inline">Managing:</span>
              {adminMemberships.length === 1 ? (
                <Badge variant="outline" className="flex items-center gap-1 max-w-full">
                  <Shield className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{adminMemberships[0].clubName}</span>
                </Badge>
              ) : (
                <Select value={selectedAdminClubId} onValueChange={setSelectedAdminClubId}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {adminMemberships.map((membership) => (
                      <SelectItem key={membership.clubId} value={membership.clubId}>
                        <div className="flex items-center gap-2">
                          <Shield className="h-3 w-3" />
                          <span className="truncate">{membership.clubName}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        <div className="max-w-6xl mx-auto space-y-6">
            {/* Athletes List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Athletes ({athletes.length})
                </CardTitle>
                <CardDescription>
                  Select an athlete to manage their personal records and goals
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-4">Loading athletes...</div>
                ) : athletes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No athletes found</p>
                    <p className="text-sm mt-1">Athletes will appear here when they join the club</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {athletes.map((athlete) => (
                      <Button
                        key={athlete.id}
                        variant={selectedAthlete?.id === athlete.id ? "default" : "outline"}
                        className="justify-start h-auto p-4 w-full"
                        onClick={() => setSelectedAthlete(athlete)}
                      >
                        <div className="text-left min-w-0 w-full">
                          <div className="font-medium truncate">
                            {athlete.firstName && athlete.lastName 
                              ? `${athlete.firstName} ${athlete.lastName}`
                              : athlete.email
                            }
                          </div>
                          {athlete.sport && (
                            <div className="text-sm text-muted-foreground truncate">{athlete.sport}</div>
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Selected Athlete Performance Data */}
            {selectedAthlete && (
              <div className="space-y-6">
                {/* Personal Records */}
                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 min-w-0">
                        <Trophy className="h-5 w-5 flex-shrink-0" />
                        <span className="truncate">
                          Personal Records - {selectedAthlete.firstName && selectedAthlete.lastName 
                            ? `${selectedAthlete.firstName} ${selectedAthlete.lastName}`
                            : selectedAthlete.email
                          }
                        </span>
                      </CardTitle>
                      <Button size="sm" onClick={() => openRecordDialog()} disabled={categories.length === 0} className="w-full sm:w-auto">
                        <Plus className="h-4 w-4 mr-1" />
                        <span className="sm:hidden">Add Personal Record</span>
                        <span className="hidden sm:inline">Add Record</span>
                      </Button>
                    </div>
                    <CardDescription>
                      Track personal bests across different performance categories
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedAthleteRecords.length === 0 && selectedAthletePBs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No personal records yet</p>
                        <p className="text-sm mt-1">Add the athlete's first personal record or wait for test results</p>
                      </div>
                    ) : (
                      <>
                        {/* Desktop Table View */}
                        <div className="hidden sm:block">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Category</TableHead>
                                <TableHead>Best Performance</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(() => {
                                // Combine all records and PBs, then get the highest value per category
                                const allRawRecords = [
                                  // Manual records
                                  ...selectedAthleteRecords.map(record => ({
                                    ...record,
                                    type: 'manual',
                                    source: 'Manual Entry',
                                    canEdit: true,
                                    canDelete: true
                                  })),
                                  // Personal bests from tests
                                  ...selectedAthletePBs.map(pb => ({
                                    id: pb.id,
                                    categoryId: pb.categoryId,
                                    value: pb.value,
                                    date: pb.date,
                                    notes: pb.testId ? `Test ${pb.testId.slice(-8)}` : 'Test Result',
                                    type: 'pb',
                                    source: 'Test Result',
                                    testId: pb.testId,
                                    canEdit: false,
                                    canDelete: false
                                  }))
                                ];

                                // Group by category and get the highest value for each category
                                const categoryMap = new Map();

                                                            allRawRecords.forEach(record => {
                              const categoryId = record.categoryId;
                              if (!categoryMap.has(categoryId)) {
                                categoryMap.set(categoryId, record);
                              } else {
                                const existing = categoryMap.get(categoryId);
                                const higherIsBetter = isHigherBetter(categoryId);

                                // Compare values based on whether higher or lower is better
                                if (higherIsBetter) {
                                  if (record.value > existing.value) {
                                    categoryMap.set(categoryId, record);
                                  }
                                } else {
                                  // Lower is better (e.g., time)
                                  if (record.value < existing.value) {
                                    categoryMap.set(categoryId, record);
                                  }
                                }
                              }
                            });

                                // Convert back to array and sort by category name
                                const consolidatedRecords = Array.from(categoryMap.values()).sort((a, b) => {
                                  const categoryA = getCategoryName(a.categoryId);
                                  const categoryB = getCategoryName(b.categoryId);
                                  return categoryA.localeCompare(categoryB);
                                });

                                return consolidatedRecords.map((record) => (
                                  <TableRow key={`${record.type}-${record.id}`}>
                                    <TableCell className="truncate max-w-xs">{getCategoryName(record.categoryId)}</TableCell>
                                    <TableCell className="font-mono">
                                      {record.value} {getCategoryUnit(record.categoryId)}
                                    </TableCell>
                                    <TableCell>{record.date ? new Date(record.date).toLocaleDateString() : 'N/A'}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{record.source}</TableCell>
                                    <TableCell>
                                      {record.canEdit ? (
                                        <div className="flex gap-1">
                                          <Button size="sm" variant="ghost" onClick={() => openRecordDialog(record)}>
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button size="sm" variant="ghost">
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="w-[95vw] max-w-md">
                                              <AlertDialogHeader>
                                                <AlertDialogTitle>Delete Record</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                  Are you sure you want to delete this personal record?
                                                </AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                                <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                  onClick={() => handleDeleteRecord(record.id)}
                                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
                                                >
                                                  Delete
                                                </AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">Auto-updated</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ));
                              })()}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="sm:hidden space-y-3">
                          {(() => {
                            // Combine all records and PBs, then get the highest value per category
                            const allRawRecords = [
                              // Manual records
                              ...selectedAthleteRecords.map(record => ({
                                ...record,
                                type: 'manual',
                                source: 'Manual Entry',
                                canEdit: true,
                                canDelete: true
                              })),
                              // Personal bests from tests
                              ...selectedAthletePBs.map(pb => ({
                                id: pb.id,
                                categoryId: pb.categoryId,
                                value: pb.value,
                                date: pb.date,
                                notes: pb.testId ? `Test ${pb.testId.slice(-8)}` : 'Test Result',
                                type: 'pb',
                                source: 'Test Result',
                                testId: pb.testId,
                                canEdit: false,
                                canDelete: false
                              }))
                            ];

                            // Group by category and get the highest value for each category
                            const categoryMap = new Map();

                            allRawRecords.forEach(record => {
                              const categoryId = record.categoryId;
                              if (!categoryMap.has(categoryId)) {
                                categoryMap.set(categoryId, record);
                              } else {
                                const existing = categoryMap.get(categoryId);
                                const higherIsBetter = isHigherBetter(categoryId);

                                // Compare values based on whether higher or lower is better
                                if (higherIsBetter) {
                                  if (record.value > existing.value) {
                                    categoryMap.set(categoryId, record);
                                  }
                                } else {
                                  // Lower is better (e.g., time)
                                  if (record.value < existing.value) {
                                    categoryMap.set(categoryId, record);
                                  }
                                }
                              }
                            });

                            // Convert back to array and sort by category name
                            const consolidatedRecords = Array.from(categoryMap.values()).sort((a, b) => {
                              const categoryA = getCategoryName(a.categoryId);
                              const categoryB = getCategoryName(b.categoryId);
                              return categoryA.localeCompare(categoryB);
                            });

                            return consolidatedRecords.map((record) => (
                              <div key={`${record.type}-${record.id}`} className="border rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="font-medium truncate">{getCategoryName(record.categoryId)}</div>
                                  <div className="flex gap-1 flex-shrink-0">
                                    {record.canEdit ? (
                                      <>
                                        <Button size="sm" variant="ghost" onClick={() => openRecordDialog(record)}>
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button size="sm" variant="ghost">
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent className="w-[95vw] max-w-md">
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>Delete Record</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                Are you sure you want to delete this personal record?
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter className="flex-col gap-2">
                                              <AlertDialogCancel className="w-full">Cancel</AlertDialogCancel>
                                              <AlertDialogAction
                                                onClick={() => handleDeleteRecord(record.id)}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full"
                                              >
                                                Delete
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">Auto</span>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-1 text-sm text-muted-foreground">
                                  <div className="font-mono">
                                    <strong>Value:</strong> {record.value} {getCategoryUnit(record.categoryId)}
                                  </div>
                                  <div><strong>Date:</strong> {record.date ? new Date(record.date).toLocaleDateString() : 'N/A'}</div>
                                  <div><strong>Source:</strong> {record.source}</div>
                                  {record.notes && record.notes !== record.source && <div><strong>Notes:</strong> {record.notes}</div>}
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Goals */}
                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 min-w-0">
                        <Target className="h-5 w-5 flex-shrink-0" />
                        <span className="truncate">
                          Goals - {selectedAthlete.firstName && selectedAthlete.lastName 
                            ? `${selectedAthlete.firstName} ${selectedAthlete.lastName}`
                            : selectedAthlete.email
                          }
                        </span>
                      </CardTitle>
                      <Button size="sm" onClick={() => openGoalDialog()} disabled={categories.length === 0} className="w-full sm:w-auto">
                        <Plus className="h-4 w-4 mr-1" />
                        <span className="sm:hidden">Add Goal</span>
                        <span className="hidden sm:inline">Add Goal</span>
                      </Button>
                    </div>
                    <CardDescription>
                      Set and track performance goals
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedAthleteGoals.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No goals set yet</p>
                        <p className="text-sm mt-1">Set the athlete's first performance goal</p>
                      </div>
                    ) : (
                      <>
                        {/* Desktop Table View */}
                        <div className="hidden sm:block">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Category</TableHead>
                                <TableHead>Target</TableHead>
                                <TableHead>Target Date</TableHead>
                                <TableHead>Notes</TableHead>
                                <TableHead>Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedAthleteGoals.map((goal) => (
                                <TableRow key={goal.id}>
                                  <TableCell className="truncate max-w-xs">{getCategoryName(goal.categoryId)}</TableCell>
                                  <TableCell>
                                    {goal.targetValue} {getCategoryUnit(goal.categoryId)}
                                  </TableCell>
                                  <TableCell>{new Date(goal.targetDate).toLocaleDateString()}</TableCell>
                                  <TableCell className="truncate max-w-xs">{goal.notes || '-'}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button size="sm" variant="ghost" onClick={() => openGoalDialog(goal)}>
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button size="sm" variant="ghost">
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="w-[95vw] max-w-md">
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Goal</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Are you sure you want to delete this goal?
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => handleDeleteGoal(goal.id)}
                                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
                                            >
                                              Delete
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="sm:hidden space-y-3">
                          {selectedAthleteGoals.map((goal) => (
                            <div key={goal.id} className="border rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-medium truncate">{getCategoryName(goal.categoryId)}</div>
                                <div className="flex gap-1 flex-shrink-0">
                                  <Button size="sm" variant="ghost" onClick={() => openGoalDialog(goal)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="sm" variant="ghost">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="w-[95vw] max-w-md">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Goal</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this goal?
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter className="flex-col gap-2">
                                        <AlertDialogCancel className="w-full">Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteGoal(goal.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                              <div className="space-y-1 text-sm text-muted-foreground">
                                <div><strong>Target:</strong> {goal.targetValue} {getCategoryUnit(goal.categoryId)}</div>
                                <div><strong>Target Date:</strong> {new Date(goal.targetDate).toLocaleDateString()}</div>
                                {goal.notes && <div><strong>Notes:</strong> {goal.notes}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>

        {/* Dialogs */}
        


        {/* Record Dialog */}
        <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRecord ? 'Edit Personal Record' : 'Add Personal Record'}
              </DialogTitle>
              <DialogDescription>
                {editingRecord 
                  ? 'Update the personal record details'
                  : `Add a new personal record for ${selectedAthlete?.firstName || selectedAthlete?.email || 'athlete'}`
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="recordCategory">Category</Label>
                <Select 
                  value={recordForm.categoryId} 
                  onValueChange={(value) => setRecordForm(prev => ({ ...prev, categoryId: value }))}
                  disabled={editingRecord !== null}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name} {category.unit && `(${category.unit})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="recordValue">Value</Label>
                <Input
                  id="recordValue"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 100, 4.15"
                  value={recordForm.value}
                  onChange={(e) => setRecordForm(prev => ({ ...prev, value: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="recordDate">Date</Label>
                <Input
                  id="recordDate"
                  type="date"
                  value={recordForm.date}
                  onChange={(e) => setRecordForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="recordNotes">Notes (optional)</Label>
                <Textarea
                  id="recordNotes"
                  placeholder="Additional notes about this record"
                  value={recordForm.notes}
                  onChange={(e) => setRecordForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRecordDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={editingRecord ? handleUpdateRecord : handleCreateRecord}
                disabled={saving || !recordForm.categoryId || !recordForm.value}
              >
                {saving ? 'Saving...' : (editingRecord ? 'Update' : 'Add')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Goal Dialog */}
        <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingGoal ? 'Edit Goal' : 'Add Goal'}
              </DialogTitle>
              <DialogDescription>
                {editingGoal 
                  ? 'Update the goal details'
                  : `Set a new performance goal for ${selectedAthlete?.firstName || selectedAthlete?.email || 'athlete'}`
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="goalCategory">Category</Label>
                <Select 
                  value={goalForm.categoryId} 
                  onValueChange={(value) => setGoalForm(prev => ({ ...prev, categoryId: value }))}
                  disabled={editingGoal !== null}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name} {category.unit && `(${category.unit})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="goalTarget">Target Value</Label>
                <Input
                  id="goalTarget"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 120, 3.45"
                  value={goalForm.targetValue}
                  onChange={(e) => setGoalForm(prev => ({ ...prev, targetValue: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="goalDate">Target Date</Label>
                <Input
                  id="goalDate"
                  type="date"
                  value={goalForm.targetDate}
                  onChange={(e) => setGoalForm(prev => ({ ...prev, targetDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="goalNotes">Notes (optional)</Label>
                <Textarea
                  id="goalNotes"
                  placeholder="Additional notes about this goal"
                  value={goalForm.notes}
                  onChange={(e) => setGoalForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGoalDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={editingGoal ? handleUpdateGoal : handleCreateGoal}
                disabled={saving || !goalForm.categoryId || !goalForm.targetValue || !goalForm.targetDate}
              >
                {saving ? 'Saving...' : (editingGoal ? 'Update' : 'Add')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}

export default AthleteManagement;
