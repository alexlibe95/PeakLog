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
import { Shield, Users, Plus, Edit, Trash2, Target, Trophy, Calendar, TrendingUp } from 'lucide-react';

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
  const [categories, setCategories] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [selectedAthleteRecords, setSelectedAthleteRecords] = useState([]);
  const [selectedAthleteGoals, setSelectedAthleteGoals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);

  // Form states
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', unit: '' });
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

  const loadCategories = async () => {
    if (!effectiveClubId) return;
    
    try {
      console.log('🔍 Loading categories for club:', effectiveClubId);
      const clubCategories = await performanceCategoryService.getClubCategories(effectiveClubId);
      console.log('✅ Categories loaded:', clubCategories);
      setCategories(clubCategories);
    } catch (error) {
      console.error('❌ Error loading categories:', error);
      toast({
        title: 'Error loading performance categories',
        description: error.message,
        variant: 'destructive'
      });
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
    } catch (error) {
      console.error('Error loading athlete data:', error);
      toast({
        title: 'Error loading athlete performance data',
        variant: 'destructive'
      });
    }
  };

  // Category management
  const handleCreateCategory = async () => {
    if (!effectiveClubId || !categoryForm.name.trim()) return;
    
    setSaving(true);
    try {
      console.log('🔧 Creating category:', { effectiveClubId, categoryForm });
      const newCategory = await performanceCategoryService.createCategory(effectiveClubId, categoryForm);
      console.log('✅ Category created:', newCategory);
      
      await loadCategories();
      setCategoryForm({ name: '', description: '', unit: '' });
      setCategoryDialogOpen(false);
      toast({
        title: 'Category created successfully',
        description: `"${categoryForm.name}" has been added to your categories`
      });
    } catch (error) {
      console.error('❌ Error creating category:', error);
      toast({
        title: 'Error creating category',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !categoryForm.name.trim()) return;
    
    setSaving(true);
    try {
      await performanceCategoryService.updateCategory(editingCategory.id, categoryForm);
      await loadCategories();
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '', unit: '' });
      setCategoryDialogOpen(false);
      toast({
        title: 'Category updated successfully'
      });
    } catch (error) {
      console.error('Error updating category:', error);
      toast({
        title: 'Error updating category',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    setSaving(true);
    try {
      await performanceCategoryService.deleteCategory(categoryId);
      await loadCategories();
      toast({
        title: 'Category deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: 'Error deleting category',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
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
  const openCategoryDialog = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description || '',
        unit: category.unit || ''
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '', unit: '' });
    }
    setCategoryDialogOpen(true);
  };

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

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Athlete Performance Management</h1>
          {adminMemberships.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Managing:</span>
              {adminMemberships.length === 1 ? (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {adminMemberships[0].clubName}
                </Badge>
              ) : (
                <Select value={selectedAdminClubId} onValueChange={setSelectedAdminClubId}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {adminMemberships.map((membership) => (
                      <SelectItem key={membership.clubId} value={membership.clubId}>
                        <div className="flex items-center gap-2">
                          <Shield className="h-3 w-3" />
                          {membership.clubName}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Performance Categories Section */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Performance Categories
                  </CardTitle>
                  <Button size="sm" onClick={() => openCategoryDialog()}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                <CardDescription>
                  Manage exercise categories like bench press, 1000m time, etc.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {categories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No categories yet</p>
                    <p className="text-sm mt-1">Create your first performance category</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <div key={category.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{category.name}</div>
                          {category.unit && (
                            <div className="text-sm text-muted-foreground">Unit: {category.unit}</div>
                          )}
                          {category.description && (
                            <div className="text-sm text-muted-foreground">{category.description}</div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openCategoryDialog(category)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Category</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{category.name}"? This will also delete all related records and goals.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteCategory(category.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Athletes and Performance Data Section */}
          <div className="lg:col-span-2 space-y-6">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {athletes.map((athlete) => (
                      <Button
                        key={athlete.id}
                        variant={selectedAthlete?.id === athlete.id ? "default" : "outline"}
                        className="justify-start h-auto p-4"
                        onClick={() => setSelectedAthlete(athlete)}
                      >
                        <div className="text-left">
                          <div className="font-medium">
                            {athlete.firstName && athlete.lastName 
                              ? `${athlete.firstName} ${athlete.lastName}`
                              : athlete.email
                            }
                          </div>
                          {athlete.sport && (
                            <div className="text-sm text-muted-foreground">{athlete.sport}</div>
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
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5" />
                        Personal Records - {selectedAthlete.firstName && selectedAthlete.lastName 
                          ? `${selectedAthlete.firstName} ${selectedAthlete.lastName}`
                          : selectedAthlete.email
                        }
                      </CardTitle>
                      <Button size="sm" onClick={() => openRecordDialog()} disabled={categories.length === 0}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Record
                      </Button>
                    </div>
                    <CardDescription>
                      Track personal bests across different performance categories
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedAthleteRecords.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No personal records yet</p>
                        <p className="text-sm mt-1">Add the athlete's first personal record</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedAthleteRecords.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell>{getCategoryName(record.categoryId)}</TableCell>
                              <TableCell>
                                {record.value} {getCategoryUnit(record.categoryId)}
                              </TableCell>
                              <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                              <TableCell>{record.notes || '-'}</TableCell>
                              <TableCell>
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
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Record</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this personal record?
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteRecord(record.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
                    )}
                  </CardContent>
                </Card>

                {/* Goals */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Goals - {selectedAthlete.firstName && selectedAthlete.lastName 
                          ? `${selectedAthlete.firstName} ${selectedAthlete.lastName}`
                          : selectedAthlete.email
                        }
                      </CardTitle>
                      <Button size="sm" onClick={() => openGoalDialog()} disabled={categories.length === 0}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Goal
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
                              <TableCell>{getCategoryName(goal.categoryId)}</TableCell>
                              <TableCell>
                                {goal.targetValue} {getCategoryUnit(goal.categoryId)}
                              </TableCell>
                              <TableCell>{new Date(goal.targetDate).toLocaleDateString()}</TableCell>
                              <TableCell>{goal.notes || '-'}</TableCell>
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
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Goal</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this goal?
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteGoal(goal.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Dialogs */}
        
        {/* Category Dialog */}
        <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? 'Edit Category' : 'Create Performance Category'}
              </DialogTitle>
              <DialogDescription>
                {editingCategory 
                  ? 'Update the performance category details'
                  : 'Create a new performance category like "Bench Press" or "1000m Time"'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="categoryName">Category Name</Label>
                <Input
                  id="categoryName"
                  placeholder="e.g., Bench Press, 1000m Time"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="categoryUnit">Unit (optional)</Label>
                <Input
                  id="categoryUnit"
                  placeholder="e.g., kg, minutes, seconds"
                  value={categoryForm.unit}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, unit: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="categoryDescription">Description (optional)</Label>
                <Textarea
                  id="categoryDescription"
                  placeholder="Additional details about this category"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}
                disabled={saving || !categoryForm.name.trim()}
              >
                {saving ? 'Saving...' : (editingCategory ? 'Update' : 'Create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
      </main>
    </div>
  );
}

export default AthleteManagement;
