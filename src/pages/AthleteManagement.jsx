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
import { formatTimeValue, isTimeUnit, parsePerformanceValue } from '../utils/valueParser';
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
    // Auth state logging removed
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
      loadAthletes();
      loadCategories();
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
      // Get the selected category to determine the unit
      const selectedCategoryData = getCategory(goalForm.categoryId);

      // Parse the target value using the proper unit parsing
      const parsedValue = parsePerformanceValue(goalForm.targetValue.trim(), selectedCategoryData?.unit);

      await athletePerformanceService.createGoal(selectedAthlete.id, effectiveClubId, {
        ...goalForm,
        targetValue: parsedValue
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
        description: error.message || 'Failed to create goal',
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
      // Get the selected category to determine the unit
      const selectedCategoryData = getCategory(goalForm.categoryId);

      // Parse the target value using the proper unit parsing
      const parsedValue = parsePerformanceValue(goalForm.targetValue.trim(), selectedCategoryData?.unit);

      await athletePerformanceService.updateGoal(editingGoal.id, {
        ...goalForm,
        targetValue: parsedValue
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
        description: error.message || 'Failed to update goal',
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
        targetValue: isTimeUnit(getCategoryUnit(goal.categoryId))
          ? formatTimeValue(goal.targetValue)
          : goal.targetValue.toString(),
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

  const getCategory = (categoryId) => {
    return categories.find(c => c.id === categoryId) || null;
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
      <main className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold">Athlete Performance Management</h1>
          {adminMemberships.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 self-start sm:self-auto">
                <span className="text-sm text-muted-foreground">Managing:</span>
              {adminMemberships.length === 1 ? (
                  <Badge variant="outline" className="flex items-center gap-1 max-w-full w-fit">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                    {athletes.map((athlete) => (
                      <Button
                        key={athlete.id}
                        variant={selectedAthlete?.id === athlete.id ? "default" : "outline"}
                        className="justify-start h-auto p-3 sm:p-4 w-full text-left"
                        onClick={() => setSelectedAthlete(selectedAthlete?.id === athlete.id ? null : athlete)}
                      >
                        <div className="text-left min-w-0 w-full">
                          <div className="font-medium text-sm sm:text-base truncate">
                            {athlete.firstName && athlete.lastName 
                              ? `${athlete.firstName} ${athlete.lastName}`
                              : athlete.email
                            }
                          </div>
                          {athlete.sport && (
                            <div className="text-xs sm:text-sm text-muted-foreground truncate">{athlete.sport}</div>
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
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <Trophy className="h-5 w-5" />
                          Personal Records
                        </CardTitle>
                        <div className="text-sm text-muted-foreground mt-1">
                          {selectedAthlete.firstName && selectedAthlete.lastName
                            ? `${selectedAthlete.firstName} ${selectedAthlete.lastName}`
                            : selectedAthlete.email
                          }
                        </div>
                      </div>
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
                                            <div>
                        {/* Desktop Table View */}
                        <div className="hidden sm:block overflow-x-auto">
                          <Table className="min-w-full">
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
                                notes: pb.notes || '',
                                type: 'pb',
                                source: 'Test Result',
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
                                  <TableRow key={`${record.type}-${record.id}`} className={record.type === 'pb' ? 'bg-blue-50/30 dark:bg-blue-950/20' : 'bg-green-50/30 dark:bg-green-950/20'}>
                                    <TableCell className="truncate max-w-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{getCategoryName(record.categoryId)}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                          record.type === 'pb'
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200'
                                            : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200'
                                        }`}>
                                          {record.type === 'pb' ? 'Test' : 'Manual'}
                                        </span>
                                      </div>
                                    </TableCell>
                                  <TableCell>
                                      <div className={`font-mono font-semibold ${
                                        record.type === 'pb' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'
                                      }`}>
                                        {isTimeUnit(getCategoryUnit(record.categoryId))
                                          ? formatTimeValue(record.value)
                                          : record.value}
                                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">
                                          {getCategoryUnit(record.categoryId)}
                                        </span>
                                      </div>
                                  </TableCell>
                                  <TableCell>
                                      <div className="text-sm">
                                        {record.date ? new Date(record.date).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric'
                                        }) : 'No date'}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-col gap-1">
                                        <span className="text-sm text-gray-600">{record.source}</span>
                                        {record.notes && (
                                          <span className="text-xs text-gray-500 italic truncate max-w-xs">{record.notes}</span>
                                        )}
                                      </div>
                                    </TableCell>
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
                                        <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded">
                                          Auto-updated
                                        </span>
                                      )}
                                  </TableCell>
                                </TableRow>
                                ));
                              })()}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="sm:hidden space-y-3 -mx-1">
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
                                notes: pb.notes || '',
                                type: 'pb',
                                source: 'Test Result',
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
                              <div key={`${record.type}-${record.id}`} className={`border rounded-lg p-4 bg-white dark:bg-gray-900 shadow-sm mx-1 ${
                                record.type === 'pb' ? 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20' : 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20'
                              }`}>
                                {/* Category Title */}
                                <div className="text-center mb-2">
                                  <h4 className="font-semibold text-base mb-1 truncate">{getCategoryName(record.categoryId)}</h4>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    record.type === 'pb'
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200'
                                      : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200'
                                  }`}>
                                    {record.type === 'pb' ? 'Test Result' : 'Manual Entry'}
                                  </span>
                                </div>

                                {/* Performance Value */}
                                <div className="text-center mb-3">
                                  <div className={`font-mono text-xl font-bold mb-1 ${
                                    record.type === 'pb' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'
                                  }`}>
                                    {isTimeUnit(getCategoryUnit(record.categoryId))
                                      ? formatTimeValue(record.value)
                                      : record.value}
                                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">
                                      {getCategoryUnit(record.categoryId)}
                                    </span>
                                  </div>
                                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    record.type === 'pb'
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200'
                                      : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200'
                                  }`}>
                                    {record.type === 'pb' ? '🏆 Test PB' : '⭐ Personal Best'}
                                  </div>
                                </div>

                                {/* Date and Notes */}
                                <div className="text-center space-y-1">
                                  <span className="text-xs text-gray-500 dark:text-gray-400 block">
                                    {record.date ? new Date(record.date).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    }) : 'No date'}
                                  </span>
                                  {record.notes && (
                                    <p className="text-xs text-gray-600 dark:text-gray-300 italic truncate px-2">{record.notes}</p>
                                  )}
                                </div>

                                                                {/* Action Buttons for Mobile */}
                                {record.canEdit && (
                                  <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700 mt-3">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openRecordDialog(record)}
                                      className="flex-1 text-xs h-8"
                                    >
                                      <Edit className="h-3 w-3 mr-1" />
                                      Edit
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="flex-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 h-8"
                                        >
                                          <Trash2 className="h-3 w-3 mr-1" />
                                          Delete
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
                                )}
                              </div>
                            ));
                          })()}
                              </div>
                            </div>
                    )}
                  </CardContent>
                </Card>

                {/* Goals */}
                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <Target className="h-5 w-5" />
                          Goals
                        </CardTitle>
                        <div className="text-sm text-muted-foreground mt-1">
                          {selectedAthlete.firstName && selectedAthlete.lastName
                            ? `${selectedAthlete.firstName} ${selectedAthlete.lastName}`
                            : selectedAthlete.email
                          }
                        </div>
                      </div>
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
                                            <div>
                        {/* Desktop Table View */}
                        <div className="hidden sm:block overflow-x-auto">
                          <Table className="min-w-full">
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
                              {selectedAthleteGoals.map((goal) => {
                                // Find the current best performance for this category
                                const currentRecord = (() => {
                                  const allRawRecords = [
                                    ...selectedAthleteRecords.map(record => ({
                                      ...record,
                                      type: 'manual',
                                      source: 'Manual Entry'
                                    })),
                                    ...selectedAthletePBs.map(pb => ({
                                      id: pb.id,
                                      categoryId: pb.categoryId,
                                      value: pb.value,
                                      date: pb.date,
                                      type: 'pb',
                                      source: 'Test Result'
                                    }))
                                  ];

                                  const categoryRecords = allRawRecords.filter(record => record.categoryId === goal.categoryId);
                                  if (categoryRecords.length === 0) return null;

                                  const higherIsBetter = isHigherBetter(goal.categoryId);
                                  return categoryRecords.reduce((best, current) => {
                                    if (!best) return current;
                                    if (higherIsBetter) {
                                      return current.value > best.value ? current : best;
                                    } else {
                                      return current.value < best.value ? current : best;
                                    }
                                  });
                                })();

                                // Calculate progress
                                const targetDate = new Date(goal.targetDate);
                                const now = new Date();
                                const daysLeft = Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24));

                                let progress = 0;
                                let status = 'pending';
                                let statusColor = 'bg-gray-100 text-gray-700';

                                if (currentRecord) {
                                  const higherIsBetter = isHigherBetter(goal.categoryId);
                                  if (higherIsBetter) {
                                    progress = Math.min((currentRecord.value / goal.targetValue) * 100, 100);
                                    if (currentRecord.value >= goal.targetValue) {
                                      status = 'achieved';
                                      statusColor = 'bg-green-100 text-green-700';
                                    } else if (daysLeft < 0) {
                                      status = 'overdue';
                                      statusColor = 'bg-red-100 text-red-700';
                                    } else {
                                      status = 'on-track';
                                      statusColor = 'bg-blue-100 text-blue-700';
                                    }
                                  } else {
                                    progress = Math.min((goal.targetValue / currentRecord.value) * 100, 100);
                                    if (currentRecord.value <= goal.targetValue) {
                                      status = 'achieved';
                                      statusColor = 'bg-green-100 text-green-700';
                                    } else if (daysLeft < 0) {
                                      status = 'overdue';
                                      statusColor = 'bg-red-100 text-red-700';
                                    } else {
                                      status = 'on-track';
                                      statusColor = 'bg-blue-100 text-blue-700';
                                    }
                                  }
                                } else if (daysLeft < 0) {
                                  status = 'overdue';
                                  statusColor = 'bg-red-100 text-red-700';
                                }

                                return (
                                  <TableRow key={goal.id} className={
                                    status === 'achieved' ? 'bg-green-50/30 dark:bg-green-950/20' :
                                    status === 'overdue' ? 'bg-red-50/30 dark:bg-red-950/20' :
                                    status === 'on-track' ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
                                  }>
                                    <TableCell className="truncate max-w-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{getCategoryName(goal.categoryId)}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                          status === 'achieved' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200' :
                                          status === 'overdue' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200' :
                                          status === 'on-track' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200' :
                                          'bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-200'
                                        }`}>
                                          {status === 'achieved' ? '✓ Achieved' :
                                           status === 'overdue' ? '⚠ Overdue' :
                                           status === 'on-track' ? '📈 On Track' : '⏳ Pending'}
                                        </span>
                                      </div>
                                    </TableCell>
                                  <TableCell>
                                        <div className="space-y-1">
                                        <div className="font-mono font-semibold">
                                    {isTimeUnit(getCategoryUnit(goal.categoryId))
                                      ? formatTimeValue(goal.targetValue)
                                      : goal.targetValue} {getCategoryUnit(goal.categoryId)}
                                        </div>
                                        {currentRecord && (
                                          <div className="text-xs text-gray-500">
                                            Current: {isTimeUnit(getCategoryUnit(goal.categoryId))
                                              ? formatTimeValue(currentRecord.value)
                                              : currentRecord.value} {getCategoryUnit(goal.categoryId)}
                                          </div>
                                        )}
                                      </div>
                                  </TableCell>
                                    <TableCell>
                                      <div className="space-y-1">
                                        <div className="text-sm">
                                          {targetDate.toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                          })}
                                        </div>
                                        {daysLeft > 0 && (
                                          <div className="text-xs text-blue-600 font-medium">
                                            {daysLeft} days left
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="space-y-1">
                                        {currentRecord && (
                                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div
                                              className={`h-2 rounded-full transition-all duration-300 ${
                                                status === 'achieved' ? 'bg-green-500 dark:bg-green-400' :
                                                status === 'overdue' ? 'bg-red-500 dark:bg-red-400' :
                                                'bg-blue-500 dark:bg-blue-400'
                                              }`}
                                              style={{ width: `${progress}%` }}
                                            ></div>
                                          </div>
                                        )}
                                        {currentRecord && (
                                          <div className="text-xs text-gray-600 dark:text-gray-300 text-center mt-1">
                                            {Math.round(progress)}% complete
                                          </div>
                                        )}
                                        {goal.notes && (
                                          <div className="text-xs text-gray-500 dark:text-gray-400 italic truncate max-w-xs mt-2">
                                            {goal.notes}
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
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
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="sm:hidden space-y-3 -mx-1">
                          {selectedAthleteGoals.map((goal) => {
                            // Find the current best performance for this category
                            const currentRecord = (() => {
                              const allRawRecords = [
                                ...selectedAthleteRecords.map(record => ({
                                  ...record,
                                  type: 'manual',
                                  source: 'Manual Entry'
                                })),
                                ...selectedAthletePBs.map(pb => ({
                                  id: pb.id,
                                  categoryId: pb.categoryId,
                                  value: pb.value,
                                  date: pb.date,
                                  type: 'pb',
                                  source: 'Test Result'
                                }))
                              ];

                              const categoryRecords = allRawRecords.filter(record => record.categoryId === goal.categoryId);
                              if (categoryRecords.length === 0) return null;

                              const higherIsBetter = isHigherBetter(goal.categoryId);
                              return categoryRecords.reduce((best, current) => {
                                if (!best) return current;
                                if (higherIsBetter) {
                                  return current.value > best.value ? current : best;
                                } else {
                                  return current.value < best.value ? current : best;
                                }
                              });
                            })();

                            // Calculate progress
                            const targetDate = new Date(goal.targetDate);
                            const now = new Date();
                            const daysLeft = Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24));

                            let status = 'pending';
                            let statusColor = 'bg-gray-100 text-gray-700';

                            if (currentRecord) {
                              const higherIsBetter = isHigherBetter(goal.categoryId);
                              if (higherIsBetter) {
                                if (currentRecord.value >= goal.targetValue) {
                                  status = 'achieved';
                                  statusColor = 'bg-green-100 text-green-700';
                                } else if (daysLeft < 0) {
                                  status = 'overdue';
                                  statusColor = 'bg-red-100 text-red-700';
                                } else {
                                  status = 'on-track';
                                  statusColor = 'bg-blue-100 text-blue-700';
                                }
                              } else {
                                if (currentRecord.value <= goal.targetValue) {
                                  status = 'achieved';
                                  statusColor = 'bg-green-100 text-green-700';
                                } else if (daysLeft < 0) {
                                  status = 'overdue';
                                  statusColor = 'bg-red-100 text-red-700';
                                } else {
                                  status = 'on-track';
                                  statusColor = 'bg-blue-100 text-blue-700';
                                }
                              }
                            } else if (daysLeft < 0) {
                              status = 'overdue';
                              statusColor = 'bg-red-100 text-red-700';
                            }

                            return (
                              <div key={goal.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900 shadow-sm mx-1">
                                {/* Category Title */}
                                <div className="text-center mb-2">
                                  <h4 className="font-semibold text-base mb-1 truncate">{getCategoryName(goal.categoryId)}</h4>
                                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    status === 'achieved' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200' :
                                    status === 'overdue' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200' :
                                    status === 'on-track' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200' :
                                    'bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-200'
                                  }`}>
                                    {status === 'achieved' ? '🎉 Achieved' :
                                     status === 'overdue' ? '⚠️ Overdue' :
                                     status === 'on-track' ? '📈 On Track' : '⏳ Pending'}
                                  </div>
                                </div>

                                {/* Target Value */}
                                <div className="text-center mb-3">
                                  <div className="font-mono text-xl font-bold mb-1 text-gray-700 dark:text-gray-200">
                                    {isTimeUnit(getCategoryUnit(goal.categoryId))
                                      ? formatTimeValue(goal.targetValue)
                                      : goal.targetValue}
                                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">
                                      {getCategoryUnit(goal.categoryId)}
                                    </span>
                                  </div>

                                </div>



                                {/* Due Date and Notes */}
                                <div className="text-center space-y-1">
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Due: {targetDate.toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}
                                    {daysLeft > 0 && (
                                      <span className="text-blue-600 dark:text-blue-400 font-medium ml-2">
                                        • {daysLeft} days left
                                      </span>
                                    )}
                                  </div>
                                  {goal.notes && (
                                    <p className="text-xs text-gray-600 dark:text-gray-300 italic truncate px-2">{goal.notes}</p>
                                  )}
                                </div>



                                {/* Action Buttons for Mobile */}
                                <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700 mt-3">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openGoalDialog(goal)}
                                    className="flex-1 text-xs h-8"
                                  >
                                    <Edit className="h-3 w-3 mr-1" />
                                    Edit
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 h-8"
                                      >
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        Delete
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
                              </div>
                            );
                          })}
                              </div>
                            </div>
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
          <DialogContent className="sm:max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-6">
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
            <div className="space-y-4 pt-2 pb-4">
              <div className="space-y-2">
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
              <div className="space-y-2">
                <Label htmlFor="recordValue">Value</Label>
                <Input
                  id="recordValue"
                  type={isTimeUnit(getCategoryUnit(recordForm.categoryId)) ? "text" : "number"}
                  step={isTimeUnit(getCategoryUnit(recordForm.categoryId)) ? undefined : "0.01"}
                  placeholder={isTimeUnit(getCategoryUnit(recordForm.categoryId)) ? "e.g., 2:30.00, 1:45" : "e.g., 100, 4.15"}
                  value={recordForm.value}
                  onChange={(e) => setRecordForm(prev => ({ ...prev, value: e.target.value }))}
                />
                {recordForm.categoryId && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Unit: {getCategoryUnit(recordForm.categoryId) || 'Not selected'}
                    {isTimeUnit(getCategoryUnit(recordForm.categoryId)) && ' (use format: MM:SS.ms or seconds)'}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="recordDate">Date</Label>
                <Input
                  id="recordDate"
                  type="date"
                  value={recordForm.date}
                  onChange={(e) => setRecordForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recordNotes">Notes (optional)</Label>
                <Textarea
                  id="recordNotes"
                  placeholder="Additional notes about this record"
                  value={recordForm.notes}
                  onChange={(e) => setRecordForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:gap-3 pt-6">
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
          <DialogContent className="sm:max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-6">
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
            <div className="space-y-4 pt-2 pb-4">
              <div className="space-y-2">
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
              <div className="space-y-2">
                <Label htmlFor="goalTarget">Target Value</Label>
                <Input
                  id="goalTarget"
                  type={isTimeUnit(getCategoryUnit(goalForm.categoryId)) ? "text" : "number"}
                  step={isTimeUnit(getCategoryUnit(goalForm.categoryId)) ? undefined : "0.01"}
                  placeholder={isTimeUnit(getCategoryUnit(goalForm.categoryId)) ? "e.g., 2:30.00, 1:45" : "e.g., 120, 3.45"}
                  value={goalForm.targetValue}
                  onChange={(e) => setGoalForm(prev => ({ ...prev, targetValue: e.target.value }))}
                />
                {goalForm.categoryId && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Unit: {getCategoryUnit(goalForm.categoryId) || 'Not selected'}
                    {isTimeUnit(getCategoryUnit(goalForm.categoryId)) && ' (use format: MM:SS.ms or seconds)'}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="goalDate">Target Date</Label>
                <Input
                  id="goalDate"
                  type="date"
                  value={goalForm.targetDate}
                  onChange={(e) => setGoalForm(prev => ({ ...prev, targetDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goalNotes">Notes (optional)</Label>
                <Textarea
                  id="goalNotes"
                  placeholder="Additional notes about this goal"
                  value={goalForm.notes}
                  onChange={(e) => setGoalForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:gap-3 pt-6">
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
