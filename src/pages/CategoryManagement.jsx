import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { performanceCategoryService } from '@/services/performanceCategoryService';
import { useToast } from '@/components/ui/toast-context';
import Navigation from '@/components/Navigation';
import { Plus, Edit, Trash2, Target } from 'lucide-react';

const CategoryManagement = () => {
  const { user, currentClubId, memberships } = useAuth();
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
  const adminMemberships = (memberships || []).filter(m => m.role === 'admin');
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
        const newCategory = await performanceCategoryService.createCategory(effectiveClubId, formData);
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
      await performanceCategoryService.deleteCategory(categoryId);
      await loadCategories();
      toast({
        title: 'Category deleted successfully',
        description: 'The category and all related data have been removed'
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
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Category Management</h1>
              <p className="text-muted-foreground">
                Manage performance categories for testing and athlete tracking
              </p>
            </div>
            <Button onClick={() => openDialog()} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          </div>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Target className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Categories Yet</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Create your first performance category to start tracking athlete performance
                  </p>
                  <Button onClick={() => openDialog()}>
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
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-lg truncate">{category.name}</CardTitle>
                        {category.unit && (
                          <Badge variant="outline" className="mt-1">
                            Unit: {category.unit}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openDialog(category)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Category</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{category.name}"? This will permanently remove:
                                <ul className="list-disc list-inside mt-2 space-y-1">
                                  <li>All athlete records in this category</li>
                                  <li>All goals related to this category</li>
                                  <li>All test results for this category</li>
                                </ul>
                                This action cannot be undone.
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
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
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

              <div className="space-y-4 py-4">
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
                  <Input
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="e.g., seconds, kg, reps, points"
                  />
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

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || !formData.name.trim()}>
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
