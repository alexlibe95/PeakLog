import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { performanceCategoryService } from '@/services/performanceCategoryService';
import { athletePerformanceService } from '@/services/athletePerformanceService';
import { useToast } from '@/components/ui/toast-context';
import Navigation from '@/components/Navigation';
import { Plus, Edit, Trash2, Target } from 'lucide-react';

// Static unit options for performance categories
const UNIT_OPTIONS = [
  // Time units (lower is better)
  { value: 'seconds', label: 'Seconds', type: 'time' },
  { value: 'minutes', label: 'Minutes', type: 'time' },
  { value: 'hours', label: 'Hours', type: 'time' },
  { value: 'milliseconds', label: 'Milliseconds', type: 'time' },

  // Weight units (higher is better)
  { value: 'kg', label: 'Kilograms (kg)', type: 'weight' },
  { value: 'lbs', label: 'Pounds (lbs)', type: 'weight' },
  { value: 'g', label: 'Grams (g)', type: 'weight' },
  { value: 'tonnes', label: 'Tonnes', type: 'weight' },

  // Distance units (higher is better)
  { value: 'm', label: 'Meters (m)', type: 'distance' },
  { value: 'km', label: 'Kilometers (km)', type: 'distance' },
  { value: 'miles', label: 'Miles', type: 'distance' },
  { value: 'feet', label: 'Feet', type: 'distance' },
  { value: 'yards', label: 'Yards', type: 'distance' },

  // Count units (higher is better)
  { value: 'reps', label: 'Repetitions', type: 'count' },
  { value: 'sets', label: 'Sets', type: 'count' },
  { value: 'times', label: 'Times', type: 'count' },

  // Points/score units (higher is better)
  { value: 'points', label: 'Points', type: 'points' },
  { value: 'pts', label: 'Points (pts)', type: 'points' },
  { value: 'score', label: 'Score', type: 'points' },
  { value: 'marks', label: 'Marks', type: 'points' }
];

const CategoryManagement = () => {
  const { currentClubId } = useAuth();
  const { toast } = useToast();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    unit: ''
  });

  // Get admin memberships
  const effectiveClubId = currentClubId;

  // Load categories
  const loadCategories = useCallback(async () => {
    if (!effectiveClubId) return;

    setLoading(true);
    try {
      const clubCategories = await performanceCategoryService.getClubCategories(effectiveClubId);
      setCategories(clubCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast({
        title: 'Error loading categories',
        description: 'Failed to load performance categories',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [effectiveClubId, toast]);

  useEffect(() => {
    if (effectiveClubId) {
      loadCategories();
    }
  }, [effectiveClubId, loadCategories]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!effectiveClubId || !formData.name.trim()) return;

    setSaving(true);
    try {
      if (editingCategory) {
        await performanceCategoryService.updateCategory(editingCategory.id, formData);
        toast({
          title: 'Category updated successfully',
          description: `"${formData.name}" has been updated`
        });
      } else {
        await performanceCategoryService.createCategory(effectiveClubId, formData);
        toast({
          title: 'Category created successfully',
          description: `"${formData.name}" has been added to your categories`
        });
      }

      await loadCategories();
      setDialogOpen(false);
      setEditingCategory(null);
      setFormData({ name: '', description: '', unit: '' });
    } catch (error) {
      console.error('Error saving category:', error);
      toast({
        title: `Error ${editingCategory ? 'updating' : 'creating'} category`,
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle category deletion
  const handleDelete = async (categoryId) => {
    setSaving(true);
    try {
      // Delete performance data first (records and goals)
      await athletePerformanceService.deleteCategoryPerformanceData(categoryId, effectiveClubId);

      // Delete the category itself
      await performanceCategoryService.deleteCategory(categoryId);

      await loadCategories();
      toast({
        title: 'Category deleted successfully',
        description: 'The category and all related personal records and goals have been removed'
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: 'Error deleting category',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Open dialog for creating/editing
  const openDialog = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || '',
        unit: category.unit || ''
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: '', description: '', unit: '' });
    }
    setDialogOpen(true);
  };

  // Close dialog
  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCategory(null);
    setFormData({ name: '', description: '', unit: '' });
  };



  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold">Category Management</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                Manage performance categories for testing and athlete tracking
              </p>
            </div>
            <div className="flex justify-center sm:justify-end">
              <Button onClick={() => openDialog()} className="flex items-center gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Add Category
              </Button>
            </div>
          </div>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {loading ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Loading categories...</p>
              </div>
            </div>
          ) : categories.length === 0 ? (
            <div className="col-span-full">
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 px-4">
                  <Target className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                  <h3 className="text-base sm:text-lg font-semibold mb-2">No Categories Yet</h3>
                  <p className="text-sm sm:text-base text-muted-foreground text-center mb-4 max-w-md">
                    Create your first performance category to start tracking athlete performance
                  </p>
                  <Button onClick={() => openDialog()} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Category
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            categories.map((category) => {
              return (
                <Card key={category.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base sm:text-lg truncate">{category.name}</CardTitle>
                        {category.unit && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            Unit: {category.unit}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1 self-end sm:self-start">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openDialog(category)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-8 w-8 p-0">
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Category</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{category.name}"? This will permanently remove:
                                <ul className="list-disc list-inside mt-2 space-y-1">
                                  <li>The category itself</li>
                                  <li>All athlete personal records in this category</li>
                                  <li>All goals related to this category</li>
                                  <li>All test results for this category</li>
                                </ul>
                                <strong>Note:</strong> Personal records and goals will be soft-deleted (marked as inactive) but can be restored if needed. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(category.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete Category
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {category.description && (
                      <p className="text-sm text-muted-foreground">
                        {category.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md mx-4">
            <form onSubmit={handleSubmit}>
              <DialogHeader className="pb-6">
                <DialogTitle>
                  {editingCategory ? 'Edit Category' : 'Create New Category'}
                </DialogTitle>
                <DialogDescription>
                  {editingCategory
                    ? 'Update the category details below'
                    : 'Add a new performance category for tracking athlete results'
                  }
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2 pb-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Category Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., 100m Sprint, Bench Press, Pull-ups"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit">Unit (optional)</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose the appropriate unit for measuring performance in this category.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what this category measures..."
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:gap-3 pt-6">
                <Button type="button" variant="outline" onClick={closeDialog} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || !formData.name.trim()} className="w-full sm:w-auto">
                  {saving ? 'Saving...' : (editingCategory ? 'Update Category' : 'Create Category')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CategoryManagement;
