import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast-context';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/context/AuthContext';
import { performanceCategoryService } from '@/services/performanceCategoryService';
import { testService } from '@/services/testService';
import { clubService } from '@/services/clubService';
import { parsePerformanceValue, formatTimeValue, isTimeUnit } from '@/utils/valueParser';
import { Plus, Calendar, Target, TrendingUp, ChevronDown, ChevronUp, Save, Users, Edit, X, Check, Trash2 } from 'lucide-react';

const Testing = () => {
  const { user, currentClubId, memberships } = useAuth();
  const { toast } = useToast();

  // State management
  const [categories, setCategories] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingPastTests, setLoadingPastTests] = useState(false);

  // Current test state
  const [selectedCategory, setSelectedCategory] = useState('');
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [testNotes, setTestNotes] = useState('');
  const [athleteResults, setAthleteResults] = useState({});

  // Past tests state
  const [pastTests, setPastTests] = useState([]);
  const [expandedTests, setExpandedTests] = useState(new Set());

  // Editing state
  const [editingTest, setEditingTest] = useState(null);
  const [editingTestData, setEditingTestData] = useState({
    categoryId: '',
    date: '',
    notes: '',
    results: {}
  });

  // Get effective club ID
  const getEffectiveClubId = () => {
    if (currentClubId) return currentClubId;
    const adminMembership = memberships.find(m => m.role === 'admin');
    return adminMembership?.clubId || '';
  };

  const effectiveClubId = getEffectiveClubId();


  // Load initial data
  const loadData = useCallback(async () => {
    if (!effectiveClubId) return;

    setLoading(true);
    try {
      // Load categories
      const clubCategories = await performanceCategoryService.getClubCategories(effectiveClubId);
      setCategories(clubCategories);

      // Load athletes - try multiple methods
      let athleteMembers = [];

      try {
        // First try to get members with details
        const clubAthletes = await clubService.getClubMembersWithDetails(effectiveClubId);
        athleteMembers = clubAthletes.filter(member => member.role === 'athlete');
      } catch (error) {
        // Fallback to basic member list
        try {
          const clubAthletes = await clubService.listMembers(effectiveClubId);
          athleteMembers = clubAthletes.filter(member => member.role === 'athlete');
        } catch (fallbackError) {
          // Silently handle fallback error
        }
      }

      setAthletes(athleteMembers);

      // Load past tests
      setLoadingPastTests(true);
      try {
        const tests = await testService.getTestSessionsWithResults(effectiveClubId);
        setPastTests(tests);
      } finally {
        setLoadingPastTests(false);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error loading data',
        description: 'Failed to load test data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setLoadingPastTests(false); // Ensure past tests loading state is also reset
    }
  }, [effectiveClubId, toast]);

  useEffect(() => {
    if (effectiveClubId) {
      loadData();
    }
  }, [effectiveClubId, loadData]);

  // Handle athlete result input
  const handleAthleteResultChange = (athleteId, value) => {
    setAthleteResults(prev => ({
      ...prev,
      [athleteId]: value
    }));
  };

  // Save current test
  const handleSaveTest = async () => {
    if (!selectedCategory || !testDate) {
      toast({
        title: 'Missing information',
        description: 'Please select a category and date for the test.',
        variant: 'destructive'
      });
      return;
    }

    const hasResults = Object.values(athleteResults).some(result => result && result.trim() !== '');
    if (!hasResults) {
      toast({
        title: 'No results entered',
        description: 'Please enter at least one athlete result.',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      // Create test session
      const testSession = await testService.createTestSession(effectiveClubId, {
        categoryId: selectedCategory,
        date: new Date(testDate),
        notes: testNotes || '',
        createdBy: user?.uid
      });

      // Add results for athletes who have values - batch them all together
      const selectedCategoryData = getCategory(selectedCategory);
      const results = Object.entries(athleteResults)
        .filter(([_, result]) => result && result.trim() !== '')
        .map(([athleteId, result]) => {
          try {
            const parsedValue = parsePerformanceValue(result.trim(), selectedCategoryData?.unit);
            return {
              athleteId,
              value: parsedValue,
              categoryId: selectedCategory
            };
          } catch (error) {
            console.error(`Error parsing value for athlete ${athleteId}:`, error.message);
            toast({
              title: 'Invalid value format',
              description: `Please check the format for athlete result: ${error.message}`,
              variant: 'destructive'
            });
            throw error;
          }
        });

      if (results.length > 0) {
        await testService.addTestResults(testSession.id, results, effectiveClubId);
      }

      // Update athlete PBs and goals
      await Promise.all(
        Object.entries(athleteResults)
          .filter(([_, result]) => result && result.trim() !== '')
          .map(([athleteId, result]) => {
            const parsedValue = parsePerformanceValue(result.trim(), selectedCategoryData?.unit);
            return testService.updateAthletePBIfBetter(athleteId, selectedCategory, parsedValue, testSession.id);
          })
      );

      await Promise.all(
        Object.entries(athleteResults)
          .filter(([_, result]) => result && result.trim() !== '')
          .map(([athleteId, result]) => {
            const parsedValue = parsePerformanceValue(result.trim(), selectedCategoryData?.unit);
            return testService.checkAndUpdateGoals(athleteId, selectedCategory, parsedValue, testSession.id);
          })
      );

      toast({
        title: 'Test saved successfully',
        description: 'Athlete results have been recorded and PBs/goals updated.'
      });

      // Reset form
      setSelectedCategory('');
      setTestDate(new Date().toISOString().split('T')[0]);
      setTestNotes('');
      setAthleteResults({});

      // Reload data
      await loadData();

    } catch (error) {
      console.error('Error saving test:', error);
      toast({
        title: 'Error saving test',
        description: error.message || 'Failed to save test results.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Toggle test expansion
  const toggleTestExpansion = (testId) => {
    setExpandedTests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(testId)) {
        newSet.delete(testId);
      } else {
        newSet.add(testId);
      }
      return newSet;
    });
  };

  // Start editing a test
  const startEditingTest = (test) => {
    // Format date properly
    let formattedDate = '';
    try {
      if (test.date && test.date.seconds) {
        formattedDate = new Date(test.date.seconds * 1000).toISOString().split('T')[0];
      } else if (test.date instanceof Date) {
        formattedDate = test.date.toISOString().split('T')[0];
      } else if (typeof test.date === 'string') {
        formattedDate = new Date(test.date).toISOString().split('T')[0];
      }
    } catch (error) {
      formattedDate = new Date().toISOString().split('T')[0];
    }

    // Prepare results data
    const resultsData = {};
    if (test.results) {
      test.results.forEach(result => {
        resultsData[result.athleteId] = result.value.toString();
      });
    }

    setEditingTest(test);
    setEditingTestData({
      categoryId: test.categoryId,
      date: formattedDate,
      notes: test.notes || '',
      results: resultsData
    });

    // Auto-expand the test being edited
    setExpandedTests(prev => new Set([...prev, test.id]));
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingTest(null);
    setEditingTestData({
      categoryId: '',
      date: '',
      notes: '',
      results: {}
    });
  };

  // Handle editing test data changes
  const handleEditingTestChange = (field, value) => {
    setEditingTestData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle editing athlete result changes
  const handleEditingResultChange = (athleteId, value) => {
    setEditingTestData(prev => ({
      ...prev,
      results: {
        ...prev.results,
        [athleteId]: value
      }
    }));
  };

  // Delete test with all related data
  const deleteTest = async (test) => {
    if (!window.confirm(`Are you sure you want to delete this test? This will also delete all results, personal records, and completed goals from this test. This action cannot be undone.`)) {
      return;
    }

    setSaving(true);
    try {
      console.log('🗑️ Deleting test:', test.id);

      // Delete all test results for this test
      console.log('🗑️ Deleting test results...');
      await testService.deleteTestResults(test.id);

      // Delete the test session itself
      console.log('🗑️ Deleting test session...');
      await testService.deleteTestSession(test.id);

      // Delete personal records that were set from this test
      if (test.results && test.results.length > 0) {
        console.log('🗑️ Deleting related personal records...');
        for (const result of test.results) {
          try {
            await testService.deletePersonalRecordsFromTest(test.id, result.athleteId, test.categoryId);
          } catch (error) {
            console.error(`Error deleting PB for athlete ${result.athleteId}:`, error);
          }
        }
      }

      // Delete goals that were completed from this test
      if (test.results && test.results.length > 0) {
        console.log('🗑️ Deleting related goals...');
        for (const result of test.results) {
          try {
            await testService.deleteGoalsFromTest(test.id, result.athleteId, test.categoryId);
          } catch (error) {
            console.error(`Error deleting goals for athlete ${result.athleteId}:`, error);
          }
        }
      }

      toast({
        title: 'Test deleted successfully',
        description: 'Test and all related data have been deleted.'
      });

      // Reset editing state and reload data
      cancelEditing();
      await loadData();

    } catch (error) {
      console.error('❌ Error deleting test:', error);
      toast({
        title: 'Error deleting test',
        description: error.message || 'Failed to delete test.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Save edited test
  const saveEditedTest = async () => {
    if (!editingTest || !editingTestData.categoryId || !editingTestData.date) {
      toast({
        title: 'Missing information',
        description: 'Please select a category and date for the test.',
        variant: 'destructive'
      });
      return;
    }

    const hasResults = Object.values(editingTestData.results).some(result => result && result.trim() !== '');
    if (!hasResults) {
      toast({
        title: 'No results entered',
        description: 'Please enter at least one athlete result.',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      // Update test session
      await testService.updateTestSession(editingTest.id, {
        categoryId: editingTestData.categoryId,
        date: new Date(editingTestData.date),
        notes: editingTestData.notes || ''
      });

      // Update results - delete existing and add new ones
      const editingCategoryData = getCategory(editingTestData.categoryId);
      await testService.updateTestResults(editingTest.id, Object.entries(editingTestData.results)
        .filter(([_, result]) => result && result.trim() !== '')
        .map(([athleteId, result]) => {
          try {
            const parsedValue = parsePerformanceValue(result.trim(), editingCategoryData?.unit);
            return {
              athleteId,
              value: parsedValue,
              categoryId: editingTestData.categoryId
            };
          } catch (error) {
            console.error(`Error parsing value for athlete ${athleteId}:`, error.message);
            toast({
              title: 'Invalid value format',
              description: `Please check the format for athlete result: ${error.message}`,
              variant: 'destructive'
            });
            throw error;
          }
        }), effectiveClubId);

      // Update athlete PBs and goals for new results
      await Promise.all(
        Object.entries(editingTestData.results)
          .filter(([_, result]) => result && result.trim() !== '')
          .map(([athleteId, result]) => {
            const parsedValue = parsePerformanceValue(result.trim(), editingCategoryData?.unit);
            return testService.updateAthletePBIfBetter(athleteId, editingTestData.categoryId, parsedValue, editingTest.id);
          })
      );

      await Promise.all(
        Object.entries(editingTestData.results)
          .filter(([_, result]) => result && result.trim() !== '')
          .map(([athleteId, result]) => {
            const parsedValue = parsePerformanceValue(result.trim(), editingCategoryData?.unit);
            return testService.checkAndUpdateGoals(athleteId, editingTestData.categoryId, parsedValue, editingTest.id);
          })
      );

      toast({
        title: 'Test updated successfully',
        description: 'Test results have been updated and PBs/goals checked.'
      });

      // Reset editing state
      cancelEditing();

      // Reload data
      await loadData();

    } catch (error) {
      console.error('Error updating test:', error);
      toast({
        title: 'Error updating test',
        description: error.message || 'Failed to update test results.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Get category name
  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown Category';
  };

  // Get category unit
  const getCategoryUnit = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.unit : '';
  };

  // Get category by ID
  const getCategory = (categoryId) => {
    return categories.find(c => c.id === categoryId);
  };



  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Test Limits</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Record and track athlete performance peaks and test results
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Current Test Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Current Test
                </CardTitle>
                <CardDescription>
                  Record a new performance test for your athletes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Test Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-sm font-medium">Performance Category *</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select category" />
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
                    <Label htmlFor="date" className="text-sm font-medium">Test Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={testDate}
                      onChange={(e) => setTestDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm font-medium">Test Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any notes about this test session..."
                    value={testNotes}
                    onChange={(e) => setTestNotes(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                {/* Athlete Results */}
                {selectedCategory && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        <Label className="text-sm sm:text-base font-medium">Athlete Results</Label>
                      </div>
                      <Badge variant="outline" className="text-xs self-start">
                        {getCategoryName(selectedCategory)}
                        {getCategoryUnit(selectedCategory) && ` (${getCategoryUnit(selectedCategory)})`}
                      </Badge>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {athletes.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                          <p>No athletes found in this club</p>
                          <p className="text-sm">Make sure athletes are assigned to your club</p>
                        </div>
                      ) : (
                        athletes.map((athlete, index) => (
                          <div key={athlete.id || `athlete-${index}`} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/50 rounded-lg">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {athlete.firstName || athlete.email || 'Unknown'} {athlete.lastName || ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                              <div className="w-20 sm:w-24">
                                <Input
                                  type={isTimeUnit(getCategoryUnit(selectedCategory)) ? "text" : "number"}
                                  step={isTimeUnit(getCategoryUnit(selectedCategory)) ? undefined : "0.01"}
                                  placeholder={isTimeUnit(getCategoryUnit(selectedCategory)) ? "0:00.00" : "0.00"}
                                  value={athleteResults[athlete.id] || ''}
                                  onChange={(e) => handleAthleteResultChange(athlete.id, e.target.value)}
                                  className="text-right text-sm h-8 sm:h-9"
                                />
                              </div>
                              <span className="text-xs sm:text-sm text-muted-foreground min-w-6 sm:min-w-8 text-center">
                                {getCategoryUnit(selectedCategory)}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleSaveTest}
                  disabled={saving || !selectedCategory}
                  className="w-full"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saving ? 'Saving Test...' : 'Save Test Results'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Past Tests Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Past Tests
                </CardTitle>
                <CardDescription>
                  View previous test results and athlete performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPastTests ? (
                  <div className="text-center py-6 sm:py-8 px-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3 sm:mb-4"></div>
                    <p className="text-sm sm:text-base text-muted-foreground">Loading past tests...</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">Fetching test results</p>
                  </div>
                ) : pastTests.length === 0 ? (
                  <div className="text-center py-6 sm:py-8 px-4">
                    <Target className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
                    <p className="text-sm sm:text-base text-muted-foreground">No tests recorded yet</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">Create your first test to see results here</p>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {pastTests.map((test) => (
                      <Card key={test.id} className={`border overflow-hidden ${editingTest?.id === test.id ? 'ring-2 ring-blue-500 bg-blue-50/30' : ''}`}>
                        <CardHeader className="pb-3">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <CardTitle className="text-base sm:text-lg">
                                    {editingTest?.id === test.id ? (
                                      <Select
                                        value={editingTestData.categoryId}
                                        onValueChange={(value) => handleEditingTestChange('categoryId', value)}
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {categories.map((category) => (
                                            <SelectItem key={category.id} value={category.id}>
                                              {category.name} {category.unit && `(${category.unit})`}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <span className="break-words">{getCategoryName(test.categoryId)}</span>
                                    )}
                                    </CardTitle>
                                    {editingTest?.id === test.id && (
                                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                        Editing
                                      </Badge>
                                    )}
                                  </div>
                                  <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                                      <span className="text-xs sm:text-sm">
                                        {editingTest?.id === test.id ? (
                                          <Input
                                            type="date"
                                            value={editingTestData.date}
                                            onChange={(e) => handleEditingTestChange('date', e.target.value)}
                                            className="h-7 sm:h-8 text-xs sm:text-sm w-32 sm:w-auto"
                                          />
                                        ) : (
                                          (() => {
                                            try {
                                              // Handle Firestore Timestamp
                                              if (test.date && test.date.seconds) {
                                                return new Date(test.date.seconds * 1000).toLocaleDateString();
                                              }
                                              // Handle JavaScript Date object
                                              if (test.date instanceof Date) {
                                                return test.date.toLocaleDateString();
                                              }
                                              // Handle date string
                                              if (typeof test.date === 'string') {
                                                return new Date(test.date).toLocaleDateString();
                                              }
                                              return 'Invalid date';
                                                                                    } catch (error) {
                                              return 'Invalid date';
                                            }
                                          })()
                                        )}
                                      </span>
                                    </div>
                                  </CardDescription>
                                </div>
                                <div className="flex items-center gap-1 self-end sm:self-start">
                                  {editingTest?.id !== test.id && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => startEditingTest(test)}
                                        className="flex items-center gap-1 h-8 px-2"
                                      >
                                        <Edit className="h-3 w-3" />
                                        <span className="text-xs font-medium hidden sm:inline">Edit</span>
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleTestExpansion(test.id)}
                                        className="h-8 w-8 p-0"
                                      >
                                        {expandedTests.has(test.id) ? (
                                          <ChevronUp className="h-4 w-4" />
                                        ) : (
                                          <ChevronDown className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </>
                                  )}
                                </div>
                          </div>
                        </CardHeader>

                          {test.notes && (
                            <div className="px-6 pb-3">
                              {editingTest?.id === test.id ? (
                                <Textarea
                                  placeholder="Add notes about this test session..."
                                  value={editingTestData.notes}
                                  onChange={(e) => handleEditingTestChange('notes', e.target.value)}
                                  rows={2}
                                  className="resize-none text-sm"
                                />
                              ) : (
                                <p className="text-sm text-muted-foreground leading-relaxed">{test.notes}</p>
                              )}
                            </div>
                          )}

                                                    {expandedTests.has(test.id) && (
                            <>
                              <CardContent className="pt-0">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm font-medium">
                                    <Users className="h-4 w-4" />
                                    Results ({editingTest?.id === test.id ? Object.keys(editingTestData.results).filter(key => editingTestData.results[key] && editingTestData.results[key].trim() !== '').length : (test.results?.length || 0)} athletes)
                                  </div>
                                  {editingTest?.id === test.id ? (
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 text-sm font-medium">
                                        <Target className="h-4 w-4" />
                                        <Label>Edit Results</Label>
                                      </div>
                                      <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {athletes.length === 0 ? (
                                          <div className="text-center py-4 text-muted-foreground">
                                            <p>No athletes found in this club</p>
                                          </div>
                                        ) : (
                                          athletes.map((athlete, index) => (
                                            <div key={athlete.id || `athlete-${index}`} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/50 rounded-lg">
                                              <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">
                                                  {athlete.firstName || athlete.email || 'Unknown'} {athlete.lastName || ''}
                                                </p>
                                              </div>
                                              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                                <div className="w-20 sm:w-24">
                                                  <Input
                                                    type={isTimeUnit(getCategoryUnit(editingTestData.categoryId)) ? "text" : "number"}
                                                    step={isTimeUnit(getCategoryUnit(editingTestData.categoryId)) ? undefined : "0.01"}
                                                    placeholder={isTimeUnit(getCategoryUnit(editingTestData.categoryId)) ? "0:00.00" : "0.00"}
                                                    value={editingTestData.results[athlete.id] || ''}
                                                    onChange={(e) => handleEditingResultChange(athlete.id, e.target.value)}
                                                    className="text-right text-sm h-8 sm:h-9"
                                                  />
                                                </div>
                                                <span className="text-xs sm:text-sm text-muted-foreground min-w-6 sm:min-w-8 text-center">
                                                  {getCategoryUnit(editingTestData.categoryId)}
                                                </span>
                                              </div>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    test.results && test.results.length > 0 ? (
                                      <div className="space-y-1">
                                        {test.results.map((result, index) => {
                                          return (
                                            <div key={index} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/50 rounded-lg">
                                              <div className="flex flex-col flex-1 min-w-0">
                                                <span className="text-sm font-medium truncate">
                                                  {result.athleteName || 'Unknown Athlete'}
                                                </span>
                                                {result.email && result.email !== result.athleteName && (
                                                  <span className="text-xs text-muted-foreground truncate">
                                                    {result.email}
                                                  </span>
                                                )}
                                                </div>
                                              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                                <span className="font-mono text-sm bg-background px-2 py-1 rounded border text-center min-w-16 sm:min-w-20">
                                                  {isTimeUnit(getCategoryUnit(test.categoryId))
                                                    ? formatTimeValue(result.value)
                                                    : result.value}
                                                </span>
                                                <span className="text-xs sm:text-sm text-muted-foreground min-w-6 sm:min-w-8 text-center">
                                                  {getCategoryUnit(test.categoryId)}
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">No results recorded</p>
                                    )
                                  )}
                                </div>
                              </CardContent>

                              {editingTest?.id === test.id && (
                                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                                  {saving ? (
                                    <div className="text-center py-4">
                                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                                      <p className="text-sm text-muted-foreground">Processing changes...</p>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col sm:flex-row gap-3 justify-center sm:justify-end">
                                      <Button
                                        onClick={saveEditedTest}
                                        disabled={saving}
                                        size="sm"
                                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white h-10 px-4 dark:bg-green-700 dark:hover:bg-green-600"
                                      >
                                        <Check className="h-4 w-4" />
                                        <span className="text-sm font-medium">
                                          {saving ? 'Saving...' : 'Save Changes'}
                                        </span>
                                      </Button>
                                      <Button
                                        onClick={() => deleteTest(test)}
                                        disabled={saving}
                                        size="sm"
                                        variant="destructive"
                                        className="flex items-center gap-2 h-10 px-4"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        <span className="text-sm font-medium">
                                          {saving ? 'Deleting...' : 'Delete Test'}
                                        </span>
                                      </Button>
                                      <Button
                                        variant="outline"
                                        onClick={cancelEditing}
                                        disabled={saving}
                                        size="sm"
                                        className="flex items-center gap-2 border-gray-300 text-gray-600 hover:bg-gray-50 h-10 px-4 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                                      >
                                        <X className="h-4 w-4" />
                                        <span className="text-sm font-medium">Cancel</span>
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </Card>
                      )
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Testing;
