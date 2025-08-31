import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const performanceCategoryService = {
  // Create a new performance category for a club
  async createCategory(clubId, categoryData) {
    try {
      if (!clubId) {
        throw new Error('Club ID is required');
      }
      if (!categoryData.name || !categoryData.name.trim()) {
        throw new Error('Category name is required');
      }

      console.log('🔧 Creating category in Firebase:', { clubId, categoryData });
      
      const categoryRef = doc(collection(db, 'performanceCategories'));
      const category = {
        id: categoryRef.id,
        clubId,
        name: categoryData.name.trim(),
        description: categoryData.description || '',
        unit: categoryData.unit || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true
      };

      await setDoc(categoryRef, category);
      console.log('✅ Performance category created successfully:', category);
      return category;
    } catch (error) {
      console.error('❌ Error creating performance category:', error);
      throw new Error(`Failed to create category: ${error.message}`);
    }
  },

  // Get all performance categories for a club
  async getClubCategories(clubId) {
    try {
      if (!clubId) {
        throw new Error('Club ID is required');
      }

      console.log('🔍 Fetching categories for club:', clubId);
      
      const categoriesQuery = query(
        collection(db, 'performanceCategories'),
        where('clubId', '==', clubId),
        where('isActive', '==', true)
      );

      const categoriesSnap = await getDocs(categoriesQuery);
      console.log('📊 Query result:', categoriesSnap.size, 'categories found');
      
      const categories = categoriesSnap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      console.log('📋 Categories loaded:', categories);
      
      // Sort client-side to avoid needing a Firestore index
      return categories.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('❌ Error fetching performance categories:', error);
      throw new Error(`Failed to load categories: ${error.message}`);
    }
  },

  // Get a specific category by ID
  async getCategory(categoryId) {
    try {
      const categoryRef = doc(db, 'performanceCategories', categoryId);
      const categorySnap = await getDoc(categoryRef);
      
      if (categorySnap.exists()) {
        return { id: categorySnap.id, ...categorySnap.data() };
      } else {
        throw new Error(`Category not found: ${categoryId}`);
      }
    } catch (error) {
      console.error('❌ Error fetching category:', error);
      throw error;
    }
  },

  // Update a performance category
  async updateCategory(categoryId, categoryData) {
    try {
      const categoryRef = doc(db, 'performanceCategories', categoryId);
      const updatedData = {
        ...categoryData,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(categoryRef, updatedData);
      console.log('✅ Performance category updated successfully:', categoryData.name);
      return updatedData;
    } catch (error) {
      console.error('❌ Error updating performance category:', error);
      throw error;
    }
  },

  // Delete a performance category (soft delete)
  async deleteCategory(categoryId) {
    try {
      const batch = writeBatch(db);

      // Soft delete the category
      const categoryRef = doc(db, 'performanceCategories', categoryId);
      batch.update(categoryRef, {
        isActive: false,
        updatedAt: new Date().toISOString()
      });

      // Also soft delete all related records and goals
      const [recordsQuery, goalsQuery] = await Promise.all([
        getDocs(query(
          collection(db, 'athleteRecords'),
          where('categoryId', '==', categoryId)
        )),
        getDocs(query(
          collection(db, 'athleteGoals'),
          where('categoryId', '==', categoryId)
        ))
      ]);

      // Soft delete records
      recordsQuery.docs.forEach(recordDoc => {
        batch.update(recordDoc.ref, {
          isActive: false,
          updatedAt: new Date().toISOString()
        });
      });

      // Soft delete goals
      goalsQuery.docs.forEach(goalDoc => {
        batch.update(goalDoc.ref, {
          isActive: false,
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit();
      console.log('✅ Performance category and related data deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting performance category:', error);
      throw error;
    }
  },

  // Check if category name exists in club
  async categoryNameExists(clubId, name, excludeId = null) {
    try {
      const lowered = name.trim().toLowerCase();
      if (!lowered) return false;

      const categoriesQuery = query(
        collection(db, 'performanceCategories'),
        where('clubId', '==', clubId),
        where('isActive', '==', true)
      );

      const categoriesSnap = await getDocs(categoriesQuery);
      
      return categoriesSnap.docs.some(doc => {
        const categoryData = doc.data();
        const categoryNameLower = categoryData.name?.toLowerCase();
        return categoryNameLower === lowered && doc.id !== excludeId;
      });
    } catch (error) {
      console.error('❌ Error checking category name existence:', error);
      throw error;
    }
  },

  // Get categories with usage statistics
  async getCategoriesWithStats(clubId) {
    try {
      const categories = await this.getClubCategories(clubId);
      const categoriesWithStats = [];

      for (const category of categories) {
        try {
          // Get record count
          const recordsQuery = query(
            collection(db, 'athleteRecords'),
            where('categoryId', '==', category.id),
            where('isActive', '==', true)
          );
          const recordsSnap = await getDocs(recordsQuery);
          const recordCount = recordsSnap.size;

          // Get goal count
          const goalsQuery = query(
            collection(db, 'athleteGoals'),
            where('categoryId', '==', category.id),
            where('isActive', '==', true)
          );
          const goalsSnap = await getDocs(goalsQuery);
          const goalCount = goalsSnap.size;

          categoriesWithStats.push({
            ...category,
            recordCount,
            goalCount,
            totalUsage: recordCount + goalCount
          });
        } catch (statError) {
          console.error(`Error getting stats for category ${category.id}:`, statError);
          categoriesWithStats.push({
            ...category,
            recordCount: 0,
            goalCount: 0,
            totalUsage: 0
          });
        }
      }

      return categoriesWithStats;
    } catch (error) {
      console.error('❌ Error fetching categories with stats:', error);
      throw error;
    }
  }
};
